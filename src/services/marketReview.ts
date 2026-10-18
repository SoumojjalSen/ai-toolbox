import { loadStockSignals, type BhavcopyRow } from "./marketScan.js"
import { scorePick, buildTrackRecord, type ReportPick } from "./scorecard.js"
import { readHoldings } from "./holdings.js"
import { readJson, listJson, todayIst, nseDate } from "./marketStore.js"
import type { MoverAlert, MoveLabel } from "./marketAlert.js"
import { convertMarkdownToEmailHtml } from "../formats.js"

// Evening scorecard (~19:30, after NSE publishes the day's bhavcopy) — code only. Checks today's report picks,
// the running track record, and whether the market-check labels ("likely to fade", "news-backed"…) were right,
// so the rules get kept or changed on evidence.

const MISSED_MOVE_PERCENT = 7
const MISSED_MIN_TURNOVER_LACS = 1000 // ₹10 cr

interface AlertRun { time: string; rows: { symbol: string; price: number; changePercent: number; label: MoveLabel }[] }

const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
const dayChange = (bar: BhavcopyRow) => ((bar.close - bar.prevClose) / bar.prevClose) * 100

// A label is right when the close agrees with it: fade → the move shrank by more than a quarter or reversed
export function labelWasRight(label: MoveLabel, alertChange: number, closeChange: number): boolean | undefined {
  const held = Math.sign(closeChange) === Math.sign(alertChange) && Math.abs(closeChange) >= 0.75 * Math.abs(alertChange)
  if (label === "likely to fade") return !held
  if (label === "news-backed" || label === "bad news, may continue") return held
  return undefined // "falling, no news found" and "not a real move" make no prediction
}

export async function buildEveningScorecard(): Promise<MoverAlert> {
  const [{ sessionDates, sessions }, holdings] = await Promise.all([loadStockSignals(), readHoldings()])
  const today = nseDate()
  if (sessionDates.at(-1) !== today) return { count: 0, subject: "", html: "" } // holiday, or the bhavcopy isn't out yet
  const barsOn = (index: number) => new Map(sessions[index].map((row) => [row.symbol, row]))
  const todayBars = barsOn(sessions.length - 1)
  const sessionIndexOf = (isoDate: string) => sessionDates.indexOf(nseDate(new Date(`${isoDate}T12:00:00+05:30`)))
  const sections: string[] = []

  // 1. today's report picks
  const todaysPicks = (await readJson<ReportPick[]>(`report-picks/${todayIst()}.json`)) ?? []
  if (todaysPicks.length) {
    sections.push("## Today's report picks", "| Stock | Open → close | vs entry | Result |", "|---|---|---|---|",
      ...todaysPicks.map((pick) => {
        const bar = todayBars.get(pick.symbol)
        if (!bar) return `| ${pick.symbol} | — | — | no data |`
        const risk = pick.entry - pick.stopLoss
        const skipAbove = pick.entry + 0.5 * risk
        const result = bar.low > skipAbove ? "skipped — never came back into the buy zone"
          : bar.low <= pick.stopLoss ? "🔴 stop loss hit" : bar.high >= pick.target ? "🟢 target hit" : `open trade, ${((bar.close - pick.entry) / risk >= 0 ? "+" : "")}${((bar.close - pick.entry) / risk).toFixed(2)}R`
        return `| ${pick.symbol} | ₹${bar.open} → ₹${bar.close} (${sign(dayChange(bar))}) | entry ₹${pick.entry} | ${result} |`
      }))
  }

  // 2. track record of every report pick so far (bought on its report day, same rules as the backtest)
  let closed = 0, wins = 0, totalR = 0, open = 0, notEntered = 0
  for (const file of await listJson("report-picks")) {
    const index = sessionIndexOf(file.replace(/\.json$/, ""))
    if (index < 0) continue
    for (const pick of (await readJson<ReportPick[]>(`report-picks/${file}`)) ?? []) {
      const laterBars = sessions.slice(index).map((session) => session.find((row) => row.symbol === pick.symbol)).filter((row): row is BhavcopyRow => !!row)
      const outcome = scorePick({ ...pick, rsRank: 0, lenses: [], regime: "" }, laterBars)
      if (outcome.status === "open") open++
      else if (outcome.status === "not entered") notEntered++
      else { closed++; totalR += outcome.r; wins += outcome.status === "target" ? 1 : 0 }
    }
  }
  sections.push("## Track record — report picks",
    closed ? `${closed} closed · ${Math.round((wins / closed) * 100)}% hit target · avg ${(totalR / closed).toFixed(2)}R · total ${totalR.toFixed(1)}R · ${open} still open · ${notEntered} skipped (gapped above the buy zone)`
      : `No closed trades yet — ${open} open, ${notEntered} skipped. Trades last up to ~6 weeks.`)
  const codeRecord = await buildTrackRecord(sessionDates, sessions)
  if (codeRecord) sections.push(codeRecord.replace(/^### .*$/m, "## Track record — top code setups (all lenses)"))

  // 3. were the market-check labels right? today, and over every saved day
  const tally = new Map<MoveLabel, { right: number; total: number }>()
  const todayRows: string[] = []
  const alertedToday = new Set<string>()
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
          todayRows.push(`| ${row.symbol} | ${run.time}: ${sign(row.changePercent)} | close ${sign(dayChange(bar))} | ${row.label} | ${right === undefined ? "—" : right ? "✅ right" : "❌ wrong"} |`)
        }
      }
    }
  }
  if (todayRows.length) sections.push("## Market-check movers — how they closed", "| Stock | Alerted | Close | Label | Label right? |", "|---|---|---|---|---|", ...todayRows)
  if (tally.size) sections.push("## Label accuracy so far", ...[...tally].map(([label, { right, total }]) => `- **${label}**: right ${right}/${total} (${Math.round((right / total) * 100)}%)`))

  // 4. big moves the market check missed
  const missed = [...todayBars.values()]
    .filter((bar) => bar.turnoverLacs >= MISSED_MIN_TURNOVER_LACS && Math.abs(dayChange(bar)) >= MISSED_MOVE_PERCENT && !alertedToday.has(bar.symbol))
    .sort((a, b) => Math.abs(dayChange(b)) - Math.abs(dayChange(a))).slice(0, 12)
  if (missed.length) sections.push(`## Big moves the market check missed (≥${MISSED_MOVE_PERCENT}%, ≥₹10 cr traded)`, missed.map((bar) => `${bar.symbol} ${sign(dayChange(bar))} (opened ${sign(((bar.open - bar.prevClose) / bar.prevClose) * 100)})`).join(", "))

  // 5. holdings today
  const holdingBars = [...holdings.symbols].map((symbol) => todayBars.get(symbol)).filter((bar): bar is BhavcopyRow => !!bar)
  if (holdingBars.length) sections.push("## Your holdings today", holdingBars.sort((a, b) => dayChange(b) - dayChange(a)).map((bar) => `${bar.symbol} ${sign(dayChange(bar))}`).join(" · "))

  const markdown = [`# Scorecard — ${today}`, ...sections].join("\n\n")
  return { count: sections.length, subject: `🧾 Scorecard — ${today}`, html: convertMarkdownToEmailHtml(markdown) }
}
