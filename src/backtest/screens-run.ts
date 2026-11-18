// Backtest of popular stock screens (screens.ts) on point-in-time NSE filings: every 21 sessions from Nov 2023,
// buy every main-board stock that passes (equal weight), measure its return over the next 63 / 126 / 252
// sessions, and compare with every liquid main-board stock that had enough filings to be screened.
// Run: NODE_OPTIONS=--max-old-space-size=8192 npx tsx src/backtest/screens-run.ts
import { writeFile } from "fs/promises"
import { join } from "path"
import { parseNseDate } from "../services/market/store.js"
import type { PriceAdjustment } from "../services/market/adjust.js"
import { loadHistory, parseNseTimestamp, type History, type StockHistory } from "./history.js"
import { HISTORY_DIR, readGz } from "./download.js"
import { forwardReturn, SIGNALS_FROM, CONFIRM_FROM } from "./run.js"
import { computeMetrics, SCREENS, type Metrics, type PriceFacts } from "./screens.js"
import type { Filing } from "./fundamentals.js"

const REBALANCE_SESSIONS = 21
const HOLDS = [63, 126, 252]
const MULTIBAGGER_PERCENT = 50 // "big winner": up 50%+ within 252 sessions
const MIN_TURNOVER_LAKHS = 50

interface Pick { day: string; symbol: string; returns: (number | undefined)[]; bigWinner: boolean | undefined }

// The traded (unadjusted) price, so it matches the share count in the filings of that date
function rawPrice(stock: StockHistory, barIndex: number, closeTime: number, factorsAfter: { exTime: number; factor: number }[] | undefined): number {
  const factor = (factorsAfter ?? []).filter((action) => action.exTime > closeTime).reduce((product, action) => product * action.factor, 1)
  return stock.bars[barIndex].close / factor
}

function priceFacts(stock: StockHistory, barIndex: number): PriceFacts | undefined {
  if (barIndex < 126) return undefined
  const year = stock.bars.slice(Math.max(0, barIndex - 251), barIndex + 1)
  const close = stock.bars[barIndex].close
  return { percentFrom52WeekHigh: (close / Math.max(...year.map((bar) => bar.high)) - 1) * 100, return6Months: (close / stock.bars[barIndex - 126].close - 1) * 100 }
}

function bigWinner(stock: StockHistory, barIndex: number, history: History): boolean | undefined {
  if (stock.dayIndex[barIndex] + 252 > history.days.length - 1) return undefined // the window runs past the data
  const later = stock.bars.slice(barIndex + 1, barIndex + 253)
  return later.some((bar) => bar.close >= stock.bars[barIndex].close * (1 + MULTIBAGGER_PERCENT / 100))
}

async function main() {
  const history = await loadHistory()
  const filingsBySymbol = new Map<string, (Filing & { filedTime: number })[]>()
  for (const { symbol, filings } of JSON.parse(await readGz("fundamentals.json.gz")) as { symbol: string; filings: Filing[] }[]) {
    filingsBySymbol.set(symbol, filings.map((filing) => ({ ...filing, filedTime: parseNseTimestamp(filing.filedAt) })).filter((filing) => Number.isFinite(filing.filedTime)))
  }
  const factorsAfter = new Map<string, { exTime: number; factor: number }[]>()
  for (const action of JSON.parse(await readGz("corporate-actions.json.gz")) as PriceAdjustment[]) {
    factorsAfter.set(action.symbol, [...(factorsAfter.get(action.symbol) ?? []), { exTime: parseNseDate(action.exDate), factor: action.factor }])
  }

  const start = history.days.findIndex((day) => day >= SIGNALS_FROM)
  const picks = new Map<string, Pick[]>(SCREENS.map((screen) => [screen.name, []]))
  const universe: Pick[] = []
  const screenedCount: number[] = []
  for (let day = start; day < history.days.length; day += REBALANCE_SESSIONS) {
    const asOf = history.closeTimes[day]
    let screened = 0
    for (const stock of history.stocks.values()) {
      if (stock.board !== "main") continue
      const barIndex = stock.dayIndex.indexOf(day)
      if (barIndex < 20) continue
      const turnover = stock.bars.slice(barIndex - 20, barIndex).reduce((total, bar) => total + bar.turnoverLakhs, 0) / 20
      if (turnover < MIN_TURNOVER_LAKHS) continue
      const known = (filingsBySymbol.get(stock.symbol) ?? []).filter((filing) => filing.filedTime <= asOf)
      const metrics = computeMetrics(known, rawPrice(stock, barIndex, asOf, factorsAfter.get(stock.symbol)))
      const facts = priceFacts(stock, barIndex)
      if (!metrics || !facts) continue
      screened++
      const pick: Pick = { day: history.days[day], symbol: stock.symbol, returns: HOLDS.map((hold) => forwardReturn(history, stock, barIndex, hold)), bigWinner: bigWinner(stock, barIndex, history) }
      universe.push(pick)
      for (const screen of SCREENS) if (screen.passes(metrics, facts)) picks.get(screen.name)!.push({ ...pick, rank: screen.rankBy?.(metrics) } as Pick & { rank?: number })
    }
    screenedCount.push(screened)
    // ranked screens keep only their best `top` of the day
    for (const screen of SCREENS.filter((candidate) => candidate.top)) {
      const all = picks.get(screen.name)!
      const today = all.filter((pick) => pick.day === history.days[day]) as (Pick & { rank: number })[]
      const keep = new Set(today.sort((a, b) => a.rank - b.rank).slice(0, screen.top).map((pick) => pick.symbol))
      picks.set(screen.name, all.filter((pick) => pick.day !== history.days[day] || keep.has(pick.symbol)))
    }
  }

  const fmt = (value: number | undefined, digits = 1) => (value === undefined || Number.isNaN(value) ? "–" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`)
  const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN)
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN }
  const summarise = (label: string, rows: Pick[], base: Pick[]) => {
    const days = new Set(rows.map((row) => row.day))
    const cells = HOLDS.map((_, holdIndex) => {
      const values = rows.map((row) => row.returns[holdIndex]).filter((value): value is number => value !== undefined)
      return values.length ? `${fmt(average(values))} (median ${fmt(median(values))})` : "–"
    })
    // rebalances where the screen's average beat the universe's average (126 sessions)
    let beat = 0
    let compared = 0
    for (const day of days) {
      const mine = rows.filter((row) => row.day === day).map((row) => row.returns[1]).filter((value): value is number => value !== undefined)
      const all = base.filter((row) => row.day === day).map((row) => row.returns[1]).filter((value): value is number => value !== undefined)
      if (!mine.length || !all.length) continue
      compared++
      if (average(mine) > average(all)) beat++
    }
    const winners = rows.filter((row) => row.bigWinner !== undefined)
    const winnerRate = winners.length ? (winners.filter((row) => row.bigWinner).length / winners.length) * 100 : undefined
    const beatCell = rows === base ? "–" : compared ? `${beat} of ${compared}` : "–"
    const yearStarts = new Set(rows.filter((row) => row.returns[2] !== undefined).map((row) => row.day)).size
    return `| ${label} | ${days.size ? (rows.length / days.size).toFixed(0) : 0} | ${cells.slice(0, 2).join(" | ")} | ${cells[2]}${yearStarts && yearStarts < 3 ? ` (${yearStarts} start date)` : ""} | ${beatCell} | ${winnerRate === undefined ? "–" : `${winnerRate.toFixed(0)}%`} |`
  }
  const table = (from: string, to: string) => {
    const inPeriod = (rows: Pick[]) => rows.filter((row) => row.day >= from && row.day < to)
    const base = inPeriod(universe)
    return [
      `| Screen | Stocks per month | Avg return, 63 sessions (~3 months) | 126 sessions (~6 months) | 252 sessions (~1 year) | Beat all stocks (6 months) | Rose ${MULTIBAGGER_PERCENT}%+ within a year |`,
      "|---|---|---|---|---|---|---|",
      summarise("**All screened stocks (the benchmark)**", base, base),
      ...SCREENS.map((screen) => summarise(screen.name, inPeriod(picks.get(screen.name)!), base)),
    ].join("\n")
  }
  const report = [
    "# Popular stock screens — backtest on point-in-time NSE filings",
    "",
    `Every ${REBALANCE_SESSIONS} sessions from ${SIGNALS_FROM}: each liquid main-board stock (₹${MIN_TURNOVER_LAKHS} lakh+ a day) with 8 straight quarters of structured results is screened using only filings public by that day's close; every stock that passes is bought (equal weight) and its return measured. On average ${average(screenedCount).toFixed(0)} stocks could be screened per date. Returns are before costs and taxes; overlapping monthly windows are not independent tests.`,
    "",
    "Screens (thresholds from public Screener.in screens and the books; see the notes for what the data can't do):",
    ...SCREENS.map((screen) => `- **${screen.name}** — ${screen.note}`),
    "",
    `## Period 1 (${SIGNALS_FROM} → ${CONFIRM_FROM})`,
    table(SIGNALS_FROM, CONFIRM_FROM),
    "",
    `## Period 2 — the check (${CONFIRM_FROM} → ${history.days[history.days.length - 1]}; 252-session holds not finished yet)`,
    table(CONFIRM_FROM, "9999"),
  ].join("\n")
  await writeFile(join(HISTORY_DIR, "backtest", "screens-report.md"), report)
  console.log(report)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
