import { test } from "node:test"
import assert from "node:assert/strict"
import { pickExplainingHeadline, shortCompanyName, searchNames, buyOrSkip, type LiveQuote } from "../../src/services/market/alert.js"
import { parseReportPicks } from "../../src/services/market/scorecard.js"

const quote = (price: number): LiveQuote => ({ symbol: "X", price, changePercent: 0 })

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
  // 23 Oct misses: a data page, a list article
  assert.equal(pickExplainingHeadline(["Easy Trip Planners Ltd. Estimates – NSE:EASEMYTRIP - MarketScreener"], "Easy Trip"), undefined)
  assert.equal(pickExplainingHeadline(["Investment Stocks 2026: Metro Brands, Tata Elxsi - Groww"], "Tata Elxsi"), undefined)
  assert.equal(pickExplainingHeadline(["Fundamentally Strong Stocks 2026: Tata Elxsi, Force Motors - Groww"], "Tata Elxsi"), undefined)
  assert.equal(pickExplainingHeadline(["Indian Renewable Energy Stocks Decline as Inox Wind Falls 5.45% on October 23 - Meyka"], "Indian Renewable"), undefined)
  // still accepted: a story about the company
  assert.equal(pickExplainingHeadline(["Nomura names Piramal Finance top NBFC pick as Q2 profit jumps 67% - ET"], "Piramal Finance"), "Nomura names Piramal Finance top NBFC pick as Q2 profit jumps 67% - ET")
  assert.equal(shortCompanyName("The India Cements Limited"), "India Cements")
})

test("buyOrSkip: buy up to 1% above the report's entry; skip above it, below the stop, or on bad news", () => {
  const pick = { symbol: "X", entry: 100, target: 130, stopLoss: 90 }
  assert.equal(buyOrSkip(pick, quote(100.5), false), "✅ buy — limit order at about ₹100.5 (no higher than ₹101), then set SL ₹90")
  assert.equal(buyOrSkip(pick, quote(101.5), false), "❌ above ₹101 — skip today, don't chase")
  assert.equal(buyOrSkip(pick, quote(89), false), "❌ below the stop loss (₹90) — skip")
  assert.equal(buyOrSkip(pick, quote(100), true), "⚠️ bad news filed today — skip")
  assert.equal(buyOrSkip(pick, undefined, false), "no live price — check manually")
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

test("searchNames: two companies sharing a short name both get their longer name", () => {
  const names = searchNames([["TMPV", "Tata Motors Passenger Vehicles Limited"], ["TMCV", "Tata Motors Limited"], ["RELIANCE", "Reliance Industries Limited"]])
  assert.deepEqual(Object.fromEntries(names), { TMPV: "Tata Motors Passenger", TMCV: "Tata Motors", RELIANCE: "Reliance Industries" })
  assert.equal(pickExplainingHeadline(["Tata Motors CV Q2 results: profitability returns - ET"], names.get("TMPV")!), undefined)
})
