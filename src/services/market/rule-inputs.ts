import { fetchNse, fetchNseJson } from "./nse.js"
import { parseNseDate } from "./store.js"
import { isInsiderMarketBuy } from "./strategies.js"

// What the pick rules (strategies.ts) need beyond prices, fetched live from NSE: listing dates, Nifty 500 sectors and
// insider buys. The backtest reads the same sources from data/market-history (src/backtest/history.ts).

export interface RuleInputs {
  listedOn: Map<string, number> // symbol → listing date (epoch ms, IST midnight)
  sectorOf: Map<string, string> // Nifty 500 stocks only
  insiderBuyValue: (symbol: string, sessionDate: string) => number // ₹ of promoter/director market buys disclosed that session
  unavailable: string[]
}

interface NseInsiderRow { symbol: string; personCategory: string; acqMode: string; tdpTransactionType: string; secType: string; secVal: string; date: string }

async function fetchCsv(url: string): Promise<string[][] | undefined> {
  const response = await fetchNse(url).catch(() => undefined)
  if (!response?.ok) return undefined
  return (await response.text()).split("\n").slice(1).filter(Boolean).map((line) => line.split(",").map((field) => field.trim()))
}

// "01-11-2026" — the PIT API's date format
function numericDate(epochMs: number): string {
  const date = new Date(epochMs + 5.5 * 3_600_000)
  return `${String(date.getUTCDate()).padStart(2, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${date.getUTCFullYear()}`
}

export async function fetchRuleInputs(now = Date.now()): Promise<RuleInputs> {
  const [equityList, nifty500, insider] = await Promise.all([
    fetchCsv("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"),
    fetchCsv("https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv"),
    fetchNseJson<{ data?: NseInsiderRow[] }>(`corporates-pit?index=equities&from_date=${numericDate(now - 7 * 86_400_000)}&to_date=${numericDate(now)}`),
  ])
  const unavailable = [
    ...(equityList ? [] : ["listing dates (new-listing rule)"]),
    ...(nifty500 ? [] : ["Nifty 500 sectors (sector-leader rule)"]),
    ...(insider?.data ? [] : ["insider trades (insider-buy rule)"]),
  ]
  const buys = new Map<string, number>() // `${symbol}|${DD-Mon-YYYY}` → ₹
  for (const row of insider?.data ?? []) {
    if (!isInsiderMarketBuy({ ...row, type: row.tdpTransactionType })) continue
    const key = `${row.symbol}|${row.date.slice(0, 11)}`
    buys.set(key, (buys.get(key) ?? 0) + (Number(row.secVal) || 0))
  }
  return {
    listedOn: new Map((equityList ?? []).filter((fields) => /^\d{2}-\w{3}-\d{4}$/.test(fields[3])).map((fields) => [fields[0], parseNseDate(fields[3])])),
    sectorOf: new Map((nifty500 ?? []).filter((fields) => fields[2]).map((fields) => [fields[2], fields[1]])),
    insiderBuyValue: (symbol, sessionDate) => buys.get(`${symbol}|${sessionDate}`) ?? 0,
    unavailable,
  }
}
