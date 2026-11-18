import type { DailyPriceRow, StockSignal } from "./scan.js"

// Every pick rule in one place, as pure functions of one stock's day — the backtest (src/backtest/run.ts) and the
// live scan call the same code. A rule fires on the signal day (after the close); the trade is bought at the next
// session's open. Levels are set from the fill: stop = fill − risk, target = fill + reward × risk.

export type Board = "main" | "sme"
export type StrategyName =
  | "stage2-tight" | "leader-pullback" | "new-listing-breakout" | "results-day" | "insider-buy" | "sector-leader"
  | "intraday-results-gap" | "intraday-accumulation" | "intraday-stage2"

export interface StockDay {
  bars: DailyPriceRow[] // history ending today, adjusted for splits/bonuses (up to ~220 sessions)
  signal: StockSignal // today's signal, RS rank set across the market
  board: Board
  sessionsSinceListing: number | undefined // undefined: listed before the history starts
  resultsFiledAfterLastClose: boolean // results filed after yesterday's close and before today's close
  resultsFiledAfterTodaysClose: boolean // known before tomorrow's open
  insiderBuyValueToday: number // ₹ of promoter/director market purchases disclosed today
  inLeadingSector: boolean // Nifty 500 stock whose sector is in the top 2 by 1-month return
}

export interface TradePlan {
  strategy: StrategyName
  risk: number // ₹ per share between fill and stop
  reward: number // target = fill + reward × risk
  holdSessions: number // sell at the close of this session if neither level is hit; 0 = sell at today's close (intraday)
}

const SWING_STOP_ATR = 2
const INTRADAY_STOP_ATR = 0.5

const previous = (day: StockDay) => day.bars[day.bars.length - 2]

function swing(strategy: StrategyName, day: StockDay, holdSessions = 30): TradePlan {
  return { strategy, risk: SWING_STOP_ATR * day.signal.averageDailyRange, reward: 3, holdSessions }
}

// Each rule: the plain-words condition, then the code. Order = priority when several fire on one stock.
export const SWING_RULES: { name: StrategyName; fires: (day: StockDay) => boolean; plan: (day: StockDay) => TradePlan }[] = [
  {
    // Results filed and the market liked them: up ≥4% on ≥2× volume, closing in the top half of the day's range
    name: "results-day",
    fires: (day) => day.resultsFiledAfterLastClose && day.signal.changePercent1d >= 4 && day.signal.volumeRatio >= 2 && day.signal.closePosition >= 0.5,
    plan: (day) => swing("results-day", day, 60),
  },
  {
    // A promoter or director bought ≥ ₹50 lakh in the market (disclosed today)
    name: "insider-buy",
    fires: (day) => day.insiderBuyValueToday >= 50_00_000,
    plan: (day) => swing("insider-buy", day, 60),
  },
  {
    // Listed under a year ago: a new closing high since listing, on more volume than usual after the listing days
    name: "new-listing-breakout",
    fires: (day) => {
      const listed = day.sessionsSinceListing
      if (listed === undefined || listed < 6 || listed > 250) return false
      const sinceListing = day.bars.slice(-listed)
      const before = sinceListing.slice(0, -1)
      const usualVolume = before.slice(2).reduce((total, bar) => total + bar.volume, 0) / Math.max(before.length - 2, 1)
      return day.signal.close > Math.max(...before.map((bar) => bar.high)) && sinceListing[sinceListing.length - 1].volume > usualVolume
    },
    plan: (day) => swing("new-listing-breakout", day),
  },
  {
    // The current core rule: Stage 2 uptrend + tight 10-day range
    name: "stage2-tight",
    fires: (day) => day.signal.isStage2Uptrend && day.signal.isTightRange,
    plan: (day) => swing("stage2-tight", day),
  },
  {
    // A leader (Stage 2, RS ≥ 80) dipped to its 20-day average and turned up: today's close above yesterday's high
    name: "leader-pullback",
    fires: (day) => {
      const yesterday = previous(day)
      return day.signal.isStage2Uptrend && day.signal.relativeStrengthRank >= 80 && !!yesterday &&
        Math.min(yesterday.low, day.signal.low) <= day.signal.average20Day * 1.01 && day.signal.close > yesterday.high
    },
    plan: (day) => swing("leader-pullback", day),
  },
  {
    // Strongest stock (Stage 2, RS ≥ 90) in one of the 2 best sectors this month (Nifty 500 sectors only)
    name: "sector-leader",
    fires: (day) => day.inLeadingSector && day.signal.isStage2Uptrend && day.signal.relativeStrengthRank >= 90,
    plan: (day) => swing("sector-leader", day),
  },
]

// Same-day trades: bought at the open, sold at the close (or at the stop, 0.5× the average daily range below the
// fill). The rule must be known before the open, so it reads the signal day (the day before the trade).
export const INTRADAY_RULES: { name: StrategyName; fires: (day: StockDay) => boolean }[] = [
  // results filed after today's close → buy tomorrow's open
  { name: "intraday-results-gap", fires: (day) => day.resultsFiledAfterTodaysClose },
  // up ≥3% on ≥3× volume, closed in the top 20% of the range — big buyers; does it carry into the next morning?
  { name: "intraday-accumulation", fires: (day) => day.signal.changePercent1d >= 3 && day.signal.volumeRatio >= 3 && day.signal.closePosition >= 0.8 },
  { name: "intraday-stage2", fires: (day) => day.signal.isStage2Uptrend && day.signal.isTightRange },
]

export function intradayPlan(strategy: StrategyName, day: StockDay): TradePlan {
  return { strategy, risk: INTRADAY_STOP_ATR * day.signal.averageDailyRange, reward: Infinity, holdSessions: 0 }
}
