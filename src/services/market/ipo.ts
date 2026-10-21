import { fetchNseJson } from "./nse.js"
import { nseDate, parseNseDate, writeJson, todayIst } from "./store.js"
import { convertMarkdownToEmailHtml } from "../../formats.js"

// IPO facts from NSE's own pages — official, combined NSE + BSE subscription by category. The web sites the agent
// used (Chittorgarh, IPO Central) came back empty or blocked on every run, and the blogs disagreed with each other.
// Tested on 174 mainboard IPOs listed Jul 2025 → Oct 2026 (NSE subscription + daily prices):
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
    qib: times((category) => category.startsWith("Qualified Institutional")),
    nii: times((category) => category === "Non Institutional Investors"),
    retail: times((category) => category.startsWith("Retail Individual")),
    total: times((category) => category === "Total"),
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
export const formatSubscription = (subscription: Subscription) =>
  `QIB ${formatTimes(subscription.qib)} · NII ${formatTimes(subscription.nii)} · Retail ${formatTimes(subscription.retail)} · Total ${formatTimes(subscription.total)} (NSE, ${subscription.updated})`

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

export async function fetchHolidays(): Promise<Set<string>> {
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
    const subscription = issue.subscription
    const when = issue.status === "closed" ? `closed ${issue.end}` : `${issue.start} → ${issue.end}${issue.end === today ? " (CLOSES TODAY)" : ""}`
    return [
      `- **${issue.name}** (${issue.symbol}) · ${issue.status} · ${when} · band ${issue.band} · lot ${issue.lot ?? "?"} · **lists ${issue.listing}**${issue.listing === today ? " (TODAY)" : ""}`,
      issue.size ? `  Issue: ${issue.size.slice(0, 220)}` : "",
      subscription ? `  Subscription: ${formatSubscription(subscription)} · ${qibVerdict(subscription.qib, issue.status === "closed")}` : "  Subscription: not open yet",
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

export type IpoCall = "apply now" | "apply and wait" | "keep" | "cancel"
export interface IpoCallRecord { symbol: string; name: string; time: string; qib?: number; call: IpoCall }

// Closing day, two steps (retail can cancel a bid until 5 PM; QIB bidding closes at 4 PM):
// 14:00 — QIB ≥ 20× already → apply now (final QIB only goes up). Otherwise apply to hold a place and wait:
//   on 19 Oct, QIB at 13:54 → final was 14.6× → 121× (Bonfiglioli) and 1.6× → 35× (Sahajanand).
// 16:15 — QIB is final: ≥ 20× → keep (or apply now), under 20× → cancel before ~4:45 (apps slow down near 5 PM).
export function ipoCall(qib: number | undefined, isFinal: boolean): IpoCall {
  const strong = qib !== undefined && qib >= STRONG_QIB
  if (isFinal) return strong ? "keep" : "cancel"
  return strong ? "apply now" : "apply and wait"
}

const CALL_TEXT: Record<IpoCall, (issue: IpoIssue) => string> = {
  "apply now": (issue) => `🟢 apply now — QIB already ≥${STRONG_QIB}× · lists ${issue.listing} · plan to sell on listing day`,
  "apply and wait": () => `🟡 apply now to hold your place (unless this morning's report said avoid) — the 16:15 email says keep or cancel from the final QIB`,
  keep: (issue) => `🟢 keep your bid (or apply now, before ~4:45 PM) — final QIB ≥${STRONG_QIB}× · lists ${issue.listing} · plan to sell on listing day`,
  cancel: () => `🔴 cancel your bid before ~4:45 PM (retail can cancel until 5 PM) — final QIB under ${STRONG_QIB}×: almost half such IPOs listed below the issue price`,
}

// The IPO rows for the 14:00 market check (early read) and the 16:15 final; the calls are saved for the scorecard
export async function buildIpoClosingToday(now = new Date(), isFinal = false): Promise<{ rows: string[]; calls: IpoCallRecord[] }> {
  const data = await fetchIpos(now).catch(() => undefined)
  const closing = (data?.issues ?? []).filter((issue) => issue.status === "open" && issue.end === nseDate(now))
  if (!closing.length) return { rows: [], calls: [] }
  const time = new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(11, 16)
  const calls = closing.map((issue) => ({ symbol: issue.symbol, name: issue.name, time, qib: issue.subscription?.qib, call: ipoCall(issue.subscription?.qib, isFinal) }))
  const rows = [
    isFinal ? `## IPOs closing today — final call (QIB bidding closed at 4 PM)` : `## IPOs closing today — early read (final call at 16:15)`,
    "| IPO | Subscription | Decision |", "|---|---|---|",
    ...closing.map((issue, index) => {
      const updated = issue.subscription?.updated ?? ""
      const stale = !updated.startsWith(nseDate(now)) || (isFinal && updated.slice(12, 14) < "16")
        ? " ⚠️ NSE's number isn't the latest — check it in your broker app before acting" : ""
      const call = calls[index].call
      return `| ${call === "cancel" ? "🔴" : "🟢"} **${issue.name}** · ${issue.band} | ${issue.subscription ? formatSubscription(issue.subscription) : "no data"} | ${CALL_TEXT[call](issue)}${stale}${issue.reservedFor ? ` · ⭐ ${issue.reservedFor}` : ""} |`
    }),
  ]
  return { rows, calls }
}

// 16:15 on a closing day: keep or cancel from the final QIB number. Sends nothing on other days.
export async function buildIpoFinal(now = new Date()): Promise<{ count: number; subject: string; html: string }> {
  const { rows, calls } = await buildIpoClosingToday(now, true)
  if (!calls.length) return { count: 0, subject: "", html: "" }
  await writeJson(`ipo-calls/${todayIst()}-final.json`, calls)
  const doNow = calls.map((call) => `**${call.name.replace(/ Limited$/, "")}:** ${call.call === "keep" ? "keep your bid (or apply now)" : "cancel your bid"} — final QIB ${call.qib?.toFixed(1) ?? "?"}×`)
  const markdown = [
    `# IPO final call — ${nseDate(now)}`,
    `> 🟢 **Do now — before ~4:45 PM** (retail bids and cancellations close at 5 PM; apps slow down near the end)\n>\n> ${doNow.join("\n>\n> ")}`,
    rows.join("\n"),
    `_Rule (174 IPOs, Jul 2025 → Oct 2026): final QIB ≥ ${STRONG_QIB}× → median listing gain +17%, 5 in 99 listed below the issue price; under ${STRONG_QIB}× → median 0%, almost half below._`,
  ].join("\n\n")
  return { count: calls.length, subject: `🧾 IPO final call — ${calls.map((call) => `${call.name.replace(/ Limited$/, "").split(" ")[0]}: ${call.call}`).join(", ")}`, html: convertMarkdownToEmailHtml(markdown) }
}
