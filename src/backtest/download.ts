// Downloads the NSE history the backtest needs into data/market-history/ (gzipped, committed for reference).
// Re-running fetches only what is missing. Run: npx tsx src/backtest/download.ts [fromDate=2023-01-01]
//
//   prices/YYYY-MM-DD.csv.gz        NSE daily price file (sec_bhavdata_full), all series — EQ main board, SM/ST SME
//   corporate-actions.json.gz       splits and bonuses (symbol, exDate, factor) — prices are adjusted with these
//   insider-trades.json.gz          SEBI PIT disclosures: promoter / director buys and sells
//   results-filings.json.gz         when each company filed its quarterly results (from NSE announcements)
//   listings.json.gz                listing date and issue price of every IPO NSE lists (main board and SME)
//   equity-list.csv.gz, nifty500.csv.gz   listing dates of all main-board stocks; sectors of the Nifty 500
import { mkdir, readFile, writeFile, readdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { gzipSync, gunzipSync } from "zlib"
import { fetchNse } from "../services/market/nse.js"
import { toAdjustments } from "../services/market/adjust.js"
import { parseNseDate } from "../services/market/store.js"

export const HISTORY_DIR = join(process.cwd(), "data", "market-history")
const API = "https://www.nseindia.com/api/"

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const ddmmyyyy = (date: Date) => isoDate(date).split("-").reverse().join("-") // API dates: 01-11-2025
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)

async function fetchWithRetry(url: string, attempts = 4): Promise<Response | undefined> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetchNse(url).catch((error: Error) => { console.error(`  ${url}: ${error.message}`); return undefined })
    if (response?.ok || response?.status === 404) return response
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
  }
  console.error(`  gave up: ${url}`)
  return undefined
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchWithRetry(API + path)
  if (!response?.ok) throw new Error(`NSE ${path}: ${response?.status ?? "no answer"}`)
  return response.json() as Promise<T>
}

export async function writeGz(name: string, text: string) {
  await writeFile(join(HISTORY_DIR, name), gzipSync(text, { level: 9 }))
}

export async function readGz(name: string): Promise<string> {
  return gunzipSync(await readFile(join(HISTORY_DIR, name))).toString("utf8")
}

// Daily price files: weekdays only; a holiday's URL is a 404 (or a copy of the previous session — deduped by DATE1)
async function downloadPrices(from: Date, to: Date) {
  await mkdir(join(HISTORY_DIR, "prices"), { recursive: true })
  const have = new Set(await readdir(join(HISTORY_DIR, "prices")))
  const missingFiles = new Set(existsSync(join(HISTORY_DIR, "no-file-days.txt")) ? (await readFile(join(HISTORY_DIR, "no-file-days.txt"), "utf8")).split("\n") : [])
  const days: Date[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) days.push(day)
  const todo = days.filter((day) => !have.has(`${isoDate(day)}.csv.gz`) && !missingFiles.has(isoDate(day)))
  console.log(`prices: ${todo.length} of ${days.length} weekdays to fetch`)
  for (let start = 0; start < todo.length; start += 4) {
    await Promise.all(todo.slice(start, start + 4).map(async (day) => {
      const [y, m, d] = isoDate(day).split("-")
      const response = await fetchWithRetry(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${d}${m}${y}.csv`)
      const text = response?.ok ? await response.text() : ""
      const sessionDate = text.startsWith("SYMBOL") ? text.split("\n")[1]?.split(",")[2]?.trim() : undefined
      // a holiday URL can serve the previous session's file: keep a file only under its own session date
      if (sessionDate && isoDate(new Date(parseNseDate(sessionDate) + 6 * 3_600_000)) === isoDate(day)) await writeGz(`prices/${isoDate(day)}.csv.gz`, text)
      else if (response?.status === 404 || sessionDate) missingFiles.add(isoDate(day))
    }))
    if (start % 100 === 0) console.log(`  prices ${start}/${todo.length}`)
  }
  await writeFile(join(HISTORY_DIR, "no-file-days.txt"), [...missingFiles].filter(Boolean).sort().join("\n"))
}

// Long ranges are split so each API call stays small
async function fetchInChunks<T>(label: string, from: Date, to: Date, chunkDays: number, path: (from: string, to: string) => string, pick: (body: unknown) => T[]): Promise<T[]> {
  const rows: T[] = []
  for (let start = from; start <= to; start = addDays(start, chunkDays)) {
    const end = addDays(start, chunkDays - 1) < to ? addDays(start, chunkDays - 1) : to
    rows.push(...pick(await fetchJson<unknown>(path(ddmmyyyy(start), ddmmyyyy(end)))))
    process.stdout.write(`\r  ${label} through ${isoDate(end)} (${rows.length} rows)`)
  }
  process.stdout.write("\n")
  return rows
}

interface Announcement { symbol: string; desc: string; an_dt: string; attchmntText: string | null }
interface InsiderRow { symbol: string; personCategory: string; acqMode: string; tdpTransactionType: string; secType: string; secAcq: string; secVal: string; acqfromDt: string; acqtoDt: string; intimDt: string; date: string }
const RESULTS_TEXT = /submitted to the Exchange,? the financial results/i

async function downloadEvents(from: Date, to: Date) {
  const actions = await fetchInChunks("corporate actions", from, to, 90, (a, b) => `corporates-corporateActions?index=equities&from_date=${a}&to_date=${b}`, (body) => body as { symbol: string; series: string; subject: string; exDate: string }[])
  await writeGz("corporate-actions.json.gz", JSON.stringify(toAdjustments(actions)))

  const insider = await fetchInChunks("insider trades", from, to, 7, (a, b) => `corporates-pit?index=equities&from_date=${a}&to_date=${b}`, (body) => ((body as { data?: InsiderRow[] }).data ?? []))
  await writeGz("insider-trades.json.gz", JSON.stringify(insider.map(({ symbol, personCategory, acqMode, tdpTransactionType, secType, secAcq, secVal, acqfromDt, acqtoDt, intimDt, date }) =>
    ({ symbol, personCategory, acqMode, type: tdpTransactionType, secType, shares: Number(secAcq) || 0, value: Number(secVal) || 0, tradeFrom: acqfromDt, tradeTo: acqtoDt, disclosed: date || intimDt }))))

  // one day per call: a results-season day has ~1,500 announcements
  const results = await fetchInChunks("results filings", from, to, 1, (a, b) => `corporate-announcements?index=equities&from_date=${a}&to_date=${b}`,
    (body) => (body as Announcement[]).filter((row) => RESULTS_TEXT.test(row.attchmntText ?? "")).map((row) => ({ symbol: row.symbol, filedAt: row.an_dt })))
  await writeGz("results-filings.json.gz", JSON.stringify(results))
}

async function downloadLists() {
  const listings = await fetchJson<{ symbol: string; securityType: string; issuePrice: string; listingDate: string; ipoStartDate: string }[]>("public-past-issues")
  await writeGz("listings.json.gz", JSON.stringify(listings.map(({ symbol, securityType, issuePrice, listingDate, ipoStartDate }) => ({ symbol, board: securityType, issuePrice: Number(issuePrice) || undefined, listingDate, ipoStartDate }))))
  for (const [name, url] of [["equity-list.csv.gz", "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"], ["nifty500.csv.gz", "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv"], ["etf-list.csv.gz", "https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv"]]) {
    const response = await fetchWithRetry(url)
    if (!response?.ok) throw new Error(`${url}: ${response?.status ?? "no answer"}`)
    await writeGz(name, await response.text())
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const from = new Date(`${process.argv[2] ?? "2023-01-01"}T00:00:00Z`)
  const to = new Date(`${isoDate(new Date(Date.now() + 5.5 * 3_600_000))}T00:00:00Z`)
  await mkdir(HISTORY_DIR, { recursive: true })
  await downloadLists()
  await downloadPrices(from, to)
  await downloadEvents(from, to)
  console.log("done")
}
