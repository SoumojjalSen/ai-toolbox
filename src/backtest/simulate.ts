import type { DailyPriceRow } from "../services/market/scan.js"
import type { TradePlan } from "../services/market/strategies.js"

// One trade on daily bars, the way the live report trades it: bought at the next session's open (skipped if that
// open is more than 1% above the signal close — the report's buy limit — or the stock is locked at its upper price
// limit), then sold at the stop, the target or the close of the last holding session. A day that touches both the
// stop and the target counts as the stop (daily bars can't tell which came first — the cautious choice).

export interface ClosedTrade {
  kind: "closed"
  entryIndex: number
  exitIndex: number
  entry: number
  exit: number
  r: number // profit in units of the risk taken, after costs
  outcome: "target" | "stop" | "sell-by"
}
export interface SkippedTrade { kind: "skipped"; reason: "above buy limit" | "locked at upper limit" | "no next session" | "no risk" }
export interface OpenTrade { kind: "open"; entryIndex: number; entry: number }
export type TradeResult = ClosedTrade | SkippedTrade | OpenTrade

export const BUY_LIMIT_PERCENT = 1

export function simulateTrade(bars: DailyPriceRow[], signalIndex: number, plan: TradePlan, roundTripCostPercent: number, useBuyLimit = true): TradeResult {
  const fillIndex = signalIndex + 1
  const fill = bars[fillIndex]
  if (!fill) return { kind: "skipped", reason: "no next session" }
  if (!(plan.risk > 0)) return { kind: "skipped", reason: "no risk" }
  if (fill.open === fill.high && fill.close === fill.high && fill.open > fill.prevClose) return { kind: "skipped", reason: "locked at upper limit" }
  if (useBuyLimit && fill.open > bars[signalIndex].close * (1 + BUY_LIMIT_PERCENT / 100)) return { kind: "skipped", reason: "above buy limit" }

  const entry = fill.open
  const stop = entry - plan.risk
  const target = entry + plan.reward * plan.risk
  const close = (exitIndex: number, exit: number, outcome: ClosedTrade["outcome"]): ClosedTrade => ({
    kind: "closed", entryIndex: fillIndex, exitIndex, entry, exit, outcome,
    r: (exit - entry) / plan.risk - (roundTripCostPercent / 100) * entry / plan.risk,
  })
  for (let index = fillIndex; index < bars.length; index++) {
    const bar = bars[index]
    if (index > fillIndex && bar.open <= stop) return close(index, bar.open, "stop") // gapped through the stop
    if (bar.low <= stop) return close(index, stop, "stop")
    if (index > fillIndex && bar.open >= target) return close(index, bar.open, "target")
    if (bar.high >= target) return close(index, target, "target")
    if (index - fillIndex >= plan.holdSessions) return close(index, bar.close, "sell-by")
  }
  return { kind: "open", entryIndex: fillIndex, entry }
}
