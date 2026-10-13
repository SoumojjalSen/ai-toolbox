import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import type { BhavcopyRow } from "./services/marketScan.js"

process.env.MARKET_DATA_DIR = mkdtempSync(join(tmpdir(), "scorecard-"))
const { scorePick, recordPicks, buildTrackRecord } = await import("./services/scorecard.js")

const bar = (open: number, high: number, low: number, close: number, symbol = "ACME"): BhavcopyRow =>
  ({ symbol, prevClose: open, open, high, low, close, volume: 1000, turnoverLacs: 100, deliveryPercent: 40 })
const pick = { symbol: "ACME", entry: 100, stopLoss: 90, target: 130, rsRank: 95, lenses: ["order filing"], regime: "strong" }

test("scorePick: target, stop (stop wins a same-session tie), open, not entered", () => {
  assert.deepEqual(scorePick(pick, [bar(100, 105, 95, 104), bar(104, 131, 100, 128)]), { status: "target", r: 3 })
  assert.deepEqual(scorePick(pick, [bar(100, 131, 89, 100)]), { status: "stop", r: -1 })
  assert.deepEqual(scorePick(pick, [bar(100, 105, 95, 104)]), { status: "open", r: 0 })
  assert.deepEqual(scorePick(pick, [bar(108, 110, 100, 105)]), { status: "not entered", r: 0 })
})

test("recordPicks + buildTrackRecord tally results overall, per lens and per regime", async () => {
  await recordPicks("01-Oct-2026", [pick, { ...pick, symbol: "BETA", lenses: [] }])
  const sessionDates = ["01-Oct-2026", "03-Oct-2026", "04-Oct-2026"]
  const sessions = [[bar(100, 101, 99, 100)], [bar(100, 105, 95, 104), bar(100, 101, 89, 90, "BETA")], [bar(104, 131, 100, 128)]]
  const record = await buildTrackRecord(sessionDates, sessions)
  assert.match(record, /All: 2 closed · 50% hit target · avg 1\.00R/)
  assert.match(record, /With order filing: 1 closed · 100% hit target · avg 3\.00R/)
  assert.match(record, /With no extra lens: 1 closed · 0% hit target · avg -1\.00R/)
  assert.match(record, /Picked in a strong market: 2 closed/)
})
