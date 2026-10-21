import { fetchNse, fetchNseJson } from "./nse.js"
import { loadStockSignals, type StockSignal } from "./scan.js"
import { fetchMarketLenses, type CompanyEvent, type EventKind } from "./lenses.js"
import { readHoldings } from "./holdings.js"
import { buildIpoClosingToday } from "./ipo.js"
import { readJson, writeJson, todayIst, nseDate, parseNseDate } from "./store.js"
import { findOpenTrades, tradeStatus, type ReportPick } from "./scorecard.js"
import { convertMarkdownToEmailHtml, markdownTable as table, tableCell } from "../../formats.js"

// Market check at 10:00 and 14:00 — code only, no AI. Chosen from 5-minute data on 1,100 stocks (13–16 Oct):
// 10:00 + 14:00 caught 91% of the day's ≥5% moves vs 37% for 9:30 alone, and 10:00 is when the opening swings
// settle (bad fills 13% vs 30% at the open) — so it's also when the report's picks are bought.
// What it's for, in order: what to do now (buy/skip the picks, open trades at their stop/target, IPOs closing
// today), your holdings, then what's moving and why. Movers are information, not buys.

const MIN_MOVE_PERCENT = 3
const MIN_RELATIVE_VOLUME = 2 // volume so far ÷ what a normal day has traded by this time
const MIN_THIN_STOCK_VALUE_CR = 10 // a normally illiquid stock counts once ₹10 cr trades today
const HOLDING_MOVE_PERCENT = 2
const MAX_MOVERS_PER_SIDE = 6

// Share of a day's volume normally traded by each time (median, 1,100 NSE stocks, 5-minute bars, Oct 2026)
const VOLUME_CURVE: [string, number][] = [
  ["09:15", 0], ["09:30", 0.05], ["10:00", 0.15], ["10:30", 0.24], ["11:00", 0.31], ["12:00", 0.45],
  ["13:00", 0.57], ["14:00", 0.69], ["14:30", 0.76], ["15:00", 0.85], ["15:30", 1],
]

export function expectedVolumeShare(timeIst: string): number {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const now = minutes(timeIst)
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

// Labels say only what's known. "likely to fade" was dropped: on 19 Oct it was right 5 of 24 times, so no
// prediction is made for up-moves until the scorecard shows one that works (≥60% right over 50+ cases).
// "likely to fade" and "falling, no news found" stay in the type only so older saved alert runs still read.
export type MoveLabel = "not a real move" | "bad news, may continue" | "news-backed" | "no news found" | "likely to fade" | "falling, no news found"
// the only label with a track record so far (right 5 of 6 on 19 Oct); the others are shown by the reason itself
const LABEL_TEXT: Partial<Record<MoveLabel, string>> = { "bad news, may continue": "🔴 bad news — may keep falling · " }
const BAD_NEWS: EventKind[] = ["regulatory", "management exit"]

export function labelMove(quote: LiveQuote, events: CompanyEvent[], exDateAction: string | undefined, hasHeadline: boolean): MoveLabel {
  if (exDateAction) return "not a real move"
  const hasBadNews = events.some((event) => BAD_NEWS.includes(event.kind))
  if (quote.changePercent < 0 && (hasBadNews || events.some((event) => event.kind === "results"))) return "bad news, may continue"
  if (hasHeadline || events.some((event) => event.kind !== "price-move query")) return "news-backed"
  return "no news found"
}

// A headline explains a move only if it's about this company: it names the company, isn't a list of stocks
// ("Buzzing stocks: …, SML Mahindra, Just Dial …", "Buy, sell or hold: TCS, Tata Motors PV …"), doesn't just
// restate the move, and — for a one-word name like "Amal" — reads as stock-market news (not a beach-soccer result)
const RESTATES_THE_MOVE = /share price|stock price|shares? (today )?(up|down|rise|fall|jump|surge|gain|slip|plunge|soar|tank|zoom|rall)|top (gainers|losers)|volume gainers|stocks? to (watch|buy)|technical (view|outlook)|valuation snapshot|52[- ]week|hits (upper|lower) circuit/i
const LIST_ARTICLE = /buzzing stocks|stocks? in (focus|news)|momentum stocks|buy,? sell,? or hold|leaderboard|top picks|stocks? that|market (live|today|wrap)|sensex|nifty \d|price action:/i
const ABOUT_BUSINESS = /share|stock|nse|bse|q[1-4]|result|profit|revenue|earning|order|contract|ipo|dividend|stake|deal|acqui|merger|rating|target|crore|₹|rs\.? ?\d|plant|ceo|cfo|board|sebi|raid|fraud|tender|launch|approval/i
const STOCK_CONTEXT = /\b(shares?|stocks?|nse|bse|ltd|limited|q[1-4]|crore|ipo|sebi|fy\d\d)\b|₹|\brs\.? ?\d/i

// headlines say "Quick Heal", not "Quick Heal Technologies" — match and search on the first two words ("The" dropped)
export function shortCompanyName(legalName: string): string {
  return legalName.replace(/\s+(Limited|Ltd\.?)$/i, "").replace(/^The\s+/i, "").split(/\s+/).slice(0, 2).join(" ")
}

export function pickExplainingHeadline(titles: string[], companyName: string): string | undefined {
  const name = companyName.toLowerCase()
  const isOneWord = !name.includes(" ")
  return titles.find((title) => {
    const text = title.replace(/\s+-\s+[^-]+$/, "") // drop the " - Source" suffix
    const lower = text.toLowerCase()
    return lower.includes(name) && ABOUT_BUSINESS.test(text) && !RESTATES_THE_MOVE.test(text) && !LIST_ARTICLE.test(text) &&
      (text.match(/[,;]/g) ?? []).length < 2 && (!isOneWord || STOCK_CONTEXT.test(text))
  })
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

interface AlertRow { symbol: string; price: number; changePercent: number; label: MoveLabel; why?: string }
interface AlertRun { time: string; rows: AlertRow[] }

export interface Mover { quote: LiveQuote; signal?: StockSignal; relativeVolume: number }

// EQ series only (BE = trade-for-trade, usually under surveillance) and no ETFs — they aren't stock moves
export function selectMovers(quotes: Iterable<LiveQuote>, signalsBySymbol: Map<string, StockSignal>, volumeShareNow: number, etfSymbols = new Set<string>()): Mover[] {
  return [...quotes]
    .filter((quote) => quote.series !== "BE" && !etfSymbols.has(quote.symbol))
    .map((quote) => {
      const signal = signalsBySymbol.get(quote.symbol)
      const relativeVolume = signal && signal.averageVolume20Day > 0 ? quote.volume / (signal.averageVolume20Day * volumeShareNow) : Infinity
      return { quote, signal, relativeVolume }
    })
    .filter(({ quote, signal, relativeVolume }) => Math.abs(quote.changePercent) >= MIN_MOVE_PERCENT &&
      (signal ? relativeVolume >= MIN_RELATIVE_VOLUME : quote.valueCr >= MIN_THIN_STOCK_VALUE_CR))
    .sort((a, b) => Math.abs(b.quote.changePercent) * Math.min(b.relativeVolume, 20) - Math.abs(a.quote.changePercent) * Math.min(a.relativeVolume, 20))
}

// Every report pick in its buy zone gets "buy" — the report already kept only the stocks that passed every check
export function buyOrSkip(pick: ReportPick, quote: LiveQuote | undefined, badNews: boolean): string {
  if (!quote) return "no live price — check manually"
  const skipAbove = pick.entry + 0.5 * (pick.entry - pick.stopLoss) // same rule the scorecard uses
  if (badNews) return `⚠️ bad news filed today — skip`
  if (quote.price <= pick.stopLoss) return `❌ below the stop loss (₹${pick.stopLoss}) — skip`
  if (quote.price > skipAbove) return `❌ above ₹${skipAbove.toFixed(1)} — skip today, don't chase`
  return `✅ buy — limit order at about ₹${quote.price} (no higher than ₹${skipAbove.toFixed(1)}), then set SL ₹${pick.stopLoss}`
}

const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
const chart = (symbol: string) => `[chart](https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)})`

export interface MoverAlert { count: number; subject: string; html: string }

export async function buildMoverAlert(): Promise<MoverAlert> {
  const [{ stockSignals, etfSymbols }, live, lenses, holdings, names] = await Promise.all([
    loadStockSignals(), fetchLiveMarket(), fetchMarketLenses(), readHoldings(), loadCompanyNames(),
  ])
  if (!live.isTradingDay || !live.quotes.size) return { count: 0, subject: "", html: "" } // weekend or holiday
  const timeIst = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(11, 16)
  const signalsBySymbol = new Map(stockSignals.map((stock) => [stock.symbol, stock]))
  const eventsFor = (symbol: string) => lenses.events.filter((event) => event.symbol === symbol)
  const runsFile = `alerts/${todayIst()}.json`
  const earlierRuns = (await readJson<AlertRun[]>(runsFile)) ?? []
  const earlier = new Map(earlierRuns.flatMap((run) => run.rows.map((row) => [row.symbol, row] as const)))
  const doNow: string[] = []
  const blocks: string[] = []

  // 1. today's report picks — buy or skip at the live price
  const reportPicks = (await readJson<ReportPick[]>(`report-picks/${todayIst()}.json`)) ?? []
  if (reportPicks.length) {
    const decisions = reportPicks.map((pick) => {
      const quote = live.quotes.get(pick.symbol)
      return { pick, quote, decision: buyOrSkip(pick, quote, eventsFor(pick.symbol).some((event) => BAD_NEWS.includes(event.kind))) }
    })
    const buys = decisions.filter(({ decision }) => decision.startsWith("✅"))
    const skips = decisions.filter(({ decision }) => !decision.startsWith("✅"))
    if (buys.length) doNow.push(`**Buy** (limit order): ${buys.map(({ pick }) => `${pick.symbol} ≤ ₹${(pick.entry + 0.5 * (pick.entry - pick.stopLoss)).toFixed(1)}`).join(" · ")}`)
    if (skips.length) doNow.push(`**Skip today:** ${skips.map(({ pick, decision }) => `${pick.symbol} (${decision.replace(/^\S+\s*/, "").split(" — ")[0]})`).join(" · ")}`)
    blocks.push(table(`## Today's picks — live ${timeIst}`, "| Stock | Now | Entry · SL | Decision |",
      decisions.map(({ pick, quote, decision }) =>
        `| ${decision.startsWith("✅") ? "🟢" : "🔴"} **${pick.symbol}** ${chart(pick.symbol)} | ${quote ? `₹${quote.price} (${sign(quote.changePercent)})` : "—"} | ₹${pick.entry} · SL ₹${pick.stopLoss} | ${decision} |`)))
  }

  // 2. trades you hold from earlier picks — stop, target, sell-by
  const today = parseNseDate(nseDate())
  const openTrades = (await findOpenTrades(holdings.symbols)).filter((trade) => live.quotes.has(trade.symbol))
  if (openTrades.length) {
    const statuses = openTrades.map((trade) => ({ trade, quote: live.quotes.get(trade.symbol)!, status: tradeStatus(trade, live.quotes.get(trade.symbol)!.price, today) }))
    for (const { trade, status } of statuses) if (!status.startsWith("hold")) doNow.push(`**${trade.symbol}:** ${status.slice(2).trim()}`)
    blocks.push(table("## Your trades from earlier picks", "| Stock | Now | Status |",
      statuses.map(({ trade, quote, status }) => `| ${status.startsWith("🔴") ? "🔴" : status.startsWith("🟢") ? "🟢" : ""}**${trade.symbol}** (picked ${trade.pickedOn}) | ₹${quote.price} (${sign(quote.changePercent)}) | ${status} |`)))
  }

  // 3. IPOs closing today — the early read (the final call is the 16:15 email)
  const ipo = timeIst >= "13:00" ? await buildIpoClosingToday() : { rows: [], calls: [] }
  if (ipo.calls.length) {
    doNow.push(...ipo.calls.map((call) => `**IPO ${call.name.replace(/ Limited$/, "")}:** ${call.call === "apply now" ? "apply now" : "apply now to hold your place — final call at 16:15"}`))
    blocks.push(ipo.rows.join("\n"))
    await writeJson(`ipo-calls/${todayIst()}-${timeIst.replace(":", "")}.json`, ipo.calls)
  }

  // 4. movers: new since the earlier run (or moved ≥3 more points); ex-date drops aren't real moves
  const tradeSymbols = new Set(openTrades.map((trade) => trade.symbol))
  const holdingRows = [...holdings.symbols].filter((symbol) => !tradeSymbols.has(symbol)).map((symbol) => live.quotes.get(symbol))
    .filter((quote): quote is LiveQuote => !!quote && Math.abs(quote.changePercent) >= HOLDING_MOVE_PERCENT)
  const movers = selectMovers(live.quotes.values(), signalsBySymbol, expectedVolumeShare(timeIst), etfSymbols)
  const exDate = movers.filter(({ quote }) => lenses.exToday.has(quote.symbol))
  const fresh = movers.filter(({ quote }) => !lenses.exToday.has(quote.symbol) &&
    (!earlier.has(quote.symbol) || Math.abs(quote.changePercent - earlier.get(quote.symbol)!.changePercent) >= 3))
  const ups = fresh.filter(({ quote }) => quote.changePercent > 0).slice(0, MAX_MOVERS_PER_SIDE)
  const downs = fresh.filter(({ quote }) => quote.changePercent < 0).slice(0, MAX_MOVERS_PER_SIDE)

  // why: NSE filing first; else a headline about this company; else the earlier run's reason
  const shown = [...new Set([...ups, ...downs].map(({ quote }) => quote.symbol).concat(holdingRows.map((quote) => quote.symbol)))]
  const needNews = shown.filter((symbol) => !eventsFor(symbol).length)
  const headlines = new Map(await Promise.all(needNews.map(async (symbol) => [symbol, names.get(symbol) ? await fetchHeadline(names.get(symbol)!) : undefined] as const)))
  const why = (symbol: string) => {
    const events = eventsFor(symbol)
    if (events.length) return events.slice(0, 2).map((event) => `${event.kind}: ${tableCell(event.headline.slice(0, 70))}${event.link ? ` [NSE](${event.link})` : ""}`).join("; ")
    const headline = headlines.get(symbol)
    if (headline) return `${tableCell(headline.title.replace(/\s+-\s+[^-]+$/, "").slice(0, 90))} [news](${headline.link})`
    return earlier.get(symbol)?.why ?? "no reason found yet"
  }
  const labelled = [...ups, ...downs].map((mover) => ({ ...mover, why: why(mover.quote.symbol),
    label: labelMove(mover.quote, eventsFor(mover.quote.symbol), undefined, headlines.has(mover.quote.symbol) && !!headlines.get(mover.quote.symbol)) }))

  if (holdingRows.length) {
    blocks.push(table(`## Your holdings moving ≥${HOLDING_MOVE_PERCENT}%`, "| Stock | Move | Why |",
      holdingRows.map((quote) => `| ${quote.changePercent > 0 ? "🟢" : "🔴"} **${quote.symbol}** | ${sign(quote.changePercent)} at ₹${quote.price} | ${why(quote.symbol)} |`)))
  }
  const moverRows = (side: typeof labelled) => side.map(({ quote, signal, relativeVolume, why: reason, label }) =>
    `| **${quote.symbol}** ${chart(quote.symbol)} | ${sign(quote.changePercent)} at ₹${quote.price} · ${signal ? `${relativeVolume.toFixed(0)}× normal volume` : `₹${quote.valueCr.toFixed(0)} cr traded`} | ${LABEL_TEXT[label] ?? ""}${reason} |`)
  const upRows = labelled.filter(({ quote }) => quote.changePercent > 0)
  const downRows = labelled.filter(({ quote }) => quote.changePercent < 0)
  if (upRows.length) blocks.push(table(earlierRuns.length ? "## Moving up — new since the morning" : "## Moving up", "| Stock | Move | Why |", moverRows(upRows)))
  if (downRows.length) blocks.push(table(earlierRuns.length ? "## Moving down — new since the morning" : "## Moving down", "| Stock | Move | Why |", moverRows(downRows)))
  if (earlierRuns.length) {
    const checked = [...earlier.values()].map((row) => ({ row, now: live.quotes.get(row.symbol) })).filter((entry) => entry.now)
    const held = checked.filter(({ row, now }) => Math.sign(now!.changePercent) === Math.sign(row.changePercent) && Math.abs(now!.changePercent) >= 0.75 * Math.abs(row.changePercent))
    const faded = checked.filter((entry) => !held.includes(entry))
    const list = (entries: typeof checked) => entries.map(({ row, now }) => `${row.symbol} ${sign(now!.changePercent)} (was ${sign(row.changePercent)})`).join(", ") || "none"
    blocks.push(`## Morning movers since then\n\n**Held:** ${list(held)}\n\n**Faded:** ${list(faded)}`)
  }
  if (exDate.length) blocks.push(`_Ignored — ex-date today (the drop is the payout, not a real move): ${exDate.map(({ quote }) => `${quote.symbol} (${lenses.exToday.get(quote.symbol)})`).join(", ")}_`)
  if (lenses.unavailable.length) blocks.push(`> ⚠️ NSE didn't return today: ${lenses.unavailable.join(", ")} — reasons and ex-date checks may be incomplete.`)

  const marketLine = [
    live.nifty ? `Nifty ${sign(live.nifty.changePercent)}` : "",
    `${live.risingSinceOpen} stocks rising vs ${live.fallingSinceOpen} falling since the open`,
  ].filter(Boolean).join(" · ")
  const markdown = [
    `# Market check — ${timeIst}`,
    `> 🟢 **Do now**\n>\n> ${(doNow.length ? doNow : ["Nothing to do now — the rest is information."]).join("\n>\n> ")}`,
    ...blocks,
    `> ${marketLine}`,
    `_Movers are information, not buys — only "Today's picks" passed every check._`,
  ].join("\n\n")

  await writeJson(runsFile, [...earlierRuns, { time: timeIst, rows: labelled.map(({ quote, label, why: reason }) => ({ symbol: quote.symbol, price: quote.price, changePercent: quote.changePercent, label, why: reason })) }])
  const count = reportPicks.length + openTrades.length + holdingRows.length + labelled.length + ipo.calls.length
  const subjectParts = [reportPicks.length ? "picks: buy or skip" : "", ipo.calls.length ? "IPOs closing today" : "", `${labelled.length} movers`].filter(Boolean)
  return { count, subject: `📈 Market check ${timeIst} — ${subjectParts.join(", ")}`, html: convertMarkdownToEmailHtml(markdown) }
}
