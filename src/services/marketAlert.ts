import { fetchNseJson } from "./nse.js"
import { loadStockSignals, rankSwingSetups, type StockSignal } from "./marketScan.js"
import { fetchMarketLenses, type CompanyEvent } from "./marketLenses.js"
import { convertMarkdownToEmailHtml } from "../formats.js"

// 9:30 alert — stocks moving hard on heavy volume since the open (the NIACL case: flat at 9:15, +19% by noon on
// news). Code only, no AI. It's information, not picks: in our backtest, chasing gap-ups lost money; the value is
// seeing the move early, finding its cause, and acting only when it lines up with a core setup.

const MIN_MOVE_PERCENT = 3
const MIN_VOLUME_PERCENT_OF_DAY = 25 // traded so far vs a normal full day — at 9:30 that's ~3× the usual pace
const MAX_ROWS = 15

interface LiveQuote { symbol: string; price: number; changePercent: number; gapPercent: number; volume: number }

interface NseVariationRow { symbol: string; ltp: number; perChange: number; open_price: number; prev_price: number; trade_quantity: number }
interface NseMostActiveRow { symbol: string; lastPrice: number; pChange: number; open: number; previousClose: number; totalTradedVolume: number }
interface NsePreOpenRow { metadata: { symbol: string; iep: number; pChange: number; previousClose: number; finalQuantity: number } }
type NseVariations = Record<string, { data?: NseVariationRow[] } | unknown> & { legends?: unknown }

const percentChange = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : 0)

// "13-Oct-2026 16:00:00" → "13-Oct-2026"; today's date the way NSE prints it, in IST
const nseDay = (timestamp?: string) => timestamp?.split(" ")[0]
function todayInNseFormat(): string {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date())
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part("day")}-${part("month")}-${part("year")}`
}

export async function fetchLiveQuotes(): Promise<{ quotes: Map<string, LiveQuote>; isToday: boolean }> {
  const [gainers, losers, byVolume, byValue, preOpen] = await Promise.all([
    fetchNseJson<NseVariations & { timestamp?: string }>("live-analysis-variations?index=gainers"),
    fetchNseJson<NseVariations>("live-analysis-variations?index=loosers"),
    fetchNseJson<{ data?: NseMostActiveRow[]; timestamp?: string }>("live-analysis-most-active-securities?index=volume"),
    fetchNseJson<{ data?: NseMostActiveRow[] }>("live-analysis-most-active-securities?index=value"),
    fetchNseJson<{ data?: NsePreOpenRow[]; timestamp?: string }>("market-data-pre-open?key=ALL"),
  ])
  const quotes = new Map<string, LiveQuote>()
  // pre-open first (every stock, 9:08 equilibrium price); live lists overwrite with fresher numbers
  for (const { metadata: row } of preOpen?.data ?? []) {
    const gapPercent = percentChange(row.previousClose, row.iep)
    quotes.set(row.symbol, { symbol: row.symbol, price: row.iep, changePercent: gapPercent, gapPercent, volume: row.finalQuantity })
  }
  for (const list of [gainers, losers]) {
    for (const [group, value] of Object.entries(list ?? {})) {
      if (group === "legends" || group === "timestamp") continue
      for (const row of (value as { data?: NseVariationRow[] }).data ?? []) {
        quotes.set(row.symbol, { symbol: row.symbol, price: row.ltp, changePercent: row.perChange, gapPercent: percentChange(row.prev_price, row.open_price), volume: row.trade_quantity })
      }
    }
  }
  for (const row of [...(byVolume?.data ?? []), ...(byValue?.data ?? [])]) {
    quotes.set(row.symbol, { symbol: row.symbol, price: row.lastPrice, changePercent: row.pChange, gapPercent: percentChange(row.previousClose, row.open), volume: row.totalTradedVolume })
  }
  const today = todayInNseFormat()
  const isToday = [nseDay(byVolume?.timestamp), nseDay(preOpen?.timestamp)].includes(today)
  return { quotes, isToday }
}

export interface MoverAlert { count: number; subject: string; html: string }

export function selectMovers(quotes: Iterable<LiveQuote>, signalsBySymbol: Map<string, StockSignal>) {
  return [...quotes]
    .map((quote) => {
      const signal = signalsBySymbol.get(quote.symbol)
      const volumePercentOfDay = signal && signal.avgVolume20 > 0 ? (quote.volume / signal.avgVolume20) * 100 : 0
      return { quote, signal, volumePercentOfDay }
    })
    .filter(({ quote, signal, volumePercentOfDay }) =>
      signal && Math.abs(quote.changePercent) >= MIN_MOVE_PERCENT && volumePercentOfDay >= MIN_VOLUME_PERCENT_OF_DAY)
    .sort((a, b) => Math.abs(b.quote.changePercent) * Math.min(b.volumePercentOfDay, 500) - Math.abs(a.quote.changePercent) * Math.min(a.volumePercentOfDay, 500))
    .slice(0, MAX_ROWS)
}

function describeSetup(signal: StockSignal, coreSymbols: Set<string>): string {
  if (coreSymbols.has(signal.symbol)) return "🟢 core swing setup — see the morning report for levels"
  const trend = signal.isStage2Uptrend ? "stage 2" : signal.aboveDma200 ? "above 200DMA" : "below 200DMA"
  return `RS ${signal.rsRank}, ${trend} — no setup`
}

function describeCause(events: CompanyEvent[]): string {
  if (!events.length) return "no NSE filing yet — check the news"
  return events.slice(0, 2).map((event) => `${event.kind}: ${event.headline.slice(0, 80)}${event.link ? ` [NSE](${event.link})` : ""}`).join("; ")
}

export async function buildMoverAlert(): Promise<MoverAlert> {
  const [{ stockSignals }, { quotes, isToday }, lenses] = await Promise.all([loadStockSignals(), fetchLiveQuotes(), fetchMarketLenses()])
  const time = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
  if (!isToday) return { count: 0, subject: "", html: "" } // holiday or weekend — NSE still serves the last session's data
  const signalsBySymbol = new Map(stockSignals.map((s) => [s.symbol, s]))
  const coreSymbols = new Set(rankSwingSetups(stockSignals).filter((setup) => setup.kind === "core").map((setup) => setup.symbol))
  const movers = selectMovers(quotes.values(), signalsBySymbol)
  if (!movers.length) return { count: 0, subject: "", html: "" }

  const rows = movers.map(({ quote, signal, volumePercentOfDay }) => {
    const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
    return [
      `${quote.changePercent > 0 ? "🟢" : "🔴"} **${quote.symbol}** [chart](https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(quote.symbol)})`,
      `${sign(quote.changePercent)} at ₹${quote.price} (opened ${sign(quote.gapPercent)})`,
      `${Math.round(volumePercentOfDay)}% of a normal day`,
      describeCause(lenses.events.filter((event) => event.symbol === quote.symbol)),
      describeSetup(signal!, coreSymbols),
    ].join(" | ")
  })
  const markdown = [
    `# Stocks moving now — ${time}`,
    `> Big moves on heavy volume since the open. **Information, not picks:** chasing a move like this lost money in our backtest. Use it to spot news early; buy only stocks marked as a core swing setup, near the morning report's entry.`,
    "| Stock | Move | Volume so far | Why | Setup |",
    "|---|---|---|---|---|",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n")
  return { count: movers.length, subject: `⚡ ${movers.length} stocks moving — ${time}`, html: convertMarkdownToEmailHtml(markdown) }
}
