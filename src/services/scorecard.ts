import { mkdir, readdir, readFile, writeFile } from "fs/promises"
import { join } from "path"
import type { BhavcopyRow } from "./marketScan.js"

// Every morning's top core setups are saved; later scans score them against the bhavcopy they already hold —
// so the report carries its own live track record, per lens, with no extra job or AI.
// Saved only where the data folder exists (the VM's /data volume); local dev runs skip it silently.
const PICKS_DIR = join(process.env.MARKET_DATA_DIR ?? "/data/market", "picks")
const MAX_HOLD_SESSIONS = 30
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

export async function recordPicks(sessionDate: string, picks: RecordedPick[]): Promise<void> {
  try {
    await mkdir(PICKS_DIR, { recursive: true })
    await writeFile(join(PICKS_DIR, `${sessionDate}.json`), JSON.stringify(picks, null, 1))
  } catch {
    // no data volume (local dev) — nothing to record
  }
}

interface Tally { closed: number; wins: number; totalR: number }

function describe(label: string, tally: Tally): string {
  if (!tally.closed) return `${label}: no closed trades yet`
  return `${label}: ${tally.closed} closed · ${Math.round((tally.wins / tally.closed) * 100)}% hit target · avg ${(tally.totalR / tally.closed).toFixed(2)}R · total ${tally.totalR.toFixed(1)}R`
}

// sessionDates/sessions: oldest → newest, as the scan holds them
export async function buildTrackRecord(sessionDates: string[], sessions: BhavcopyRow[][]): Promise<string> {
  const files = await readdir(PICKS_DIR).catch(() => [] as string[])
  const sessionIndex = new Map(sessionDates.map((date, index) => [date, index]))
  const overall: Tally = { closed: 0, wins: 0, totalR: 0 }
  const byLens = new Map<string, Tally>()
  const byRegime = new Map<string, Tally>()
  let open = 0
  let skipped = 0
  for (const file of files) {
    const index = sessionIndex.get(file.replace(/\.json$/, ""))
    if (index === undefined || index < sessions.length - TRACK_RECORD_SESSIONS) continue
    const picks = JSON.parse(await readFile(join(PICKS_DIR, file), "utf8")) as RecordedPick[]
    for (const pick of picks) {
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
  if (!files.length) return ""
  return [
    `### Track record of this system's top core setups (live, last ~${TRACK_RECORD_SESSIONS} sessions; R = multiples of the risk taken)`,
    describe("All", overall) + ` · ${open} still open · ${skipped} skipped (gapped above entry)`,
    ...[...byLens].map(([lens, tally]) => describe(`With ${lens}`, tally)),
    ...[...byRegime].map(([regime, tally]) => describe(`Picked in a ${regime} market`, tally)),
  ].join("\n")
}
