import { test } from "node:test"
import assert from "node:assert/strict"
import { parseReportPicks, splitFindingsLog, tradeStatus } from "../../src/services/market/scorecard.js"

test("splitFindingsLog removes the log from the email and reads its rows", () => {
  const { report, findings } = splitFindingsLog([
    "# Pre-market briefing", "body",
    "## Findings log",
    "| Symbol | Verdict | Key finding |", "|---|---|---|",
    "| RATNAVEER | drop | Rights issue up to ₹330 cr (20 Aug) dilutes holders; negative operating cash flow FY26 |",
    "| SMLMAH | drop | Q2 profit −43% YoY (19 Oct) despite revenue +21% |",
  ].join("\n"))
  assert.equal(report, "# Pre-market briefing\nbody")
  assert.deepEqual(findings.map((finding) => [finding.symbol, finding.verdict]), [["RATNAVEER", "drop"], ["SMLMAH", "drop"]])
})

test("parseReportPicks keeps the sell-by date in either format", () => {
  const picks = parseReportPicks([
    "### 1. Swing picks", "| Stock | Action | Levels | Analysis |", "|---|---|---|---|",
    "| 🟢 MARINE | 🟢 Buy | ₹432.30 → ₹573.55 · SL ₹385.20 · by 2-Dec-2026 | x |",
    "| 🟢 SBC | 🟢 Buy | ₹63.35 → ₹80.70 · SL ₹57.55 · by 30 Nov 2026 | x |",
  ].join("\n"))
  assert.deepEqual(picks.map((pick) => pick.sellBy), ["2-Dec-2026", "30-Nov-2026"])
})

test("tradeStatus: stop, target, sell-by, else progress", () => {
  const trade = { symbol: "X", entry: 100, target: 130, stopLoss: 90, sellBy: "2-Dec-2026", pickedOn: "2026-10-21" }
  const oct22 = new Date("2026-10-22T10:00:00+05:30").getTime()
  assert.match(tradeStatus(trade, 89, oct22), /^🔴 stop loss/)
  assert.match(tradeStatus(trade, 131, oct22), /^🟢 target/)
  assert.match(tradeStatus(trade, 110, new Date("2026-12-03T10:00:00+05:30").getTime()), /sell-by/)
  assert.match(tradeStatus(trade, 115, oct22), /^hold .*50% of the way/)
})
