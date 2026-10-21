import { test } from "node:test"
import assert from "node:assert/strict"
import { selectMovers, labelMove, pickExplainingHeadline, shortCompanyName, buyOrSkip, expectedVolumeShare, type LiveQuote } from "../../src/services/market/alert.js"
import { labelWasRight } from "../../src/services/market/review.js"
import { parseReportPicks } from "../../src/services/market/scorecard.js"
import type { StockSignal } from "../../src/services/market/scan.js"
import type { CompanyEvent } from "../../src/services/market/lenses.js"

const signal = (symbol: string, averageVolume20Day: number) => ({ symbol, averageVolume20Day }) as StockSignal
const quote = (symbol: string, changePercent: number, gapPercent: number, volume: number, valueCr = 50): LiveQuote =>
  ({ symbol, price: 100, changePercent, gapPercent, volume, valueCr })
const event = (kind: CompanyEvent["kind"]): CompanyEvent => ({ symbol: "X", kind, time: "", headline: "", link: "" })

test("expectedVolumeShare follows the intraday volume curve", () => {
  assert.equal(expectedVolumeShare("10:00"), 0.15)
  assert.equal(expectedVolumeShare("14:00"), 0.69)
  assert.ok(Math.abs(expectedVolumeShare("13:30") - 0.63) < 0.01)
})

test("selectMovers compares volume with what's normal by this time; keeps thin stocks only with ₹10 cr traded", () => {
  const signals = new Map([["HOT", signal("HOT", 1_000_000)], ["QUIET", signal("QUIET", 1_000_000)], ["FLAT", signal("FLAT", 1_000_000)]])
  const movers = selectMovers([
    quote("HOT", 6, 0.5, 400_000), // 400k by 10:00 vs 150k normal → 2.7×
    quote("QUIET", 6, 0.5, 200_000), // 1.3× — not unusual
    quote("FLAT", 1, 0, 900_000), // volume but no move
    quote("THINACTIVE", 9, 1, 0, 25), // not in the liquid scan, ₹25 cr today
    quote("THINDEAD", 9, 1, 0, 2),
  ], signals, expectedVolumeShare("10:00"))
  assert.deepEqual(movers.map((mover) => mover.quote.symbol).sort(), ["HOT", "THINACTIVE"])
  const withEtfAndBe = selectMovers([quote("HOT", 6, 0.5, 400_000), { ...quote("TTOT", 9, 1, 0, 25), series: "BE" }, quote("ITBEES", 4, 0, 0, 160)], signals, expectedVolumeShare("10:00"), new Set(["ITBEES"]))
  assert.deepEqual(withEtfAndBe.map((mover) => mover.quote.symbol), ["HOT"])
})

test("labelMove: ex-date, bad news, news found, nothing found — no fade predictions", () => {
  assert.equal(labelMove(quote("X", -10, -7, 1), [], "Special Dividend - Rs 21", false), "not a real move")
  assert.equal(labelMove(quote("X", -6, -1, 1), [event("regulatory")], undefined, false), "bad news, may continue")
  assert.equal(labelMove(quote("X", -6, -1, 1), [event("results")], undefined, false), "bad news, may continue")
  assert.equal(labelMove(quote("X", 8, 1, 1), [], undefined, false), "no news found")
  assert.equal(labelMove(quote("X", 10, 9, 1), [event("results")], undefined, false), "news-backed")
  assert.equal(labelMove(quote("X", 8, 2, 1), [], undefined, true), "news-backed") // a headline about the company
  assert.equal(labelMove(quote("X", -6, -1, 1), [event("price-move query")], undefined, false), "no news found")
})

test("pickExplainingHeadline skips headlines that only restate the move", () => {
  assert.equal(pickExplainingHeadline(["QUICK HEAL Share Price Today Up 13% - Equitymaster", "Quick Heal wins ₹200 cr defence cybersecurity contract - ET"], shortCompanyName("Quick Heal Technologies Limited")), "Quick Heal wins ₹200 cr defence cybersecurity contract - ET")
  assert.equal(pickExplainingHeadline(["Viviana Power Tech Share Price and Technical View - Kalkine"], "Viviana Power Tech"), undefined)
  assert.equal(pickExplainingHeadline(["Amal Clooney Radiates in a Mint Green Top - InStyle"], "Amal"), undefined)
  assert.equal(pickExplainingHeadline(["SBI Banking & Financial Services Fund(G)-Direct Plan - Univest"], shortCompanyName("SBI Funds Management Limited")), undefined)
  // 19–21 Oct misses: a beach-soccer result, stock lists, a story about another company
  assert.equal(pickExplainingHeadline(["Amal Mogador v Rostocker Robben results, H2H stats | Beach soccer - Flashscore UK"], "Amal"), undefined)
  assert.equal(pickExplainingHeadline(["Buzzing Stocks: Infosys jumps 2% on Truist collaboration; Sobha, SML Mahindra, Just Dial fall 3-8% after... - Moneycontrol.com"], "SML Mahindra"), undefined)
  assert.equal(pickExplainingHeadline(["Buy, Sell Or Hold: TCS Asian Paints, Tata Motors PV, Coforge, Welspun Corp | Ask Profit - NDTV Profit"], "Tata Motors"), undefined)
  assert.equal(pickExplainingHeadline(["Price Action: Transrail Lighting jumps 5% on stake acquisition; L&T Technology Services surges - ET"], "L&T Technology"), undefined)
  assert.equal(pickExplainingHeadline(["99% work done on trade deal, tariffs and visa curbs not targeted at India: US Secretary - ET"], shortCompanyName("The India Cements Limited")), undefined)
  // still accepted: a story about the company
  assert.equal(pickExplainingHeadline(["Nomura names Piramal Finance top NBFC pick as Q2 profit jumps 67% - ET"], "Piramal Finance"), "Nomura names Piramal Finance top NBFC pick as Q2 profit jumps 67% - ET")
  assert.equal(shortCompanyName("The India Cements Limited"), "India Cements")
})

test("buyOrSkip: buy zone is entry to entry + half the risk; skip above it, below the stop, or on bad news", () => {
  const pick = { symbol: "X", entry: 100, target: 130, stopLoss: 90 }
  assert.match(buyOrSkip(pick, quote("X", 1, 0, 1), false), /^✅ buy —/)
  assert.match(buyOrSkip(pick, { ...quote("X", 6, 0, 1), price: 106 }, false), /^❌ above ₹105/)
  assert.match(buyOrSkip(pick, { ...quote("X", -11, 0, 1), price: 89 }, false), /^❌ below the stop/)
  assert.match(buyOrSkip(pick, quote("X", 1, 0, 1), true), /bad news/)
})

test("parseReportPicks reads the Swing picks table only", () => {
  const markdown = [
    "## 1. Swing picks (hold up to ~6 weeks), news-checked", "| Stock | Action | Levels | Analysis |", "|---|---|---|---|",
    "| 🟢 LAURUSLABS | 🟢 Buy | ₹2,018.50 → ₹2,317.70 · SL ₹1,918.75 · by 27 Nov | RS 99 |",
    "| 🟢 FCL | 🟢 Buy (backup) | ₹57.90 → ₹79.45 · SL ₹50.70 · by 27 Nov | RS 97 |",
    "## 2. Watchlist", "| Stock | Watch for | Level | Why |", "| REDINGTON | Hold above entry | ₹391.95 | Buy later |",
  ].join("\n")
  assert.deepEqual(parseReportPicks(markdown), [
    { symbol: "LAURUSLABS", entry: 2018.5, target: 2317.7, stopLoss: 1918.75 },
    { symbol: "FCL", entry: 57.9, target: 79.45, stopLoss: 50.7 },
  ])
})

test("labelWasRight: a fade is right when the move shrinks or reverses; news-backed when it holds", () => {
  assert.equal(labelWasRight("likely to fade", 8, 2), true)
  assert.equal(labelWasRight("likely to fade", 8, 9), false)
  assert.equal(labelWasRight("news-backed", 6, 7), true)
  assert.equal(labelWasRight("bad news, may continue", -6, 1), false)
  assert.equal(labelWasRight("falling, no news found", -6, -8), undefined)
})
