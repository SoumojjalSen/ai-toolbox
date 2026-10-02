import { test } from "node:test"
import assert from "node:assert/strict"
import { parseBhavcopy, computeStockSignals, buildScanLists, buildTradeSetups, type BhavcopyRow } from "./services/marketScan.js"

function makeSession(close: number, volume: number, overrides: Partial<BhavcopyRow> = {}): BhavcopyRow {
  return { symbol: "ACME", prevClose: close, open: close, high: close + 1, low: close - 1, close, volume, turnoverLacs: 100, deliveryPercent: 40, ...overrides }
}

test("parseBhavcopy keeps EQ rows and trims padded fields", () => {
  const csvText = [
    "SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER",
    "20MICRONS, EQ, 01-Oct-2026, 214.59, 213.00, 214.70, 203.35, 205.35, 207.26, 208.20, 92549, 192.69, 3990, 42666, 46.10",
    "SOMEBE, BE, 01-Oct-2026, 10, 10, 10, 10, 10, 10, 10, 100, 0.01, 1, -, -",
  ].join("\n")
  assert.deepEqual(parseBhavcopy(csvText), [
    { symbol: "20MICRONS", prevClose: 214.59, open: 213, high: 214.7, low: 203.35, close: 207.26, volume: 92549, turnoverLacs: 192.69, deliveryPercent: 46.1 },
  ])
})

test("computeStockSignals: breakout on a volume spike lands in accumulation, breakout and episodic-pivot lists", () => {
  // 20 flat sessions at ₹100 / 1,000 shares, then a gap-up to ₹110 on 5,000 shares with higher delivery
  const sessions = Array.from({ length: 20 }, () => [makeSession(100, 1000)])
  sessions.push([makeSession(110, 5000, { prevClose: 100, open: 105, high: 111, low: 104, deliveryPercent: 60 })])

  const [signal] = computeStockSignals(sessions)
  assert.equal(signal.changePercent1d, 10)
  assert.equal(signal.gapPercent, 5)
  assert.equal(signal.volumeRatio, 5)
  assert.equal(signal.isBreakout20d, true)

  const listTitles = buildScanLists([signal]).filter((list) => list.stocks.length).map((list) => list.title)
  assert.deepEqual(listTitles, ["Top gainers", "Accumulation", "Episodic pivots", "20-day breakouts", "20-day leaders"])
})

test("computeStockSignals drops illiquid stocks and new listings", () => {
  const illiquid = Array.from({ length: 21 }, () => [makeSession(100, 1000, { turnoverLacs: 10 })])
  assert.equal(computeStockSignals(illiquid).length, 0)
  const newListing = Array.from({ length: 3 }, () => [makeSession(100, 1000)])
  assert.equal(computeStockSignals(newListing).length, 0)
})

test("computeStockSignals: a steady 220-session uptrend passes the Minervini trend template", () => {
  // close rises ₹100 → ₹209 by ₹0.5 a session; the high/low band stays tight
  const uptrend = Array.from({ length: 220 }, (_, index) => [makeSession(100 + index * 0.5, 1000, { prevClose: 100 + (index - 1) * 0.5 })])
  const [signal] = computeStockSignals(uptrend)
  assert.equal(signal.isStage2Uptrend, true)
  assert.equal(signal.aboveDma200, true)

  // same history, but the last session crashes below the 50-day average → template fails
  uptrend[219] = [makeSession(150, 1000, { prevClose: 209 })]
  assert.equal(computeStockSignals(uptrend)[0].isStage2Uptrend, false)
})

test("buildTradeSetups: levels give reward = 2 × risk; intraday long triggers above yesterday's high", () => {
  // uptrend, then a strong close near the high on 5× volume → intraday long AND swing long
  const sessions = Array.from({ length: 220 }, (_, index) => [makeSession(100 + index * 0.5, 1000, { prevClose: 100 + (index - 1) * 0.5 })])
  sessions[219] = [makeSession(214, 5000, { prevClose: 209.5, open: 210, high: 214.5, low: 209.5, deliveryPercent: 60 })]
  const setups = buildTradeSetups(computeStockSignals(sessions))

  const [intradayLong] = setups["intraday long"]
  assert.ok(intradayLong.entry > 214.5, "entry above yesterday's high")
  const [swingLong] = setups["swing long"]
  assert.equal(setups["intraday short"].length, 0)
  for (const setup of [intradayLong, swingLong]) {
    const risk = setup.entry - setup.stopLoss
    const reward = setup.target - setup.entry
    assert.ok(risk > 0 && Math.abs(reward / risk - 2) < 0.05, `${setup.setupType}: reward ${reward} vs risk ${risk}`)
  }
})
