import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"

// Scans every NSE EQ stock in code — Claude's WebFetch summarises pages with a small model, so it can't
// reliably read a 400 KB file of ~2,600 stocks. The result is a compact text block for the market-analyst prompt.

const NSE_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36" }
// ~10 months: 200-day average plus 20 sessions to tell whether it's rising (Minervini trend template)
const HISTORY_SESSIONS = 220
const MAX_CALENDAR_DAYS_BACK = 340 // weekends and holidays in between
// ₹50 lakh average daily turnover — below that a pick may be impossible to buy/sell at the quoted price
const MIN_AVG_TURNOVER_LACS = 50
const FETCH_TIMEOUT_MS = 20_000

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
    stockSignals.push({
      symbol: latest.symbol,
      close: latest.close,
      changePercent1d: percentChange(latest.prevClose, latest.close),
      changePercent5d: percentChange(history[Math.max(0, history.length - 6)].close, latest.close),
      changePercent20d: percentChange(priorSessions[0].close, latest.close),
      gapPercent: percentChange(latest.prevClose, latest.open),
      volumeRatio: avgVolume > 0 ? latest.volume / avgVolume : 0,
      deliveryPercent: latest.deliveryPercent,
      avgDeliveryPercent: average(priorSessions.map((row) => row.deliveryPercent)),
      atr14: average(trueRanges),
      isBreakout20d: latest.close > Math.max(...priorSessions.map((row) => row.high)),
      isBreakdown20d: latest.close < Math.min(...priorSessions.map((row) => row.low)),
      changePercent3m: percentChange(history[Math.max(0, history.length - 64)].close, latest.close),
      percentFromHigh: percentChange(historyHigh, latest.close),
      aboveDma200: dma200 === undefined ? undefined : latest.close > dma200,
      isStage2Uptrend,
      high: latest.high,
      low: latest.low,
      closePosition: latest.high > latest.low ? (latest.close - latest.low) / (latest.high - latest.low) : 0.5,
      dma20: movingAverage(20) ?? average(closes),
      dma50,
      dma200,
    })
  }
  return stockSignals
}

// Rule-based setups scored for EVERY liquid stock, with levels computed here — so reward:risk is ≥ 2 by
// construction and the AI only has to news-check the top of each list.
export type SetupType = "intraday long" | "intraday short" | "swing long"

export interface TradeSetup {
  symbol: string
  setupType: SetupType
  score: number // 0–100
  close: number
  entry: number
  stopLoss: number
  target: number
  reasons: string[]
}

const INTRADAY_STOP_ATR = 0.6
const SWING_STOP_ATR = 2
const REWARD_TO_RISK = 2
const SWING_HOLD_SESSIONS = 15

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function roundPrice(price: number): number {
  return Math.round(price * 20) / 20 // NSE tick size ₹0.05
}

function buildIntradaySetup(s: StockSignal, direction: "long" | "short"): TradeSetup | undefined {
  const isLong = direction === "long"
  const movedWithTrend = isLong ? s.changePercent1d > 0 && s.closePosition >= 0.7 && s.close > s.dma20 : s.changePercent1d < 0 && s.closePosition <= 0.3 && s.close < s.dma20
  if (!movedWithTrend || s.volumeRatio < 1.5 || s.atr14 <= 0) return undefined

  // trigger beyond yesterday's extreme — the move has to continue before you're in
  const entry = roundPrice(isLong ? s.high * 1.001 : s.low * 0.999)
  const risk = INTRADAY_STOP_ATR * s.atr14
  const trendBonus = isLong ? (s.isStage2Uptrend ? 1 : s.aboveDma200 ? 0.5 : 0) : s.aboveDma200 === false ? 1 : 0
  const score =
    35 * clamp01(s.volumeRatio / 5) +
    20 * clamp01(isLong ? s.closePosition : 1 - s.closePosition) +
    20 * clamp01(Math.abs(s.changePercent1d) / 8) +
    15 * trendBonus +
    10 * clamp01(s.deliveryPercent / Math.max(s.avgDeliveryPercent, 1) - 0.5)
  const reasons = [
    `vol ${s.volumeRatio.toFixed(1)}×`,
    `${s.changePercent1d > 0 ? "+" : ""}${s.changePercent1d.toFixed(1)}% closing near the ${isLong ? "high" : "low"}`,
    ...(s.isBreakout20d && isLong ? ["20-day breakout"] : []),
    ...(s.isBreakdown20d && !isLong ? ["20-day breakdown"] : []),
    ...(s.isStage2Uptrend && isLong ? ["stage 2"] : []),
  ]
  return {
    symbol: s.symbol, setupType: isLong ? "intraday long" : "intraday short", score: Math.round(score), close: s.close, entry,
    stopLoss: roundPrice(isLong ? entry - risk : entry + risk),
    target: roundPrice(isLong ? entry + REWARD_TO_RISK * risk : entry - REWARD_TO_RISK * risk),
    reasons,
  }
}

function buildSwingSetup(s: StockSignal): TradeSetup | undefined {
  if (!s.aboveDma200 || s.atr14 <= 0 || s.isBreakdown20d) return undefined
  const isAccumulation = s.volumeRatio >= 2 && s.changePercent1d > 0 && s.deliveryPercent > s.avgDeliveryPercent
  const isPullbackToDma50 = s.dma50 !== undefined && s.dma200 !== undefined && s.dma50 > s.dma200 && s.close >= s.dma50 && s.close <= s.dma50 * 1.03
  const isBreakoutOnVolume = s.isBreakout20d && s.volumeRatio >= 1.5
  if (!s.isStage2Uptrend && !isAccumulation && !isPullbackToDma50 && !isBreakoutOnVolume) return undefined

  const entry = roundPrice(s.close)
  const risk = SWING_STOP_ATR * s.atr14
  const score =
    30 * (s.isStage2Uptrend ? 1 : 0.4) +
    25 * clamp01(s.changePercent3m / 60) +
    15 * (isBreakoutOnVolume ? 1 : 0) +
    15 * (isAccumulation ? 1 : 0) +
    10 * clamp01(1 + s.percentFromHigh / 15) + // closer to the high = stronger
    5 * (isPullbackToDma50 ? 1 : 0)
  const reasons = [
    ...(s.isStage2Uptrend ? ["stage 2"] : ["above 200DMA"]),
    `3m ${s.changePercent3m > 0 ? "+" : ""}${s.changePercent3m.toFixed(0)}%`,
    ...(isBreakoutOnVolume ? [`20-day breakout, vol ${s.volumeRatio.toFixed(1)}×`] : []),
    ...(isAccumulation ? ["accumulation"] : []),
    ...(isPullbackToDma50 ? ["pullback to 50DMA"] : []),
    `${s.percentFromHigh.toFixed(0)}% from high`,
  ]
  return {
    symbol: s.symbol, setupType: "swing long", score: Math.round(score), close: s.close, entry,
    stopLoss: roundPrice(entry - risk), target: roundPrice(entry + REWARD_TO_RISK * risk), reasons,
  }
}

export function buildTradeSetups(stockSignals: StockSignal[]): Record<SetupType, TradeSetup[]> {
  const rank = (setups: (TradeSetup | undefined)[]) => setups.filter((setup): setup is TradeSetup => !!setup).sort((a, b) => b.score - a.score)
  return {
    "intraday long": rank(stockSignals.map((s) => buildIntradaySetup(s, "long"))),
    "intraday short": rank(stockSignals.map((s) => buildIntradaySetup(s, "short"))),
    "swing long": rank(stockSignals.map(buildSwingSetup)),
  }
}

const SETUP_LIST_LIMITS: Record<SetupType, number> = { "intraday long": 50, "intraday short": 30, "swing long": 60 }

function formatTradeSetups(setupsByType: Record<SetupType, TradeSetup[]>): string {
  const sections = (Object.keys(setupsByType) as SetupType[]).map((setupType) => {
    const setups = setupsByType[setupType]
    const rows = setups.slice(0, SETUP_LIST_LIMITS[setupType]).map((setup) =>
      [setup.symbol, setup.score, setup.close.toFixed(2), setup.entry.toFixed(2), setup.stopLoss.toFixed(2), setup.target.toFixed(2), setup.reasons.join(", ")].join(" | "),
    )
    const holdNote = setupType === "swing long" ? `; sell by ~${SWING_HOLD_SESSIONS} sessions` : "; square off same day"
    return [
      `### Ranked ${setupType} setups (${setups.length} qualified, top ${rows.length} shown; reward:risk ${REWARD_TO_RISK}×${holdNote})`,
      "symbol | score | close ₹ | entry ₹ | stop loss ₹ | target ₹ | why",
      ...rows,
    ].join("\n")
  })
  return sections.join("\n\n")
}

interface ScanList {
  title: string
  rule: string
  stocks: StockSignal[]
}

function takeTop(stockSignals: StockSignal[], include: (stock: StockSignal) => boolean, sortKey: (stock: StockSignal) => number, limit: number) {
  return stockSignals.filter(include).sort((a, b) => sortKey(b) - sortKey(a)).slice(0, limit)
}

export function buildScanLists(stockSignals: StockSignal[]): ScanList[] {
  return [
    { title: "Top gainers", rule: "biggest 1-day rise", stocks: takeTop(stockSignals, (s) => s.changePercent1d > 0, (s) => s.changePercent1d, 25) },
    { title: "Top losers", rule: "biggest 1-day fall — oversold bounce or falling knife", stocks: takeTop(stockSignals, (s) => s.changePercent1d < 0, (s) => -s.changePercent1d, 25) },
    {
      title: "Accumulation",
      rule: "volume ≥3× average, price up, delivery above its average — big buyers entering",
      stocks: takeTop(stockSignals, (s) => s.volumeRatio >= 3 && s.changePercent1d > 0 && s.deliveryPercent > s.avgDeliveryPercent, (s) => s.volumeRatio, 25),
    },
    { title: "Distribution", rule: "volume ≥3× average, price down — big sellers leaving", stocks: takeTop(stockSignals, (s) => s.volumeRatio >= 3 && s.changePercent1d < 0, (s) => s.volumeRatio, 15) },
    {
      title: "Episodic pivots",
      rule: "gap up ≥4% at the open on ≥3× volume — usually news-driven, strong swing setups",
      stocks: takeTop(stockSignals, (s) => s.gapPercent >= 4 && s.volumeRatio >= 3, (s) => s.gapPercent, 15),
    },
    { title: "20-day breakouts", rule: "close above the prior 20 sessions' high on ≥1.5× volume", stocks: takeTop(stockSignals, (s) => s.isBreakout20d && s.volumeRatio >= 1.5, (s) => s.volumeRatio, 25) },
    { title: "20-day breakdowns", rule: "close below the prior 20 sessions' low on ≥1.5× volume", stocks: takeTop(stockSignals, (s) => s.isBreakdown20d && s.volumeRatio >= 1.5, (s) => s.volumeRatio, 15) },
    {
      title: "Stage 2 uptrends near highs",
      rule: "Minervini trend template, within 10% of the ~10-month high, strongest 3-month return first — swing and multibagger candidates",
      stocks: takeTop(stockSignals, (s) => s.isStage2Uptrend && s.percentFromHigh >= -10, (s) => s.changePercent3m, 30),
    },
    { title: "20-day leaders", rule: "strongest 20-session return — relative strength", stocks: takeTop(stockSignals, () => true, (s) => s.changePercent20d, 20) },
  ]
}

function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

function formatScanList(scanList: ScanList): string {
  if (scanList.stocks.length === 0) return `### ${scanList.title} (${scanList.rule})\nnone\n`
  const header = "symbol | close ₹ | 1d % | 5d % | 20d % | 3m % | gap % | vol×avg | deliv % (avg) | ATR14 ₹ | from high % | trend"
  const rows = scanList.stocks.map((s) =>
    [
      s.symbol, formatNumber(s.close, 2), formatNumber(s.changePercent1d), formatNumber(s.changePercent5d), formatNumber(s.changePercent20d),
      formatNumber(s.changePercent3m), formatNumber(s.gapPercent), formatNumber(s.volumeRatio), `${formatNumber(s.deliveryPercent, 0)} (${formatNumber(s.avgDeliveryPercent, 0)})`,
      formatNumber(s.atr14, 2), formatNumber(s.percentFromHigh), s.isStage2Uptrend ? "stage 2" : s.aboveDma200 === undefined ? "?" : s.aboveDma200 ? "above 200DMA" : "below 200DMA",
    ].join(" | "),
  )
  return `### ${scanList.title} (${scanList.rule})\n${header}\n${rows.join("\n")}\n`
}

async function fetchNse(url: string): Promise<Response> {
  return fetch(url, { headers: NSE_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
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
async function fetchEtfSymbols(): Promise<Set<string>> {
  const response = await fetchNse("https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv").catch(() => undefined)
  const csvText = response?.ok ? await response.text() : ""
  return new Set(csvText.split("\n").slice(1).map((line) => line.split(",")[0].trim()).filter(Boolean))
}

// Optional extras — the scan still works if one of these NSE endpoints fails
async function fetchNseJson<T>(path: string): Promise<T | undefined> {
  const response = await fetchNse(`https://www.nseindia.com/api/${path}`).catch(() => undefined)
  return response?.ok ? ((await response.json().catch(() => undefined)) as T | undefined) : undefined
}

interface NseBreadth { advance?: { count?: { Advances: number; Declines: number; Unchange: number } } }
interface NseFiftyTwoWeekList { data?: { symbol: string; ltp: number; pChange: number }[] }
interface NseAllIndices { data?: { index: string; percentChange: number; key?: string }[] }

async function fetchMarketContext(etfSymbols: Set<string>): Promise<string> {
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
  return lines.join("\n")
}

export async function buildMarketScan(): Promise<string> {
  const etfSymbols = await fetchEtfSymbols()
  const [{ sessionDates, sessions: allSessions }, marketContext] = await Promise.all([fetchRecentSessions(), fetchMarketContext(etfSymbols)])
  const sessions = allSessions.map((session) => session.filter((row) => !etfSymbols.has(row.symbol)))
  const stockSignals = computeStockSignals(sessions)
  const scanLists = buildScanLists(stockSignals)
  const latestDate = sessionDates[sessionDates.length - 1]
  return [
    `## Market scan — computed in code from NSE bhavcopy`,
    `Latest session ${latestDate} · ${sessions[sessions.length - 1].length} stocks scanned (EQ series, ETFs excluded) · ${stockSignals.length} liquid (avg turnover ≥ ₹${MIN_AVG_TURNOVER_LACS} lakh) · ${sessions.length} sessions of history`,
    marketContext,
    formatTradeSetups(buildTradeSetups(stockSignals)),
    ...scanLists.map(formatScanList),
  ].filter(Boolean).join("\n\n")
}
