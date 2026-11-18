// Backtest every pick rule (src/services/market/strategies.ts) on every NSE stock, main board and SME, using the
// same signal code as the live scan. Writes data/market-history/backtest/report.md and trades.json.gz.
// Run: NODE_OPTIONS=--max-old-space-size=8192 npx tsx src/backtest/run.ts
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { computeStockSignal, rankRelativeStrength, assessRegime, type DailyPriceRow, type StockSignal } from "../services/market/scan.js"
import { SWING_RULES, INTRADAY_RULES, intradayPlan, leadingSectors, liveRiskPercent, type Board, type MarketType, type StockDay, type StrategyName } from "../services/market/strategies.js"
import { simulateTrade, type TradeResult } from "./simulate.js"
import { loadHistory, type History, type StockHistory } from "./history.js"
import { HISTORY_DIR, writeGz } from "./download.js"

const SIGNAL_WINDOW = 220 // sessions of history per signal — what the live scan loads
const MIN_TURNOVER_LAKHS: Record<Board, number> = { main: 50, sme: 10 }
const SWING_COST_PERCENT: Record<Board, number> = { main: 0.25, sme: 0.5 } // round trip: brokerage, STT, slippage
const INTRADAY_COST_PERCENT: Record<Board, number> = { main: 0.15, sme: 0.3 }
export const SIGNALS_FROM = "2023-11-01" // the first ~10 months of data only warm up the 200-day averages
export const CONFIRM_FROM = "2025-11-01" // rules are judged on the earlier period, then confirmed once on this one
const MOVE_PERCENT = 20
const MOVE_SESSIONS = 30

export interface TradeRecord {
  symbol: string
  board: Board
  strategy: StrategyName
  signalDay: string
  signalIndex: number // index into the stock's bars
  regime: string
  relativeStrengthRank: number
  result: TradeResult
}

interface ScanState { scanned: Map<string, Set<number>> } // symbol → bar indices where the stock passed the liquidity filter

function backtest(history: History): { trades: TradeRecord[]; state: ScanState; longTerm: string[] } {
  const { days, closeTimes, stocks } = history
  const start = days.findIndex((day) => day >= SIGNALS_FROM)
  const position = new Map<string, number>() // symbol → index of the bar for the current day
  const rowsByDay: DailyPriceRow[][] = days.map(() => [])
  for (const stock of stocks.values()) if (stock.board === "main") stock.dayIndex.forEach((day, index) => rowsByDay[day].push(stock.bars[index]))
  const trades: TradeRecord[] = []
  const busyUntil = new Map<string, number>() // `${symbol}|${strategy}` → bar index the open trade exits on
  const scanned = new Map<string, Set<number>>()
  const longTerm: string[] = []

  for (let day = start; day < days.length; day++) {
    const today: { stock: StockHistory; barIndex: number; signal: StockSignal }[] = []
    for (const stock of stocks.values()) {
      let index = position.get(stock.symbol) ?? 0
      while (index < stock.dayIndex.length && stock.dayIndex[index] < day) index++
      position.set(stock.symbol, index)
      if (stock.dayIndex[index] !== day) continue
      const signal = computeStockSignal(stock.bars.slice(Math.max(0, index - SIGNAL_WINDOW + 1), index + 1), MIN_TURNOVER_LAKHS[stock.board])
      if (!signal) continue
      today.push({ stock, barIndex: index, signal })
      const set = scanned.get(stock.symbol) ?? new Set<number>()
      set.add(index)
      scanned.set(stock.symbol, set)
    }
    const mainSignals = today.filter((entry) => entry.stock.board === "main").map((entry) => entry.signal)
    rankRelativeStrength(mainSignals)
    rankRelativeStrength(today.filter((entry) => entry.stock.board === "sme").map((entry) => entry.signal))
    const regime = assessRegime(mainSignals, rowsByDay.slice(Math.max(0, day - 4), day + 1)).label

    const sectorsLeading = leadingSectors(today.map(({ stock, signal }) => ({ sector: history.sectorOf.get(stock.symbol), changePercent20d: signal.changePercent20d })))

    const nextOpenTime = day + 1 < days.length ? closeTimes[day + 1] - 6.25 * 3_600_000 : closeTimes[day] + 17.75 * 3_600_000
    for (const { stock, barIndex, signal } of today) {
      const filings = history.resultsFiledAt.get(stock.symbol) ?? []
      const stockDay: StockDay = {
        bars: stock.bars.slice(Math.max(0, barIndex - SIGNAL_WINDOW + 1), barIndex + 1),
        signal,
        board: stock.board,
        sessionsSinceListing: stock.listedAtIndex === undefined ? undefined : barIndex - stock.listedAtIndex + 1,
        resultsFiledAfterLastClose: day > 0 && filings.some((time) => time > closeTimes[day - 1] && time <= closeTimes[day]),
        resultsFiledAfterTodaysClose: filings.some((time) => time > closeTimes[day] && time < nextOpenTime),
        insiderBuyValueToday: history.insiderBuys.get(stock.symbol)?.get(day) ?? 0,
        inLeadingSector: sectorsLeading.has(history.sectorOf.get(stock.symbol) ?? ""),
      }
      const record = (strategy: StrategyName, result: TradeResult) => {
        trades.push({ symbol: stock.symbol, board: stock.board, strategy, signalDay: days[day], signalIndex: barIndex, regime, relativeStrengthRank: signal.relativeStrengthRank, result })
        if (result.kind === "closed") busyUntil.set(`${stock.symbol}|${strategy}`, result.exitIndex)
        if (result.kind === "open") busyUntil.set(`${stock.symbol}|${strategy}`, Infinity)
      }
      const isBusy = (strategy: StrategyName) => (busyUntil.get(`${stock.symbol}|${strategy}`) ?? -1) >= barIndex
      for (const rule of SWING_RULES) {
        if (isBusy(rule.name) || !rule.fires(stockDay)) continue
        record(rule.name, simulateTrade(stock.bars, barIndex, rule.plan(stockDay), SWING_COST_PERCENT[stock.board]))
      }
      for (const rule of INTRADAY_RULES) {
        if (!rule.fires(stockDay)) continue
        record(rule.name, simulateTrade(stock.bars, barIndex, intradayPlan(rule.name, stockDay), INTRADAY_COST_PERCENT[stock.board], false))
      }
    }

    // Long-term screen, every 21 sessions: main board, above the 200-day average, best 12-month return ÷ volatility
    if ((day - start) % 21 === 0) longTerm.push(...longTermRebalance(history, day, today))
  }
  return { trades, state: { scanned }, longTerm }
}

// % change over the next `sessions` sessions; a stock that stopped trading counts at its last price; undefined if
// the history ends before the period does
export function forwardReturn(history: History, stock: StockHistory, barIndex: number, sessions: number): number | undefined {
  if (stock.dayIndex[barIndex] + sessions > history.days.length - 1) return undefined // the window runs past the data
  if (barIndex + sessions < stock.bars.length) return (stock.bars[barIndex + sessions].close / stock.bars[barIndex].close - 1) * 100
  return (stock.bars[stock.bars.length - 1].close / stock.bars[barIndex].close - 1) * 100 // stopped trading: its last price
}

function longTermRebalance(history: History, day: number, today: { stock: StockHistory; barIndex: number; signal: StockSignal }[]): string[] {
  const candidates = today.filter(({ stock, barIndex }) => stock.board === "main" && barIndex >= 252).map((entry) => {
    const bars = entry.stock.bars.slice(entry.barIndex - 252, entry.barIndex + 1)
    const returns = bars.slice(1).map((bar, index) => bar.close / bars[index].close - 1)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const volatility = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length) * Math.sqrt(252)
    return { ...entry, score: (bars[bars.length - 1].close / bars[0].close - 1) / volatility }
  })
  const picks = candidates.filter((entry) => entry.signal.isAbove200DayAverage).sort((a, b) => b.score - a.score).slice(0, 20)
  return [126, 252].map((sessions) => {
    const pickReturns = picks.map(({ stock, barIndex }) => forwardReturn(history, stock, barIndex, sessions)).filter((value): value is number => value !== undefined)
    const allReturns = candidates.map(({ stock, barIndex }) => forwardReturn(history, stock, barIndex, sessions)).filter((value): value is number => value !== undefined)
    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1)
    return JSON.stringify({ day: history.days[day], sessions, picks: pickReturns.length, pickAverage: average(pickReturns), marketAverage: average(allReturns), symbols: picks.map((pick) => pick.stock.symbol) })
  }).filter((line) => JSON.parse(line).picks >= 10)
}

// ---------- reports ----------

const fmt = (value: number, digits = 2) => (value >= 0 ? "+" : "") + value.toFixed(digits)

interface Tally { closed: number; wins: number; totalR: number; skipped: number; open: number; holdSessions: number }
const emptyTally = (): Tally => ({ closed: 0, wins: 0, totalR: 0, skipped: 0, open: 0, holdSessions: 0 })
function add(tally: Tally, result: TradeResult) {
  if (result.kind === "skipped") tally.skipped++
  else if (result.kind === "open") tally.open++
  else { tally.closed++; tally.totalR += result.r; tally.holdSessions += result.exitIndex - result.entryIndex; if (result.r > 0) tally.wins++ }
}
const row = (label: string, tally: Tally) => tally.closed
  ? `| ${label} | ${tally.closed} | ${((tally.wins / tally.closed) * 100).toFixed(0)}% | ${fmt(tally.totalR / tally.closed)} | ${fmt(tally.totalR, 0)} | ${(tally.holdSessions / tally.closed).toFixed(0)} | ${tally.skipped} |`
  : `| ${label} | 0 | – | – | – | – | ${tally.skipped} |`
const TABLE_HEAD = "| Group | Closed trades | Win rate | Avg R | Total R | Avg sessions held | Skipped |\n|---|---|---|---|---|---|---|"

function strategyTable(trades: TradeRecord[], groupBy: (trade: TradeRecord) => string): string {
  const groups = new Map<string, Tally>()
  for (const trade of trades) {
    const key = groupBy(trade)
    const tally = groups.get(key) ?? emptyTally()
    add(tally, trade.result)
    groups.set(key, tally)
  }
  return [TABLE_HEAD, ...[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([label, tally]) => row(label, tally))].join("\n")
}

// ---------- one account: sizes by market type, a cap on open risk ----------

export const MAX_OPEN_RISK_PERCENT = 10
const RISK_BY_REGIME: Record<string, number> = { strong: 1, neutral: 0.5, weak: 0.25 } // the live sizes (scan.ts)
const KEEP_MIN_TRADES = 30
const KEEP_MIN_AVERAGE_R = 0.05

type SizeTable = Map<string, number> // `${strategy}|${board}|${regime}` → % of capital risked per trade (0 = not traded)

// A rule is kept for a board and market type only if it earned ≥ +0.05R a trade over ≥ 30 trades in period 1 —
// decided on period 1 alone, then period 2 shows whether it held
export function sizesFromPeriodOne(trades: TradeRecord[], marketTypes: "sized" | "strong only"): SizeTable {
  const cells = new Map<string, Tally>()
  for (const trade of trades) {
    if (trade.signalDay >= CONFIRM_FROM) continue
    const key = `${trade.strategy}|${trade.board}|${trade.regime}`
    const tally = cells.get(key) ?? emptyTally()
    add(tally, trade.result)
    cells.set(key, tally)
  }
  const sizes: SizeTable = new Map()
  for (const [key, tally] of cells) {
    const regime = key.split("|")[2]
    const kept = tally.closed >= KEEP_MIN_TRADES && tally.totalR / tally.closed >= KEEP_MIN_AVERAGE_R && (marketTypes === "sized" || regime === "strong")
    sizes.set(key, kept ? RISK_BY_REGIME[regime] : 0)
  }
  return sizes
}

interface AccountResult { label: string; byYear: Map<string, number>; trades: number; skippedForRisk: number; maxDrawdown: number; total: number }

// Trades are taken in signal order (rule priority, then RS) while open risk stays ≤ 10% of capital. Returns are
// simple (not compounded): each trade adds r × its risk %.
export function simulateAccount(label: string, history: History, trades: TradeRecord[], sizes: SizeTable, fromDay: string, toDay: string): AccountResult {
  const priority = new Map(SWING_RULES.map((rule, index) => [rule.name, index]))
  const candidates = trades
    .filter((trade) => trade.signalDay >= fromDay && trade.signalDay < toDay && trade.result.kind === "closed" && (sizes.get(`${trade.strategy}|${trade.board}|${trade.regime}`) ?? 0) > 0)
    .sort((a, b) => a.signalDay.localeCompare(b.signalDay) || priority.get(a.strategy)! - priority.get(b.strategy)! || b.relativeStrengthRank - a.relativeStrengthRank)
  const open: { exitDay: string; risk: number; symbol: string }[] = []
  const pnlByExitDay = new Map<string, number>()
  let taken = 0
  let skippedForRisk = 0
  for (const trade of candidates) {
    const result = trade.result as Extract<TradeResult, { kind: "closed" }>
    const stock = history.stocks.get(trade.symbol)!
    const entryDay = history.days[stock.dayIndex[result.entryIndex]]
    const exitDay = history.days[stock.dayIndex[result.exitIndex]]
    for (let index = open.length - 1; index >= 0; index--) if (open[index].exitDay < entryDay) open.splice(index, 1)
    if (open.some((position) => position.symbol === trade.symbol)) continue // one position per stock
    const risk = sizes.get(`${trade.strategy}|${trade.board}|${trade.regime}`)!
    if (open.reduce((total, position) => total + position.risk, 0) + risk > MAX_OPEN_RISK_PERCENT) { skippedForRisk++; continue }
    open.push({ exitDay, risk, symbol: trade.symbol })
    taken++
    pnlByExitDay.set(exitDay, (pnlByExitDay.get(exitDay) ?? 0) + result.r * risk)
  }
  const byYear = new Map<string, number>()
  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  for (const [day, pnl] of [...pnlByExitDay].sort(([a], [b]) => a.localeCompare(b))) {
    equity += pnl
    peak = Math.max(peak, equity)
    maxDrawdown = Math.max(maxDrawdown, peak - equity)
    byYear.set(day.slice(0, 4), (byYear.get(day.slice(0, 4)) ?? 0) + pnl)
  }
  return { label, byYear, trades: taken, skippedForRisk, maxDrawdown, total: equity }
}

function accountTable(results: AccountResult[]): string {
  const years = [...new Set(results.flatMap((result) => [...result.byYear.keys()]))].sort()
  return [
    `| Setup | Trades | Skipped (risk cap) | ${years.join(" | ")} | Total | Worst drop from a peak |`,
    `|---|---|---|${years.map(() => "---").join("|")}|---|---|`,
    ...results.map((result) => `| ${result.label} | ${result.trades} | ${result.skippedForRisk} | ${years.map((year) => `${fmt(result.byYear.get(year) ?? 0, 1)}%`).join(" | ")} | ${fmt(result.total, 1)}% | −${result.maxDrawdown.toFixed(1)}% |`),
  ].join("\n")
}

function keptRules(sizes: SizeTable): string {
  const kept = [...sizes].filter(([, size]) => size > 0).map(([key, size]) => `${key.replaceAll("|", " · ")} (${size}%)`)
  return kept.length ? kept.join("; ") : "none"
}

// Big moves: from a session's close, +20% (or −20%) within 30 sessions. One row per move — the next move of the same
// stock starts after this one's peak (trough).
interface Move { symbol: string; board: Board; startIndex: number; endIndex: number; percent: number; startDay: string }
function findMoves(history: History, direction: 1 | -1, fromDay: string): Move[] {
  const moves: Move[] = []
  for (const stock of history.stocks.values()) {
    for (let index = 0; index < stock.bars.length - 1; index++) {
      if (history.days[stock.dayIndex[index]] < fromDay) continue
      const window = stock.bars.slice(index + 1, index + 1 + MOVE_SESSIONS)
      const extreme = window.reduce((best, bar, offset) => (direction * bar.close > direction * best.close ? { close: bar.close, offset } : best), { close: stock.bars[index].close, offset: -1 })
      const percent = (extreme.close / stock.bars[index].close - 1) * 100
      if (extreme.offset < 0 || direction * percent < MOVE_PERCENT) continue
      moves.push({ symbol: stock.symbol, board: stock.board, startIndex: index, endIndex: index + 1 + extreme.offset, percent, startDay: history.days[stock.dayIndex[index]] })
      index = index + 1 + extreme.offset
    }
  }
  return moves
}

function moveCoverage(history: History, trades: TradeRecord[], state: ScanState, fromDay: string, swingStrategies: Set<StrategyName>): { text: string; rows: string[] } {
  const swingTrades = new Map<string, TradeRecord[]>()
  for (const trade of trades) if (swingStrategies.has(trade.strategy)) swingTrades.set(trade.symbol, [...(swingTrades.get(trade.symbol) ?? []), trade])

  const ups = findMoves(history, 1, fromDay)
  const upReasons = new Map<string, { count: number; examples: string[] }>()
  const caughtBy = new Map<string, { count: number; totalR: number }>()
  const upRows: string[] = []
  for (const move of ups) {
    const stock = history.stocks.get(move.symbol)!
    // a rule counts as catching the move if it fired from 5 sessions before the start until 5 sessions before the peak
    const fired = (swingTrades.get(move.symbol) ?? []).filter((trade) => trade.signalIndex >= move.startIndex - 5 && trade.signalIndex <= move.endIndex - 5)
    const bought = fired.filter((trade) => trade.result.kind !== "skipped")
    let reason: string
    if (bought.length) {
      reason = "caught"
      for (const trade of bought) {
        const tally = caughtBy.get(trade.strategy) ?? { count: 0, totalR: 0 }
        tally.count++
        tally.totalR += trade.result.kind === "closed" ? trade.result.r : 0
        caughtBy.set(trade.strategy, tally)
      }
    } else if (fired.length) reason = `rule fired but skipped (${(fired[0].result as { reason: string }).reason})`
    else if (move.startIndex < 5) reason = "missed: too new (under 6 sessions)"
    else if (!state.scanned.get(move.symbol)?.has(move.startIndex)) reason = `missed: not scanned (${move.board === "sme" ? "SME, " : ""}turnover under ₹${MIN_TURNOVER_LAKHS[move.board]} lakh)`
    else reason = "missed: no rule fired"
    const tally = upReasons.get(reason) ?? { count: 0, examples: [] }
    tally.count++
    if (tally.examples.length < 6) tally.examples.push(`${move.symbol} ${fmt(move.percent, 0)}% from ${move.startDay}`)
    upReasons.set(reason, tally)
    upRows.push([move.symbol, move.board, move.startDay, history.days[stock.dayIndex[move.endIndex]], move.percent.toFixed(0), reason, bought.map((trade) => trade.strategy).join(" ")].join(","))
  }

  const downs = findMoves(history, -1, fromDay)
  let pickedIntoFall = 0
  let fallR = 0
  for (const move of downs) {
    const held = (swingTrades.get(move.symbol) ?? []).filter((trade) => trade.result.kind !== "skipped" && trade.result.entryIndex <= move.endIndex &&
      (trade.result.kind === "open" || trade.result.exitIndex >= move.startIndex))
    if (!held.length) continue
    pickedIntoFall++
    fallR += held.reduce((total, trade) => total + (trade.result.kind === "closed" ? trade.result.r : 0), 0)
  }

  const scannedUps = ups.filter((move) => state.scanned.get(move.symbol)?.has(move.startIndex))
  const text = [
    `**Rises of ${MOVE_PERCENT}%+ within ${MOVE_SESSIONS} sessions since ${fromDay}: ${ups.length}** (${scannedUps.length} in stocks the scan covered that day)`,
    "",
    "| Result | Moves | Examples |",
    "|---|---|---|",
    ...[...upReasons].sort((a, b) => b[1].count - a[1].count).map(([reason, tally]) => `| ${reason} | ${tally.count} (${((tally.count / ups.length) * 100).toFixed(0)}%) | ${tally.examples.join("; ")} |`),
    "",
    "Caught, by rule (a move can be caught by more than one rule; R = what the trade made, closed trades only):",
    "",
    "| Rule | Moves caught | Avg R on those trades |",
    "|---|---|---|",
    ...[...caughtBy].sort((a, b) => b[1].count - a[1].count).map(([strategy, tally]) => `| ${strategy} | ${tally.count} | ${fmt(tally.totalR / tally.count)} |`),
    "",
    `**Falls of ${MOVE_PERCENT}%+ within ${MOVE_SESSIONS} sessions since ${fromDay}: ${downs.length}.** A swing trade was open (or bought) during ${pickedIntoFall} of them (${((pickedIntoFall / Math.max(downs.length, 1)) * 100).toFixed(1)}%); those trades made ${fmt(fallR, 0)}R in total (stops limit the damage).`,
    "",
  ].join("\n")
  return { text, rows: upRows }
}

function longTermTable(lines: string[], fromDay: string, toDay = "9999"): string {
  const rows = lines.map((line) => JSON.parse(line) as { day: string; sessions: number; picks: number; pickAverage: number; marketAverage: number }).filter((row) => row.day >= fromDay && row.day < toDay)
  return [126, 252].map((sessions) => {
    const subset = rows.filter((row) => row.sessions === sessions)
    if (!subset.length) return `| ${sessions} sessions | 0 | – | – | – |`
    const pick = subset.reduce((a, row) => a + row.pickAverage, 0) / subset.length
    const market = subset.reduce((a, row) => a + row.marketAverage, 0) / subset.length
    const beat = subset.filter((row) => row.pickAverage > row.marketAverage).length
    return `| ${sessions} sessions | ${subset.length} | ${fmt(pick, 1)}% | ${fmt(market, 1)}% | ${beat} of ${subset.length} |`
  }).join("\n")
}

async function main() {
  console.time("load")
  const history = await loadHistory()
  console.timeEnd("load")
  console.log(`${history.days.length} sessions ${history.days[0]} → ${history.days[history.days.length - 1]}, ${history.stocks.size} stocks`)
  console.time("backtest")
  const { trades, state, longTerm } = backtest(history)
  console.timeEnd("backtest")

  const lastDay = history.days[history.days.length - 1]
  const lastYearFrom = new Date(new Date(`${lastDay}T00:00:00Z`).getTime() - 365 * 86_400_000).toISOString().slice(0, 10)
  const period = (trade: TradeRecord) => (trade.signalDay >= CONFIRM_FROM ? "2 confirm" : "1 set")
  const swing = new Set(SWING_RULES.map((rule) => rule.name))
  const swingTrades = trades.filter((trade) => swing.has(trade.strategy))
  const intradayTrades = trades.filter((trade) => !swing.has(trade.strategy))

  const sized = sizesFromPeriodOne(swingTrades, "sized")
  const strongOnly = sizesFromPeriodOne(swingTrades, "strong only")
  const before: SizeTable = new Map(["strong", "neutral", "weak"].map((regime) => [`stage2-tight|main|${regime}`, RISK_BY_REGIME[regime]]))
  const live: SizeTable = new Map(SWING_RULES.flatMap((rule) => (["main", "sme"] as const).flatMap((board) => (["strong", "neutral", "weak"] as MarketType[])
    .map((regime) => [`${rule.name}|${board}|${regime}`, liveRiskPercent(rule.name, board, regime)] as const))))
  const accounts = (fromDay: string, toDay = "9999") => [
    simulateAccount("Before (pushed 18 Nov morning): stage2-tight, main board, 1% / 0.5% / 0.25%", history, swingTrades, before, fromDay, toDay),
    simulateAccount("**Live now** (strategies.ts LIVE_RISK_PERCENT)", history, swingTrades, live, fromDay, toDay),
    simulateAccount("Kept rules, sized by market type", history, swingTrades, sized, fromDay, toDay),
    simulateAccount("Kept rules, strong market only", history, swingTrades, strongOnly, fromDay, toDay),
  ]
  const wholePeriod = moveCoverage(history, trades, state, SIGNALS_FROM, swing)
  const lastYear = moveCoverage(history, trades, state, lastYearFrom, swing)
  const report = [
    `# Backtest — every rule on every NSE stock (main board + SME)`,
    "",
    `Data: ${history.days.length} sessions, ${history.days[0]} → ${lastDay}, ${history.stocks.size} symbols; prices adjusted for splits/bonuses. Signals from ${SIGNALS_FROM}.`,
    `Periods: **1 set** = ${SIGNALS_FROM} → ${CONFIRM_FROM} (rules may be judged here); **2 confirm** = ${CONFIRM_FROM} → ${lastDay} (checked once, never tuned on).`,
    `Trades: bought at the next open (skipped if >1% above the signal close or locked at the upper limit); stop 2× the average daily range, target 3R, sell-by 30 sessions (60 for results-day and insider-buy). Costs per round trip: main ${SWING_COST_PERCENT.main}%, SME ${SWING_COST_PERCENT.sme}%. R = profit ÷ amount risked.`,
    `Intraday: bought at the open, sold at the close or a stop 0.5× the average daily range below; costs main ${INTRADAY_COST_PERCENT.main}%, SME ${INTRADAY_COST_PERCENT.sme}%.`,
    "",
    "## Swing rules — by rule, board and period",
    strategyTable(swingTrades, (trade) => `${trade.strategy} · ${trade.board} · ${period(trade)}`),
    "",
    "## Swing rules — by market type and period (market type is measured on the main board)",
    strategyTable(swingTrades, (trade) => `${trade.strategy} · ${trade.board} · ${trade.regime} · ${period(trade)}`),
    "",
    "## Intraday rules — by rule, board and period",
    strategyTable(intradayTrades, (trade) => `${trade.strategy} · ${trade.board} · ${period(trade)}`),
    "",
    "## Long-term screen (top 20 by 12-month return ÷ volatility, above the 200-day average, every 21 sessions)",
    "| Held | Rebalances | Picks' avg return | All stocks' avg return | Picks beat the market |",
    "|---|---|---|---|---|",
    longTermTable(longTerm, SIGNALS_FROM),
    "",
    `Picks made in period 2 only (${CONFIRM_FROM} →; a 252-session hold can't finish yet):`,
    "| Held | Rebalances | Picks' avg return | All stocks' avg return | Picks beat the market |",
    "|---|---|---|---|---|",
    longTermTable(longTerm, CONFIRM_FROM),
    "",
    `## One account — ${MAX_OPEN_RISK_PERCENT}% cap on open risk, % of capital per year (simple, not compounded)`,
    `Kept (period 1: ≥ ${KEEP_MIN_TRADES} trades and ≥ +${KEEP_MIN_AVERAGE_R}R a trade), sized: ${keptRules(sized)}`,
    "",
    `Strong market only: ${keptRules(strongOnly)}`,
    "",
    "Period 1 (rules chosen here):",
    accountTable(accounts(SIGNALS_FROM, CONFIRM_FROM)),
    "",
    `Period 2 only (${CONFIRM_FROM} →, the check):`,
    accountTable(accounts(CONFIRM_FROM)),
    "",
    `## Big moves — whole period (${SIGNALS_FROM} → ${lastDay}), all swing rules`,
    wholePeriod.text,
    `## Final test — the last year (${lastYearFrom} → ${lastDay}), all swing rules`,
    strategyTable(swingTrades.filter((trade) => trade.signalDay >= lastYearFrom), (trade) => `${trade.strategy} · ${trade.board}`),
    "",
    lastYear.text,
    "",
    "Every rise, with its result: `backtest/moves-up.csv` (symbol, board, start, peak, %, result, rules that caught it).",
  ].join("\n")

  const outDir = join(HISTORY_DIR, "backtest")
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, "report.md"), report)
  await writeFile(join(outDir, "moves-up.csv"), ["symbol,board,start,peak,percent,result,caught_by", ...wholePeriod.rows].join("\n"))
  await writeGz("backtest/trades.json.gz", JSON.stringify(trades.map(({ symbol, board, strategy, signalDay, regime, relativeStrengthRank, result }) => ({ symbol, board, strategy, signalDay, regime, relativeStrengthRank, ...result }))))
  console.log(report)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
