import { fetchNseJson } from "./nse.js"
import { parseNseDate, nseDate } from "./store.js"
import type { DailyPriceRow } from "./scan.js"

// NSE's daily price files are NOT adjusted for splits and bonuses: on CONCORDBIO's 1:1 bonus (ex-date 4 Nov 2026)
// the file shows prev close ₹1,227.90 and close ₹655.50 — a fake −47% day. Unadjusted, every such stock looks broken
// for ~10 months (below its 200-day average, wrong RS, a "top loser"). Prices before the ex-date are multiplied by
// the action's factor (and volume divided by it), the way chart sites adjust.

export interface PriceAdjustment {
  symbol: string
  exDate: string // "04-Nov-2026"
  factor: number // new price ÷ old price, e.g. 0.5 for a 1:1 bonus
}

// "Bonus 2:5" = 2 new shares for every 5 held → price × 5/7. "From Rs 10/- … To Re 1/-" → × 0.1 (a consolidation
// the other way round → × 10). "Bonus Ncrps" (preference shares) leaves the equity price alone.
export function priceFactor(subject: string): number | undefined {
  const bonus = /^Bonus (\d+):(\d+)\s*$/i.exec(subject.trim())
  if (bonus) return Number(bonus[2]) / (Number(bonus[1]) + Number(bonus[2]))
  const faceValue = /From R[se]\.? ?(\d+(?:\.\d+)?)\/-.*To R[se]\.? ?(\d+(?:\.\d+)?)\/-/i.exec(subject)
  if (faceValue && /split|sub-division|consolidation/i.test(subject)) return Number(faceValue[2]) / Number(faceValue[1])
  return undefined
}

const roundPrice = (price: number) => Math.round(price * 100) / 100

// sessions oldest → newest with their DATE1 strings; returns new arrays, the input is not changed
export function adjustForCorporateActions(sessions: DailyPriceRow[][], sessionDates: string[], adjustments: PriceAdjustment[]): DailyPriceRow[][] {
  const sessionTimes = sessionDates.map(parseNseDate)
  const factorsBySymbol = new Map<string, { exTime: number; factor: number }[]>()
  for (const { symbol, exDate, factor } of adjustments) {
    const exTime = parseNseDate(exDate)
    if (exTime <= sessionTimes[0] || exTime > sessionTimes[sessionTimes.length - 1]) continue // no rows on both sides
    factorsBySymbol.set(symbol, [...(factorsBySymbol.get(symbol) ?? []), { exTime, factor }])
  }
  if (!factorsBySymbol.size) return sessions
  return sessions.map((session, index) => session.map((row) => {
    const actions = factorsBySymbol.get(row.symbol)
    if (!actions) return row
    // this row's prices are scaled by every action after its session; prevClose also by an action on its own session
    const factorAfter = actions.filter((action) => action.exTime > sessionTimes[index]).reduce((product, action) => product * action.factor, 1)
    const factorOnDay = actions.filter((action) => action.exTime === sessionTimes[index]).reduce((product, action) => product * action.factor, 1)
    if (factorAfter === 1 && factorOnDay === 1) return row
    return {
      ...row,
      prevClose: roundPrice(row.prevClose * factorAfter * factorOnDay),
      open: roundPrice(row.open * factorAfter),
      high: roundPrice(row.high * factorAfter),
      low: roundPrice(row.low * factorAfter),
      close: roundPrice(row.close * factorAfter),
      volume: Math.round(row.volume / factorAfter),
    }
  }))
}

interface NseCorporateAction { symbol: string; series: string; subject: string; exDate: string }

// Splits and bonuses with an ex-date in the window. undefined = NSE didn't answer (the caller reports it).
export async function fetchPriceAdjustments(fromDate: Date, toDate = new Date()): Promise<PriceAdjustment[] | undefined> {
  const actions = await fetchNseJson<NseCorporateAction[]>(`corporates-corporateActions?index=equities&from_date=${nseNumericDate(fromDate)}&to_date=${nseNumericDate(toDate)}`)
  return actions && toAdjustments(actions)
}

export function toAdjustments(actions: NseCorporateAction[]): PriceAdjustment[] {
  return actions.flatMap(({ symbol, subject, exDate }) => {
    const factor = priceFactor(subject)
    return factor && factor !== 1 && exDate && exDate !== "-" ? [{ symbol, exDate, factor }] : []
  })
}

// the corporate-actions API takes "01-11-2025"
function nseNumericDate(date: Date): string {
  const [day, month, year] = nseDate(date).split("-")
  const monthNumber = String(new Date(`${month} 1, 2000`).getMonth() + 1).padStart(2, "0")
  return `${day}-${monthNumber}-${year}`
}
