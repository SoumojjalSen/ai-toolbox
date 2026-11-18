import { test } from "node:test"
import assert from "node:assert/strict"
import { sizesFromPeriodOne, simulateAccount, type TradeRecord } from "../../src/backtest/run.js"
import type { History } from "../../src/backtest/history.js"

const closed = (r: number, entryIndex = 1, exitIndex = 5) => ({ kind: "closed" as const, entryIndex, exitIndex, entry: 100, exit: 100, r, outcome: "sell-by" as const })
const trade = (overrides: Partial<TradeRecord>): TradeRecord =>
  ({ symbol: "A", board: "main", strategy: "stage2-tight", signalDay: "2024-01-02", signalIndex: 0, regime: "strong", relativeStrengthRank: 90, result: closed(1), ...overrides })

test("sizesFromPeriodOne keeps a rule × board × market type only with ≥30 period-1 trades at ≥ +0.05R; period 2 never counts", () => {
  const trades = [
    ...Array.from({ length: 30 }, () => trade({ regime: "strong", result: closed(0.2) })),
    ...Array.from({ length: 30 }, () => trade({ regime: "neutral", result: closed(-0.1) })),
    ...Array.from({ length: 29 }, () => trade({ regime: "weak", result: closed(1) })), // too few
    ...Array.from({ length: 50 }, () => trade({ regime: "neutral", signalDay: "2026-01-05", result: closed(2) })), // period 2
  ]
  const sized = sizesFromPeriodOne(trades, "sized")
  assert.deepEqual([...sized].sort(), [["stage2-tight|main|neutral", 0], ["stage2-tight|main|strong", 1], ["stage2-tight|main|weak", 0]])
})

test("simulateAccount: risk per trade from the size table, skips trades over the 10% open-risk cap", () => {
  const days = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-08", "2024-01-09"]
  const stocks = new Map(Array.from({ length: 12 }, (_, index) => [`S${index}`, { symbol: `S${index}`, board: "main" as const, bars: [], dayIndex: days.map((_, day) => day), listedAtIndex: undefined }]))
  const history = { days, stocks } as unknown as History
  // 12 trades on the same day, each risking 1%: only 10 fit under the cap
  const trades = Array.from({ length: 12 }, (_, index) => trade({ symbol: `S${index}`, result: closed(2) }))
  const result = simulateAccount("test", history, trades, new Map([["stage2-tight|main|strong", 1]]), "2024-01-01", "9999")
  assert.equal(result.trades, 10)
  assert.equal(result.skippedForRisk, 2)
  assert.equal(result.total, 20) // 10 trades × 2R × 1%
  assert.deepEqual([...result.byYear], [["2024", 20]])
})
