// Point-in-time fundamentals for the backtest: every quarterly results filing (main board) from Dec 2021, with the
// figures from NSE's structured (XBRL) file and the time it was filed — so a screen on a past date only sees what
// was public then. SME companies file no structured results on NSE, so screens cover the main board only.
// Run: npx tsx src/backtest/fundamentals.ts   (resumes: symbols already in fundamentals.jsonl are skipped)
import { appendFile, readFile, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { gzipSync } from "zlib"
import { fetchNse } from "../services/market/nse.js"
import { HISTORY_DIR } from "./download.js"
import { loadHistory } from "./history.js"

export interface Filing {
  symbol: string
  periodEnd: string // ISO, end of the quarter
  filedAt: string // "29-Oct-2026 18:58" (IST) — when it became public
  basis: "consolidated" | "standalone"
  revenue?: number // ₹, the quarter
  profit?: number // ₹, the quarter, owners' share when given
  eps?: number // ₹ per share, the quarter
  profitBeforeTax?: number
  financeCosts?: number
  equity?: number // ₹, balance sheet (half-year and year-end filings only)
  borrowings?: number // ₹, current + non-current
  operatingCashFlowYtd?: number // ₹, financial year to date (half-year and year-end filings)
  shares?: number // paid-up capital ÷ face value
}

const FROM_PERIOD = "2021-12-01"
const API = "https://www.nseindia.com/api/"
const JSONL = join(HISTORY_DIR, "fundamentals.jsonl")

const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" }
const isoFromNse = (date: string) => { const [day, month, year] = date.split("-"); return `${year}-${MONTHS[month.toUpperCase()]}-${day}` } // "30-Sep-2024" → 2024-09-30

export function parseFilingXbrl(xml: string): Omit<Filing, "symbol" | "periodEnd" | "filedAt" | "basis"> {
  const value = (name: string, context: "OneD" | "OneI" | "FourD") => {
    const match = xml.match(new RegExp(`<[\\w-]+:${name} contextRef="${context}"[^>]*>([^<]+)<`))?.[1]
    const number = match === undefined ? NaN : Number(match)
    return Number.isFinite(number) ? number : undefined
  }
  const paidUp = value("PaidUpValueOfEquityShareCapital", "OneD")
  const faceValue = value("FaceValueOfEquityShareCapital", "OneD")
  const borrowingsNoncurrent = value("BorrowingsNoncurrent", "OneI")
  const borrowingsCurrent = value("BorrowingsCurrent", "OneI")
  return {
    revenue: value("RevenueFromOperations", "OneD"),
    profit: value("ProfitOrLossAttributableToOwnersOfParent", "OneD") ?? value("ProfitLossForPeriod", "OneD"),
    eps: value("BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations", "OneD") ?? value("BasicEarningsLossPerShareFromContinuingOperations", "OneD"),
    profitBeforeTax: value("ProfitBeforeTax", "OneD"),
    financeCosts: value("FinanceCosts", "OneD"),
    equity: value("EquityAttributableToOwnersOfParent", "OneI") ?? value("Equity", "OneI"),
    borrowings: borrowingsNoncurrent === undefined && borrowingsCurrent === undefined ? undefined : (borrowingsNoncurrent ?? 0) + (borrowingsCurrent ?? 0),
    operatingCashFlowYtd: value("CashFlowsFromUsedInOperatingActivities", "FourD"),
    shares: paidUp && faceValue ? paidUp / faceValue : undefined,
  }
}

async function fetchText(url: string): Promise<string | undefined> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetchNse(url).catch(() => undefined)
    if (response?.ok) return response.text()
    if (response?.status === 404) return undefined
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
  }
  console.error(`  gave up: ${url}`)
  return undefined
}

interface Listed { periodEnd: string; filedAt: string; basis: Filing["basis"]; xbrl: string }

export async function listFilings(symbol: string): Promise<Listed[]> {
  const older = JSON.parse((await fetchText(`${API}corporates-financial-results?index=equities&symbol=${encodeURIComponent(symbol)}&period=Quarterly`)) ?? "[]") as
    { toDate: string; filingDate: string; consolidated: string; xbrl: string }[]
  const newer = (JSON.parse((await fetchText(`${API}integrated-filing-results?index=equities&symbol=${encodeURIComponent(symbol)}`)) ?? "{}") as
    { data?: { qe_Date: string; broadcast_Date: string | null; creation_Date: string | null; consolidated: string | null; type: string; xbrl: string | null }[] }).data ?? []
  const all: Listed[] = [
    ...older.filter((row) => row.xbrl?.endsWith(".xml") && row.filingDate !== "-")
      .map((row) => ({ periodEnd: isoFromNse(row.toDate), filedAt: row.filingDate, basis: row.consolidated === "Consolidated" ? "consolidated" as const : "standalone" as const, xbrl: row.xbrl })),
    // a filing with no time can't be placed in time — left out
    ...newer.filter((row) => row.type.includes("Financial") && row.xbrl?.endsWith(".xml") && row.consolidated && (row.broadcast_Date ?? row.creation_Date))
      .map((row) => ({ periodEnd: isoFromNse(row.qe_Date), filedAt: (row.broadcast_Date ?? row.creation_Date)!.slice(0, 17), basis: row.consolidated === "Consolidated" ? "consolidated" as const : "standalone" as const, xbrl: row.xbrl! })),
  ].filter((row) => row.periodEnd >= FROM_PERIOD)
  // one filing per quarter: consolidated when the company files it, the first-listed (latest) revision
  const byPeriod = new Map<string, Listed>()
  for (const row of all) {
    const current = byPeriod.get(row.periodEnd)
    if (!current || (current.basis === "standalone" && row.basis === "consolidated")) byPeriod.set(row.periodEnd, row)
  }
  return [...byPeriod.values()]
}

async function main() {
  const history = await loadHistory()
  // main-board stocks that were liquid (₹50 lakh+ a day) in at least 20 sessions since Nov 2023
  const symbols = [...history.stocks.values()].filter((stock) => stock.board === "main" &&
    stock.bars.filter((bar, index) => history.days[stock.dayIndex[index]] >= "2023-11-01" && bar.turnoverLakhs >= 50).length >= 20).map((stock) => stock.symbol)
  const done = new Set(existsSync(JSONL) ? (await readFile(JSONL, "utf8")).split("\n").filter(Boolean).map((line) => (JSON.parse(line) as { symbol: string }).symbol) : [])
  const todo = symbols.filter((symbol) => !done.has(symbol))
  console.log(`${symbols.length} symbols, ${todo.length} to fetch`)
  for (let index = 0; index < todo.length; index += 6) {
    await Promise.all(todo.slice(index, index + 6).map(async (symbol) => {
      const listed = await listFilings(symbol)
      const filings: Filing[] = []
      for (const row of listed) {
        const xml = await fetchText(row.xbrl)
        if (xml) filings.push({ symbol, periodEnd: row.periodEnd, filedAt: row.filedAt, basis: row.basis, ...parseFilingXbrl(xml) })
      }
      await appendFile(JSONL, JSON.stringify({ symbol, filings }) + "\n")
    }))
    if (index % 60 === 0) console.log(`  ${index}/${todo.length}`)
  }
  const lines = (await readFile(JSONL, "utf8")).split("\n").filter(Boolean)
  await writeFile(join(HISTORY_DIR, "fundamentals.json.gz"), gzipSync(`[${lines.join(",")}]`, { level: 9 }))
  console.log("done")
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
