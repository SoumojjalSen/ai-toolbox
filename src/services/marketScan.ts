import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"
import { fetchNse, fetchNseJson } from "./nse.js"
import { fetchMarketLenses, type EventKind, type MarketLenses } from "./marketLenses.js"
import { recordPicks, buildTrackRecord } from "./scorecard.js"

// Scans every NSE EQ stock in code — Claude's WebFetch summarises pages with a small model, so it can't
// reliably read a 400 KB file of ~2,600 stocks. The result is a compact text block for the market-analyst prompt.

// ~10 months: 200-day average plus 20 sessions to tell whether it's rising (Minervini trend template)
const HISTORY_SESSIONS = 220
const MAX_CALENDAR_DAYS_BACK = 340 // weekends and holidays in between
// ₹50 lakh average daily turnover — below that a pick may be impossible to buy/sell at the quoted price
const MIN_AVG_TURNOVER_LACS = 50

export interface BhavcopyRow {
  symbol: string
  prevClose: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  turnoverLacs: number
  deliveryPercent: number
}

export interface StockSignal {
  symbol: string
  close: number
  changePercent1d: number
  changePercent5d: number
  changePercent20d: number
  gapPercent: number
  volumeRatio: number // today's volume ÷ 20-session average
  avgVolume20: number
  deliveryPercent: number
  avgDeliveryPercent: number
  atr14: number
  isBreakout20d: boolean // close above the prior 20 sessions' high
  isBreakdown20d: boolean
  changePercent3m: number // 63 sessions — relative strength
  percentFromHigh: number // vs the highest high in the history (~10 months); 0 = at the high
  aboveDma200: boolean | undefined // undefined: under 200 sessions of history
  // Minervini trend template: close > 50 > 150 > 200-day average, 200-day rising, ≥30% above the low, within 25% of the high
  isStage2Uptrend: boolean
  high: number // latest session
  low: number
  closePosition: number // where it closed in the day's range: 0 = at the low, 1 = at the high
  dma20: number
  dma50: number | undefined
  dma200: number | undefined
  // Relative strength, the Nifty200 Momentum 30 way: 6- and 3-month return ÷ annualised volatility, ranked 1–99
  // across all liquid stocks (99 = strongest). 0 = under ~6 months of history.
  rsRank: number
  momentumScore: number | undefined
  // Volatility contraction (VCP-style): last 10 sessions' range ≤ 40% of the last 50 sessions' range, within 15% of the high
  isTight: boolean
}

// sec_bhavdata_full: "SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE,
// AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER" — EQ series only (BE etc. can't be traded intraday)
export function parseBhavcopy(csvText: string): BhavcopyRow[] {
  return csvText
    .split("\n")
    .slice(1)
    .map((line) => line.split(",").map((field) => field.trim()))
    .filter((fields) => fields[1] === "EQ")
    .map((fields) => ({
      symbol: fields[0],
      prevClose: Number(fields[3]),
      open: Number(fields[4]),
      high: Number(fields[5]),
      low: Number(fields[6]),
      close: Number(fields[8]),
      volume: Number(fields[10]),
      turnoverLacs: Number(fields[11]),
      deliveryPercent: Number(fields[14]) || 0,
    }))
}

function percentChange(from: number, to: number): number {
  return from > 0 ? ((to - from) / from) * 100 : 0
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
}

function standardDeviation(values: number[]): number {
  const mean = average(values)
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)))
}

function priceRange(rows: BhavcopyRow[]): number {
  return Math.max(...rows.map((row) => row.high)) - Math.min(...rows.map((row) => row.low))
}

const MOMENTUM_6M_SESSIONS = 126

// sessions: oldest → newest. Only liquid stocks present in the latest session are returned.
export function computeStockSignals(sessions: BhavcopyRow[][]): StockSignal[] {
  const latestSession = sessions[sessions.length - 1]
  const historyBySymbol = new Map<string, BhavcopyRow[]>()
  for (const session of sessions) {
    for (const row of session) {
      const history = historyBySymbol.get(row.symbol)
      if (history) history.push(row)
      else historyBySymbol.set(row.symbol, [row])
    }
  }

  const stockSignals: StockSignal[] = []
  for (const latest of latestSession) {
    const history = historyBySymbol.get(latest.symbol) ?? []
    const priorSessions = history.slice(0, -1).slice(-20)
    if (priorSessions.length < 5) continue // new listings: not enough history for averages
    if (average(priorSessions.map((row) => row.turnoverLacs)) < MIN_AVG_TURNOVER_LACS) continue

    const trueRanges = history.slice(-14).map((row) => Math.max(row.high - row.low, Math.abs(row.high - row.prevClose), Math.abs(row.low - row.prevClose)))
    const avgVolume = average(priorSessions.map((row) => row.volume))
    const closes = history.map((row) => row.close)
    const movingAverage = (sessionCount: number, sessionsAgo = 0) => {
      const end = closes.length - sessionsAgo
      return end >= sessionCount ? average(closes.slice(end - sessionCount, end)) : undefined
    }
    const [dma50, dma150, dma200, dma200MonthAgo] = [movingAverage(50), movingAverage(150), movingAverage(200), movingAverage(200, 20)]
    const historyHigh = Math.max(...history.map((row) => row.high))
    const historyLow = Math.min(...history.map((row) => row.low))
    const isStage2Uptrend =
      dma50 !== undefined && dma150 !== undefined && dma200 !== undefined && dma200MonthAgo !== undefined &&
      latest.close > dma50 && dma50 > dma150 && dma150 > dma200 && dma200 > dma200MonthAgo &&
      latest.close >= historyLow * 1.3 && latest.close >= historyHigh * 0.75
    const changePercent3m = percentChange(history[Math.max(0, history.length - 64)].close, latest.close)
    const annualisedVolatility = standardDeviation(history.slice(-MOMENTUM_6M_SESSIONS).map((row) => percentChange(row.prevClose, row.close))) * Math.sqrt(252)
    const momentumScore = history.length > MOMENTUM_6M_SESSIONS && annualisedVolatility > 0
      ? (percentChange(history[history.length - MOMENTUM_6M_SESSIONS - 1].close, latest.close) + changePercent3m) / 2 / annualisedVolatility
      : undefined
    const percentFromHigh = percentChange(historyHigh, latest.close)
    const isTight = history.length >= 50 && priceRange(history.slice(-10)) <= 0.4 * priceRange(history.slice(-50)) && percentFromHigh >= -15
    stockSignals.push({
      symbol: latest.symbol,
      close: latest.close,
      changePercent1d: percentChange(latest.prevClose, latest.close),
      changePercent5d: percentChange(history[Math.max(0, history.length - 6)].close, latest.close),
      changePercent20d: percentChange(priorSessions[0].close, latest.close),
      gapPercent: percentChange(latest.prevClose, latest.open),
      volumeRatio: avgVolume > 0 ? latest.volume / avgVolume : 0,
      avgVolume20: avgVolume,
      deliveryPercent: latest.deliveryPercent,
      avgDeliveryPercent: average(priorSessions.map((row) => row.deliveryPercent)),
      atr14: average(trueRanges),
      isBreakout20d: latest.close > Math.max(...priorSessions.map((row) => row.high)),
      isBreakdown20d: latest.close < Math.min(...priorSessions.map((row) => row.low)),
      changePercent3m,
      percentFromHigh,
      aboveDma200: dma200 === undefined ? undefined : latest.close > dma200,
      isStage2Uptrend,
      high: latest.high,
      low: latest.low,
      closePosition: latest.high > latest.low ? (latest.close - latest.low) / (latest.high - latest.low) : 0.5,
      dma20: movingAverage(20) ?? average(closes),
      dma50,
      dma200,
      rsRank: 0,
      momentumScore,
      isTight,
    })
  }
  const ranked = stockSignals.filter((s) => s.momentumScore !== undefined).sort((a, b) => a.momentumScore! - b.momentumScore!)
  ranked.forEach((s, index) => { s.rsRank = Math.max(1, Math.min(99, Math.round(((index + 1) / ranked.length) * 100))) })
  return stockSignals
}

// Swing setups. Rules chosen by backtest (NSE bhavcopy, Oct 2025 → Oct 2026, ~3,400 trades, entry at the next open,
// 0.05R costs): Stage 2 + tight 10-day range, strongest RS first, stop 2 × ATR14, target 3R, hold ≤ 30 sessions
// averaged +0.24R a trade (+0.44R in a strong market) vs −0.07R for a random stock above its 200-day average.
// 20-day breakouts, episodic pivots, loser bounces and intraday setups all lost money after costs — they stay as
// context lists, never as picks.
const SWING_STOP_ATR = 2
const REWARD_TO_RISK = 3
export const SWING_HOLD_SESSIONS = 30
const LEADER_MIN_RS = 80

export interface TradeSetup {
  symbol: string
  kind: "core" | "leader" // core = Stage 2 + tight (the backtested rule); leader = Stage 2 + RS ≥ 80, waiting to tighten
  rsRank: number
  close: number
  entry: number
  stopLoss: number
  target: number
  reasons: string[]
}

function roundPrice(price: number): number {
  return Math.round(price * 20) / 20 // NSE tick size ₹0.05
}

export function buildSwingSetup(s: StockSignal): TradeSetup | undefined {
  const isCore = s.isStage2Uptrend && s.isTight
  const isLeader = s.isStage2Uptrend && s.rsRank >= LEADER_MIN_RS
  if ((!isCore && !isLeader) || s.atr14 <= 0) return undefined
  const entry = roundPrice(s.close)
  const risk = SWING_STOP_ATR * s.atr14
  return {
    symbol: s.symbol, kind: isCore ? "core" : "leader", rsRank: s.rsRank, close: s.close, entry,
    stopLoss: roundPrice(entry - risk), target: roundPrice(entry + REWARD_TO_RISK * risk),
    reasons: [
      `RS ${s.rsRank}`, "stage 2", ...(s.isTight ? ["tight 10-day range"] : []),
      `3m ${s.changePercent3m > 0 ? "+" : ""}${s.changePercent3m.toFixed(0)}%`, `${s.percentFromHigh.toFixed(0)}% from high`,
      ...(s.volumeRatio >= 2 ? [`vol ${s.volumeRatio.toFixed(1)}×`] : []),
    ],
  }
}

// Core setups first, each group strongest RS first
export function rankSwingSetups(stockSignals: StockSignal[]): TradeSetup[] {
  return stockSignals
    .map(buildSwingSetup)
    .filter((setup): setup is TradeSetup => !!setup)
    .sort((a, b) => (a.kind === b.kind ? b.rsRank - a.rsRank : a.kind === "core" ? -1 : 1))
}

// Market regime from breadth (O'Neil's "M", Stockbee's 4% counts) — sets how much capital to put to work.
// Backtest: the core rule made +0.44R a trade in "strong", +0.17R in "weak" — so weak means smaller, not zero.
export interface Regime {
  label: "strong" | "neutral" | "weak"
  percentAbove50: number
  percentAbove200: number
  upMoves5d: number // liquid stocks up ≥ 4% in a session, last 5 sessions
  downMoves5d: number
}

export function assessRegime(stockSignals: StockSignal[], sessions: BhavcopyRow[][]): Regime {
  const liquidSymbols = new Set(stockSignals.map((s) => s.symbol))
  const percentOf = (count: number) => (count / Math.max(stockSignals.length, 1)) * 100
  const percentAbove50 = percentOf(stockSignals.filter((s) => s.dma50 !== undefined && s.close > s.dma50).length)
  const percentAbove200 = percentOf(stockSignals.filter((s) => s.aboveDma200).length)
  let upMoves5d = 0
  let downMoves5d = 0
  for (const session of sessions.slice(-5)) {
    for (const row of session) {
      if (!liquidSymbols.has(row.symbol)) continue
      const change = percentChange(row.prevClose, row.close)
      if (change >= 4) upMoves5d++
      else if (change <= -4) downMoves5d++
    }
  }
  const upDownRatio = upMoves5d / Math.max(downMoves5d, 1)
  const strongSigns = (percentAbove50 >= 60 ? 1 : 0) + (upDownRatio >= 1.5 ? 1 : 0)
  const weakSigns = (percentAbove50 < 40 ? 1 : 0) + (upDownRatio < 0.7 ? 1 : 0)
  const label = weakSigns >= 2 || (weakSigns === 1 && strongSigns === 0) ? "weak" : strongSigns >= 2 ? "strong" : "neutral"
  return { label, percentAbove50, percentAbove200, upMoves5d, downMoves5d }
}

const CAPITAL_BY_REGIME: Record<Regime["label"], string> = {
  strong: "70–100% of trading capital, up to 6 open swing trades",
  neutral: "40–60%, up to 4 open swing trades",
  weak: "0–30%, at most 2 trades and only the very top RS core setups",
}

function formatRegime(regime: Regime, vixLine: string): string {
  return [
    `### Market regime (code): ${regime.label.toUpperCase()} → ${CAPITAL_BY_REGIME[regime.label]}`,
    `${regime.percentAbove50.toFixed(0)}% of liquid stocks above their 50-day average, ${regime.percentAbove200.toFixed(0)}% above the 200-day; last 5 sessions: ${regime.upMoves5d} moves of +4% or more vs ${regime.downMoves5d} of −4% or more${vixLine}`,
    "Rule: strong = ≥60% above the 50-day AND 4% up-moves ≥1.5× down-moves; weak = <40% above the 50-day or up/down <0.7 (with no strong sign).",
  ].join("\n")
}

interface ScanList {
  title: string
  rule: string
  stocks: StockSignal[]
}

function takeTop(stockSignals: StockSignal[], include: (stock: StockSignal) => boolean, sortKey: (stock: StockSignal) => number, limit: number) {
  return stockSignals.filter(include).sort((a, b) => sortKey(b) - sortKey(a)).slice(0, limit)
}

// Context lists — what moved and why. None of these is a pick on its own (see the backtest note above).
export function buildScanLists(stockSignals: StockSignal[]): ScanList[] {
  return [
    { title: "Top gainers", rule: "biggest 1-day rise", stocks: takeTop(stockSignals, (s) => s.changePercent1d > 0, (s) => s.changePercent1d, 15) },
    {
      title: "Top losers",
      rule: "biggest 1-day fall — below the 200-day average = falling knife (bounce buys lost −0.15R a trade in our backtest)",
      stocks: takeTop(stockSignals, (s) => s.changePercent1d < 0, (s) => -s.changePercent1d, 15),
    },
    {
      title: "Accumulation",
      rule: "volume ≥3× average, price up, delivery above its average — big buyers entering",
      stocks: takeTop(stockSignals, (s) => s.volumeRatio >= 3 && s.changePercent1d > 0 && s.deliveryPercent > s.avgDeliveryPercent, (s) => s.volumeRatio, 15),
    },
    { title: "Distribution", rule: "volume ≥3× average, price down — big sellers leaving", stocks: takeTop(stockSignals, (s) => s.volumeRatio >= 3 && s.changePercent1d < 0, (s) => s.volumeRatio, 10) },
    {
      title: "Episodic pivots",
      rule: "gap up ≥4% on ≥3× volume — news-driven; find the news, but no edge as a standalone entry in our backtest",
      stocks: takeTop(stockSignals, (s) => s.gapPercent >= 4 && s.volumeRatio >= 3, (s) => s.gapPercent, 10),
    },
    { title: "20-day breakdowns", rule: "close below the prior 20 sessions' low on ≥1.5× volume — exit/avoid candidates", stocks: takeTop(stockSignals, (s) => s.isBreakdown20d && s.volumeRatio >= 1.5, (s) => s.volumeRatio, 10) },
  ]
}

function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

function formatScanList(scanList: ScanList): string {
  if (scanList.stocks.length === 0) return `### ${scanList.title} (${scanList.rule})\nnone\n`
  const header = "symbol | close ₹ | 1d % | 5d % | 20d % | 3m % | gap % | vol×avg | deliv % (avg) | ATR14 ₹ | from high % | RS | trend"
  const rows = scanList.stocks.map((s) =>
    [
      s.symbol, formatNumber(s.close, 2), formatNumber(s.changePercent1d), formatNumber(s.changePercent5d), formatNumber(s.changePercent20d),
      formatNumber(s.changePercent3m), formatNumber(s.gapPercent), formatNumber(s.volumeRatio), `${formatNumber(s.deliveryPercent, 0)} (${formatNumber(s.avgDeliveryPercent, 0)})`,
      formatNumber(s.atr14, 2), formatNumber(s.percentFromHigh), s.rsRank, s.isStage2Uptrend ? "stage 2" : s.aboveDma200 === undefined ? "?" : s.aboveDma200 ? "above 200DMA" : "below 200DMA",
    ].join(" | "),
  )
  return `### ${scanList.title} (${scanList.rule})\n${header}\n${rows.join("\n")}\n`
}

function formatBhavcopyDate(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-")
  return `${day}${month}${year}`
}

// Past sessions never change — cache them for the life of the process, so only the first scan after a
// restart downloads ~220 files (~90 MB); later scans fetch just the new day. undefined = no file (holiday).
const bhavcopyCache = new Map<string, { sessionDate: string; rows: BhavcopyRow[] } | undefined>()

// Newest first, walking back over weekends/holidays. Today's file only appears after ~6 PM IST, and a holiday's
// URL can serve the previous session's file — so the session date comes from the file's DATE1 column, deduped.
async function fetchRecentSessions(): Promise<{ sessionDates: string[]; sessions: BhavcopyRow[][] }> {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const candidateDates = Array.from({ length: MAX_CALENDAR_DAYS_BACK }, (_, daysBack) => new Date(istNow.getTime() - daysBack * 86_400_000))
    .filter((date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
    .map(formatBhavcopyDate)

  const found: { sessionDate: string; rows: BhavcopyRow[] }[] = []
  const seenSessionDates = new Set<string>()
  const recentUrlDates = new Set(candidateDates.slice(0, 3)) // a missing recent file may still be published later
  for (let batchStart = 0; batchStart < candidateDates.length && found.length < HISTORY_SESSIONS; batchStart += 5) {
    const batch = candidateDates.slice(batchStart, batchStart + 5)
    const batchResults = await Promise.all(
      batch.map(async (urlDate) => {
        if (bhavcopyCache.has(urlDate)) return bhavcopyCache.get(urlDate)
        const response = await fetchNse(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${urlDate}.csv`).catch(() => undefined)
        const csvText = response?.ok ? await response.text() : ""
        const sessionDate = csvText.startsWith("SYMBOL") ? csvText.split("\n")[1]?.split(",")[2]?.trim() : undefined // DATE1, e.g. "01-Oct-2026"
        const result = sessionDate ? { sessionDate, rows: parseBhavcopy(csvText) } : undefined
        if (result || (response?.status === 404 && !recentUrlDates.has(urlDate))) bhavcopyCache.set(urlDate, result)
        return result
      }),
    )
    for (const result of batchResults) {
      if (!result || seenSessionDates.has(result.sessionDate) || found.length >= HISTORY_SESSIONS) continue
      seenSessionDates.add(result.sessionDate)
      found.push(result)
    }
  }
  if (found.length < 6) {
    throw new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.PROVIDER_ERROR, `NSE bhavcopy: only ${found.length} sessions found`)
  }
  found.reverse()
  return { sessionDates: found.map((session) => session.sessionDate), sessions: found.map((session) => session.rows) }
}

// ETFs trade in the EQ series too — exclude them so the lists are stocks only. Empty set if NSE's list fails.
export async function fetchEtfSymbols(): Promise<Set<string>> {
  const response = await fetchNse("https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv").catch(() => undefined)
  const csvText = response?.ok ? await response.text() : ""
  return new Set(csvText.split("\n").slice(1).map((line) => line.split(",")[0].trim()).filter(Boolean))
}

interface NseBreadth { advance?: { count?: { Advances: number; Declines: number; Unchange: number } } }
interface NseFiftyTwoWeekList { data?: { symbol: string; ltp: number; pChange: number }[] }
interface NseAllIndices { data?: { index: string; last: number; percentChange: number; key?: string }[] }

async function fetchMarketContext(etfSymbols: Set<string>): Promise<{ text: string; vixLine: string }> {
  const [breadth, fiftyTwoWeekHighs, fiftyTwoWeekLows, allIndices] = await Promise.all([
    fetchNseJson<NseBreadth>("live-analysis-advance"),
    fetchNseJson<NseFiftyTwoWeekList>("live-analysis-data-52weekhighstock"),
    fetchNseJson<NseFiftyTwoWeekList>("live-analysis-data-52weeklowstock"),
    fetchNseJson<NseAllIndices>("allIndices"),
  ])
  const lines: string[] = []
  const breadthCount = breadth?.advance?.count
  if (breadthCount) lines.push(`Breadth (all NSE): ${breadthCount.Advances} advances / ${breadthCount.Declines} declines / ${breadthCount.Unchange} unchanged`)
  // NSE lists a symbol once per series (EQ, BE, …) — dedupe
  const highSymbols = [...new Set(fiftyTwoWeekHighs?.data?.map((stock) => stock.symbol))].filter((symbol) => !etfSymbols.has(symbol))
  const lowSymbols = [...new Set(fiftyTwoWeekLows?.data?.map((stock) => stock.symbol))].filter((symbol) => !etfSymbols.has(symbol))
  if (highSymbols.length) lines.push(`New 52-week highs (${highSymbols.length}): ${highSymbols.join(", ")}`)
  if (lowSymbols.length) lines.push(`New 52-week lows (${lowSymbols.length}, first 60): ${lowSymbols.slice(0, 60).join(", ")}`)
  const sectorIndices = allIndices?.data?.filter((index) => index.key === "SECTORAL INDICES")
  if (sectorIndices?.length) {
    const sortedSectors = [...sectorIndices].sort((a, b) => b.percentChange - a.percentChange)
    lines.push(`Sectors, best → worst: ${sortedSectors.map((index) => `${index.index.replace("NIFTY ", "")} ${formatNumber(index.percentChange)}%`).join(", ")}`)
  }
  const vix = allIndices?.data?.find((index) => index.index === "INDIA VIX")
  const vixLine = vix ? `; India VIX ${vix.last} (${vix.percentChange > 0 ? "+" : ""}${formatNumber(vix.percentChange)}%) — above 20 = fearful market` : ""
  return { text: lines.join("\n"), vixLine }
}

// Only these raise a setup's rank; results/press release/rating/fund raise are shown but can cut either way
const POSITIVE_EVENTS = new Set<EventKind>(["order", "corporate action", "expansion"])
const INFO_EVENTS = new Set<EventKind>(["results", "rating change", "fund raise", "press release", "price-move query"])
const NEGATIVE_EVENTS = new Set<EventKind>(["regulatory", "management exit"])
const SETUP_LIMITS = { core: 40, leader: 20 }
const PICKS_TO_RECORD = 10
const MAX_EVENTS = 60

function lensesFor(symbol: string, signal: StockSignal | undefined, lenses: MarketLenses) {
  const positive = new Set<string>()
  const keys = new Set<string>() // short lens names for the scorecard, e.g. "order filing", "post-results drift"
  const info = new Set<string>()
  const warnings = new Set<string>()
  const addPositive = (key: string, label = key) => { positive.add(label); keys.add(key) }
  for (const event of lenses.events.filter((e) => e.symbol === symbol)) {
    if (NEGATIVE_EVENTS.has(event.kind)) warnings.add(`⚠️ ${event.kind} filing`)
    else if (POSITIVE_EVENTS.has(event.kind)) addPositive(`${event.kind} filing`)
    else if (INFO_EVENTS.has(event.kind)) info.add(`${event.kind} filing`)
  }
  if (lenses.resultsLastWeek.has(symbol) && signal) {
    if (signal.changePercent5d >= 5) addPositive("post-results drift", `results + ${signal.changePercent5d.toFixed(0)}% in 5d (post-results drift)`)
    else if (signal.changePercent5d <= -5) warnings.add(`⚠️ results then ${signal.changePercent5d.toFixed(0)}% in 5d`)
  }
  for (const deal of lenses.deals.filter((d) => d.symbol === symbol)) {
    if (deal.side === "buy") addPositive(`${deal.isPromoter ? "promoter" : "big-holder"} buy`, `${deal.isPromoter ? "promoter" : "big-holder"} buy ${deal.percent}%`)
    else if (deal.isPromoter) warnings.add(`⚠️ promoter sold ${deal.percent}%`)
  }
  for (const action of lenses.specialSituations.filter((a) => a.symbol === symbol)) addPositive("special situation", `${action.subject} (ex ${action.exDate})`)
  if (lenses.resultsSoon.has(symbol)) warnings.add(`⚠️ results due ${lenses.resultsSoon.get(symbol)} — wait`)
  const caution = lenses.cautions.get(symbol)
  if (caution) warnings.add(`⚠️ ${caution}`)
  return { positive: [...positive], keys: [...keys], info: [...info], warnings: [...warnings] }
}

type RankedSetup = TradeSetup & ReturnType<typeof lensesFor>

// confluence: agreeing lenses push a setup up, warnings push it down; then RS. Core setups before leaders.
function rankWithLenses(setups: TradeSetup[], signalsBySymbol: Map<string, StockSignal>, lenses: MarketLenses): RankedSetup[] {
  const lensScore = (setup: RankedSetup) => setup.positive.length - setup.warnings.length
  return setups
    .map((setup) => ({ ...setup, ...lensesFor(setup.symbol, signalsBySymbol.get(setup.symbol), lenses) }))
    .sort((a, b) => (a.kind !== b.kind ? (a.kind === "core" ? -1 : 1) : lensScore(b) - lensScore(a) || b.rsRank - a.rsRank))
}

function formatSwingSetups(ranked: RankedSetup[]): string {
  const rows = (kind: TradeSetup["kind"]) => {
    const ofKind = ranked.filter((setup) => setup.kind === kind)
    return {
      total: ofKind.length,
      lines: ofKind.slice(0, SETUP_LIMITS[kind]).map((setup) =>
        [setup.symbol, setup.rsRank, setup.close.toFixed(2), setup.entry.toFixed(2), setup.stopLoss.toFixed(2), setup.target.toFixed(2), setup.reasons.join(", "), [...setup.positive, ...setup.info, ...setup.warnings].join("; ") || "—"].join(" | "),
      ),
    }
  }
  const header = "symbol | RS | close ₹ | entry ₹ | stop loss ₹ | target ₹ | trend | other lenses"
  const core = rows("core")
  const leaders = rows("leader")
  return [
    `### Swing setups — CORE (Stage 2 + tight range; backtested +0.24R/trade; stop 2×ATR, target 3R, sell by ~${SWING_HOLD_SESSIONS} sessions) — ${core.total} qualified, top ${core.lines.length}`,
    "Skip a setup if it opens more than 1 ATR above entry (don't chase).",
    header, ...core.lines,
    `### Swing WATCHLIST — leaders (Stage 2 + RS ≥ ${LEADER_MIN_RS}, not tight yet; +0.09R/trade) — ${leaders.total} qualified, top ${leaders.lines.length}`,
    header, ...leaders.lines,
  ].join("\n")
}

function formatLensSections(lenses: MarketLenses, signalsBySymbol: Map<string, StockSignal>, holdingSymbols: Set<string>, excluded: Map<string, string>): string {
  const relevant = (symbol: string) => signalsBySymbol.has(symbol) || holdingSymbols.has(symbol)
  const kindOrder: EventKind[] = ["regulatory", "management exit", "corporate action", "results", "order", "rating change", "fund raise", "expansion", "price-move query", "press release"]
  const events = lenses.events
    .filter((event) => relevant(event.symbol))
    .sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind))
    .slice(0, MAX_EVENTS)
  const driftUp: string[] = []
  const driftDown: string[] = []
  for (const symbol of lenses.resultsLastWeek.keys()) {
    const signal = signalsBySymbol.get(symbol)
    if (!signal) continue
    if (signal.changePercent5d >= 5) driftUp.push(`${symbol} +${signal.changePercent5d.toFixed(0)}% (RS ${signal.rsRank})`)
    else if (signal.changePercent5d <= -5) driftDown.push(`${symbol} ${signal.changePercent5d.toFixed(0)}%`)
  }
  const deals = lenses.deals.filter((deal) => relevant(deal.symbol))
  const resultsSoon = [...lenses.resultsSoon].filter(([symbol]) => relevant(symbol))
  return [
    `### Company filings since the last session (NSE, liquid stocks + holdings; ${events.length} of ${lenses.events.length}) — the "News that moves stocks" source; open the link for detail`,
    "symbol | type | filed | headline | filing",
    ...events.map((event) => [event.symbol, event.kind, event.time, event.headline, event.link].join(" | ")),
    `### Post-results drift (results filed in the last 7 days; Indian studies: stocks keep drifting ~60 days in the direction of the surprise)`,
    `Up ≥5% in 5 sessions: ${driftUp.join(", ") || "none"}`,
    `Down ≥5% in 5 sessions: ${driftDown.join(", ") || "none"}`,
    `### Big-shareholder open-market deals (SAST Reg 29 — ≥5% holders/promoters; insider buys beat the market by ~6.7% over 90 days in Indian data)`,
    ...(deals.length ? deals.map((deal) => `${deal.symbol}: ${deal.side} ${deal.percent}% by ${deal.acquirer}${deal.isPromoter ? " (promoter)" : ""}, ${deal.period}`) : ["none"]),
    `### Special situations — corporate actions in the next 30 days (demergers beat the Nifty by ~16 points in Indian data)`,
    ...(lenses.specialSituations.length ? lenses.specialSituations.map((action) => `${action.symbol}: ${action.subject} — ex-date ${action.exDate}`) : ["none"]),
    `### Results due in the next ~3 days (${resultsSoon.length}) — no fresh swing entries; holders decide before the numbers`,
    resultsSoon.map(([symbol, date]) => `${symbol} (${date})`).join(", ") || "none",
    `### Vetoed — never pick (GSM, ASM stage II+): ${excluded.size} setups removed`,
    [...excluded].map(([symbol, reason]) => `${symbol}: ${reason}`).join("\n") || "none",
  ].join("\n")
}

function formatHoldingsCheck(holdingSymbols: Set<string>, signalsBySymbol: Map<string, StockSignal>, lenses: MarketLenses): string {
  if (!holdingSymbols.size) return ""
  const lines = [...holdingSymbols].map((symbol) => {
    const signal = signalsBySymbol.get(symbol)
    const { positive, info, warnings } = lensesFor(symbol, signal, lenses)
    const veto = lenses.vetoes.get(symbol)
    const trend = !signal ? "not in the liquid NSE scan (ETF, BSE-only or illiquid)"
      : `close ₹${signal.close.toFixed(2)}, 1d ${formatNumber(signal.changePercent1d)}%, 3m ${formatNumber(signal.changePercent3m)}%, RS ${signal.rsRank}, ${signal.isStage2Uptrend ? "stage 2" : signal.aboveDma200 ? "above 200DMA" : "below 200DMA"}${signal.isBreakdown20d ? ", 20-day BREAKDOWN" : ""}`
    const flags = [...positive, ...info, ...warnings]
    return `${symbol}: ${trend}${veto ? ` · ⚠️ ${veto}` : ""}${flags.length ? ` · ${flags.join("; ")}` : ""}`
  })
  return [`### Holdings check (code)`, ...lines].join("\n")
}

// Bhavcopy history minus ETFs, with signals — shared by the morning scan and the 9:30 alert (cached after the first call)
export async function loadStockSignals() {
  const etfSymbols = await fetchEtfSymbols()
  const { sessionDates, sessions: allSessions } = await fetchRecentSessions()
  const sessions = allSessions.map((session) => session.filter((row) => !etfSymbols.has(row.symbol)))
  return { etfSymbols, sessionDates, sessions, stockSignals: computeStockSignals(sessions) }
}

export async function buildMarketScan(holdingSymbols: Set<string> = new Set()): Promise<string> {
  const [{ etfSymbols, sessionDates, sessions, stockSignals }, lenses] = await Promise.all([loadStockSignals(), fetchMarketLenses()])
  const marketContext = await fetchMarketContext(etfSymbols)
  const signalsBySymbol = new Map(stockSignals.map((s) => [s.symbol, s]))
  const excluded = new Map<string, string>()
  const setups = rankSwingSetups(stockSignals).filter((setup) => {
    const veto = lenses.vetoes.get(setup.symbol)
    if (veto) excluded.set(setup.symbol, veto)
    return !veto
  })
  const latestDate = sessionDates[sessionDates.length - 1]
  const regime = assessRegime(stockSignals, sessions)
  const ranked = rankWithLenses(setups, signalsBySymbol, lenses)
  // the top core setups without warnings are what the report can pick from — recorded for the scorecard
  const recordable = ranked.filter((setup) => setup.kind === "core" && !setup.warnings.length).slice(0, PICKS_TO_RECORD)
  await recordPicks(latestDate, recordable.map((setup) => ({
    symbol: setup.symbol, entry: setup.entry, stopLoss: setup.stopLoss, target: setup.target, rsRank: setup.rsRank, lenses: setup.keys, regime: regime.label,
  })))
  return [
    `## Market scan — computed in code from NSE data`,
    `Latest session ${latestDate} · ${sessions[sessions.length - 1].length} stocks scanned (EQ series, ETFs excluded) · ${stockSignals.length} liquid (avg turnover ≥ ₹${MIN_AVG_TURNOVER_LACS} lakh) · ${sessions.length} sessions of history · RS = relative-strength rank 1–99`,
    formatRegime(regime, marketContext.vixLine),
    await buildTrackRecord(sessionDates, sessions),
    marketContext.text,
    formatSwingSetups(ranked),
    formatHoldingsCheck(holdingSymbols, signalsBySymbol, lenses),
    formatLensSections(lenses, signalsBySymbol, holdingSymbols, excluded),
    "### Context lists (what moved — not picks on their own)",
    ...buildScanLists(stockSignals).map(formatScanList),
  ].filter(Boolean).join("\n\n")
}
