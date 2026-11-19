// Money flow from bulk and block deals: when a fund (or any buyer who kept the shares) bought a big block, was the
// stock worth buying at the next open? Most bulk deals are high-speed traders who buy and sell the same day — a buyer
// counts only if it didn't also sell that stock that day. Judged on period 1, confirmed on period 2, by market type,
// after costs, with the standard swing plan (2× daily range stop, 3R target, 30 sessions, skip an open > 1% above).
// Needs download.ts's deals.json.gz and run.ts's trades.json.gz (market type per session).
// Run: NODE_OPTIONS=--max-old-space-size=8192 npx tsx src/backtest/deals-run.ts
import { writeFile } from "fs/promises"
import { join } from "path"
import { computeStockSignal } from "../services/market/scan.js"
import { parseNseDate } from "../services/market/store.js"
import type { Board } from "../services/market/strategies.js"
import { simulateTrade, type TradeResult } from "./simulate.js"
import { loadHistory } from "./history.js"
import { HISTORY_DIR, readGz } from "./download.js"
import { SIGNALS_FROM, CONFIRM_FROM } from "./run.js"

const SIGNAL_WINDOW = 220
const MIN_TURNOVER_LAKHS: Record<Board, number> = { main: 50, sme: 10 }
const SWING_COST_PERCENT: Record<Board, number> = { main: 0.25, sme: 0.5 }
const CRORE = 1e7
// Mutual funds, insurers, pension funds and the foreign funds and banks that file under their own name
const FUND = /mutual fund|\bmf\b|insurance|pension|provident|asset management|\bamc\b|\bfund\b|\bfunds\b|plc|sicav|government of singapore|monetary authority|abu dhabi|norges|vanguard|blackrock|goldman sachs|morgan stanley|societe generale|bnp paribas|citigroup|nomura|copthall|ghisallo|trustee|life insurance|icici prudential|nippon life/i

interface Deal { kind: string; date: string; symbol: string; client: string; side: string; quantity: number; price: number }
interface Tally { trades: number; wins: number; totalR: number; skipped: number }
const SIGNALS = ["fund-buy ≥ ₹10 cr", "holder-buy ≥ ₹5 cr", "any liquid stock (1 in 20 sample)"] as const

async function main() {
  const history = await loadHistory()
  const { days, stocks } = history
  const dayOf = new Map(days.map((day, index) => [day, index]))
  const regimeOf = new Map<string, string>()
  for (const trade of JSON.parse(await readGz("backtest/trades.json.gz")) as { signalDay: string; regime: string }[]) regimeOf.set(trade.signalDay, trade.regime)

  // net ₹ bought per symbol and session, by buyers who didn't sell that stock that day
  const net = new Map<string, number>() // `${symbol}|${day}|${client}` → ₹ (+ buy, − sell)
  const sold = new Set<string>()
  for (const deal of JSON.parse(await readGz("deals.json.gz")) as Deal[]) {
    const day = dayOf.get(new Date(parseNseDate(deal.date) + 6 * 3_600_000).toISOString().slice(0, 10))
    if (day === undefined || /arbitrage/i.test(deal.client)) continue
    const key = `${deal.symbol}|${day}|${deal.client}`
    const isBuy = /buy/i.test(deal.side)
    net.set(key, (net.get(key) ?? 0) + (isBuy ? 1 : -1) * deal.quantity * deal.price)
    if (!isBuy) sold.add(key)
  }
  const fundBuy = new Map<string, number>() // `${symbol}|${day}` → ₹
  const holderBuy = new Map<string, number>()
  for (const [key, value] of net) {
    if (value <= 0 || sold.has(key)) continue
    const [symbol, day, client] = key.split("|")
    const stockDay = `${symbol}|${day}`
    holderBuy.set(stockDay, (holderBuy.get(stockDay) ?? 0) + value)
    if (FUND.test(client)) fundBuy.set(stockDay, (fundBuy.get(stockDay) ?? 0) + value)
  }

  const tallies = new Map<string, Tally>()
  const add = (key: string, result: TradeResult) => {
    const tally = tallies.get(key) ?? tallies.set(key, { trades: 0, wins: 0, totalR: 0, skipped: 0 }).get(key)!
    if (result.kind !== "closed") { tally.skipped++; return }
    tally.trades++
    tally.totalR += result.r
    if (result.r > 0) tally.wins++
  }
  const start = days.findIndex((day) => day >= SIGNALS_FROM)
  for (const stock of stocks.values()) {
    for (let index = 0; index + 1 < stock.bars.length; index++) {
      const day = stock.dayIndex[index]
      if (day < start) continue
      const key = `${stock.symbol}|${day}`
      const fired = [
        (fundBuy.get(key) ?? 0) >= 10 * CRORE ? SIGNALS[0] : undefined,
        (holderBuy.get(key) ?? 0) >= 5 * CRORE ? SIGNALS[1] : undefined,
        (index * 7 + stock.symbol.length) % 20 === 0 ? SIGNALS[2] : undefined,
      ].filter((signal): signal is (typeof SIGNALS)[number] => !!signal)
      if (!fired.length) continue
      const signal = computeStockSignal(stock.bars.slice(Math.max(0, index - SIGNAL_WINDOW + 1), index + 1), MIN_TURNOVER_LAKHS[stock.board])
      if (!signal) continue
      const result = simulateTrade(stock.bars, index, { strategy: "stage2-tight", risk: 2 * signal.averageDailyRange, reward: 3, holdSessions: 30 }, SWING_COST_PERCENT[stock.board])
      const period = days[day] < CONFIRM_FROM ? "1 set" : "2 confirm"
      for (const name of fired) for (const regime of [regimeOf.get(days[day]) ?? "unknown", "all"]) add(`${name}|${stock.board}|${regime}|${period}`, result)
    }
  }

  const fmt = (value: number) => (value >= 0 ? "+" : "") + value.toFixed(2)
  const cell = (key: string) => {
    const t = tallies.get(key)
    return t?.trades ? `${t.trades} · ${fmt(t.totalR / t.trades)}R · ${((t.wins / t.trades) * 100).toFixed(0)}% won · ${t.skipped} skipped` : "–"
  }
  const lines = [
    `# Bulk and block deals — bought at the next open (${SIGNALS_FROM} → ${days[days.length - 1]})`,
    "",
    "A buyer counts only if it didn't sell that stock the same day (most bulk deals are high-speed traders who do both). **fund-buy**: mutual funds, insurers, pension and foreign funds by name, net ≥ ₹10 crore in a session. **holder-buy**: any such buyer, net ≥ ₹5 crore. The sample row is a random 1 in 20 liquid stock-days with the same plan — the bar to beat. Each cell: trades · average R after costs · win rate · skipped (opened > 1% above the close, or locked at the upper limit).",
    "",
    "| Signal | Board | Market | Period 1 (set) | Period 2 (confirm) |",
    "|---|---|---|---|---|",
    ...SIGNALS.flatMap((name) => ["main", "sme"].flatMap((board) => ["strong", "neutral", "weak", "all"].map((regime) =>
      `| ${name} | ${board} | ${regime} | ${cell(`${name}|${board}|${regime}|1 set`)} | ${cell(`${name}|${board}|${regime}|2 confirm`)} |`))),
  ]
  await writeFile(join(HISTORY_DIR, "backtest", "deals-report.md"), lines.join("\n"))
  console.log(lines.join("\n"))
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
