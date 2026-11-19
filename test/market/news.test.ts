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

