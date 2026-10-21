import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises"
import { dirname, join } from "path"

// JSON files under the data volume (/data/market on the VM): picks, report picks, alert runs — what the
// scorecard reads back. Local dev has no volume: writes are skipped and reads come back empty.
const DATA_DIR = process.env.MARKET_DATA_DIR ?? "/data/market"

export async function readJson<T>(name: string): Promise<T | undefined> {
  return readFile(join(DATA_DIR, name), "utf8").then((text) => JSON.parse(text) as T).catch(() => undefined)
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  const path = join(DATA_DIR, name)
  await mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, JSON.stringify(value, null, 1))).catch(() => {})
}

// Raw files (NSE's daily price CSVs) — same folder rules as the JSON files
export async function readText(name: string): Promise<string | undefined> {
  return readFile(join(DATA_DIR, name), "utf8").catch(() => undefined)
}

export async function writeText(name: string, text: string): Promise<void> {
  const path = join(DATA_DIR, name)
  await mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, text)).catch(() => {})
}

export async function listFiles(folder: string): Promise<string[]> {
  return (await readdir(join(DATA_DIR, folder)).catch(() => [] as string[])).sort()
}

export async function deleteFile(name: string): Promise<void> {
  await unlink(join(DATA_DIR, name)).catch(() => {})
}

export async function listJson(folder: string): Promise<string[]> {
  return (await readdir(join(DATA_DIR, folder)).catch(() => [] as string[])).filter((file) => file.endsWith(".json")).sort()
}

// "2026-10-16" in IST — file names sort by date
export function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)
}

// "16-Oct-2026" — how NSE prints dates (IST)
export function nseDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(date)
  const part = (type: string) => parts.find((part) => part.type === type)?.value
  return `${part("day")}-${part("month")}-${part("year")}`
}

// "15-Oct-2026" → epoch ms (IST midnight)
export function parseNseDate(text: string): number {
  return new Date(`${text.replace(/-/g, " ")} 00:00 GMT+0530`).getTime()
}
