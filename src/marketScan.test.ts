import { test } from "node:test"
import assert from "node:assert/strict"
import { parseBhavcopy, computeStockSignals, buildScanLists, buildSwingSetup, rankSwingSetups, assessRegime, type BhavcopyRow } from "./services/marketScan.js"

function makeSession(close: number, volume: number, overrides: Partial<BhavcopyRow> = {}): BhavcopyRow {
  return { symbol: "ACME", prevClose: close, open: close, high: close + 1, low: close - 1, close, volume, turnoverLacs: 100, deliveryPercent: 40, ...overrides }
}

// 220 sessions rising by `step` a session with a ±1 wiggle; the last 10 sessions move in a tight ₹0.2 band → Stage 2 + tight
function tightUptrend(symbol = "ACME", step = 0.5): BhavcopyRow[][] {
  const closes = Array.from({ length: 220 }, (_, index) => (index < 210 ? 100 + index * step + (index % 2) : 100 + 209 * step + (index % 2) * 0.2))
  return closes.map((close, index) => {
    const band = index < 210 ? 3 : 0.3
    return [makeSession(close, 1000, { symbol, prevClose: closes[index - 1] ?? close, high: close + band, low: close - band })]
  })
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

test("computeStockSignals: a volume spike gap-up lands in the gainers, accumulation and episodic-pivot lists", () => {
  const sessions = Array.from({ length: 20 }, () => [makeSession(100, 1000)])
  sessions.push([makeSession(110, 5000, { prevClose: 100, open: 105, high: 111, low: 104, deliveryPercent: 60 })])
  const [signal] = computeStockSignals(sessions)
  assert.equal(signal.changePercent1d, 10)
  assert.equal(signal.gapPercent, 5)
  assert.equal(signal.volumeRatio, 5)
  const listTitles = buildScanLists([signal]).filter((list) => list.stocks.length).map((list) => list.title)
  assert.deepEqual(listTitles, ["Top gainers", "Accumulation", "Episodic pivots"])
})

test("computeStockSignals drops illiquid stocks and new listings", () => {
  assert.equal(computeStockSignals(Array.from({ length: 21 }, () => [makeSession(100, 1000, { turnoverLacs: 10 })])).length, 0)
  assert.equal(computeStockSignals(Array.from({ length: 3 }, () => [makeSession(100, 1000)])).length, 0)
})

test("RS rank orders stocks by volatility-adjusted momentum; a tight Stage 2 uptrend is a core setup at 2×ATR stop, 3R target", () => {
  const strong = tightUptrend("STRONG", 0.5)
  const weak = tightUptrend("WEAK", 0.1)
  const sessions = strong.map((session, index) => [...session, ...weak[index]])
  const signals = computeStockSignals(sessions)
  const bySymbol = new Map(signals.map((s) => [s.symbol, s]))
  assert.ok(bySymbol.get("STRONG")!.rsRank > bySymbol.get("WEAK")!.rsRank)
  assert.equal(bySymbol.get("STRONG")!.isStage2Uptrend, true)
  assert.equal(bySymbol.get("STRONG")!.isTight, true)

  const setup = buildSwingSetup(bySymbol.get("STRONG")!)!
  assert.equal(setup.kind, "core")
  const risk = setup.entry - setup.stopLoss
  assert.ok(Math.abs(risk - 2 * bySymbol.get("STRONG")!.atr14) < 0.1)
  assert.ok(Math.abs((setup.target - setup.entry) / risk - 3) < 0.05)
  assert.equal(rankSwingSetups(signals)[0].symbol, "STRONG")
})

test("a stock below its 200-day average is never a swing setup", () => {
  const sessions = tightUptrend()
  sessions[219] = [makeSession(150, 1000, { prevClose: 205 })]
  assert.equal(buildSwingSetup(computeStockSignals(sessions)[0]), undefined)
})

test("assessRegime: broad 4% up-moves with most stocks above the 50-day = strong; the mirror image = weak", () => {
  const symbols = ["A", "B", "C", "D"]
  const build = (direction: 1 | -1) => Array.from({ length: 60 }, (_, index) => symbols.map((symbol) => {
    const close = 100 + direction * index * 0.5
    return makeSession(close, 1000, { symbol, prevClose: index >= 55 ? close / (1 + direction * 0.05) : close - direction * 0.5 })
  }))
  const up = build(1)
  assert.equal(assessRegime(computeStockSignals(up), up).label, "strong")
  const down = build(-1)
  assert.equal(assessRegime(computeStockSignals(down), down).label, "weak")
})
