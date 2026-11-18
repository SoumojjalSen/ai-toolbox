import { test } from "node:test"
import assert from "node:assert/strict"
import { computeMetrics, SCREENS } from "../../src/backtest/screens.js"
import type { Filing } from "../../src/backtest/fundamentals.js"

const quarterEnds = ["2024-09-30", "2024-06-30", "2024-03-31", "2023-12-31", "2023-09-30", "2023-06-30", "2023-03-31", "2022-12-31"]
const crore = 1e7
// 8 quarters, newest first: revenue ₹100 cr and profit ₹10 cr a quarter this year, ₹80 cr / ₹8 cr last year;
// 1 crore shares; balance sheet: equity ₹200 cr, borrowings ₹50 cr
function filings(): Filing[] {
  return quarterEnds.map((periodEnd, index) => ({
    symbol: "ACME", periodEnd, filedAt: "-", basis: "consolidated",
    revenue: (index < 4 ? 100 : 80) * crore, profit: (index < 4 ? 10 : 8) * crore,
    profitBeforeTax: (index < 4 ? 13 : 10) * crore, financeCosts: 2 * crore,
    shares: 1e7, ...(index === 0 ? { equity: 200 * crore, borrowings: 50 * crore } : {}),
  }))
}

test("computeMetrics: trailing-4-quarter P/E, growth, PEG, ROE, ROCE, D/E from filings and the traded price", () => {
  const metrics = computeMetrics(filings(), 600)! // market cap 1 crore shares × ₹600 = ₹600 cr; profit ₹40 cr
  assert.equal(metrics.marketCapCrore, 600)
  assert.equal(metrics.pe, 15)
  assert.equal(metrics.profitGrowth, 25) // 40 vs 32
  assert.equal(metrics.salesGrowth, 25) // 400 vs 320
  assert.equal(metrics.peg, 0.6)
  assert.equal(metrics.roe, 20) // 40 / 200
  assert.equal(metrics.roce, 24) // (52 + 8) / 250
  assert.equal(metrics.debtToEquity, 0.25)
  assert.equal(metrics.latestQuarterProfitGrowth, 25)
  assert.equal(metrics.salesGrowthYearBefore, undefined) // needs 12 quarters
})

test("computeMetrics fills one missing quarter per year with the other three's average; two missing → no metrics", () => {
  const oneMissing = filings().filter((filing) => filing.periodEnd !== "2024-03-31")
  assert.equal(computeMetrics(oneMissing, 600)!.pe, 15) // 3 × ₹10 cr, scaled to 4 quarters = ₹40 cr
  const twoMissing = oneMissing.filter((filing) => filing.periodEnd !== "2023-12-31")
  assert.equal(computeMetrics(twoMissing, 600), undefined)
  assert.equal(computeMetrics(filings().slice(0, 6), 600), undefined)
})

test("computeMetrics: a loss leaves P/E undefined", () => {
  const loss = filings().map((filing, index) => (index < 4 ? { ...filing, profit: -crore } : filing))
  assert.equal(computeMetrics(loss, 600)!.pe, undefined)
})

test("screens: P/E below 30 and the Lynch fast-grower rule on the same stock", () => {
  const metrics = computeMetrics(filings(), 600)!
  const screen = (name: string) => SCREENS.find((candidate) => candidate.name === name)!
  const price = { percentFrom52WeekHigh: -5, return6Months: 25 }
  assert.equal(screen("P/E below 30").passes(metrics, price), true)
  assert.equal(screen("Peter Lynch fast growers").passes(metrics, price), true) // PEG 0.6, growth 25%, P/E 15, D/E 0.25
  assert.equal(screen("P/E below 30").passes(computeMetrics(filings(), 1400)!, price), false) // P/E 35
})
