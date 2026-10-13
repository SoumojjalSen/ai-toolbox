import { test } from "node:test"
import assert from "node:assert/strict"
import { selectMovers } from "./services/marketAlert.js"
import type { StockSignal } from "./services/marketScan.js"

const signal = (symbol: string, avgVolume20: number) => ({ symbol, avgVolume20 }) as StockSignal

test("selectMovers flags a NIACL-style move: flat open, +15% on heavy volume; ignores quiet, small and illiquid moves", () => {
  const signals = new Map([["NIACL", signal("NIACL", 2_000_000)], ["QUIET", signal("QUIET", 2_000_000)], ["SMALL", signal("SMALL", 2_000_000)]])
  const movers = selectMovers([
    { symbol: "NIACL", price: 187, changePercent: 15.3, gapPercent: 0.5, volume: 9_000_000 }, // 450% of a normal day
    { symbol: "QUIET", price: 100, changePercent: 6, gapPercent: 6, volume: 100_000 }, // big move, no volume
    { symbol: "SMALL", price: 100, changePercent: 1, gapPercent: 0, volume: 5_000_000 }, // volume, no move
    { symbol: "ILLIQUID", price: 10, changePercent: 20, gapPercent: 20, volume: 5_000_000 }, // not in the liquid scan
  ], signals)
  assert.deepEqual(movers.map((mover) => mover.quote.symbol), ["NIACL"])
  assert.equal(Math.round(movers[0].volumePercentOfDay), 450)
})
