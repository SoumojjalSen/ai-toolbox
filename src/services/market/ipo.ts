import { fetchNseJson } from "./nse.js"
import { nseDate, parseNseDate } from "./store.js"

// IPO facts from NSE's own pages — official, combined NSE + BSE subscription by category. The web sites the agent
// used (Chittorgarh, IPO Central) came back empty or blocked on every run, and the blogs disagreed with each other.
// Tested on 174 mainboard IPOs listed Jul 2025 → Oct 2026 (NSE subscription + bhavcopy):
// - Final QIB (big-institution) subscription is the best predictor of the listing price:
//   under 20×: median listing gain 0%, 35 of 75 listed below the issue price; 20× or more: median +17%, 5 of 99 below.
//   Retail demand above QIB demand: median +0.3%.
// - Selling at the listing open vs the close made no difference (median −0.3%).
// - 90 days after allotment (the last anchor shares unlock) stocks did −2.2% vs the market in the 10 sessions
//   around it (34% rose, n=110); the 30-day unlock showed no effect.

export const STRONG_QIB = 20
const ANCHOR_UNLOCK_DAYS = 90
const LISTING_AFTER_CLOSE = 3 // T+3 trading days

export interface Subscription { qib?: number; nii?: number; retail?: number; total?: number; updated: string }
export interface IpoIssue {
  symbol: string
  name: string
  status: "open" | "upcoming" | "closed"
  start: string // "15-Oct-2026"
  end: string
  band: string
  listing: string // computed from the close + NSE holidays
  subscription?: Subscription
  lot?: string
  size?: string
  reservedFor?: string // e.g. "Eligible RIL shareholders aggregating up to Rs. 25000 million"
  upiCutoff?: string // "5:00 PM" on the last day
  rhp?: string
}

interface NseUpcoming { companyName: string; symbol: string; issueStartDate: string; issueEndDate: string; issuePrice: string; status: string; series: string }
interface NsePast { company?: string; companyName?: string; symbol: string; ipoStartDate: string; ipoEndDate: string; priceRange: string; listingDate: string; securityType: string; issuePrice: string }
interface NseCategoryRow { category: string; noOfTotalMeant?: string }
interface NseDetail { issueInfo?: { dataList?: { title: string | null; value: string }[] } }

const DAY_MS = 86_400_000
const isWeekend = (ms: number) => [0, 6].includes(new Date(ms + 5.5 * 3_600_000).getUTCDay())
const formatDate = (ms: number) => nseDate(new Date(ms))

// The Nth trading day after `date`, skipping weekends and NSE holidays
export function addTradingDays(date: string, count: number, holidays: Set<string>): string {
  let ms = parseNseDate(date)
  for (let added = 0; added < count;) {
    ms += DAY_MS
    if (!isWeekend(ms) && !holidays.has(formatDate(ms))) added++
  }
  return formatDate(ms)
}

export function parseSubscription(rows: NseCategoryRow[], updated: string): Subscription {
  const times = (match: (category: string) => boolean) => {
    const value = Number(rows.find((row) => match(row.category))?.noOfTotalMeant)
    return Number.isFinite(value) && value > 0 ? value : undefined
  }
  return {
    qib: times((c) => c.startsWith("Qualified Institutional")),
    nii: times((c) => c === "Non Institutional Investors"),
    retail: times((c) => c.startsWith("Retail Individual")),
    total: times((c) => c === "Total"),
    updated: updated.replace("Updated as on ", ""),
  }
}

// What the QIB number says — the one tested rule
export function qibVerdict(qib: number | undefined, isFinal: boolean): string {
  if (qib === undefined) return "no QIB bids yet"
  if (qib >= STRONG_QIB) return `🟢 QIB ${qib.toFixed(1)}× — strong (≥${STRONG_QIB}×: 5 of 99 listed below the issue price)`
  return `🔴 QIB ${qib.toFixed(1)}×${isFinal ? "" : " so far"} — weak (under ${STRONG_QIB}× final: 35 of 75 listed below the issue price, median gain 0%)`
}

const formatTimes = (value?: number) => (value === undefined ? "—" : `${value.toFixed(value < 10 ? 2 : 1)}×`)
export const formatSubscription = (s: Subscription) =>
  `QIB ${formatTimes(s.qib)} · NII ${formatTimes(s.nii)} · Retail ${formatTimes(s.retail)} · Total ${formatTimes(s.total)} (NSE, ${s.updated})`

async function fetchSubscription(symbol: string): Promise<Subscription | undefined> {
  const data = await fetchNseJson<{ dataList?: NseCategoryRow[]; updateTime?: string }>(`ipo-active-category?symbol=${encodeURIComponent(symbol)}`)
  if (!data?.dataList?.length || !data.updateTime || data.updateTime.includes("null")) return undefined
  return parseSubscription(data.dataList, data.updateTime)
}

async function fetchDetail(symbol: string): Promise<Pick<IpoIssue, "lot" | "size" | "reservedFor" | "upiCutoff" | "rhp">> {
  const rows = (await fetchNseJson<NseDetail>(`ipo-detail?symbol=${encodeURIComponent(symbol)}&series=EQ`))?.issueInfo?.dataList ?? []
  const value = (title: string) => rows.find((row) => row.title === title)?.value.replace(/^"|"$/g, "").trim()
  const size = value("Issue Size")
  return {
    lot: value("Bid Lot")?.replace(/ Equity Shares and in multiples thereof/i, " shares"),
    size,
    // shareholders of a listed parent get their own portion (and can bid in it and as retail)
    reservedFor: size?.match(/eligible [^,()]*?shareholders[^,()]*/i)?.[0],
    upiCutoff: value("Cut-off time for UPI Mandate Confirmation")?.match(/\d{1,2}:\d{2} ?[AP]M/i)?.[0],
    rhp: value("Red Herring Prospectus"),
  }
}

async function fetchHolidays(): Promise<Set<string>> {
  const data = await fetchNseJson<{ CM?: { tradingDate: string }[] }>("holiday-master?type=trading")
  return new Set((data?.CM ?? []).map((holiday) => holiday.tradingDate))
}

// Mainboard issues open, upcoming, or closed and not yet listed; plus the past list (for anchor unlocks)
export async function fetchIpos(now = new Date()): Promise<{ issues: IpoIssue[]; past: NsePast[]; holidays: Set<string> } | undefined> {
  const [upcoming, past, holidays] = await Promise.all([
    fetchNseJson<NseUpcoming[]>("all-upcoming-issues?category=ipo"),
    fetchNseJson<NsePast[]>("public-past-issues"),
    fetchHolidays(),
  ])
  if (!upcoming && !past) return undefined
  const today = parseNseDate(nseDate(now))
  const issues: IpoIssue[] = (upcoming ?? []).filter((issue) => issue.series === "EQ").map((issue) => ({
    symbol: issue.symbol, name: issue.companyName, status: issue.status === "Active" ? "open" : "upcoming",
    start: issue.issueStartDate, end: issue.issueEndDate, band: issue.issuePrice.replace(/Rs\./g, "₹"),
    listing: addTradingDays(issue.issueEndDate, LISTING_AFTER_CLOSE, holidays),
  }))
  for (const issue of past ?? []) {
    if (!["EQ", "BE"].includes(issue.securityType) || issues.some((open) => open.symbol === issue.symbol)) continue
    const end = formatDate(parseNseDate(issue.ipoEndDate))
    const listing = addTradingDays(end, LISTING_AFTER_CLOSE, holidays)
    if (parseNseDate(listing) < today || parseNseDate(end) < today - 10 * DAY_MS) continue // listed already
    issues.push({ symbol: issue.symbol, name: issue.company ?? issue.companyName ?? issue.symbol, status: "closed",
      start: formatDate(parseNseDate(issue.ipoStartDate)), end, band: issue.priceRange.replace(/Rs\./g, "₹"), listing })
  }
  await Promise.all(issues.map(async (issue) => {
    const [subscription, detail] = await Promise.all([issue.status === "upcoming" ? undefined : fetchSubscription(issue.symbol), fetchDetail(issue.symbol)])
    Object.assign(issue, detail, { subscription })
  }))
  return { issues, past: past ?? [], holidays }
}

// Holdings whose last anchor shares unlock within a week either side of today
export function anchorUnlocks(past: NsePast[], holdingSymbols: Set<string>, holidays: Set<string>, now = new Date()): string[] {
  const today = parseNseDate(nseDate(now))
  return past.filter((issue) => holdingSymbols.has(issue.symbol)).flatMap((issue) => {
    const allotment = parseNseDate(addTradingDays(formatDate(parseNseDate(issue.ipoEndDate)), 1, holidays))
    const unlock = allotment + ANCHOR_UNLOCK_DAYS * DAY_MS
    return Math.abs(unlock - today) <= 7 * DAY_MS ? [`${issue.symbol}: last anchor shares unlock ~${formatDate(unlock)} — past IPOs did −2.2% vs the market around this date (34% rose); don't add until a week after`] : []
  })
}

// For the morning report — the facts, so the agent only adds the grey-market premium, business and red flags
export async function buildIpoBrief(holdingSymbols: Set<string>, now = new Date()): Promise<string> {
  const data = await fetchIpos(now).catch(() => undefined)
  if (!data) return "### IPOs (NSE)\nNSE IPO data unavailable today — market-ipo-research must find dates and subscription itself."
  const today = nseDate(now)
  const lines = data.issues.map((issue) => {
    const s = issue.subscription
    const when = issue.status === "closed" ? `closed ${issue.end}` : `${issue.start} → ${issue.end}${issue.end === today ? " (CLOSES TODAY)" : ""}`
    return [
      `- **${issue.name}** (${issue.symbol}) · ${issue.status} · ${when} · band ${issue.band} · lot ${issue.lot ?? "?"} · **lists ${issue.listing}**${issue.listing === today ? " (TODAY)" : ""}`,
      issue.size ? `  Issue: ${issue.size.slice(0, 220)}` : "",
      s ? `  Subscription: ${formatSubscription(s)} · ${qibVerdict(s.qib, issue.status === "closed")}` : "  Subscription: not open yet",
      issue.reservedFor ? `  ⭐ Shareholder quota: ${issue.reservedFor} — they can bid in this quota AND as retail (same PAN), roughly doubling the allotment chance` : "",
      issue.rhp ? `  RHP: ${issue.rhp}` : "",
    ].filter(Boolean).join("\n")
  })
  const unlocks = anchorUnlocks(data.past, holdingSymbols, data.holidays, now)
  return [
    `### IPOs (NSE official — mainboard; listing date = close + 3 trading days)`,
    lines.join("\n") || "No mainboard IPOs open, upcoming or awaiting listing.",
    unlocks.length ? `### Holdings near the 90-day anchor unlock\n${unlocks.join("\n")}` : "",
  ].filter(Boolean).join("\n\n")
}

// For the 14:00 market check — apply or skip for issues that close today, from the live QIB number. Final QIB only
// goes up, so ≥20× now is safe; under 20× may still get there, but skipping is the cautious call.
export async function buildIpoClosingToday(now = new Date()): Promise<string[]> {
  const data = await fetchIpos(now).catch(() => undefined)
  const closing = (data?.issues ?? []).filter((issue) => issue.status === "open" && issue.end === nseDate(now))
  if (!closing.length) return []
  return [
    `## IPOs closing today — apply or skip`,
    "| IPO | Subscription now | Decision |", "|---|---|---|",
    ...closing.map((issue) => {
      const qib = issue.subscription?.qib
      const stale = issue.subscription && !issue.subscription.updated.startsWith(nseDate(now)) ? " ⚠️ NSE hasn't updated today — check the live number before applying" : ""
      const decision = qib !== undefined && qib >= STRONG_QIB
        ? `🟢 apply before ${issue.upiCutoff ?? "5 PM"} (UPI cut-off) · lists ${issue.listing} · plan to sell on listing day`
        : `🔴 skip — QIB under ${STRONG_QIB}× so far`
      return `| ${qib !== undefined && qib >= STRONG_QIB ? "🟢" : "🔴"} **${issue.name}** · ${issue.band} | ${issue.subscription ? formatSubscription(issue.subscription) : "no data"} | ${decision}${stale}${issue.reservedFor ? ` · ⭐ ${issue.reservedFor}` : ""} |`
    }),
  ]
}
