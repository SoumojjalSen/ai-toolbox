import { test } from "node:test"
import assert from "node:assert/strict"
import { parseReportCalls, judgeCall, judgeOpen, groupRisers } from "../../src/services/market/report-check.js"
import type { DailyPriceRow } from "../../src/services/market/scan.js"

// rows as the 18 Nov 2026 report wrote them (shortened), plus one swing pick
const report = [
  "### 1. Swing picks (hold up to ~6–12 weeks) — news-checked",
  "| Stock | Action | Levels | Analysis & proof |", "|---|---|---|---|",
  "| 🟢 **ACME** | 🟢 Buy | ₹100 → ₹130 · SL ₹90 · by 30-Dec-2026 | stage2-tight · risk 1% |",
  "### 3. Events that move stocks today",
  "| Stock | What happened | Likely effect | Proof |", "|---|---|---|---|",
  "| TATACHEM | Gapped up 7.2% on 9.5× volume | 🟢 Short-term interest | [news](https://x) |",
  "| TITAN, KALYANKJIL | Gold at a 1-year low | 🔴 Jewellery inventory loses value | [news](https://x) |",
  "| FIRSTCRY | +12.9% on 113× volume | ⚠️ Speculative move, below the 200-day average. No setup. | [NSE](https://x) |",
  "### 4. Exit / avoid",
  "| Stock | Action | Risk if held | Analysis & proof |", "|---|---|---|---|",
  "| 🔴 PAGEIND | 🔴 Avoid | High | 20-day breakdown on 1.5× volume [chart](https://www.tradingview.com/chart/?symbol=NSE:PAGEIND) |",
  "### 2b. Long-term picks — compounders & CANSLIM (hold 6–12 months)",
  "| Stock | Screens | Numbers | Why |", "|---|---|---|---|",
  "| IGIL | Both | P/E 29 | No debt [Screener](https://www.screener.in/company/IGIL/) |",
  "### 9. Market today", "> **Expected open:** slightly down. US markets fell overnight.",
].join("\n")

const bar = (prevClose: number, open: number, high: number, low: number, close: number): DailyPriceRow =>
  ({ symbol: "X", prevClose, open, high, low, close, volume: 1, turnoverLakhs: 1, deliveryPercent: 0 })

test("parseReportCalls reads buys, event directions (two stocks in one row), avoids and long-term picks; no call for ⚠️-only effects", () => {
  assert.deepEqual(parseReportCalls(report).map((call) => `${call.section}:${call.symbol}:${call.kind}`), [
    "Swing pick:ACME:buy", "Event:TATACHEM:up", "Event:TITAN:down", "Event:KALYANKJIL:down", "Exit / avoid:PAGEIND:down", "Long-term pick:IGIL:long-term",
  ])
  assert.deepEqual(parseReportCalls(report)[0], { section: "Swing pick", symbol: "ACME", kind: "buy", entry: 100, target: 130, stopLoss: 90 })
})

test("judgeCall: direction calls are right when the close moved that way; buys by stop, target or profit so far", () => {
  const [buy, up, down] = parseReportCalls(report)
  assert.deepEqual([judgeCall(up, bar(100, 101, 104, 99, 103)).correct, judgeCall(down, bar(100, 101, 104, 99, 103)).correct], [true, false])
  assert.equal(judgeCall(buy, bar(98, 100, 132, 99, 128)).result, "target hit (₹130)")
  assert.equal(judgeCall(buy, bar(98, 100, 105, 89, 95)).correct, false)
  assert.equal(judgeCall(buy, bar(98, 102, 105, 101, 104)).correct, undefined) // opened above the 1% limit: not bought
  assert.equal(judgeCall(parseReportCalls(report)[5], bar(100, 100, 101, 99, 100)).correct, undefined) // long-term: not judged daily
})

test("judgeOpen compares 'Expected open' with the Nifty's open (flat = within ±0.2%)", () => {
  assert.deepEqual(judgeOpen(report, -0.6), { expected: "slightly down", result: "opened down (-0.6%)", correct: true })
  assert.equal(judgeOpen(report, 0.1)!.correct, false)
})

test("groupRisers: every riser gets one group — report call, scan list, scanned with nothing said, or not scanned", () => {
  const row = (symbol: string, series: string, prevClose: number, close: number) => ({ ...bar(prevClose, prevClose, close, prevClose, close), symbol, series })
  const risers = groupRisers(
    [row("TATACHEM", "EQ", 100, 112), row("IGIL", "EQ", 100, 103), row("QUIET", "EQ", 100, 101), row("TINY", "EQ", 10, 11), row("SMEX", "SM", 50, 60), row("FALL", "EQ", 100, 90)],
    parseReportCalls(report), { buy: [], watch: [], longTerm: ["IGIL"], scanned: ["TATACHEM", "IGIL", "QUIET"] },
  )
  assert.deepEqual(risers.map((riser) => `${riser.symbol}:${riser.change.toFixed(0)}:${riser.group}`), [
    "SMEX:20:not scanned (SME)", "TATACHEM:12:report: Event", "TINY:10:not scanned (illiquid)", "IGIL:3:report: Long-term pick", "QUIET:1:scanned, nothing said",
  ])
})
