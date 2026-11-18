import type { DailyPriceRow } from "./scan.js"

// End of day: was each of the morning report's calls right? The report is saved at 8:00 (routes/ai.ts); the evening
// scorecard judges every call against the day's NSE prices.
//   buy        — target hit ✅, stop hit ❌, else in profit / in loss so far (the trade runs for weeks)
//   up / down  — an event's "likely effect" 🟢 / 🔴, an exit/avoid call (down): right if the close moved that way
//   long-term  — held 6–12 months: today's move is shown, not judged
//   open       — "Expected open: up / flat / down" vs the Nifty's actual open (flat = within ±0.2%)

export type CallKind = "buy" | "up" | "down" | "long-term" | "watch"
export interface ReportCall { section: string; symbol: string; kind: CallKind; entry?: number; stopLoss?: number; target?: number }

const SYMBOLS = /\b[A-Z][A-Z0-9&-]{1,19}\b/g
const sectionOf = (heading: string) =>
  /swing picks/i.test(heading) ? "swing" : /watchlist/i.test(heading) ? "watch" : /long-term/i.test(heading) ? "long-term"
    : /events/i.test(heading) ? "events" : /exit|avoid/i.test(heading) ? "exit" : /holdings/i.test(heading) ? "holdings" : undefined

// The stock tables of the report, by section. A row's first cell names the stock (**SYMBOL** or SYMBOL).
export function parseReportCalls(markdown: string): ReportCall[] {
  const calls: ReportCall[] = []
  let section: string | undefined
  for (const line of markdown.split("\n")) {
    if (/^#{1,4} /.test(line)) { section = sectionOf(line); continue }
    if (!section || !line.startsWith("|") || /^\|\s*-/.test(line)) continue
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    if (!cells[0] || /^(Stock|IPO|Symbol)$/i.test(cells[0].replace(/\*/g, ""))) continue
    // "TITAN, KALYANKJIL" names two stocks; links are dropped first
    const symbols = [...cells[0].replace(/\[[^\]]*\]\([^)]*\)/g, "").matchAll(SYMBOLS)].map((match) => match[0])
    const row = cells.join(" | ")
    for (const symbol of symbols) {
    if (section === "swing" && /Buy/.test(cells[1] ?? "")) {
      const [entry, target, stopLoss] = [...(cells[2] ?? "").matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)].map((match) => Number(match[1].replace(/,/g, "")))
      calls.push({ section: "Swing pick", symbol, kind: "buy", entry, target, stopLoss })
    } else if (section === "exit" || (section === "holdings" && /🔴\s*Exit/.test(row))) calls.push({ section: section === "exit" ? "Exit / avoid" : "Holding: exit", symbol, kind: "down" })
    else if (section === "events") {
      const effect = cells[2] ?? ""
      if (effect.includes("🟢")) calls.push({ section: "Event", symbol, kind: "up" })
      else if (effect.includes("🔴")) calls.push({ section: "Event", symbol, kind: "down" })
    } else if (section === "long-term") calls.push({ section: "Long-term pick", symbol, kind: "long-term" })
    else if (section === "watch") calls.push({ section: "Watchlist", symbol, kind: "watch" })
    }
  }
  // a stock listed twice in one section counts once
  return calls.filter((call, index) => calls.findIndex((other) => other.section === call.section && other.symbol === call.symbol) === index)
}

export interface Verdict { call: ReportCall; bar: DailyPriceRow | undefined; result: string; correct: boolean | undefined }

const change = (bar: DailyPriceRow) => (bar.prevClose > 0 ? ((bar.close - bar.prevClose) / bar.prevClose) * 100 : 0)
const sign = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`

export function judgeCall(call: ReportCall, bar: DailyPriceRow | undefined): Verdict {
  if (!bar) return { call, bar, result: "no price today", correct: undefined }
  const move = change(bar)
  switch (call.kind) {
    case "buy": {
      if (!call.entry || !call.stopLoss || !call.target) return { call, bar, result: `${sign(move)} (levels not read)`, correct: undefined }
      if (bar.open > call.entry * 1.01) return { call, bar, result: `not bought — opened at ₹${bar.open}, above the limit; ${sign(move)}`, correct: undefined }
      if (bar.low <= call.stopLoss) return { call, bar, result: `stop loss hit (₹${call.stopLoss})`, correct: false }
      if (bar.high >= call.target) return { call, bar, result: `target hit (₹${call.target})`, correct: true }
      const fromEntry = ((bar.close - call.entry) / call.entry) * 100
      return { call, bar, result: `open trade, ${sign(fromEntry)} from entry`, correct: fromEntry >= 0 }
    }
    case "up": return { call, bar, result: sign(move), correct: move > 0 }
    case "down": return { call, bar, result: sign(move), correct: move < 0 }
    default: return { call, bar, result: `${sign(move)} (not judged daily)`, correct: undefined }
  }
}

// "Expected open: slightly down" vs the Nifty's open; flat = within ±0.2%
export function judgeOpen(markdown: string, niftyOpenChange: number | undefined): { expected: string; result: string; correct: boolean | undefined } | undefined {
  const expected = markdown.match(/Expected open:?\**\s*([^.\n]*)/i)?.[1]?.trim()
  if (!expected) return undefined
  if (niftyOpenChange === undefined) return { expected, result: "Nifty open not available", correct: undefined }
  const said = /down|lower|weak/i.test(expected) ? "down" : /up|higher|positive/i.test(expected) ? "up" : "flat"
  const actual = niftyOpenChange > 0.2 ? "up" : niftyOpenChange < -0.2 ? "down" : "flat"
  return { expected, result: `opened ${actual} (${sign(niftyOpenChange)})`, correct: said === actual }
}

// ---------- every riser of the day, by what the system said that morning ----------

export interface Riser { symbol: string; series: string; change: number; group: string }
export interface MorningFlags { buy: string[]; watch: string[]; longTerm: string[]; scanned: string[] }

// First match wins: a call in the report, then the scan's buy / watchlist / long-term lists, then scanned with
// nothing said, else not scanned (illiquid, SME, trade-for-trade)
export function whatWasSaid(symbol: string, series: string, calls: ReportCall[], flags: MorningFlags | undefined): string {
  const call = calls.find((candidate) => candidate.symbol === symbol)
  if (call) return `report: ${call.section}`
  if (!flags) return "scan lists not saved"
  if (flags.buy.includes(symbol)) return "scan: buy"
  if (flags.watch.includes(symbol)) return "scan: watchlist"
  if (flags.longTerm.includes(symbol)) return "scan: long-term screen"
  if (flags.scanned.includes(symbol)) return "scanned, nothing said"
  return series === "EQ" ? "not scanned (illiquid)" : `not scanned (${series === "BE" ? "trade-for-trade" : "SME"})`
}

export function groupRisers(rows: (DailyPriceRow & { series: string })[], calls: ReportCall[], flags: MorningFlags | undefined): Riser[] {
  return rows.filter((row) => row.prevClose > 0 && row.close > row.prevClose)
    .map((row) => ({ symbol: row.symbol, series: row.series, change: ((row.close - row.prevClose) / row.prevClose) * 100, group: whatWasSaid(row.symbol, row.series, calls, flags) }))
    .sort((a, b) => b.change - a.change)
}
