import { test } from "node:test"
import assert from "node:assert/strict"
import { gapBucket } from "../../src/services/market/strategies.js"

test("gapBucket: how much the stock opened above the last close", () => {
  assert.equal(gapBucket(-0.5), "below 0%")
  assert.equal(gapBucket(0), "0–2%")
  assert.equal(gapBucket(3.2), "2–5%") // LT Foods, 19 Nov 2026: pre-open ₹432.65 vs close ₹419.25
  assert.equal(gapBucket(7), "5–10%")
  assert.equal(gapBucket(12), "10%+")
})

test("overnightNews: filings since the last close on scanned stocks, with the pre-open gap, biggest gap first", async () => {
  const { overnightNews } = await import("../../src/services/market/alert.js")
  const events = [
    { symbol: "LTFOODS", kind: "corporate action" as const, time: "18-Nov-2026 17:25:43", headline: "acquisition of MK Foods", link: "a.pdf" },
    { symbol: "LTFOODS", kind: "press release" as const, time: "18-Nov-2026 17:40:54", headline: "press release", link: "b.pdf" },
    { symbol: "TONBO", kind: "order" as const, time: "18-Nov-2026 19:23:32", headline: "MoD order", link: "c.pdf" },
    { symbol: "PNB", kind: "regulatory" as const, time: "18-Nov-2026 11:00:00", headline: "penalty", link: "d.pdf" }, // before the close
    { symbol: "TINY", kind: "order" as const, time: "18-Nov-2026 20:00:00", headline: "order", link: "e.pdf" }, // not scanned
    { symbol: "ACME", kind: "results date" as const, time: "18-Nov-2026 20:00:00", headline: "board meeting", link: "f.pdf" },
  ]
  const quotes = new Map([["LTFOODS", 3.2], ["TONBO", -0.4], ["PNB", 1], ["TINY", 9], ["ACME", 1]].map(([symbol, changePercent]) => [symbol as string, { symbol: symbol as string, price: 100, changePercent: changePercent as number }]))
  const lastClose = new Date("18 Nov 2026 15:30:00 GMT+0530").getTime()
  assert.deepEqual(overnightNews(events, quotes, new Set(["LTFOODS", "TONBO", "PNB", "ACME"]), lastClose).map((row) => [row.symbol, row.kinds.join("+"), row.gapPercent]),
    [["LTFOODS", "corporate action+press release", 3.2], ["TONBO", "order", -0.4]])
})

test("previousSessionClose: 15:30 IST of the last trading day before today", async () => {
  const { previousSessionClose } = await import("../../src/services/market/alert.js")
  const thursday = new Date("19 Nov 2026 09:09:00 GMT+0530")
  assert.equal(previousSessionClose(thursday, new Set()), new Date("18 Nov 2026 15:30:00 GMT+0530").getTime())
  const monday = new Date("23 Nov 2026 09:09:00 GMT+0530")
  assert.equal(previousSessionClose(monday, new Set()), new Date("20 Nov 2026 15:30:00 GMT+0530").getTime())
  assert.equal(previousSessionClose(monday, new Set(["20-Nov-2026"])), new Date("19 Nov 2026 15:30:00 GMT+0530").getTime())
})


test("morningReportBlock: the 8:30 report goes under the 9:09 check; a missing report is said, not hidden", async () => {
  const { morningReportBlock } = await import("../../src/services/market/alert.js")
  assert.equal(morningReportBlock("# Pre-market briefing — Thursday\n\n> 🟢 **Do now**"), "---\n\n# Morning report (written 8:30)\n\n## Pre-market briefing — Thursday\n\n> 🟢 **Do now**")
  assert.equal(morningReportBlock(undefined), "> ⚠️ This morning's report wasn't written — the 8:30 run failed or is still running. The check above is complete on its own.")
})


test("keptBuyValues: ₹ bought in bulk/block deals by buyers who didn't sell that stock the same day", async () => {
  const { keptBuyValues } = await import("../../src/services/market/strategies.js")
  const deals = [
    { symbol: "ACME", client: "GRAVITON RESEARCH CAPITAL LLP", side: "BUY", quantity: 100000, price: 500 }, // flips the same day
    { symbol: "ACME", client: "GRAVITON RESEARCH CAPITAL LLP", side: "SELL", quantity: 100000, price: 501 },
    { symbol: "ACME", client: "SBI MUTUAL FUND", side: "BUY", quantity: 200000, price: 500 }, // ₹10 cr, kept
    { symbol: "ACME", client: "BNP PARIBAS ARBITRAGE", side: "BUY", quantity: 50000, price: 500 }, // arbitrage desk
    { symbol: "BETA", client: "SELLER LLP", side: "SELL", quantity: 1000, price: 10 },
  ]
  assert.deepEqual([...keptBuyValues(deals)], [["ACME", 10_00_00_000]])
})

test("parseDealsCsv reads NSE's bulk/block deal CSV, numbers with Indian commas", async () => {
  const { parseDealsCsv } = await import("../../src/services/market/rule-inputs.js")
  const csv = `"Date ","Symbol ","Security Name ","Client Name ","Buy / Sell ","Quantity Traded ","Trade Price / Wght. Avg. Price ","Remarks "\n"01-NOV-2023","ADVANIHOTR","Advani Hotels & Resorts (","DELTA CORP LIMITED","SELL","2,50,000","110.52","-"\n`
  assert.deepEqual(parseDealsCsv(csv, "bulk"), [{ kind: "bulk", date: "01-NOV-2023", symbol: "ADVANIHOTR", client: "DELTA CORP LIMITED", side: "SELL", quantity: 250000, price: 110.52 }])
})

test("overnightNewsCheck: each 9:09 news stock bought at the open — the move it had already made and what was left", async () => {
  const { overnightNewsCheck } = await import("../../src/services/market/report-check.js")
  const bar = (symbol: string, prevClose: number, open: number, high: number, close: number) => ({ symbol, prevClose, open, high, low: open, close, volume: 1, turnoverLakhs: 1, deliveryPercent: 0 })
  const bars = new Map([["SHALPAINTS", bar("SHALPAINTS", 97.42, 107, 116.8, 103.97)], ["RATNAVEER", bar("RATNAVEER", 370.25, 390, 406.8, 403.3)]])
  const block = overnightNewsCheck([{ symbol: "SHALPAINTS", kinds: ["press release"] }, { symbol: "RATNAVEER", kinds: ["press release"] }, { symbol: "GONE", kinds: ["order"] }], bars)
  assert.equal(block, [
    "## Overnight news — bought at the open, how did it go?",
    "",
    "**2 stocks bought at the 9:15 open: +0.3% on average by the close · 1 rose, 1 fell.** The move before 9:15 (the gap) can't be bought.",
    "",
    "| Stock | Filing | Gap at the open | High of the day | Open → close |",
    "|---|---|---|---|---|",
    "| RATNAVEER | press release | +5.3% | +9.9% | +3.4% |",
    "| SHALPAINTS | press release | +9.8% | +19.9% | -2.8% |",
  ].join("\n"))
  assert.equal(overnightNewsCheck([], bars), undefined)
})

test("overnightNewsBlocks: bad, good and other news in separate sections; bad news in Do now when held", async () => {
  const { overnightNewsBlocks } = await import("../../src/services/market/alert.js")
  const row = (symbol: string, kinds: any[], gapPercent: number) => ({ symbol, kinds, headline: `${symbol} filing`, link: "", gapPercent })
  const { blocks, doNow } = overnightNewsBlocks([row("SHALPAINTS", ["press release"], 9.8), row("ASHOKA", ["order"], 7.3), row("AARTISURF", ["regulatory"], 4.9), row("ACME", ["acquisition"], 1)], new Set(["ACME"]), new Set(["AARTISURF"]))
  assert.deepEqual(doNow, ["**AARTISURF** (you hold it): bad news filed since the last close (regulatory) — review before 9:15"])
  assert.equal(blocks.length, 4)
  assert.match(blocks[0], /already moved before 9:15/)
  assert.match(blocks[1], /^## 🔴 Bad news — avoid \(1\)/)
  assert.match(blocks[1], /\| 🔴 \*\*AARTISURF\*\* .* \| \+4\.9% \| regulatory: AARTISURF filing \| you hold it — review \|/)
  assert.match(blocks[2], /^## 🟢 Good news — orders, acquisitions, new capacity \(2\)/)
  assert.match(blocks[2], /ASHOKA[\s\S]*ACME\*\* .*\(today's pick\)/)
  assert.match(blocks[3], /^## Other filings — read before acting \(1\)/)
  assert.match(blocks[3], /SHALPAINTS/)
})
