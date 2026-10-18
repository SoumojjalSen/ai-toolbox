import type { BhavcopyRow } from "./scan.js"
import { readJson, writeJson, listJson, parseNseDate } from "./store.js"

// Every morning's top core setups are saved; later scans score them against the bhavcopy they already hold —
// so the report carries its own live track record, per lens, with no extra job or AI.
const MAX_HOLD_SESSIONS = 30
const OPEN_TRADE_DAYS = 45 // ~30 sessions: a symbol picked within this window is still the same open trade
const TRACK_RECORD_SESSIONS = 120

export interface RecordedPick {
  symbol: string
  entry: number
  stopLoss: number
  target: number
  rsRank: number
  lenses: string[] // extra lenses that agreed, e.g. "order filing"
  regime: string
}

export interface PickOutcome {
  status: "open" | "target" | "stop" | "expired" | "not entered"
  r: number // result in multiples of the risk; 0 while open
}

// Same rules as the backtest: enter at the next session's open, keep the planned risk distance, stop first when
// both levels fall inside one session, sell at the close of the last allowed session.
export function scorePick(pick: RecordedPick, laterBars: BhavcopyRow[]): PickOutcome {
  if (!laterBars.length) return { status: "open", r: 0 }
  const risk = pick.entry - pick.stopLoss
  const rewardMultiple = (pick.target - pick.entry) / risk
  const entry = laterBars[0].open
  // gapped more than half the risk above the planned entry: the report says don't chase
  if (entry > pick.entry + 0.5 * risk) return { status: "not entered", r: 0 }
  const stop = entry - risk
  const target = entry + rewardMultiple * risk
  for (const bar of laterBars.slice(0, MAX_HOLD_SESSIONS)) {
    if (bar.low <= stop) return { status: "stop", r: -1 }
    if (bar.high >= target) return { status: "target", r: rewardMultiple }
  }
  if (laterBars.length < MAX_HOLD_SESSIONS) return { status: "open", r: 0 }
  return { status: "expired", r: (laterBars[MAX_HOLD_SESSIONS - 1].close - entry) / risk }
}

// A setup that stays top-ranked for days is one trade, not one per day — only new symbols are recorded
export async function recordPicks(sessionDate: string, picks: RecordedPick[]): Promise<void> {
  const stillOpen = new Set<string>()
  for (const file of await listJson("picks")) {
    const date = file.replace(/\.json$/, "")
    if (date === sessionDate || Date.now() - parseNseDate(date) > OPEN_TRADE_DAYS * 86_400_000) continue
    for (const pick of (await readJson<RecordedPick[]>(`picks/${file}`)) ?? []) stillOpen.add(pick.symbol)
  }
  await writeJson(`picks/${sessionDate}.json`, picks.filter((pick) => !stillOpen.has(pick.symbol)))
}

interface Tally { closed: number; wins: number; totalR: number }

function describe(label: string, tally: Tally): string {
  if (!tally.closed) return `${label}: no closed trades yet`
  return `${label}: ${tally.closed} closed · ${Math.round((tally.wins / tally.closed) * 100)}% hit target · avg ${(tally.totalR / tally.closed).toFixed(2)}R · total ${tally.totalR.toFixed(1)}R`
}

// sessionDates/sessions: oldest → newest, as the scan holds them
export async function buildTrackRecord(sessionDates: string[], sessions: BhavcopyRow[][]): Promise<string> {
  // oldest first, so a symbol repeated on later days (recorded before the dedupe) counts once
  const files = (await listJson("picks")).sort((a, b) => parseNseDate(a.replace(/\.json$/, "")) - parseNseDate(b.replace(/\.json$/, "")))
  const counted = new Map<string, number>() // symbol → session index it was first counted at
  const sessionIndex = new Map(sessionDates.map((date, index) => [date, index]))
  const overall: Tally = { closed: 0, wins: 0, totalR: 0 }
  const byLens = new Map<string, Tally>()
  const byRegime = new Map<string, Tally>()
  let open = 0
  let skipped = 0
  for (const file of files) {
    const index = sessionIndex.get(file.replace(/\.json$/, ""))
    // today's picks (latest session) have nothing to score yet
    if (index === undefined || index === sessions.length - 1 || index < sessions.length - TRACK_RECORD_SESSIONS) continue
    const picks = (await readJson<RecordedPick[]>(`picks/${file}`)) ?? []
    for (const pick of picks) {
      const firstIndex = counted.get(pick.symbol)
      if (firstIndex !== undefined && index - firstIndex < MAX_HOLD_SESSIONS) continue
      counted.set(pick.symbol, index)
      const laterBars = sessions.slice(index + 1).map((session) => session.find((row) => row.symbol === pick.symbol)).filter((row): row is BhavcopyRow => !!row)
      const outcome = scorePick(pick, laterBars)
      if (outcome.status === "open") { open++; continue }
      if (outcome.status === "not entered") { skipped++; continue }
      const tallyFor = (groups: Map<string, Tally>, key: string) => groups.get(key) ?? groups.set(key, { closed: 0, wins: 0, totalR: 0 }).get(key)!
      const lensNames = pick.lenses.length ? pick.lenses : ["no extra lens"]
      const tallies = [overall, ...lensNames.map((lens) => tallyFor(byLens, lens)), tallyFor(byRegime, pick.regime)]
      for (const tally of tallies) {
        tally.closed++
        tally.totalR += outcome.r
        if (outcome.status === "target") tally.wins++
      }
    }
  }
  if (!overall.closed && !open && !skipped) return ""
  return [
    `### Track record of this system's top core setups (live, last ~${TRACK_RECORD_SESSIONS} sessions; R = multiples of the risk taken)`,
    describe("All", overall) + ` · ${open} still open · ${skipped} skipped (gapped above entry)`,
    ...[...byLens].map(([lens, tally]) => describe(`With ${lens}`, tally)),
    ...[...byRegime].map(([regime, tally]) => describe(`Picked in a ${regime} market`, tally)),
  ].join("\n")
}

// The report's own swing picks (what the reader actually buys), parsed from its "Swing picks" table:
// | 🟢 SYMBOL | 🟢 Buy | ₹entry → ₹target · SL ₹stop · by date | … |
export interface ReportPick { symbol: string; entry: number; target: number; stopLoss: number }

export function parseReportPicks(markdown: string): ReportPick[] {
  const section = markdown.split(/^#+ .*Swing picks.*$/m)[1]?.split(/^#+ /m)[0] ?? ""
  return section.split("\n").filter((line) => line.startsWith("|") && /Buy/.test(line)).flatMap((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    const symbol = cells[0]?.match(/[A-Z][A-Z0-9&-]+/)?.[0]
    const [entry, target, stopLoss] = [...(cells[2] ?? "").matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)].map((match) => Number(match[1].replace(/,/g, "")))
    return symbol && stopLoss < entry && target > entry ? [{ symbol, entry, target, stopLoss }] : []
  })
}
