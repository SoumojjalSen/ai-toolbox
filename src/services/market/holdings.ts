import { readFile, stat } from "fs/promises"

// Written by the /sync-holdings skill on the Mac (Groww → VM over SSH), one "SYMBOL:qty@avg" per line
const HOLDINGS_FILE = process.env.HOLDINGS_FILE ?? "/data/market/holdings.txt"
const STALE_AFTER_DAYS = 3

// Empty when the file is missing — the report then has no holdings section
export async function readHoldings(): Promise<{ text: string; symbols: Set<string> }> {
  const [content, fileStats] = await Promise.all([readFile(HOLDINGS_FILE, "utf8"), stat(HOLDINGS_FILE)]).catch(() => [])
  if (!content || !fileStats) return { text: "", symbols: new Set() }
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean)
  const holdings = lines.join(", ")
  const syncedOn = fileStats.mtime.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
  const ageDays = (Date.now() - fileStats.mtime.getTime()) / 86_400_000
  const staleNote = ageDays > STALE_AFTER_DAYS ? ` ⚠️ Synced ${Math.floor(ageDays)} days ago — say so in the holdings section.` : ""
  return {
    text: `My holdings (symbol:quantity@average price), synced from Groww on ${syncedOn}:${staleNote}\n${holdings}`,
    symbols: new Set(lines.map((line) => line.split(":")[0])),
  }
}
