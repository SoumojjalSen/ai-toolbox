import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyAnnouncement, parseResultsXbrl, formatResultsLine } from "../../src/services/market/lenses.js"

test("classifyAnnouncement tags market-moving filings and ignores routine ones", () => {
  const cases: [string, string, string | undefined][] = [
    ["Action(s) initiated or orders passed", "Company received a GST demand order of Rs 12 crore", "regulatory"],
    ["Updates", "Mr X has resigned as Chief Financial Officer with effect from today", "management exit"],
    ["Outcome of Board Meeting", "Board approved the scheme of arrangement for demerger of the cables business", "corporate action"],
    ["Outcome of Board Meeting", "Approved the unaudited financial results for the quarter ended September 30, 2026", "results"],
    ["Press Release", "Company bagged an order worth Rs 450 crore from NHAI", "order"],
    ["Updates", "CRISIL has upgraded the long-term rating to AA+", "rating change"],
    ["Bagging/Receiving of orders/contracts", "Company has received an order", "order"],
    ["Spurt in Volume", "Clarification sought on spurt in volume", "price-move query"],
    ["Press Release", "Company has informed the Exchange regarding a press release dated October 13", "press release"],
    ["Resignation of Director/KMP/SMP", "Resignation of Mr X as Chief Financial Officer", "management exit"],
    ["Resignation of Director/KMP/SMP", "Cessation of Ms Y as Non-Executive Independent Director", undefined],
    ["Shareholders meeting", "Notice of AGM", undefined],
    ["Allotment of Securities", "Allotment of 1,200 shares under ESOP scheme", undefined],
    ["Board Meeting Intimation", "Board meeting to be held on 29-Oct-2026 to consider and approve the financial results for the quarter", "results date"],
    ["Rights Issue", "Board of Directors has decided to issue equity shares on a rights basis", "fund raise"],
    ["General Updates", "Letter of Offer for Right Issue.", "fund raise"],
    ["Updates", "Revised finacial result after removing typographical error as observed by NSE", "governance"],
    ["Certificate under SEBI (Depositories and Participants) Regulations, 2018", "Certificate for the quarter", undefined],
    // buying a business is its own type — the one overnight filing that paid in a weak market (news-overnight.md)
    ["General Updates", "LT Foods Limited- Intimation under Regulation 30 regarding execution of Stock Purchase Agreement for acquisition of 100% equity share capital of MK Foods Holdings, Inc.", "acquisition"],
    ["Press Release", "LT Foods Limited has informed the Exchange regarding a press release dated November 18, 2026, titled \"Please find enclosed herewith copy of Press Release on LT Foods further strengthens U.S. food portfolio with acquisition of the brand Maya Kaimal\"", "acquisition"],
    ["Acquisition", "Acquisition of 51% stake in XYZ Pvt Ltd", "acquisition"],
    ["Sale or disposal-XBRL", "Sale or disposal of the unit to ABC Ltd", "corporate action"],
    ["Updates", "Company has completed the divestment of its stake in XYZ, which it acquired in 2019", "corporate action"],
  ]
  for (const [desc, attchmntText, expected] of cases) assert.equal(classifyAnnouncement({ desc, attchmntText }), expected, attchmntText)
})

test("parseResultsXbrl reads the quarter's figures, not the year-to-date ones (SMLMAH, Sep-2026 quarter)", () => {
  const xml = [
    `<in-capmkt:RevenueFromOperations contextRef="FourD" decimals="-5" unitRef="INR">16273300000</in-capmkt:RevenueFromOperations>`,
    `<in-capmkt:RevenueFromOperations contextRef="OneD" decimals="-5" unitRef="INR">6697900000</in-capmkt:RevenueFromOperations>`,
    `<in-capmkt:ProfitLossForPeriod contextRef="OneD" decimals="-6" unitRef="INR">117000000</in-capmkt:ProfitLossForPeriod>`,
  ].join("\n")
  assert.deepEqual(parseResultsXbrl(xml), { revenue: 6697900000, profit: 117000000 })
  assert.equal(parseResultsXbrl("<html>not a results filing</html>"), undefined)
})

test("formatResultsLine compares with the year-ago and previous quarter, and shows a swing from a loss", () => {
  const line = formatResultsLine("2026-09", "Consolidated", { revenue: 6697900000, profit: 117000000 }, { revenue: 9582300000, profit: 636200000 }, { revenue: 5549000000, profit: -50000000 })
  assert.equal(line, "Results (NSE structured filing, consolidated), quarter to 2026-09: revenue ₹669.8 cr (vs year ago +21%, vs last quarter -30%), profit ₹11.7 cr (vs year ago from ₹-5.0 cr, vs last quarter -82%)")
})
