import { test } from "node:test"
import assert from "node:assert/strict"
import { priceFactor, adjustForCorporateActions } from "../../src/services/market/adjust.js"
import type { DailyPriceRow } from "../../src/services/market/scan.js"

test("priceFactor reads NSE bonus and split subjects; preference-share bonuses and other actions don't move the price", () => {
  assert.equal(priceFactor("Bonus 1:1"), 0.5)
  assert.equal(priceFactor("Bonus 2:5"), 5 / 7) // 2 new shares for every 5 held
  assert.equal(priceFactor("Face Value Split (Sub-Division) - From Rs 10/- Per Share To Re 1/- Per Share"), 0.1)
  assert.equal(priceFactor("Face Value Split (Sub-Division) - From Rs 5/- Per Share To Rs 2/- Per Share"), 0.4)
  assert.equal(priceFactor("Consolidation Of Shares From Rs 1/- Per Share To Rs 10/- Per Share"), 10)
  assert.equal(priceFactor("Scheme Of Arrangement - Bonus Ncrps 3:1"), undefined)
  assert.equal(priceFactor("Dividend - Rs 5 Per Share"), undefined)
})

// CONCORDBIO's real NSE rows around its 1:1 bonus (ex-date 4 Nov 2026): the raw files show a −47% "crash"
const row = (prevClose: number, open: number, high: number, low: number, close: number, volume: number): DailyPriceRow =>
  ({ symbol: "CONCORDBIO", prevClose, open, high, low, close, volume, turnoverLakhs: 1000, deliveryPercent: 50 })

test("adjustForCorporateActions removes the bonus crash: earlier prices scaled, volume scaled up, ex-date prev close fixed", () => {
  const sessions = [
    [row(1245.6, 1207.7, 1210, 1156, 1163.5, 1000)],
    [row(1163.5, 1173, 1248, 1167, 1227.9, 2000)],
    [row(1227.9, 608, 662, 594.6, 655.5, 9000)],
  ]
  const adjusted = adjustForCorporateActions(sessions, ["02-Nov-2026", "03-Nov-2026", "04-Nov-2026"], [{ symbol: "CONCORDBIO", exDate: "04-Nov-2026", factor: 0.5 }])
  assert.deepEqual(adjusted[1][0], { ...row(581.75, 586.5, 624, 583.5, 613.95, 4000) })
  assert.equal(adjusted[2][0].prevClose, 613.95) // −47% becomes +6.8%
  assert.deepEqual(adjusted[2][0], { ...sessions[2][0], prevClose: 613.95 })
  assert.equal(sessions[1][0].close, 1227.9) // input untouched
})

test("adjustForCorporateActions leaves other stocks and actions outside the window alone", () => {
  const other = { ...row(100, 100, 101, 99, 100, 10), symbol: "OTHER" }
  const sessions = [[other], [other]]
  const adjusted = adjustForCorporateActions(sessions, ["02-Nov-2026", "03-Nov-2026"], [
    { symbol: "CONCORDBIO", exDate: "03-Nov-2026", factor: 0.5 },
    { symbol: "OTHER", exDate: "01-Jan-2020", factor: 0.5 },
  ])
  assert.deepEqual(adjusted, sessions)
})
