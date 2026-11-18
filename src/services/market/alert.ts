import { fetchNse, fetchNseJson } from "./nse.js"
import { fetchMarketLenses, type EventKind } from "./lenses.js"
import { readHoldings } from "./holdings.js"
import { buildIpoClosingToday } from "./ipo.js"
import { readJson, writeJson, todayIst, nseDate, parseNseDate } from "./store.js"
import { findOpenTrades, tradeStatus, buyLimit, type ReportPick } from "./scorecard.js"
import { convertMarkdownToEmailHtml, markdownTable as table, tableCell } from "../../formats.js"

// Market check at ~9:09 (pre-open) and 14:00 — code only, no AI. At 9:09 the pre-open auction has fixed each
// stock's opening price (IEP), so the report's picks get buy/skip against their limit before trading starts at 9:15
// (setup stocks were only 0.12% cheaper at 10:00 than at the open — waiting gains nothing). Every pre-open run also
// saves the snapshot (opening price, buy and sell quantity for all ~2,200 stocks) to preopen/ for a later test of
// whether pre-open buying predicts the day. No general movers list: on real data a stock already up or down 3%+ by
// 10:00 was a coin flip afterwards (median +0.13% to the close, 54% rose; 466 cases, Aug–Oct 2026).

const HOLDING_MOVE_PERCENT = 2

export interface LiveQuote { symbol: string; price: number; changePercent: number }

interface NseTradedRow { symbol: string; series: string; lastPrice: number; pchange: number }
export interface NsePreOpenRow {
  metadata: { symbol: string; iep: number; pChange: number; previousClose: number }
  detail?: { preOpenMarket?: { totalBuyQuantity: number; totalSellQuantity: number } }
}
interface NseMarketStatus { marketState?: { market: string; tradeDate: string; last: number; percentChange: number }[] }

// Every traded stock + the 9:08 opening price from the pre-open auction
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
    quotes.set(row.symbol, { symbol: row.symbol, price: row.lastPrice, changePercent: row.pchange })
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

// Before 9:15 the price is the pre-open opening price (IEP); stocks with no IEP (no orders) are left out
export function preOpenQuotes(rows: NsePreOpenRow[]): Map<string, LiveQuote> {
  return new Map(rows.filter(({ metadata }) => metadata.iep > 0)
    .map(({ metadata }) => [metadata.symbol, { symbol: metadata.symbol, price: metadata.iep, changePercent: metadata.pChange }]))
}

export interface PreOpenSnapshotRow { symbol: string; iep: number; previousClose: number; buyQuantity: number; sellQuantity: number }
export function preOpenSnapshot(rows: NsePreOpenRow[]): PreOpenSnapshotRow[] {
  return rows.map(({ metadata, detail }) => ({
    symbol: metadata.symbol, iep: metadata.iep, previousClose: metadata.previousClose,
    buyQuantity: detail?.preOpenMarket?.totalBuyQuantity ?? 0, sellQuantity: detail?.preOpenMarket?.totalSellQuantity ?? 0,
  }))
}

async function fetchPreOpenMarket() {
  const [preOpen, status] = await Promise.all([
    fetchNseJson<{ data?: NsePreOpenRow[] }>("market-data-pre-open?key=ALL"),
    fetchNseJson<NseMarketStatus>("marketStatus"),
  ])
  const rows = preOpen?.data ?? []
  const quotes = preOpenQuotes(rows)
  const capitalMarket = status?.marketState?.find((state) => state.market === "Capital Market")
  const isTradingDay = capitalMarket?.tradeDate.startsWith(nseDate()) ?? false
  if (isTradingDay && rows.length) await writeJson(`preopen/${todayIst()}.json`, preOpenSnapshot(rows))
  return {
    quotes, isTradingDay, nifty: undefined,
    risingSinceOpen: [...quotes.values()].filter((quote) => quote.changePercent > 0).length,
    fallingSinceOpen: [...quotes.values()].filter((quote) => quote.changePercent < 0).length,
  }
}

const BAD_NEWS: EventKind[] = ["regulatory", "management exit"]

// A headline explains a move only if it's about this company: it names the company, isn't a list of stocks
// ("Buzzing stocks: …, SML Mahindra, Just Dial …", "Buy, sell or hold: TCS, Tata Motors PV …" — any "stocks" headline), doesn't just
// restate the move, and — for a one-word name like "Amal" — reads as stock-market news (not a beach-soccer result)
const RESTATES_THE_MOVE = /share price|estimates [–-] nse:|stock price|shares? (today )?(up|down|rise|fall|jump|surge|gain|slip|plunge|soar|tank|zoom|rall)|top (gainers|losers)|volume gainers|stocks? to (watch|buy)|technical (view|outlook)|valuation snapshot|52[- ]week|hits (upper|lower) circuit/i
const LIST_ARTICLE = /\bstocks\b|stocks? in (focus|news)|buy,? sell,? or hold|leaderboard|top picks|stocks? that|market (live|today|wrap)|sensex|nifty \d|price action:/i
const ABOUT_BUSINESS = /share|stock|nse|bse|q[1-4]|result|profit|revenue|earning|order|contract|ipo|dividend|stake|deal|acqui|merger|rating|target|crore|₹|rs\.? ?\d|plant|ceo|cfo|board|sebi|raid|fraud|tender|launch|approval/i
const STOCK_CONTEXT = /\b(shares?|stocks?|nse|bse|ltd|limited|q[1-4]|crore|ipo|sebi|fy\d\d)\b|₹|\brs\.? ?\d/i

// headlines say "Quick Heal", not "Quick Heal Technologies" — match and search on the first two words ("The" dropped)
export function shortCompanyName(legalName: string, words = 2): string {
  return legalName.replace(/\s+(Limited|Ltd\.?)$/i, "").replace(/^The\s+/i, "").split(/\s+/).slice(0, words).join(" ")
}

// Two companies can share the short name (TMPV "Tata Motors Passenger Vehicles", TMCV "Tata Motors") — those get
// three words, so a TMCV headline isn't shown as TMPV's reason
export function searchNames(symbolsAndLegalNames: [string, string][]): Map<string, string> {
  const shortCounts = new Map<string, number>()
  for (const [, legalName] of symbolsAndLegalNames) shortCounts.set(shortCompanyName(legalName), (shortCounts.get(shortCompanyName(legalName)) ?? 0) + 1)
  return new Map(symbolsAndLegalNames.map(([symbol, legalName]) =>
    [symbol, shortCompanyName(legalName, shortCounts.get(shortCompanyName(legalName))! > 1 ? 3 : 2)]))
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
  companyNames = searchNames(csv.split("\n").slice(1).map((line) => line.split(",")).filter((fields) => fields[1])
    .map(([symbol, name]) => [symbol.trim(), name.trim()]))
  return companyNames
}

// Every report pick in its buy zone gets "buy" — the report already kept only the stocks that passed every check
export function buyOrSkip(pick: ReportPick, quote: LiveQuote | undefined, badNews: boolean): string {
  if (!quote) return "no live price — check manually"
  const limit = buyLimit(pick)
  if (badNews) return `⚠️ bad news filed today — skip`
  if (quote.price <= pick.stopLoss) return `❌ below the stop loss (₹${pick.stopLoss}) — skip`
  if (quote.price > limit) return `❌ above ₹${limit} — skip today, don't chase`
  return `✅ buy — limit order at about ₹${quote.price} (no higher than ₹${limit}), then set SL ₹${pick.stopLoss}`
}

const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
const chart = (symbol: string) => `[chart](https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)})`

export interface MarketEmail { count: number; subject: string; html: string }

export async function buildMarketCheck(): Promise<MarketEmail> {
  const timeIst = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(11, 16)
  const isPreOpen = timeIst < "09:15"
  const [live, lenses, holdings, names] = await Promise.all([isPreOpen ? fetchPreOpenMarket() : fetchLiveMarket(), fetchMarketLenses(), readHoldings(), loadCompanyNames()])
  if (!live.isTradingDay || !live.quotes.size) return { count: 0, subject: "", html: "" } // weekend or holiday
  const eventsFor = (symbol: string) => lenses.events.filter((event) => event.symbol === symbol)
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
    if (buys.length) doNow.push(`**Buy** (limit order): ${buys.map(({ pick }) => `${pick.symbol} ≤ ₹${buyLimit(pick)}`).join(" · ")}`)
    if (skips.length) doNow.push(`**Skip today:** ${skips.map(({ pick, decision }) => `${pick.symbol} (${decision.replace(/^\S+\s*/, "").split(" — ")[0]})`).join(" · ")}`)
    blocks.push(table(`## Today's picks — ${isPreOpen ? "opening price (pre-open)" : "live"} ${timeIst}`, "| Stock | Now | Entry · SL | Decision |",
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
    doNow.push(...ipo.calls.map((call) => `**IPO ${call.name.replace(/ Limited$/, "")}:** ${call.call === "apply now" ? "apply now" : "don't apply yet — the 16:15 email says apply or skip"}`))
    blocks.push(ipo.rows.join("\n"))
    await writeJson(`ipo-calls/${todayIst()}-${timeIst.replace(":", "")}.json`, ipo.calls)
  }

  // 4. your holdings moving ≥2% (trades from earlier picks are above) — why: NSE filing first, else a headline about the company
  const tradeSymbols = new Set(openTrades.map((trade) => trade.symbol))
  const holdingRows = [...holdings.symbols].filter((symbol) => !tradeSymbols.has(symbol)).map((symbol) => live.quotes.get(symbol))
    .filter((quote): quote is LiveQuote => !!quote && Math.abs(quote.changePercent) >= HOLDING_MOVE_PERCENT)
  const headlines = new Map(await Promise.all(holdingRows.filter((quote) => !eventsFor(quote.symbol).length)
    .map(async ({ symbol }) => [symbol, names.get(symbol) ? await fetchHeadline(names.get(symbol)!) : undefined] as const)))
  const why = (symbol: string) => {
    const exDate = lenses.exToday.get(symbol)
    if (exDate) return `ex-date today (${tableCell(exDate)}) — the drop is the payout, not a real move`
    const events = eventsFor(symbol)
    if (events.length) return events.slice(0, 2).map((event) => `${event.kind}: ${tableCell(event.headline.slice(0, 70))}${event.link ? ` [NSE](${event.link})` : ""}`).join(" · ")
    const headline = headlines.get(symbol)
    return headline ? `${tableCell(headline.title.replace(/\s+-\s+[^-]+$/, "").slice(0, 90))} [news](${headline.link})` : "no filing or news found yet"
  }
  for (const quote of holdingRows) {
    if (quote.changePercent < 0 && eventsFor(quote.symbol).some((event) => BAD_NEWS.includes(event.kind))) doNow.push(`**${quote.symbol}** (holding): bad news filed today — review it`)
  }
  if (holdingRows.length) {
    blocks.push(table(`## Your holdings moving ≥${HOLDING_MOVE_PERCENT}%`, "| Stock | Move | Why |",
      holdingRows.map((quote) => `| ${quote.changePercent > 0 ? "🟢" : "🔴"} **${quote.symbol}** ${chart(quote.symbol)} | ${sign(quote.changePercent)} at ₹${quote.price} | ${why(quote.symbol)} |`)))
  }
  if (lenses.unavailable.length) blocks.push(`> ⚠️ NSE didn't return today: ${lenses.unavailable.join(", ")} — reasons and ex-date checks may be incomplete.`)

  const marketLine = [
    live.nifty ? `Nifty ${sign(live.nifty.changePercent)}` : "",
    isPreOpen
      ? `${live.risingSinceOpen} stocks set to open higher vs ${live.fallingSinceOpen} lower`
      : `${live.risingSinceOpen} stocks rising vs ${live.fallingSinceOpen} falling since the open`,
  ].filter(Boolean).join(" · ")
  const markdown = [
    `# Market check — ${timeIst}`,
    `> 🟢 **Do now**\n>\n> ${(doNow.length ? doNow : ["Nothing to do now."]).map((item) => `- ${item}`).join("\n> ")}`,
    ...blocks,
    `> ${marketLine}`,
  ].join("\n\n")

  const count = 1 + reportPicks.length + openTrades.length + holdingRows.length + ipo.calls.length // ≥1: sent on every trading day
  const subjectParts = [reportPicks.length ? "picks: buy or skip" : "", ipo.calls.length ? "IPOs closing today" : "", holdingRows.length ? `${holdingRows.length} holdings moving` : "", doNow.length ? "" : "nothing to do"].filter(Boolean)
  return { count, subject: `📈 Market check ${timeIst} — ${subjectParts.join(", ")}`, html: convertMarkdownToEmailHtml(markdown) }
}
