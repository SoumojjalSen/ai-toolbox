// Overnight company news: a material NSE filing made after one close and before the next open (an acquisition, an
// order win, a fund raise…). Can it be bought at that open — the price the 9:09 pre-open check sees — and does it pay?
// Every liquid stock, every filing, grouped by filing type, by how much the stock opened up (the pre-open gap) and by
// market type; judged on period 1, confirmed on period 2, after costs. Needs download.ts's filings.json.gz and
// run.ts's trades.json.gz (for each session's market type).
// Run: NODE_OPTIONS=--max-old-space-size=8192 npx tsx src/backtest/news-run.ts
import { writeFile } from "fs/promises"
import { join } from "path"
import { computeStockSignal } from "../services/market/scan.js"
import { gapBucket, GAP_BUCKETS, NEWS_HOLD_SESSIONS, type Board } from "../services/market/strategies.js"
import type { EventKind } from "../services/market/lenses.js"
import { simulateTrade, type TradeResult } from "./simulate.js"
import { loadHistory, parseNseTimestamp } from "./history.js"
import { HISTORY_DIR, readGz } from "./download.js"
import { SIGNALS_FROM, CONFIRM_FROM } from "./run.js"

const SIGNAL_WINDOW = 220
const MIN_TURNOVER_LAKHS: Record<Board, number> = { main: 50, sme: 10 }
const SWING_COST_PERCENT: Record<Board, number> = { main: 0.25, sme: 0.5 }
const INTRADAY_COST_PERCENT: Record<Board, number> = { main: 0.15, sme: 0.3 }
const KEEP_MIN_TRADES = 30
const KEEP_MIN_AVERAGE_R = 0.05
const OPEN_MS = 6.25 * 3_600_000 // 09:15 is 6¼ hours before the 15:30 close

interface FilingRow { symbol: string; filedAt: string; kind: EventKind; headline: string }
interface Tally { trades: number; wins: number; totalR: number; skipped: number; dayOneReturn: number }
const emptyTally = (): Tally => ({ trades: 0, wins: 0, totalR: 0, skipped: 0, dayOneReturn: 0 })
function add(tally: Tally, result: TradeResult, dayOneReturn: number) {
  if (result.kind !== "closed") { tally.skipped++; return }
  tally.trades++
  tally.totalR += result.r
  tally.dayOneReturn += dayOneReturn
  if (result.r > 0) tally.wins++
}

async function main() {
  const history = await loadHistory()
  const { days, closeTimes, stocks } = history
  const regimeOf = new Map<string, string>()
  for (const trade of JSON.parse(await readGz("backtest/trades.json.gz")) as { signalDay: string; regime: string }[]) regimeOf.set(trade.signalDay, trade.regime)

  // filings by symbol, filed outside market hours: after close d and before open d+1 → signal day d
  const filingsBySymbol = new Map<string, { time: number; kind: EventKind }[]>()
  for (const filing of JSON.parse(await readGz("filings.json.gz")) as FilingRow[]) {
    if (filing.kind === "results date" || filing.kind === "results") continue // results have their own rules
    const time = parseNseTimestamp(filing.filedAt)
    if (Number.isFinite(time)) filingsBySymbol.set(filing.symbol, [...(filingsBySymbol.get(filing.symbol) ?? []), { time, kind: filing.kind }])
  }

  // key: `${style}|${kind}|${gap}|${regime}|${period}`
  const tallies = new Map<string, Tally>()
  const tally = (key: string) => tallies.get(key) ?? tallies.set(key, emptyTally()).get(key)!
  const start = days.findIndex((day) => day >= SIGNALS_FROM)
  const rows: string[] = []
  for (const stock of stocks.values()) {
    const filings = filingsBySymbol.get(stock.symbol)
    if (!filings) continue
    for (let index = 0; index + 1 < stock.bars.length; index++) {
      const day = stock.dayIndex[index]
      if (day < start || stock.dayIndex[index + 1] !== day + 1) continue // the next session must be the next market day
      const nextOpen = closeTimes[day + 1] - OPEN_MS
      const kinds = [...new Set(filings.filter((filing) => filing.time > closeTimes[day] && filing.time < nextOpen).map((filing) => filing.kind))]
      if (!kinds.length) continue
      const signal = computeStockSignal(stock.bars.slice(Math.max(0, index - SIGNAL_WINDOW + 1), index + 1), MIN_TURNOVER_LAKHS[stock.board])
      if (!signal) continue // illiquid
      const next = stock.bars[index + 1]
      const gapPercent = (next.open / stock.bars[index].close - 1) * 100
      const gap = gapBucket(gapPercent)
      const regime = regimeOf.get(days[day]) ?? "unknown"
      const period = days[day] < CONFIRM_FROM ? "1 set" : "2 confirm"
      const dayOneReturn = (next.close / next.open - 1) * 100
      // the acquisition-news plan (strategies.ts), applied to every filing type
      const swing = simulateTrade(stock.bars, index, { strategy: "acquisition-news", risk: 2 * signal.averageDailyRange, reward: 3, holdSessions: NEWS_HOLD_SESSIONS, buyAtAnyOpen: true }, SWING_COST_PERCENT[stock.board])
      const intraday = simulateTrade(stock.bars, index, { strategy: "acquisition-news", risk: 0.5 * signal.averageDailyRange, reward: Infinity, holdSessions: 0, buyAtAnyOpen: true }, INTRADAY_COST_PERCENT[stock.board])
      for (const kind of [...kinds, "any"]) {
        for (const [style, result] of [["swing", swing], ["intraday", intraday]] as const) {
          for (const regimeKey of [regime, "all"]) {
            add(tally(`${style}|${stock.board}|${kind}|${gap}|${regimeKey}|${period}`), result, dayOneReturn)
            add(tally(`${style}|${stock.board}|${kind}|all gaps|${regimeKey}|${period}`), result, dayOneReturn)
          }
        }
      }
      rows.push([stock.symbol, stock.board, days[day], kinds.join("+"), gapPercent.toFixed(1), regime, dayOneReturn.toFixed(1), swing.kind === "closed" ? swing.r.toFixed(2) : swing.kind].join(","))
    }
  }

  const fmt = (value: number, digits = 2) => (value >= 0 ? "+" : "") + value.toFixed(digits)
  const cell = (key: string) => {
    const t = tallies.get(key)
    return t?.trades ? `${t.trades} · ${fmt(t.totalR / t.trades)}R · ${((t.wins / t.trades) * 100).toFixed(0)}% · day 1 ${fmt(t.dayOneReturn / t.trades, 1)}%` : "–"
  }
  const passes = (key: string) => {
    const one = tallies.get(`${key}|1 set`)
    const two = tallies.get(`${key}|2 confirm`)
    return !!one && one.trades >= KEEP_MIN_TRADES && one.totalR / one.trades >= KEEP_MIN_AVERAGE_R && !!two && two.trades >= 10 && two.totalR > 0
  }
  const kindsSeen = [...new Set([...tallies.keys()].map((key) => key.split("|")[2]))].sort()
  const sections: string[] = []
  const kept: string[] = []
  for (const style of ["swing", "intraday"]) for (const board of ["main", "sme"]) {
    sections.push(`## ${style === "swing" ? `Swing (2× daily range stop, 3R target, hold ${NEWS_HOLD_SESSIONS} sessions)` : "Intraday (buy the open, sell the close; 0.5× daily range stop)"} — ${board} board`, "")
    sections.push("Each cell: trades · average R after costs · win rate · average open→close move on day 1. ✅ = kept (period 1: ≥ 30 trades and ≥ +0.05R a trade; period 2: ≥ 10 trades and positive in total).", "")
    sections.push("| Filing type | Gap at the open | Market | Period 1 (set) | Period 2 (confirm) | |", "|---|---|---|---|---|---|")
    for (const kind of kindsSeen) for (const gap of [...GAP_BUCKETS.map((bucket) => bucket.label), "all gaps"]) for (const regime of ["strong", "neutral", "weak", "all"]) {
      const key = `${style}|${board}|${kind}|${gap}|${regime}`
      if (!tallies.has(`${key}|1 set`) && !tallies.has(`${key}|2 confirm`)) continue
      const ok = passes(key)
      if (ok && gap !== "all gaps" && regime !== "all" && kind !== "any") kept.push(key)
      sections.push(`| ${kind} | ${gap} | ${regime} | ${cell(`${key}|1 set`)} | ${cell(`${key}|2 confirm`)} | ${ok ? "✅" : ""} |`)
    }
    sections.push("")
  }
  const report = [
    `# Overnight company news — bought at the next open (${SIGNALS_FROM} → ${days[days.length - 1]})`,
    "",
    "A material NSE filing (lenses.ts's classifier: acquisition, order, fund raise, rating change, regulatory action…; results are excluded — they have their own rules) made after a session's close and before the next open, on a stock liquid enough to scan. Bought at that open, which is the price the 9:09 pre-open check shows; no buy limit, since the news is the reason for the gap. Period 1 sets which cells are kept; period 2 confirms them.",
    "",
    `**Kept cells (filing type · gap · market type):** ${kept.length ? kept.map((key) => key.split("|").slice(0, 5).join(" · ")).join("; ") : "none"}`,
    "",
    ...sections,
    "Every case: `backtest/news-overnight.csv` (symbol, board, signal day, filing types, gap %, market type, day-1 open→close %, swing R).",
  ].join("\n")
  await writeFile(join(HISTORY_DIR, "backtest", "news-overnight.md"), report)
  await writeFile(join(HISTORY_DIR, "backtest", "news-overnight.csv"), ["symbol,board,signalDay,kinds,gapPercent,regime,dayOnePercent,swingR", ...rows].join("\n"))
  console.log(report.split("\n").slice(0, 6).join("\n"))
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
