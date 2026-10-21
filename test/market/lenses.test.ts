import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyAnnouncement } from "../../src/services/market/lenses.js"

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
  ]
  for (const [desc, attchmntText, expected] of cases) assert.equal(classifyAnnouncement({ desc, attchmntText }), expected, attchmntText)
})
