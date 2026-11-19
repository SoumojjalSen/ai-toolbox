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
