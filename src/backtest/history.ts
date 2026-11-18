import { readdir } from "fs/promises"
import { join } from "path"
import { parseDailyPriceFile, parseNseTimestamp, type DailyPriceRow } from "../services/market/scan.js"
export { parseNseTimestamp }
import { adjustForCorporateActions, type PriceAdjustment } from "../services/market/adjust.js"
import { parseNseDate } from "../services/market/store.js"
import { isInsiderMarketBuy, type Board } from "../services/market/strategies.js"
import { HISTORY_DIR, readGz } from "./download.js"

// Everything the backtest reads, from data/market-history (see download.ts), indexed by session.

export interface StockHistory {
  symbol: string
  board: Board // from the latest series: EQ = main board, SM/ST = SME
  bars: DailyPriceRow[] // adjusted for splits/bonuses
  dayIndex: number[] // bars[i] is session days[dayIndex[i]]
  listedAtIndex: number | undefined // index into bars of the listing day, if it is inside the history
}

export interface History {
  days: string[] // ISO dates, oldest first
  closeTimes: number[] // epoch ms of each session's 15:30 IST close
  stocks: Map<string, StockHistory>
  resultsFiledAt: Map<string, number[]> // symbol → epoch ms
  insiderBuys: Map<string, Map<number, number>> // symbol → day index → ₹ bought (promoters, directors, KMP; market purchases)
  sectorOf: Map<string, string> // Nifty 500 only (today's list)
}

const SME_SERIES = ["SM", "ST"]
const IST_CLOSE_MS = (15 * 60 + 30) * 60_000

const isoFromEpoch = (epochMs: number) => new Date(epochMs + 6 * 3_600_000).toISOString().slice(0, 10)

export async function loadHistory(): Promise<History> {
  const files = (await readdir(join(HISTORY_DIR, "prices"))).filter((file) => file.endsWith(".csv.gz")).sort()
  const etfs = new Set((await readGz("etf-list.csv.gz")).split("\n").slice(1).map((line) => line.split(",")[0].trim()))
  const days: string[] = []
  const nseDates: string[] = []
  const mainSessions: DailyPriceRow[][] = []
  const smeSessions: DailyPriceRow[][] = []
  for (const file of files) {
    const text = await readGz(`prices/${file}`)
    days.push(file.slice(0, 10))
    nseDates.push(text.split("\n")[1].split(",")[2].trim())
    mainSessions.push(parseDailyPriceFile(text).filter((row) => !etfs.has(row.symbol)))
    smeSessions.push(parseDailyPriceFile(text, SME_SERIES))
  }
  const adjustments = JSON.parse(await readGz("corporate-actions.json.gz")) as PriceAdjustment[]
  const adjustedMain = adjustForCorporateActions(mainSessions, nseDates, adjustments)
  const adjustedSme = adjustForCorporateActions(smeSessions, nseDates, adjustments)

  const listingDay = new Map<string, string>() // symbol → ISO listing date
  for (const listing of JSON.parse(await readGz("listings.json.gz")) as { symbol: string; listingDate: string }[]) {
    if (/^\d{2}-\w{3}-\d{4}$/.test(listing.listingDate)) listingDay.set(listing.symbol, isoFromEpoch(parseNseDate(listing.listingDate)))
  }
  for (const line of (await readGz("equity-list.csv.gz")).split("\n").slice(1)) {
    const fields = line.split(",").map((field) => field.trim())
    if (fields[3] && !listingDay.has(fields[0])) listingDay.set(fields[0], isoFromEpoch(parseNseDate(fields[3])))
  }

  const stocks = new Map<string, StockHistory>()
  for (const [board, sessions] of [["main", adjustedMain], ["sme", adjustedSme]] as const) {
    sessions.forEach((session, day) => {
      for (const row of session) {
        let stock = stocks.get(row.symbol)
        if (!stock) stocks.set(row.symbol, (stock = { symbol: row.symbol, board, bars: [], dayIndex: [], listedAtIndex: undefined }))
        if (stock.dayIndex[stock.dayIndex.length - 1] === day) continue // listed in both (migration day)
        stock.bars.push(row)
        stock.dayIndex.push(day)
      }
    })
  }
  for (const stock of stocks.values()) {
    // bars can arrive out of order when a stock moved from SME to the main board — sort by day
    const order = stock.dayIndex.map((day, index) => [day, index]).sort((a, b) => a[0] - b[0]).map(([, index]) => index)
    stock.bars = order.map((index) => stock.bars[index])
    stock.dayIndex = order.map((index) => stock.dayIndex[index])
    stock.board = smeSessions[stock.dayIndex[stock.dayIndex.length - 1]]?.some((row) => row.symbol === stock.symbol) ? "sme" : "main"
    const listed = listingDay.get(stock.symbol)
    const firstDay = days[stock.dayIndex[0]]
    if (listed && listed > days[0] && listed <= firstDay) stock.listedAtIndex = 0
  }

  const closeTimes = nseDates.map((date) => parseNseDate(date) + IST_CLOSE_MS)
  const resultsFiledAt = new Map<string, number[]>()
  for (const filing of JSON.parse(await readGz("results-filings.json.gz")) as { symbol: string; filedAt: string }[]) {
    resultsFiledAt.set(filing.symbol, [...(resultsFiledAt.get(filing.symbol) ?? []), parseNseTimestamp(filing.filedAt)])
  }

  const dayOf = new Map(days.map((day, index) => [day, index]))
  const insiderBuys = new Map<string, Map<number, number>>()
  for (const trade of JSON.parse(await readGz("insider-trades.json.gz")) as { symbol: string; personCategory: string; acqMode: string; type: string; secType: string; value: number; disclosed: string }[]) {
    if (!isInsiderMarketBuy(trade)) continue
    // disclosed on a non-trading day → counts on the next session
    let day = dayOf.get(isoFromEpoch(parseNseTimestamp(trade.disclosed)))
    for (let ahead = 1; day === undefined && ahead < 5; ahead++) day = dayOf.get(isoFromEpoch(parseNseTimestamp(trade.disclosed) + ahead * 86_400_000))
    if (day === undefined) continue
    const byDay = insiderBuys.get(trade.symbol) ?? new Map<number, number>()
    byDay.set(day, (byDay.get(day) ?? 0) + trade.value)
    insiderBuys.set(trade.symbol, byDay)
  }

  const sectorOf = new Map<string, string>()
  for (const line of (await readGz("nifty500.csv.gz")).split("\n").slice(1)) {
    const fields = line.split(",").map((field) => field.trim())
    if (fields[2]) sectorOf.set(fields[2], fields[1])
  }
  return { days, closeTimes, stocks, resultsFiledAt, insiderBuys, sectorOf }
}
