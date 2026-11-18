// Point-in-time fundamentals for the backtest: every quarterly results filing (main board) from Dec 2021, with the
// figures from NSE's structured (XBRL) file and the time it was filed — so a screen on a past date only sees what
// was public then. SME companies file no structured results on NSE, so screens cover the main board only.
// Run: npx tsx src/backtest/fundamentals.ts   (resumes: symbols already in fundamentals.jsonl are skipped)
import { appendFile, readFile, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { gzipSync } from "zlib"
import { HISTORY_DIR } from "./download.js"
import { loadHistory } from "./history.js"
import { listFilings, parseFilingXbrl, fetchText, type Filing } from "../services/market/fundamentals.js"
export type { Filing }

const JSONL = join(HISTORY_DIR, "fundamentals.jsonl")

async function main() {
  const history = await loadHistory()
  // main-board stocks that were liquid (₹50 lakh+ a day) in at least 20 sessions since Nov 2023
  const symbols = [...history.stocks.values()].filter((stock) => stock.board === "main" &&
    stock.bars.filter((bar, index) => history.days[stock.dayIndex[index]] >= "2023-11-01" && bar.turnoverLakhs >= 50).length >= 20).map((stock) => stock.symbol)
  const done = new Set(existsSync(JSONL) ? (await readFile(JSONL, "utf8")).split("\n").filter(Boolean).map((line) => (JSON.parse(line) as { symbol: string }).symbol) : [])
  const todo = symbols.filter((symbol) => !done.has(symbol))
  console.log(`${symbols.length} symbols, ${todo.length} to fetch`)
  for (let index = 0; index < todo.length; index += 6) {
    await Promise.all(todo.slice(index, index + 6).map(async (symbol) => {
      const listed = await listFilings(symbol)
      const filings: Filing[] = []
      for (const row of listed) {
        const xml = await fetchText(row.xbrl)
        if (xml) filings.push({ symbol, periodEnd: row.periodEnd, filedAt: row.filedAt, basis: row.basis, ...parseFilingXbrl(xml) })
      }
      await appendFile(JSONL, JSON.stringify({ symbol, filings }) + "\n")
    }))
    if (index % 60 === 0) console.log(`  ${index}/${todo.length}`)
  }
  const lines = (await readFile(JSONL, "utf8")).split("\n").filter(Boolean)
  await writeFile(join(HISTORY_DIR, "fundamentals.json.gz"), gzipSync(`[${lines.join(",")}]`, { level: 9 }))
  console.log("done")
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
