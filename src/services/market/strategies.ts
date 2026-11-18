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

// % of capital risked per trade, by rule and market type — the one place the live scan and the backtest's
// "live setup" read. From the backtest (data/market-history/backtest/report.md, Nov 2023 → Nov 2026): in a strong
// market every main-board rule made money in both periods (last year: stage2-tight +0.41R, sector-leader +0.32R,
// new-listing-breakout +0.27R, leader-pullback +0.18R, results-day +0.13R); in neutral and weak markets they lost
// in the check period. Insider buys in a weak market looked good per trade (+0.24R, then +0.35R) but lost as one
// account (−4.0% last year, worst drop −21%: repeat signals on the same stocks can't all be taken), so they aren't
// traded either. One account, this table: +22.5% (Nov 2023 → Oct 2025), +28.5% last year, worst drop −19%.
// SME rules didn't pass and aren't traded. Intraday rules lost in every test and aren't traded.
export type MarketType = "strong" | "neutral" | "weak"
export const LIVE_RISK_PERCENT: Record<string, Record<MarketType, number>> = {
  "results-day": { strong: 1, neutral: 0, weak: 0 },
  "insider-buy": { strong: 1, neutral: 0, weak: 0 },
  "new-listing-breakout": { strong: 1, neutral: 0, weak: 0 },
  "stage2-tight": { strong: 1, neutral: 0, weak: 0 },
  "leader-pullback": { strong: 1, neutral: 0, weak: 0 },
  "sector-leader": { strong: 1, neutral: 0, weak: 0 },
}
export const liveRiskPercent = (strategy: StrategyName, board: Board, marketType: MarketType) =>
  board === "main" ? LIVE_RISK_PERCENT[strategy]?.[marketType] ?? 0 : 0

// An insider-buy disclosure the rule counts: a promoter, director or key manager buying equity in the market
export function isInsiderMarketBuy(trade: { personCategory: string; acqMode: string; type: string; secType: string }): boolean {
  return /promoter|director|key managerial/i.test(trade.personCategory) && trade.acqMode === "Market Purchase" && trade.type === "Buy" && /equity/i.test(trade.secType)
}

// The 2 Nifty 500 sectors with the best average 20-session return (sectors with at least 5 stocks scanned)
export function leadingSectors(stocks: { sector: string | undefined; changePercent20d: number }[]): Set<string> {
  const returns = new Map<string, number[]>()
  for (const { sector, changePercent20d } of stocks) if (sector) returns.set(sector, [...(returns.get(sector) ?? []), changePercent20d])
  return new Set([...returns].filter(([, values]) => values.length >= 5)
    .map(([sector, values]) => [sector, values.reduce((a, b) => a + b, 0) / values.length] as const)
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([sector]) => sector))
}

export function intradayPlan(strategy: StrategyName, day: StockDay): TradePlan {
  return { strategy, risk: INTRADAY_STOP_ATR * day.signal.averageDailyRange, reward: Infinity, holdSessions: 0 }
}
