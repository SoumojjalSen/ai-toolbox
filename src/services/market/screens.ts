import type { Filing } from "./fundamentals.js"
import type { DailyPriceRow } from "./scan.js"

// Popular Indian stock screens (Screener.in public screens, Peter Lynch, Greenblatt, CANSLIM, Coffee Can), rebuilt
// from point-in-time NSE filings. The data starts Dec 2021, so "5-year" and "10-year" conditions become the
// 1-year (trailing 4 quarters vs the 4 before) and, where stated, 2-year versions — each screen's note says so.
// Promoter holding, pledge, current ratio and P/B aren't in the data: those conditions are left out (also noted).

export interface Metrics {
  marketCapCrore: number
  pe: number | undefined // market cap ÷ trailing-4-quarter profit; undefined when that profit ≤ 0
  peg: number | undefined // P/E ÷ trailing profit growth %; undefined when growth ≤ 0
  salesGrowth: number | undefined // %, trailing 4 quarters vs the 4 before
  profitGrowth: number | undefined
  salesGrowthYearBefore: number | undefined // the same, one year earlier (needs 12 quarters)
  latestQuarterProfitGrowth: number | undefined // %, latest quarter vs the same quarter a year ago
  roe: number | undefined // %, trailing profit ÷ equity
  roce: number | undefined // %, trailing (profit before tax + finance costs) ÷ (equity + borrowings)
  roceYearBefore: number | undefined
  debtToEquity: number | undefined
  earningsYield: number | undefined // %, trailing EBIT ÷ (market cap + borrowings)
}

export interface PriceFacts { percentFrom52WeekHigh: number; return6Months: number }

export interface Screen { name: string; note: string; passes: (m: Metrics, price: PriceFacts) => boolean; rankBy?: (m: Metrics) => number; top?: number }

const growth = (now: number, before: number) => (before > 0 ? (now / before - 1) * 100 : undefined)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const isDefined = <T>(value: T | undefined): value is T => value !== undefined
const daysBetween = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000

// filings: one stock's filings already public on the test date, any order. rawPrice: the traded price that day
// (not split-adjusted, so it matches the share count in the filings).
export function computeMetrics(filings: Filing[], rawPrice: number): Metrics | undefined {
  const reported = filings.filter((filing) => isDefined(filing.revenue) && isDefined(filing.profit))
  if (!reported.length) return undefined
  const latest = reported.reduce((newest, filing) => (filing.periodEnd > newest.periodEnd ? filing : newest))
  const byPeriod = new Map(reported.map((filing) => [filing.periodEnd, filing]))
  // 12 quarter slots back from the latest. NSE's data misses some quarters (often Jan–Mar 2025, when the filing
  // format changed): one missing quarter in a 4-quarter block is filled with the average of the other three.
  const slots = Array.from({ length: 12 }, (_, index) => byPeriod.get(quarterEndBefore(latest.periodEnd, index)))
  type Figures = { revenue: number; profit: number; ebit: number }
  const figures = (filing: Filing): Figures => ({ revenue: filing.revenue!, profit: filing.profit!, ebit: (filing.profitBeforeTax ?? filing.profit!) + (filing.financeCosts ?? 0) })
  const block = (from: number): Figures | undefined => {
    const known = slots.slice(from, from + 4).filter(isDefined).map(figures)
    if (known.length < 3) return undefined
    const total = (field: keyof Figures) => (sum(known.map((quarter) => quarter[field])) * 4) / known.length
    return { revenue: total("revenue"), profit: total("profit"), ebit: total("ebit") }
  }
  const [thisYear, lastYear, yearBefore] = [block(0), block(4), block(8)]
  if (!thisYear || !lastYear) return undefined
  const shares = filings.filter((filing) => filing.shares).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0]?.shares
  if (!shares) return undefined
  const balanceSheets = filings.filter((filing) => isDefined(filing.equity) && filing.equity! > 0).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
  const latestBalance = balanceSheets[0]
  const yearEarlierBalance = latestBalance && balanceSheets.find((sheet) => daysBetween(sheet.periodEnd, latestBalance.periodEnd) > 330 && daysBetween(sheet.periodEnd, latestBalance.periodEnd) < 400)

  const marketCap = shares * rawPrice
  const profitGrowth = growth(thisYear.profit, lastYear.profit)
  const pe = thisYear.profit > 0 ? marketCap / thisYear.profit : undefined
  // debt unknown (not in the filing) → ROCE and debt/equity unknown, never "no debt"
  const capital = (sheet: Filing | undefined) => (sheet && sheet.borrowings !== undefined ? sheet.equity! + sheet.borrowings : undefined)
  return {
    marketCapCrore: marketCap / 1e7,
    pe,
    peg: pe !== undefined && profitGrowth !== undefined && profitGrowth > 0 ? pe / profitGrowth : undefined,
    salesGrowth: growth(thisYear.revenue, lastYear.revenue),
    profitGrowth,
    salesGrowthYearBefore: yearBefore ? growth(lastYear.revenue, yearBefore.revenue) : undefined,
    latestQuarterProfitGrowth: slots[4] ? growth(latest.profit!, slots[4].profit!) : undefined,
    roe: latestBalance ? (thisYear.profit / latestBalance.equity!) * 100 : undefined,
    roce: capital(latestBalance) ? (thisYear.ebit / capital(latestBalance)!) * 100 : undefined,
    roceYearBefore: capital(yearEarlierBalance) ? (lastYear.ebit / capital(yearEarlierBalance)!) * 100 : undefined,
    debtToEquity: latestBalance && latestBalance.borrowings !== undefined ? latestBalance.borrowings / latestBalance.equity! : undefined,
    earningsYield: (thisYear.ebit / (marketCap + (latestBalance?.borrowings ?? 0))) * 100,
  }
}

// "2024-09-30", 2 → "2024-03-31": the end of the quarter `count` quarters earlier
function quarterEndBefore(periodEnd: string, count: number): string {
  const [year, month] = periodEnd.split("-").map(Number)
  const monthsBack = year * 12 + (month - 1) - count * 3
  const endYear = Math.floor(monthsBack / 12)
  const endMonth = (monthsBack % 12) + 1
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate()
  return `${endYear}-${String(endMonth).padStart(2, "0")}-${lastDay}`
}

const below = (value: number | undefined, limit: number) => value !== undefined && value < limit
const above = (value: number | undefined, limit: number) => value !== undefined && value > limit

export const SCREENS: Screen[] = [
  {
    name: "P/E below 30",
    note: "Profitable and P/E < 30, market cap > ₹100 cr — the simplest value rule",
    passes: (m) => m.marketCapCrore > 100 && below(m.pe, 30),
  },
  {
    name: "Multibagger (Screener 'Tanmoy')",
    note: "Mcap > 100, sales and profit growth > 15%, ROCE > 15, D/E < 0.5, PEG < 1, P/E < 20. 1-year growth (5-year in the original); promoter, current ratio, P/B, payout left out",
    passes: (m) => m.marketCapCrore > 100 && above(m.salesGrowth, 15) && above(m.profitGrowth, 15) && above(m.roce, 15) && below(m.debtToEquity, 0.5) && below(m.peg, 1) && below(m.pe, 20),
  },
  {
    name: "Multibagger (Screener 'TradingMargin')",
    note: "Mcap > 1000, profit growth > 20% (trailing year and latest quarter), D/E < 1, PEG < 1. 1-year growth (3-year in the original); promoter and pledge left out",
    passes: (m) => m.marketCapCrore > 1000 && above(m.profitGrowth, 20) && above(m.latestQuarterProfitGrowth, 20) && below(m.debtToEquity, 1) && below(m.peg, 1),
  },
  {
    name: "Small-cap multibagger (Screener)",
    note: "Mcap < 5000, ROCE > 20, ROE > 20, sales and profit growth > 20%, D/E < 0.5, PEG < 1. 1-year growth (5-year in the original); promoter, industry P/E left out",
    passes: (m) => m.marketCapCrore > 100 && m.marketCapCrore < 5000 && above(m.roce, 20) && above(m.roe, 20) && above(m.salesGrowth, 20) && above(m.profitGrowth, 20) && below(m.debtToEquity, 0.5) && below(m.peg, 1),
  },
  {
    name: "Peter Lynch fast growers",
    note: "PEG 0–1, profit growth ≥ 20%, P/E ≤ 40, D/E < 0.3, mcap > 100. 1-year growth (5-year EPS growth in the original)",
    passes: (m) => m.marketCapCrore > 100 && below(m.peg, 1) && above(m.profitGrowth, 20) && below(m.pe, 40.01) && below(m.debtToEquity, 0.3),
  },
  {
    name: "Clean-balance-sheet compounders (Screener)",
    note: "Sales and profit growth > 12%, ROCE > 18, ROE > 12, P/E 8–30, mcap > 100. 1-year growth (3-year in the original); pledge left out",
    passes: (m) => m.marketCapCrore > 100 && above(m.salesGrowth, 12) && above(m.profitGrowth, 12) && above(m.roce, 18) && above(m.roe, 12) && above(m.pe, 8) && below(m.pe, 30),
  },
  {
    name: "Coffee Can (2-year version)",
    note: "Sales growth > 10% and ROCE > 15 in each of the last 2 years, mcap > 1000 (10 years in the original)",
    passes: (m) => m.marketCapCrore > 1000 && above(m.salesGrowth, 10) && above(m.salesGrowthYearBefore, 10) && above(m.roce, 15) && above(m.roceYearBefore, 15),
  },
  {
    name: "Magic Formula (Greenblatt), top 30",
    note: "Mcap > 400, ranked on earnings yield + ROCE (lower rank sum = better), best 30; banks and finance companies drop out (no revenue/ROCE in their filings)",
    passes: (m) => m.marketCapCrore > 400 && above(m.roce, 0) && above(m.earningsYield, 0),
    rankBy: (m) => -(m.earningsYield! + m.roce!), // simple sum stands in for the rank sum
    top: 30,
  },
  {
    name: "CANSLIM (C + A + new high)",
    note: "Latest-quarter and trailing-year profit growth > 20%, within 15% of the 52-week high, 6-month return ≥ 20%, mcap > 100",
    passes: (m, price) => m.marketCapCrore > 100 && above(m.latestQuarterProfitGrowth, 20) && above(m.profitGrowth, 20) && price.percentFrom52WeekHigh >= -15 && price.return6Months >= 20,
  },
]

// 52-week high and 6-month return from adjusted daily bars ending today; undefined under 127 sessions
export function priceFactsOf(bars: DailyPriceRow[]): PriceFacts | undefined {
  if (bars.length < 127) return undefined
  const close = bars[bars.length - 1].close
  const year = bars.slice(-252)
  return { percentFrom52WeekHigh: (close / Math.max(...year.map((bar) => bar.high)) - 1) * 100, return6Months: (close / bars[bars.length - 127].close - 1) * 100 }
}

// The screens shown in the morning report: the two that beat all screened stocks in both backtest periods
// (data/market-history/backtest/screens-report.md: compounders +7.4% vs +2.1% over 6 months in Nov 2023 → Oct 2025,
// +18.0% vs +11.2% in the last year; CANSLIM +5.1% and +15.1%). The others didn't hold up and aren't shown.
export const LIVE_SCREEN_NAMES = ["Clean-balance-sheet compounders (Screener)", "CANSLIM (C + A + new high)"]

export interface LongTermPick { symbol: string; screens: string[]; metrics: Metrics; price: PriceFacts }

// stocks: liquid main-board stocks with their filings already public and today's traded price
export function longTermPicks(stocks: { symbol: string; filings: Filing[]; rawPrice: number; bars: DailyPriceRow[] }[]): LongTermPick[] {
  const screens = SCREENS.filter((screen) => LIVE_SCREEN_NAMES.includes(screen.name))
  return stocks.flatMap(({ symbol, filings, rawPrice, bars }) => {
    const metrics = computeMetrics(filings, rawPrice)
    const price = priceFactsOf(bars)
    if (!metrics || !price) return []
    const passed = screens.filter((screen) => screen.passes(metrics, price)).map((screen) => screen.name)
    return passed.length ? [{ symbol, screens: passed, metrics, price }] : []
  }).sort((a, b) => b.screens.length - a.screens.length || b.metrics.marketCapCrore - a.metrics.marketCapCrore)
}
