import { test } from "node:test"
import assert from "node:assert/strict"
import { simulateTrade } from "../../src/backtest/simulate.js"
import type { DailyPriceRow } from "../../src/services/market/scan.js"
import type { TradePlan } from "../../src/services/market/strategies.js"

const bar = (open: number, high: number, low: number, close: number, prevClose = open): DailyPriceRow =>
  ({ symbol: "ACME", prevClose, open, high, low, close, volume: 1000, turnoverLakhs: 100, deliveryPercent: 50 })
const swing: TradePlan = { strategy: "stage2-tight", risk: 10, reward: 3, holdSessions: 30 }

test("a news rule buys the open whatever the gap; levels are set from that open", () => {
  const bars = [bar(100, 101, 99, 100), bar(104, 110, 103, 109), bar(109, 135, 108, 134)]
  assert.deepEqual(simulateTrade(bars, 0, { ...swing, strategy: "acquisition-news", buyAtAnyOpen: true }, 0),
    { kind: "closed", entryIndex: 1, exitIndex: 2, entry: 104, exit: 134, outcome: "target", r: 3 })
})

test("bought at the next open, sold at the target: +3R minus costs", () => {
  const bars = [bar(100, 101, 99, 100), bar(100, 105, 99, 104), bar(104, 131, 103, 129)]
  assert.deepEqual(simulateTrade(bars, 0, swing, 0.25), { kind: "closed", entryIndex: 1, exitIndex: 2, entry: 100, exit: 130, outcome: "target", r: 3 - 0.025 })
})

test("a gap down through the stop exits at the open, below the stop", () => {
  const bars = [bar(100, 101, 99, 100), bar(100, 102, 95, 98), bar(85, 86, 80, 82)]
  const result = simulateTrade(bars, 0, swing, 0)
  assert.equal(result.kind === "closed" && result.exit, 85)
  assert.equal(result.kind === "closed" && result.r, -1.5)
})

test("a day touching both the stop and the target counts as the stop", () => {
  const bars = [bar(100, 101, 99, 100), bar(100, 101, 99, 100), bar(100, 140, 85, 120)]
  const result = simulateTrade(bars, 0, swing, 0)
  assert.equal(result.kind === "closed" && result.outcome, "stop")
})

test("skips: open more than 1% above the signal close; locked at the upper limit", () => {
  assert.deepEqual(simulateTrade([bar(100, 101, 99, 100), bar(101.5, 103, 101, 102)], 0, swing, 0), { kind: "skipped", reason: "above buy limit" })
  assert.deepEqual(simulateTrade([bar(100, 101, 99, 100), bar(105, 105, 105, 105, 100)], 0, swing, 0, false), { kind: "skipped", reason: "locked at upper limit" })
})

test("sell-by: sold at the close of the last holding session; intraday (hold 0) sells at the fill day's close", () => {
  const flat = [bar(100, 101, 99, 100), bar(100, 102, 98, 101), bar(101, 103, 99, 102)]
  const swingResult = simulateTrade(flat, 0, { ...swing, holdSessions: 1 }, 0)
  assert.equal(swingResult.kind === "closed" && swingResult.exit, 102)
  const intraday = simulateTrade(flat, 0, { strategy: "intraday-stage2", risk: 5, reward: Infinity, holdSessions: 0 }, 0)
  assert.deepEqual(intraday, { kind: "closed", entryIndex: 1, exitIndex: 1, entry: 100, exit: 101, outcome: "sell-by", r: 0.2 })
})
