import { loadStockSignals, type DailyPriceRow } from "./scan.js"
import { scorePick, buildTrackRecord, type ReportPick, type Finding } from "./scorecard.js"
import { readHoldings } from "./holdings.js"
import { fetchFilingHistory } from "./lenses.js"
import { fetchNseJson } from "./nse.js"
import { STRONG_QIB, type IpoCallRecord } from "./ipo.js"
import { readJson, listJson, todayIst, nseDate } from "./store.js"
import type { MoverAlert, MoveLabel } from "./alert.js"
import { convertMarkdownToEmailHtml, markdownTable, tableCell } from "../../formats.js"

// Evening scorecard (~19:30, after NSE publishes the day's price file) — code only. Today's picks, the running
// track record, whether the market-check labels were right, and a system check that flags the day's mistakes
// (a pick that failed fast on news the check should have read, a stock re-picked after a drop, IPO calls vs the
// final numbers and the listing, data NSE didn't return) — so problems show up the same evening.

const MISSED_MOVE_PERCENT = 7
const MISSED_MIN_TURNOVER_LAKHS = 1000 // ₹10 cr
const FAST_FAILURE_PERCENT = -5 // a pick down this much within 2 sessions of its report
const RECHECK_DAYS = 14

interface AlertRun { time: string; rows: { symbol: string; price: number; changePercent: number; label: MoveLabel; why?: string }[] }

const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
const dayChange = (bar: DailyPriceRow) => ((bar.close - bar.prevClose) / bar.prevClose) * 100
const daysAgo = (isoDate: string) => (Date.now() - new Date(`${isoDate}T00:00:00+05:30`).getTime()) / 86_400_000

// A label is right when the close agrees with it: fade → the move shrank by more than a quarter or reversed
export function labelWasRight(label: MoveLabel, alertChange: number, closeChange: number): boolean | undefined {
  const held = Math.sign(closeChange) === Math.sign(alertChange) && Math.abs(closeChange) >= 0.75 * Math.abs(alertChange)
  if (label === "likely to fade") return !held
  if (label === "news-backed" || label === "bad news, may continue") return held
  return undefined // "no news found" and "not a real move" make no prediction
}

async function buildSystemCheck(sessionDates: string[], sessions: DailyPriceRow[][], sessionIndexOf: (isoDate: string) => number): Promise<string[]> {
  const checks: string[] = []
  const lastIndex = sessions.length - 1
  const barOf = (index: number, symbol: string) => sessions[index]?.find((row) => row.symbol === symbol)

  // 1. picks that fell ≥5% within 2 sessions — was there a filing before the pick that the news check missed?
  // Falls with no filing behind them are usually the market (on a weak day most picks fall) — one line, not a card each.
  const marketFalls = new Map<string, number>() // symbol → worst fall (a stock picked on two days is listed once)
  for (const file of await listJson("report-picks")) {
    const pickedOn = file.replace(/\.json$/, "")
    const index = sessionIndexOf(pickedOn)
    if (index < 0 || lastIndex - index > 1) continue
    for (const pick of (await readJson<ReportPick[]>(`report-picks/${file}`)) ?? []) {
      const lows = [index, index + 1].map((i) => barOf(i, pick.symbol)?.low).filter((low): low is number => low !== undefined)
      if (!lows.length) continue
      const worst = ((Math.min(...lows) - pick.entry) / pick.entry) * 100
      if (worst > FAST_FAILURE_PERCENT) continue
      const pickTime = new Date(`${pickedOn}T08:00:00+05:30`)
      const filings = ((await fetchFilingHistory(pick.symbol, pickTime, 10)) ?? []).slice(0, 3)
      if (!filings.length) { marketFalls.set(pick.symbol, Math.min(worst, marketFalls.get(pick.symbol) ?? 0)); continue }
      checks.push(`| 🔴 **${pick.symbol}** picked ${pickedOn} | fell ${sign(worst)} vs entry within 2 sessions | filed before the pick: ${filings.map((filing) => `${filing.time.slice(0, 11)} ${filing.kind}: ${tableCell(filing.headline.slice(0, 60))}${filing.link ? ` [NSE](${filing.link})` : ""}`).join("; ")} — did the news check read it? |`)
    }
  }
  if (marketFalls.size) checks.push(`| **${marketFalls.size} picks fell with the market** | ${[...marketFalls].map(([symbol, fall]) => `${symbol} ${sign(fall)}`).join(", ")} | no NSE filing before them — a market or sector fall, not a missed check |`)

  // 2. stocks picked today that an earlier check dropped — the report must have said why it changed its mind
  const todaysPicks = (await readJson<ReportPick[]>(`report-picks/${todayIst()}.json`)) ?? []
  const todaysFindings = new Map(((await readJson<Finding[]>(`findings/${todayIst()}.json`)) ?? []).map((finding) => [finding.symbol, finding]))
  for (const file of await listJson("findings")) {
    const date = file.replace(/\.json$/, "")
    if (date === todayIst() || daysAgo(date) > RECHECK_DAYS) continue
    for (const finding of (await readJson<Finding[]>(`findings/${file}`)) ?? []) {
      if (!/drop|exit/i.test(finding.verdict) || !todaysPicks.some((pick) => pick.symbol === finding.symbol)) continue
      checks.push(`| ⚠️ **${finding.symbol}** re-picked | dropped ${date}: ${tableCell(finding.findings)} | today: ${tableCell(todaysFindings.get(finding.symbol)?.findings ?? "no reason recorded — check the report")} |`)
    }
  }

  // 3. IPO calls today vs the final QIB, and IPOs listing today vs the issue price
  const finalCalls = (await readJson<IpoCallRecord[]>(`ipo-calls/${todayIst()}-final.json`)) ?? []
  for (const file of (await listJson("ipo-calls")).filter((name) => name.startsWith(todayIst()) && !name.includes("final"))) {
    for (const early of (await readJson<IpoCallRecord[]>(`ipo-calls/${file}`)) ?? []) {
      const final = finalCalls.find((call) => call.symbol === early.symbol)
      checks.push(`| **IPO ${early.name.replace(/ Limited$/, "")}** | ${early.time}: ${early.call} (QIB ${early.qib?.toFixed(1) ?? "?"}×) | final: ${final ? `${final.call} (QIB ${final.qib?.toFixed(1) ?? "?"}×)` : "no 16:15 call recorded"} |`)
    }
  }
  const listedToday = [...new Map(sessions[lastIndex].map((row) => [row.symbol, row])).values()].filter((row) => !barOf(lastIndex - 1, row.symbol))
  if (listedToday.length) {
    const past = (await fetchNseJson<{ symbol: string; issuePrice: string }[]>("public-past-issues")) ?? []
    const calls = new Map<string, IpoCallRecord>()
    for (const file of await listJson("ipo-calls")) {
      if (daysAgo(file.slice(0, 10)) > 10) continue
      for (const call of (await readJson<IpoCallRecord[]>(`ipo-calls/${file}`)) ?? []) calls.set(call.symbol, call) // the final call wins (sorted last)
    }
    for (const row of listedToday) {
      const call = calls.get(row.symbol)
      const issuePrice = Number(past.find((issue) => issue.symbol === row.symbol)?.issuePrice)
      if (!call || !issuePrice) continue
      const gain = ((row.open - issuePrice) / issuePrice) * 100
      const right = (call.call === "keep" || call.call === "apply now") === gain > 0
      checks.push(`| ${right ? "🟢" : "🔴"} **IPO ${call.name.replace(/ Limited$/, "")} listed** | opened ${sign(gain)} vs issue ₹${issuePrice}, closed ${sign(((row.close - issuePrice) / issuePrice) * 100)} | our call: ${call.call} (QIB ${call.qib?.toFixed(1) ?? "?"}× vs the ${STRONG_QIB}× line) — ${right ? "right" : "wrong"} |`)
    }
  }

  // 4. data NSE didn't return this morning
  const gaps = (await readJson<string[]>(`data-gaps/${todayIst()}.json`)) ?? []
  if (gaps.length) checks.push(`| ⚠️ **Data gaps this morning** | ${gaps.join(", ")} | checks depending on these were "not verified" |`)
  return checks
}

export async function buildEveningScorecard(): Promise<MoverAlert> {
  const [{ sessionDates, sessions }, holdings] = await Promise.all([loadStockSignals(), readHoldings()])
  const today = nseDate()
  if (sessionDates.at(-1) !== today) return { count: 0, subject: "", html: "" } // holiday, or the price file isn't out yet
  const barsOn = (index: number) => new Map(sessions[index].map((row) => [row.symbol, row]))
  const todayBars = barsOn(sessions.length - 1)
  const sessionIndexOf = (isoDate: string) => sessionDates.indexOf(nseDate(new Date(`${isoDate}T12:00:00+05:30`)))
  const blocks: string[] = []

  // 1. system check first — it's what needs attention
  const systemCheck = await buildSystemCheck(sessionDates, sessions, sessionIndexOf)
  blocks.push(systemCheck.length ? markdownTable("## System check", "| Check | What happened | Detail |", systemCheck) : "## System check\n\n✅ Nothing flagged today.")

  // 2. today's report picks
  const todaysPicks = (await readJson<ReportPick[]>(`report-picks/${todayIst()}.json`)) ?? []
  if (todaysPicks.length) {
    blocks.push(markdownTable("## Today's report picks", "| Stock | Result | Open → close | Entry |", todaysPicks.map((pick) => {
      const bar = todayBars.get(pick.symbol)
      if (!bar) return `| ${pick.symbol} | no data | — | — |`
      const risk = pick.entry - pick.stopLoss
      const skipAbove = pick.entry + 0.5 * risk
      const resultInR = (bar.close - pick.entry) / risk
      const result = bar.low > skipAbove ? "skipped — never in the buy zone"
        : bar.low <= pick.stopLoss ? "🔴 stop loss hit" : bar.high >= pick.target ? "🟢 target hit" : `${resultInR >= 0 ? "🟢" : "🔴"} open, ${resultInR >= 0 ? "+" : ""}${resultInR.toFixed(2)}R`
      return `| ${result.startsWith("🔴") ? "🔴" : ""}**${pick.symbol}** | ${result} | ₹${bar.open} → ₹${bar.close} (${sign(dayChange(bar))}) | ₹${pick.entry} |`
    })))
  }

  // 3. track record of every report pick so far (bought on its report day, same rules as the backtest)
  let closed = 0, wins = 0, totalR = 0, open = 0, notEntered = 0
  for (const file of await listJson("report-picks")) {
    const index = sessionIndexOf(file.replace(/\.json$/, ""))
    if (index < 0) continue
    for (const pick of (await readJson<ReportPick[]>(`report-picks/${file}`)) ?? []) {
      const laterBars = sessions.slice(index).map((session) => session.find((row) => row.symbol === pick.symbol)).filter((row): row is DailyPriceRow => !!row)
      const outcome = scorePick({ ...pick, relativeStrengthRank: 0, lenses: [], regime: "" }, laterBars)
      if (outcome.status === "open") open++
      else if (outcome.status === "not entered") notEntered++
      else { closed++; totalR += outcome.r; wins += outcome.status === "target" ? 1 : 0 }
    }
  }
  blocks.push(`## Track record — report picks\n\n${closed
    ? `${closed} closed · ${Math.round((wins / closed) * 100)}% hit target · avg ${(totalR / closed).toFixed(2)}R · total ${totalR.toFixed(1)}R · ${open} still open · ${notEntered} skipped (gapped above the buy zone)`
    : `No closed trades yet — ${open} open, ${notEntered} skipped. Trades last up to ~6 weeks.`}`)
  const codeRecord = await buildTrackRecord(sessionDates, sessions)
  if (codeRecord) blocks.push(codeRecord.replace(/^### .*$/m, "## Track record — top code setups (all lenses)").replace(/\n/g, "\n\n"))

  // 4. were the market-check labels right? today, and over every saved day
  const tally = new Map<MoveLabel, { right: number; total: number }>()
  const todayRows: string[] = []
  const alertedToday = new Set<string>()
  let reasonsFound = 0, moversToday = 0
  for (const file of await listJson("alerts")) {
    const index = sessionIndexOf(file.replace(/\.json$/, ""))
    if (index < 0) continue
    const bars = barsOn(index)
    for (const run of (await readJson<AlertRun[]>(`alerts/${file}`)) ?? []) {
      for (const row of run.rows) {
        const bar = bars.get(row.symbol)
        if (!bar) continue
        const right = labelWasRight(row.label, row.changePercent, dayChange(bar))
        if (right !== undefined) {
          const entry = tally.get(row.label) ?? { right: 0, total: 0 }
          tally.set(row.label, { right: entry.right + (right ? 1 : 0), total: entry.total + 1 })
        }
        if (index === sessions.length - 1) {
          alertedToday.add(row.symbol)
          if (row.why !== undefined) moversToday++ // older runs didn't save the reason
          if (row.why && row.why !== "no reason found yet") reasonsFound++
          todayRows.push(`| **${row.symbol}** | ${run.time}: ${sign(row.changePercent)} → close ${sign(dayChange(bar))} | ${row.label}${right === undefined ? "" : right ? " ✅" : " ❌"} |`)
        }
      }
    }
  }
  if (todayRows.length) blocks.push(markdownTable(`## Market-check movers — how they closed${moversToday ? ` (reason found for ${reasonsFound} of ${moversToday})` : ""}`, "| Stock | Alert → close | Label |", todayRows))
  if (tally.size) blocks.push(["## Label accuracy so far", ...[...tally].map(([label, { right, total }]) =>
    `- **${label}**${label === "likely to fade" ? " (retired 21 Oct)" : ""}: right ${right}/${total} (${Math.round((right / total) * 100)}%)`)].join("\n\n"))

  // 5. big moves the market check missed
  const missed = [...todayBars.values()]
    .filter((bar) => bar.turnoverLakhs >= MISSED_MIN_TURNOVER_LAKHS && Math.abs(dayChange(bar)) >= MISSED_MOVE_PERCENT && !alertedToday.has(bar.symbol))
    .sort((a, b) => Math.abs(dayChange(b)) - Math.abs(dayChange(a))).slice(0, 12)
  if (missed.length) blocks.push(`## Big moves the market check missed (≥${MISSED_MOVE_PERCENT}%, ≥₹10 cr traded)\n\n${missed.map((bar) => `${bar.symbol} ${sign(dayChange(bar))} (opened ${sign(((bar.open - bar.prevClose) / bar.prevClose) * 100)})`).join(", ")}`)

  // 6. holdings today
  const holdingBars = [...holdings.symbols].map((symbol) => todayBars.get(symbol)).filter((bar): bar is DailyPriceRow => !!bar)
  if (holdingBars.length) blocks.push(`## Your holdings today\n\n${holdingBars.sort((a, b) => dayChange(b) - dayChange(a)).map((bar) => `${bar.symbol} ${sign(dayChange(bar))}`).join(" · ")}`)

  const markdown = [`# Scorecard — ${today}`, ...blocks].join("\n\n")
  const flagged = systemCheck.length ? ` — ${systemCheck.length} to check` : ""
  return { count: blocks.length, subject: `🧾 Scorecard — ${today}${flagged}`, html: convertMarkdownToEmailHtml(markdown) }
}
