import { test } from "node:test"
import assert from "node:assert/strict"
import { addTradingDays, parseSubscription, qibVerdict, anchorUnlocks } from "../../src/services/market/ipo.js"

const holidays = new Set(["20-Oct-2026"])

test("listing date = close + 3 trading days, skipping weekends and NSE holidays", () => {
  assert.equal(addTradingDays("15-Oct-2026", 3, holidays), "21-Oct-2026") // HD Fire: Fri, Mon, (Tue holiday), Wed
  assert.equal(addTradingDays("16-Oct-2026", 3, holidays), "22-Oct-2026") // Fusion CX
  assert.equal(addTradingDays("19-Oct-2026", 3, holidays), "23-Oct-2026") // Tonbo
  assert.equal(addTradingDays("23-Oct-2026", 3, holidays), "28-Oct-2026") // Jio
})

test("parseSubscription reads NSE's combined category rows", () => {
  const s = parseSubscription([
    { category: "Qualified Institutional Buyers(QIBs)", noOfTotalMeant: "3.95" },
    { category: "Foreign Institutional Investors(FIIs)", noOfTotalMeant: "" },
    { category: "Non Institutional Investors", noOfTotalMeant: "14.34" },
    { category: "Non Institutional Investors(Bid amount of more than Ten Lakh Rupees)", noOfTotalMeant: "11.48" },
    { category: "Retail Individual Investors(RIIs)", noOfTotalMeant: "7.11" },
    { category: "Total", noOfTotalMeant: "7.77" },
  ], "Updated as on 16-Oct-2026 17:00:00")
  assert.deepEqual(s, { qib: 3.95, nii: 14.34, retail: 7.11, total: 7.77, updated: "16-Oct-2026 17:00:00" })
})

test("qibVerdict: 20× is the line", () => {
  assert.ok(qibVerdict(25, true).startsWith("🟢"))
  assert.ok(qibVerdict(19.9, false).startsWith("🔴") && qibVerdict(19.9, false).includes("so far"))
})

test("anchorUnlocks flags holdings ~90 days after allotment", () => {
  const past = [{ symbol: "SBIFUNDS", ipoEndDate: "16-JUL-2026" }, { symbol: "OLD", ipoEndDate: "16-JAN-2026" }] as Parameters<typeof anchorUnlocks>[0]
  const flags = anchorUnlocks(past, new Set(["SBIFUNDS", "OLD"]), holidays, new Date("2026-10-14T03:00:00Z"))
  assert.equal(flags.length, 1)
  assert.ok(flags[0].startsWith("SBIFUNDS: last anchor shares unlock ~15-Oct-2026"))
})
