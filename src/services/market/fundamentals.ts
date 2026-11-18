import { gunzipSync } from "zlib"
import { readFile } from "fs/promises"
import { join } from "path"
import { fetchNse } from "./nse.js"
import { readJson, writeJson } from "./store.js"

// Quarterly results figures from NSE's structured (XBRL) filings, with the time each was filed — what the long-term
// screens (screens.ts) read. The backtest's download (src/backtest/fundamentals.ts) seeds
// data/market-history/fundamentals.json.gz (shipped in the image); the evening job adds newer filings to
// fundamentals-updates.json on the data volume. SME companies file no structured results on NSE.

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

export const FROM_PERIOD = "2021-12-01"
const API = "https://www.nseindia.com/api/"

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
  // lenders (NBFC and bank formats) report debt as borrowings, debt securities, subordinated debt and deposits
  const lenderDebt = ["Borrowings", "DebtSecurities", "SubordinatedLiabilities", "Deposits"].map((name) => value(name, "OneI")).filter((amount): amount is number => amount !== undefined)
  return {
    revenue: value("RevenueFromOperations", "OneD"),
    profit: value("ProfitOrLossAttributableToOwnersOfParent", "OneD") ?? value("ProfitLossForPeriod", "OneD"),
    eps: value("BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations", "OneD") ?? value("BasicEarningsLossPerShareFromContinuingOperations", "OneD"),
    profitBeforeTax: value("ProfitBeforeTax", "OneD"),
    financeCosts: value("FinanceCosts", "OneD"),
    equity: value("EquityAttributableToOwnersOfParent", "OneI") ?? value("Equity", "OneI"),
    borrowings: borrowingsNoncurrent !== undefined || borrowingsCurrent !== undefined ? (borrowingsNoncurrent ?? 0) + (borrowingsCurrent ?? 0)
      : lenderDebt.length ? lenderDebt.reduce((total, amount) => total + amount, 0) : undefined,
    operatingCashFlowYtd: value("CashFlowsFromUsedInOperatingActivities", "FourD"),
    shares: paidUp && faceValue ? paidUp / faceValue : undefined,
  }
}

export async function fetchText(url: string): Promise<string | undefined> {
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


export interface SymbolFilings { symbol: string; filings: Filing[] }
const SEED = join(process.cwd(), "data", "market-history", "fundamentals.json.gz")
const UPDATES = "fundamentals-updates.json"

// symbol → every filing known (seed + updates); a period filed again replaces the older copy
export async function loadFundamentals(): Promise<Map<string, Filing[]>> {
  const seed = JSON.parse(gunzipSync(await readFile(SEED)).toString("utf8")) as SymbolFilings[]
  const updates = (await readJson<SymbolFilings[]>(UPDATES)) ?? []
  const bySymbol = new Map<string, Map<string, Filing>>()
  for (const { symbol, filings } of [...seed, ...updates]) {
    const periods = bySymbol.get(symbol) ?? new Map<string, Filing>()
    for (const filing of filings) periods.set(filing.periodEnd, filing)
    bySymbol.set(symbol, periods)
  }
  return new Map([...bySymbol].map(([symbol, periods]) => [symbol, [...periods.values()]]))
}

// Fetch the filings of companies that filed results recently and keep the periods not yet known
export async function updateFundamentals(symbols: string[]): Promise<{ added: number; failed: string[] }> {
  const known = await loadFundamentals()
  const updates = (await readJson<SymbolFilings[]>(UPDATES)) ?? []
  let added = 0
  const failed: string[] = []
  for (let index = 0; index < symbols.length; index += 4) {
    await Promise.all(symbols.slice(index, index + 4).map(async (symbol) => {
      const have = new Set((known.get(symbol) ?? []).map((filing) => filing.periodEnd))
      const listed = await listFilings(symbol).catch(() => undefined)
      if (!listed) { failed.push(symbol); return }
      const fresh: Filing[] = []
      for (const row of listed.filter((candidate) => !have.has(candidate.periodEnd))) {
        const xml = await fetchText(row.xbrl)
        if (xml) fresh.push({ symbol, periodEnd: row.periodEnd, filedAt: row.filedAt, basis: row.basis, ...parseFilingXbrl(xml) })
        else failed.push(symbol)
      }
      if (fresh.length) { updates.push({ symbol, filings: fresh }); added += fresh.length }
    }))
  }
  await writeJson(UPDATES, updates)
  return { added, failed: [...new Set(failed)] }
}
