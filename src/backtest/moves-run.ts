// The last year's sharp rises: every stock that closed 10%+ higher within 1, 2, 3 or 5 sessions — and what the
// system said about it at the close BEFORE the rise began (nothing after counts). Also the lift: how much more often
// a flagged stock jumped than an unflagged one. Needs run.ts's trades.json.gz and fundamentals.json.gz.
// Run: NODE_OPTIONS=--max-old-space-size=8192 npx tsx src/backtest/moves-run.ts
import { writeFile } from "fs/promises"
import { join } from "path"
import type { PriceAdjustment } from "../services/market/adjust.js"
import { parseNseDate } from "../services/market/store.js"
import { liveRiskPercent, type StrategyName } from "../services/market/strategies.js"
import { computeMetrics, priceFactsOf, SCREENS, LIVE_SCREEN_NAMES } from "../services/market/screens.js"
import type { Filing } from "../services/market/fundamentals.js"
import { loadHistory, parseNseTimestamp } from "./history.js"
import { HISTORY_DIR, readGz } from "./download.js"

const HORIZONS = [1, 2, 3, 5] // sessions
const RISE_PERCENT = 10
const MIN_TURNOVER_LAKHS = { main: 50, sme: 10 }
const RECENT_RULE_SESSIONS = 5 // a rule that fired in the 5 sessions before still counts as "on the watchlist"

type Flag = "live buy" | "rule fired (watchlist)" | "long-term screen" | "not flagged" | "not scanned (illiquid)"
const FLAGS: Flag[] = ["live buy", "rule fired (watchlist)", "long-term screen", "not flagged", "not scanned (illiquid)"]

interface TradeRow { symbol: string; strategy: StrategyName; board: "main" | "sme"; signalDay: string; regime: "strong" | "neutral" | "weak"; kind: string }

async function main() {
  const history = await loadHistory()
  const lastDay = history.days[history.days.length - 1]
  const from = new Date(new Date(`${lastDay}T00:00:00Z`).getTime() - 365 * 86_400_000).toISOString().slice(0, 10)
  const start = history.days.findIndex((day) => day >= from)

  // rules that fired, by symbol and session
  const swing = new Set(["results-day", "insider-buy", "new-listing-breakout", "stage2-tight", "leader-pullback", "sector-leader"])
  const fired = new Map<string, Map<number, TradeRow[]>>()
  const dayOf = new Map(history.days.map((day, index) => [day, index]))
  for (const trade of JSON.parse(await readGz("backtest/trades.json.gz")) as TradeRow[]) {
    if (!swing.has(trade.strategy) || trade.signalDay < history.days[Math.max(0, start - RECENT_RULE_SESSIONS)]) continue
    const day = dayOf.get(trade.signalDay)!
    const bySymbol = fired.get(trade.symbol) ?? new Map<number, TradeRow[]>()
    bySymbol.set(day, [...(bySymbol.get(day) ?? []), trade])
    fired.set(trade.symbol, bySymbol)
  }

  // long-term screens need point-in-time filings and the traded (unadjusted) price
  const filingsBySymbol = new Map<string, (Filing & { filedTime: number })[]>()
  for (const { symbol, filings } of JSON.parse(await readGz("fundamentals.json.gz")) as { symbol: string; filings: Filing[] }[]) {
    filingsBySymbol.set(symbol, filings.map((filing) => ({ ...filing, filedTime: parseNseTimestamp(filing.filedAt) })).filter((filing) => Number.isFinite(filing.filedTime)))
  }
  const factorsAfter = new Map<string, { exTime: number; factor: number }[]>()
  for (const action of JSON.parse(await readGz("corporate-actions.json.gz")) as PriceAdjustment[]) {
    factorsAfter.set(action.symbol, [...(factorsAfter.get(action.symbol) ?? []), { exTime: parseNseDate(action.exDate), factor: action.factor }])
  }
  const liveScreens = SCREENS.filter((screen) => LIVE_SCREEN_NAMES.includes(screen.name))

  // per horizon: stock-days by flag, and how many of them began a 10%+ rise
  const tally = HORIZONS.map(() => new Map<Flag, { days: number; rises: number }>(FLAGS.map((flag) => [flag, { days: 0, rises: 0 }])))
  const rows: string[] = []
  for (const stock of history.stocks.values()) {
    const filings = filingsBySymbol.get(stock.symbol) ?? []
    let lastRiseEnd = HORIZONS.map(() => -1)
    for (let index = 20; index < stock.bars.length; index++) {
      const day = stock.dayIndex[index]
      if (day < start) continue
      const close = stock.bars[index].close
      const turnover = stock.bars.slice(index - 20, index).reduce((total, bar) => total + bar.turnoverLakhs, 0) / 20
      // what the system said at this close
      let flag: Flag
      if (turnover < MIN_TURNOVER_LAKHS[stock.board]) flag = "not scanned (illiquid)"
      else {
        const recent = [...Array(RECENT_RULE_SESSIONS).keys()].flatMap((back) => fired.get(stock.symbol)?.get(day - back) ?? [])
        const today = fired.get(stock.symbol)?.get(day) ?? []
        const isLiveBuy = today.some((trade) => liveRiskPercent(trade.strategy, trade.board, trade.regime) > 0)
        let inScreen = false
        if (!isLiveBuy && !recent.length && stock.board === "main" && filings.length) {
          const known = filings.filter((filing) => filing.filedTime <= history.closeTimes[day])
          const factor = (factorsAfter.get(stock.symbol) ?? []).filter((action) => action.exTime > history.closeTimes[day]).reduce((product, action) => product * action.factor, 1)
          const metrics = computeMetrics(known, close / factor)
          const facts = priceFactsOf(stock.bars.slice(Math.max(0, index - 251), index + 1))
          inScreen = !!metrics && !!facts && liveScreens.some((screen) => screen.passes(metrics, facts))
        }
        flag = isLiveBuy ? "live buy" : recent.length ? "rule fired (watchlist)" : inScreen ? "long-term screen" : "not flagged"
      }
      HORIZONS.forEach((sessions, horizonIndex) => {
        const later = stock.bars[index + sessions]
        if (!later || stock.dayIndex[index + sessions] - day > sessions + 3) return // window not finished or a trading gap
        const counts = tally[horizonIndex].get(flag)!
        counts.days++
        if (later.close < close * (1 + RISE_PERCENT / 100)) return
        counts.rises++
        // one row per rise in the list: the first day of a run of overlapping windows
        if (index <= lastRiseEnd[horizonIndex]) return
        lastRiseEnd[horizonIndex] = index + sessions
        rows.push([sessions, stock.symbol, stock.board, history.days[day], ((later.close / close - 1) * 100).toFixed(1), flag].join(","))
      })
    }
  }

  const fmt = (value: number) => `${value.toFixed(1)}%`
  const tables = HORIZONS.map((sessions, horizonIndex) => {
    const counts = tally[horizonIndex]
    const total = [...counts.values()].reduce((sum, count) => ({ days: sum.days + count.days, rises: sum.rises + count.rises }), { days: 0, rises: 0 })
    const listed = rows.filter((row) => row.startsWith(`${sessions},`))
    const baseRate = total.rises / total.days
    return [
      `### Rose ${RISE_PERCENT}%+ within ${sessions} session${sessions > 1 ? "s" : ""} — ${listed.length} rises (${total.rises} stock-days, base rate ${fmt(baseRate * 100)} of all stock-days)`,
      "",
      "| What the system said at the close before | Stock-days | Rises that followed | Share of all rises | Chance of a rise | vs base rate |",
      "|---|---|---|---|---|---|",
      ...FLAGS.map((flag) => {
        const count = counts.get(flag)!
        const rate = count.days ? count.rises / count.days : 0
        return `| ${flag} | ${count.days} | ${count.rises} | ${fmt((count.rises / total.rises) * 100)} | ${fmt(rate * 100)} | ${count.days ? `${(rate / baseRate).toFixed(2)}×` : "–"} |`
      }),
      "",
    ].join("\n")
  })
  const report = [
    `# Sharp rises in the last year (${from} → ${lastDay}) — what the system knew the evening before`,
    "",
    `Every NSE stock (main board and SME) on every session: did it close ${RISE_PERCENT}%+ higher within 1, 2, 3 or 5 sessions? Each case is put in one group by what the system said at the close before the rise began (first match): **live buy** (a rule fired and is traded in that market type — strategies.ts), **rule fired (watchlist)** (a rule fired in the last ${RECENT_RULE_SESSIONS} sessions but isn't traded in that market type), **long-term screen** (compounders or CANSLIM passed, main board), **not flagged** (scanned, nothing said), **not scanned** (turnover under ₹50 lakh a day, SME ₹10 lakh).`,
    "",
    "**How to read it:** \"Chance of a rise\" is how often a stock in that group rose 10%+ next; \"vs base rate\" compares it with any stock (1.00× = no better than chance). A flag only helps if it is well above 1.00×.",
    "",
    ...tables,
    "Every rise with its group: `backtest/moves-short.csv` (sessions, symbol, board, start, % rise, group).",
  ].join("\n")
  await writeFile(join(HISTORY_DIR, "backtest", "moves-short.md"), report)
  await writeFile(join(HISTORY_DIR, "backtest", "moves-short.csv"), ["sessions,symbol,board,start,percent,group", ...rows].join("\n"))
  console.log(report)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
