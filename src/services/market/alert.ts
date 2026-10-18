import { fetchNse, fetchNseJson } from "./nse.js"
import { loadStockSignals, type StockSignal } from "./scan.js"
import { fetchMarketLenses, type CompanyEvent, type EventKind } from "./lenses.js"
import { readHoldings } from "./holdings.js"
import { buildIpoClosingToday } from "./ipo.js"
import { readJson, writeJson, todayIst, nseDate } from "./store.js"
import type { ReportPick } from "./scorecard.js"
import { convertMarkdownToEmailHtml } from "../../formats.js"

// Market check at 10:00 and 14:00 — code only, no AI. Chosen from 5-minute data on 1,100 stocks (13–16 Oct):
// 10:00 + 14:00 caught 91% of the day's ≥5% moves vs 37% for 9:30 alone, and 10:00 is when the opening swings
// settle (bad fills 13% vs 30% at the open) — so it's also when the report's picks are bought.
// What it's for: buy/skip for today's picks, your holdings, and what's moving with a label saying how such
// moves usually end. Not for chasing: after 9:30, up-moves without news kept going only ~1 in 3 times.

const MIN_MOVE_PERCENT = 3
const MIN_RELATIVE_VOLUME = 2 // volume so far ÷ what a normal day has traded by this time
const MIN_THIN_STOCK_VALUE_CR = 10 // a normally illiquid stock counts once ₹10 cr trades today
const HOLDING_MOVE_PERCENT = 2
const MAX_MOVERS_PER_SIDE = 12
const CLIMAX_RELATIVE_VOLUME = 40

// Share of a day's volume normally traded by each time (median, 1,100 NSE stocks, 5-minute bars, Oct 2026)
const VOLUME_CURVE: [string, number][] = [
  ["09:15", 0], ["09:30", 0.05], ["10:00", 0.15], ["10:30", 0.24], ["11:00", 0.31], ["12:00", 0.45],
  ["13:00", 0.57], ["14:00", 0.69], ["14:30", 0.76], ["15:00", 0.85], ["15:30", 1],
]

export function expectedVolumeShare(hhmm: string): number {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const now = minutes(hhmm)
  for (let i = 1; i < VOLUME_CURVE.length; i++) {
    const [t0, v0] = VOLUME_CURVE[i - 1]
    const [t1, v1] = VOLUME_CURVE[i]
    if (now <= minutes(t1)) return Math.max(0.03, v0 + ((v1 - v0) * (now - minutes(t0))) / (minutes(t1) - minutes(t0)))
  }
  return 1
}

export interface LiveQuote { symbol: string; price: number; changePercent: number; gapPercent: number; volume: number; valueCr: number; series?: string }

interface NseTradedRow { symbol: string; series: string; lastPrice: number; pchange: number; previousClose: number; totalTradedVolume: number; totalTradedValue: number }
interface NsePreOpenRow { metadata: { symbol: string; iep: number; previousClose: number } }
interface NseMarketStatus { marketState?: { market: string; tradeDate: string; last: number; percentChange: number }[] }

const percentChange = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : 0)

// Every traded stock (volume in lakh shares, value in ₹ crore) + the 9:08 opening price from the pre-open auction
async function fetchLiveMarket() {
  const [traded, preOpen, status] = await Promise.all([
    fetchNseJson<{ total?: { data?: NseTradedRow[] } }>("live-analysis-stocksTraded"),
    fetchNseJson<{ data?: NsePreOpenRow[] }>("market-data-pre-open?key=ALL"),
    fetchNseJson<NseMarketStatus>("marketStatus"),
  ])
  const openPrice = new Map((preOpen?.data ?? []).map(({ metadata }) => [metadata.symbol, metadata.iep]))
  const quotes = new Map<string, LiveQuote>()
  for (const row of traded?.total?.data ?? []) {
    if (row.series !== "EQ" && row.series !== "BE") continue
    const open = openPrice.get(row.symbol)
    quotes.set(row.symbol, {
      symbol: row.symbol, price: row.lastPrice, changePercent: row.pchange,
      gapPercent: open ? percentChange(row.previousClose, open) : 0,
      volume: row.totalTradedVolume * 1e5, valueCr: row.totalTradedValue, series: row.series,
    })
  }
  const capitalMarket = status?.marketState?.find((state) => state.market === "Capital Market")
  const sinceOpen = [...quotes.values()].filter((quote) => openPrice.has(quote.symbol))
  return {
    quotes,
    isTradingDay: capitalMarket?.tradeDate.startsWith(nseDate()) ?? false,
    nifty: capitalMarket ? { last: capitalMarket.last, changePercent: capitalMarket.percentChange } : undefined,
    risingSinceOpen: sinceOpen.filter((quote) => quote.price > openPrice.get(quote.symbol)!).length,
    fallingSinceOpen: sinceOpen.filter((quote) => quote.price < openPrice.get(quote.symbol)!).length,
  }
}

// How such moves usually end — from 42 alert rows (14–16 Oct) checked against the close and next day
export type MoveLabel = "not a real move" | "bad news, may continue" | "news-backed" | "likely to fade" | "falling, no news found"
const LABEL_TEXT: Record<MoveLabel, string> = {
  "not a real move": "⚪ not a real move",
  "bad news, may continue": "⚠️ bad news — may keep falling",
  "news-backed": "🟢 news-backed — may drift for days; watch, don't chase",
  "likely to fade": "🔴 likely to fade — don't chase",
  "falling, no news found": "⚠️ falling, no news found",
}
const BAD_NEWS: EventKind[] = ["regulatory", "management exit"]

export function labelMove(quote: LiveQuote, events: CompanyEvent[], exDateAction: string | undefined, relativeVolume: number): MoveLabel {
  if (exDateAction) return "not a real move"
  const isUp = quote.changePercent > 0
  const hasBadNews = events.some((event) => BAD_NEWS.includes(event.kind))
  const hasNews = events.some((event) => event.kind !== "price-move query")
  if (!isUp && (hasBadNews || events.some((event) => event.kind === "results"))) return "bad news, may continue"
  // mostly an opening gap or a volume climax (≈3 days' volume by 9:30 ≈ 60× the normal pace): these mostly faded
  const mostlyGap = Math.abs(quote.gapPercent) >= 0.6 * Math.abs(quote.changePercent)
  if (isUp && (!hasNews || mostlyGap || relativeVolume >= CLIMAX_RELATIVE_VOLUME)) return "likely to fade"
  if (hasNews) return "news-backed"
  return "falling, no news found"
}

// Google News headline that explains the move: it must name the company and be about business, and not just
// restate the move ("shares up 13%") — otherwise "Amal" finds Amal Clooney and a fund house finds its funds
const RESTATES_THE_MOVE = /share price|stock price|shares? (today )?(up|down|rise|fall|jump|surge|gain|slip|plunge|soar|tank|zoom|rall)|top (gainers|losers)|volume gainers|stocks? to (watch|buy)|technical (view|outlook)|valuation snapshot|52[- ]week|hits upper circuit|hits lower circuit/i
const ABOUT_BUSINESS = /share|stock|nse|bse|q[1-4]|result|profit|revenue|earning|order|contract|ipo|dividend|stake|deal|acqui|merger|rating|target|crore|₹|rs\.? ?\d|plant|ceo|cfo|board|sebi|raid|fraud|tender|launch|approval/i

// headlines say "Quick Heal", not "Quick Heal Technologies" — match and search on the first two words
export function shortCompanyName(legalName: string): string {
  return legalName.replace(/\s+(Limited|Ltd\.?)$/i, "").split(/\s+/).slice(0, 2).join(" ")
}

export function pickExplainingHeadline(titles: string[], companyName: string): string | undefined {
  const name = companyName.toLowerCase()
  return titles.find((title) => title.toLowerCase().includes(name) && ABOUT_BUSINESS.test(title) && !RESTATES_THE_MOVE.test(title))
}

async function fetchHeadline(companyName: string): Promise<{ title: string; link: string } | undefined> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${companyName}" when:1d`)}&hl=en-IN&gl=IN&ceid=IN:en`
  const xml = await fetch(url, { signal: AbortSignal.timeout(8000) }).then((response) => (response.ok ? response.text() : "")).catch(() => "")
  const items = [...xml.matchAll(/<item>.*?<title>(.*?)<\/title>.*?<link>(.*?)<\/link>/gs)].map((match) => ({
    title: match[1].replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"'), link: match[2],
  }))
  const title = pickExplainingHeadline(items.map((item) => item.title), companyName)
  return items.find((item) => item.title === title)
}

// NSE's symbol → company name list, for news searches (cached for the process)
let companyNames: Map<string, string> | undefined
async function loadCompanyNames(): Promise<Map<string, string>> {
  if (companyNames?.size) return companyNames
  const csv = await fetchNse("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv").then((response) => (response.ok ? response.text() : "")).catch(() => "")
  companyNames = new Map(csv.split("\n").slice(1).map((line) => line.split(",")).filter((fields) => fields[1])
    .map(([symbol, name]) => [symbol.trim(), shortCompanyName(name.trim())]))
  return companyNames
}

interface AlertRow { symbol: string; price: number; changePercent: number; label: MoveLabel }
interface AlertRun { time: string; rows: AlertRow[] }

export interface Mover { quote: LiveQuote; signal?: StockSignal; relativeVolume: number }

// EQ series only (BE = trade-for-trade, usually under surveillance) and no ETFs — they aren't stock moves
export function selectMovers(quotes: Iterable<LiveQuote>, signalsBySymbol: Map<string, StockSignal>, volumeShareNow: number, etfSymbols = new Set<string>()): Mover[] {
  return [...quotes]
    .filter((quote) => quote.series !== "BE" && !etfSymbols.has(quote.symbol))
    .map((quote) => {
      const signal = signalsBySymbol.get(quote.symbol)
      const relativeVolume = signal && signal.avgVolume20 > 0 ? quote.volume / (signal.avgVolume20 * volumeShareNow) : Infinity
      return { quote, signal, relativeVolume }
    })
    .filter(({ quote, signal, relativeVolume }) => Math.abs(quote.changePercent) >= MIN_MOVE_PERCENT &&
      (signal ? relativeVolume >= MIN_RELATIVE_VOLUME : quote.valueCr >= MIN_THIN_STOCK_VALUE_CR))
    .sort((a, b) => Math.abs(b.quote.changePercent) * Math.min(b.relativeVolume, 20) - Math.abs(a.quote.changePercent) * Math.min(a.relativeVolume, 20))
}

export function buyOrSkip(pick: ReportPick, quote: LiveQuote | undefined, badNews: boolean): string {
  if (!quote) return "no live price — check manually"
  const skipAbove = pick.entry + 0.5 * (pick.entry - pick.stopLoss) // same rule the scorecard uses
  if (badNews) return `⚠️ bad news filed today — skip`
  if (quote.price <= pick.stopLoss) return `❌ below the stop loss (₹${pick.stopLoss}) — skip`
  if (quote.price > skipAbove) return `❌ above ₹${skipAbove.toFixed(1)} — skip today, don't chase`
  return `✅ buy zone — limit order at about ₹${quote.price} (no higher than ₹${skipAbove.toFixed(1)}), then set SL ₹${pick.stopLoss}`
}

const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
const chart = (symbol: string) => `[chart](https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)})`

export interface MoverAlert { count: number; subject: string; html: string }

export async function buildMoverAlert(): Promise<MoverAlert> {
  const [{ stockSignals, etfSymbols }, live, lenses, holdings, names] = await Promise.all([
    loadStockSignals(), fetchLiveMarket(), fetchMarketLenses(), readHoldings(), loadCompanyNames(),
  ])
  if (!live.isTradingDay || !live.quotes.size) return { count: 0, subject: "", html: "" } // weekend or holiday
  const hhmm = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(11, 16)
  const signalsBySymbol = new Map(stockSignals.map((s) => [s.symbol, s]))
  const eventsFor = (symbol: string) => lenses.events.filter((event) => event.symbol === symbol)
  const runsFile = `alerts/${todayIst()}.json`
  const earlierRuns = (await readJson<AlertRun[]>(runsFile)) ?? []
  const earlier = new Map(earlierRuns.flatMap((run) => run.rows.map((row) => [row.symbol, row] as const)))

  const all = selectMovers(live.quotes.values(), signalsBySymbol, expectedVolumeShare(hhmm), etfSymbols)
  const labelled = all.map((mover) => ({ ...mover, label: labelMove(mover.quote, eventsFor(mover.quote.symbol), lenses.exToday.get(mover.quote.symbol), mover.relativeVolume) }))
  const exDate = labelled.filter((mover) => mover.label === "not a real move")
  // new since the earlier run, or moved ≥3 more points
  const fresh = labelled.filter((mover) => mover.label !== "not a real move" &&
    (!earlier.has(mover.quote.symbol) || Math.abs(mover.quote.changePercent - earlier.get(mover.quote.symbol)!.changePercent) >= 3))
  const ups = fresh.filter((mover) => mover.quote.changePercent > 0).slice(0, MAX_MOVERS_PER_SIDE)
  const downs = fresh.filter((mover) => mover.quote.changePercent < 0).slice(0, MAX_MOVERS_PER_SIDE)

  // why: NSE filing first; else a news headline that explains it (looked up only for the rows shown)
  const holdingRows = [...holdings.symbols].map((symbol) => live.quotes.get(symbol)).filter((quote): quote is LiveQuote => !!quote && Math.abs(quote.changePercent) >= HOLDING_MOVE_PERCENT)
  const needNews = [...new Set([...ups, ...downs].map((mover) => mover.quote.symbol).concat(holdingRows.map((quote) => quote.symbol)))].filter((symbol) => !eventsFor(symbol).length)
  const headlines = new Map(await Promise.all(needNews.map(async (symbol) => [symbol, names.get(symbol) ? await fetchHeadline(names.get(symbol)!) : undefined] as const)))
  const why = (symbol: string) => {
    const events = eventsFor(symbol)
    if (events.length) return events.slice(0, 2).map((event) => `${event.kind}: ${event.headline.slice(0, 70)}${event.link ? ` [NSE](${event.link})` : ""}`).join("; ")
    const headline = headlines.get(symbol)
    return headline ? `${headline.title.slice(0, 90)} [news](${headline.link})` : "no reason found yet"
  }

  const sections: string[] = []
  const reportPicks = (await readJson<ReportPick[]>(`report-picks/${todayIst()}.json`)) ?? []
  if (reportPicks.length) {
    sections.push(
      `## Today's picks — buy or skip (live ${hhmm})`,
      "| Stock | Now | Entry · SL | Decision |", "|---|---|---|---|",
      ...reportPicks.map((pick) => {
        const quote = live.quotes.get(pick.symbol)
        const badNews = eventsFor(pick.symbol).some((event) => BAD_NEWS.includes(event.kind))
        const decision = buyOrSkip(pick, quote, badNews)
        return `| ${decision.startsWith("✅") ? "🟢" : "🔴"} **${pick.symbol}** ${chart(pick.symbol)} | ${quote ? `₹${quote.price} (${sign(quote.changePercent)})` : "—"} | ₹${pick.entry} · SL ₹${pick.stopLoss} | ${decision} |`
      }),
    )
  }
  // the closing-day apply/skip needs the afternoon QIB number — QIB money mostly comes in on the last day
  const ipoRows = hhmm >= "13:00" ? await buildIpoClosingToday() : []
  sections.push(...ipoRows)
  if (holdingRows.length) {
    sections.push(
      `## Your holdings moving ≥${HOLDING_MOVE_PERCENT}%`, "| Stock | Move | Why |", "|---|---|---|",
      ...holdingRows.map((quote) => `| ${quote.changePercent > 0 ? "🟢" : "🔴"} **${quote.symbol}** | ${sign(quote.changePercent)} at ₹${quote.price} | ${why(quote.symbol)} |`),
    )
  }
  if (earlierRuns.length) {
    const checked = [...earlier.values()].map((row) => ({ row, now: live.quotes.get(row.symbol) })).filter((entry) => entry.now)
    const held = checked.filter(({ row, now }) => Math.sign(now!.changePercent) === Math.sign(row.changePercent) && Math.abs(now!.changePercent) >= 0.75 * Math.abs(row.changePercent))
    const faded = checked.filter((entry) => !held.includes(entry))
    const list = (entries: typeof checked) => entries.map(({ row, now }) => `${row.symbol} ${sign(now!.changePercent)} (was ${sign(row.changePercent)})`).join(", ") || "none"
    sections.push(`## Earlier movers — held or faded`, `**Held:** ${list(held)}`, "", `**Faded:** ${list(faded)}`)
  }
  const moverTable = (title: string, movers: typeof ups) => movers.length ? [
    `## ${title}`, "| Stock | Move | Volume vs normal | Why | What usually happens |", "|---|---|---|---|---|",
    ...movers.map(({ quote, signal, relativeVolume, label }) =>
      `| ${quote.changePercent > 0 ? "🟢" : "🔴"} **${quote.symbol}** ${chart(quote.symbol)} | ${sign(quote.changePercent)} at ₹${quote.price} (opened ${sign(quote.gapPercent)}) | ${signal ? `${relativeVolume.toFixed(1)}×` : `₹${quote.valueCr.toFixed(0)} cr — normally thin`} | ${why(quote.symbol)} | ${LABEL_TEXT[label]} |`),
  ] : []
  sections.push(...moverTable(earlierRuns.length ? "Moving up — new since the morning" : "Moving up", ups))
  sections.push(...moverTable(earlierRuns.length ? "Moving down — new since the morning" : "Moving down", downs))
  if (exDate.length) sections.push(`_Ignored — ex-date today (the drop is the payout, not a real move): ${exDate.map(({ quote }) => `${quote.symbol} (${lenses.exToday.get(quote.symbol)})`).join(", ")}_`)

  const marketLine = [
    live.nifty ? `Nifty ${sign(live.nifty.changePercent)}` : "",
    `${live.risingSinceOpen} stocks rising vs ${live.fallingSinceOpen} falling since the open`,
    live.fallingSinceOpen > 1.5 * live.risingSinceOpen ? "⚠️ the market is weakening — up-moves are more likely to fade today" : "",
  ].filter(Boolean).join(" · ")
  const markdown = [
    `# Market check — ${hhmm}`,
    `> ${marketLine}`,
    ...sections,
    `_Labels come from how past alerts ended: up-moves without news kept going only ~1 in 3 times after the alert; opening gaps faded 8 times in 10; falls on bad news kept falling ~2 in 3. Nothing here is a buy except "Today's picks"._`,
  ].join("\n\n")

  await writeJson(runsFile, [...earlierRuns, { time: hhmm, rows: [...ups, ...downs].map(({ quote, label }) => ({ symbol: quote.symbol, price: quote.price, changePercent: quote.changePercent, label })) }])
  const ipoCount = Math.max(0, ipoRows.length - 3) // minus the heading and table header rows
  const count = reportPicks.length + holdingRows.length + ups.length + downs.length + ipoCount
  return { count, subject: `📈 Market check ${hhmm} — ${ups.length + downs.length} movers${reportPicks.length ? ", today's picks: buy or skip" : ""}${ipoCount ? ", IPOs closing today" : ""}`, html: convertMarkdownToEmailHtml(markdown) }
}
