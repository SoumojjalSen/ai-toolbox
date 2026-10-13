import { fetchNse, fetchNseJson } from "./nse.js"

// NSE data lenses beyond price/volume: company filings, big-shareholder deals, corporate actions, and the
// lists that veto a pick (surveillance, F&O ban, results due). Each fetch is optional — a failed NSE call
// leaves that lens empty, never breaks the scan.

export type EventKind =
  | "regulatory" | "management exit" | "corporate action" | "results" | "order" | "rating change" | "fund raise"
  | "expansion" | "price-move query" | "press release"

export interface CompanyEvent {
  symbol: string
  kind: EventKind
  time: string // as NSE prints it, e.g. "13-Oct-2026 18:42:10"
  headline: string
  link: string
}

export interface ShareholderDeal {
  symbol: string
  side: "buy" | "sell"
  acquirer: string
  isPromoter: boolean
  percent: number // of the company's shares
  period: string
}

export interface MarketLenses {
  events: CompanyEvent[] // filings in the last ~24 h
  resultsLastWeek: Map<string, string> // symbol → filing time, for the post-results drift lens
  deals: ShareholderDeal[]
  specialSituations: { symbol: string; subject: string; exDate: string }[]
  vetoes: Map<string, string> // symbol → why it can't be picked (GSM, ASM stage II+)
  cautions: Map<string, string> // symbol → flag that doesn't block a cash swing trade (ASM stage I, F&O ban)
  resultsSoon: Map<string, string> // symbol → results date (next ~3 days)
}

// NSE's own filing category decides first; for generic categories ("Updates", "Outcome of Board Meeting") the
// text does. Ordered: the first match wins, so "orders passed" by a regulator never counts as a business order.
const CATEGORY_RULES: [EventKind, RegExp][] = [
  ["regulatory", /action\(s\) (initiated|taken)|fraud|default|arrest|litigation|insolvency|effect\(s\) on listed entity/i],
  ["corporate action", /acquisition|amalgamation|merger|scheme of arrangement|sale or disposal|open offer|buyback|restructuring|takeover/i],
  ["order", /bagging|receiving of orders|awarding of order/i],
  ["rating change", /credit rating- revision/i],
  ["fund raise", /qualified institutional placement|issue of securities/i],
  ["expansion", /capacity addition|commencement of commercial production|new line\(s\) of business/i],
  ["price-move query", /spurt in volume|price movement|news verification|rumour verification/i],
]
const TEXT_RULES: [EventKind, RegExp][] = [
  ["regulatory", /search and seizure|income tax search|raid|penalt|show[- ]cause|demand order|tax demand|enforcement directorate|sebi order/i],
  // only the people who run the company or sign its accounts — independent/nominee director exits are routine
  ["management exit", /(resign|cessation).*(chief executive|\bceo\b|managing director|chief financial|\bcfo\b|statutory auditor|chairman)|(chief executive|\bceo\b|managing director|chief financial|\bcfo\b|statutory auditor|chairman).*(resign|cessation)/i],
  ["corporate action", /demerger|scheme of arrangement|amalgamation|merger|buy[- ]?back|open offer|delist|draft red herring|\bdrhp\b|initial public offer|offer for sale|stake sale|divest|acquisition of|acquire[sd]? /i],
  ["results", /financial results|unaudited results|audited results|quarterly results/i],
  ["order", /\border(s)? (worth|valued|of rs|received|from)|work order|purchase order|letter of award|\bloa\b|letter of intent|bagged|secured (an? )?(order|contract)|contract (worth|valued|from)/i],
  ["rating change", /rating.*(upgrade|downgrade)|(upgrade|downgrade).*rating/i],
  ["fund raise", /qualified institutions? placement|\bqip\b|preferential (issue|allotment)|rights issue|fund ?raising/i],
]
// Routine filings that never move a stock
const IGNORED_CATEGORIES = /allotment of securities|esop|esos|certificate under|trading window|newspaper|copy of|loss of share|duplicate share|investor (meet|presentation)|analysts\/institutional|shareholders meeting|record date|structural digital|corrigendum|company secretary|^appointment|change in director|demise|retirement|dividend|integrated filing- governance|statement of deviation|committee meeting/i

interface NseAnnouncement { symbol: string; desc: string; attchmntText?: string; an_dt: string; attchmntFile?: string }

export function classifyAnnouncement(announcement: Pick<NseAnnouncement, "desc" | "attchmntText">): EventKind | undefined {
  if (IGNORED_CATEGORIES.test(announcement.desc)) return undefined
  const byCategory = CATEGORY_RULES.find(([, pattern]) => pattern.test(announcement.desc))?.[0]
  if (byCategory) return byCategory
  const byText = TEXT_RULES.find(([, pattern]) => pattern.test(announcement.attchmntText ?? ""))?.[0]
  // a press release's text is usually just "regarding a press release" — the PDF holds the news
  return byText ?? (/press release/i.test(announcement.desc) ? "press release" : undefined)
}

function formatNseDate(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-")
  return `${day}-${month}-${year}`
}

// "13-Oct-2026 18:42:10" → Date (IST)
function parseNseTime(text: string): Date {
  const [day, month, year, time = "00:00:00"] = text.replace(/,/g, "").split(/[- ]/)
  return new Date(`${day} ${month} ${year} ${time} GMT+0530`)
}

async function fetchAnnouncements(fromDate: Date, toDate: Date): Promise<NseAnnouncement[]> {
  return (await fetchNseJson<NseAnnouncement[]>(`corporate-announcements?index=equities&from_date=${formatNseDate(fromDate)}&to_date=${formatNseDate(toDate)}`)) ?? []
}

interface NseSastRow { symbol: string; acqSaleType: string; acquisitionMode: string; acquirerName: string; promoterType: string; totAcqShare: string | null; totSaleShare: string | null; acquirerDate: string }
interface NseCorporateAction { symbol: string; subject: string; exDate: string }
interface NseSurveillanceRow { symbol: string; survDesc?: string; gsmStage?: string }
interface NseCalendarRow { symbol: string; purpose: string; date: string }

export async function fetchMarketLenses(now = new Date()): Promise<MarketLenses> {
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 86_400_000)
  const [announcements, sast, corporateActions, asm, gsm, banResponse, calendar] = await Promise.all([
    fetchAnnouncements(daysFromNow(-7), now),
    fetchNseJson<{ data?: NseSastRow[] }>("corporate-sast-reg29?index=equities"),
    fetchNseJson<NseCorporateAction[]>(`corporates-corporateActions?index=equities&from_date=${formatNseDate(daysFromNow(-3))}&to_date=${formatNseDate(daysFromNow(30))}`),
    fetchNseJson<{ longterm?: { data?: NseSurveillanceRow[] }; shortterm?: { data?: NseSurveillanceRow[] } }>("reportASM"),
    fetchNseJson<NseSurveillanceRow[]>("reportGSM"),
    fetchNse("https://nsearchives.nseindia.com/content/fo/fo_secban.csv").catch(() => undefined),
    fetchNseJson<NseCalendarRow[]>("event-calendar"),
  ])

  // last 24 h, plus the weekend when it's Monday — whatever came out since the previous session
  const eventCutoff = daysFromNow(now.getUTCDay() === 1 ? -3 : -1.2)
  const events: CompanyEvent[] = []
  const resultsLastWeek = new Map<string, string>()
  for (const announcement of announcements) {
    const kind = classifyAnnouncement(announcement)
    if (!kind) continue
    if (kind === "results" && !resultsLastWeek.has(announcement.symbol)) resultsLastWeek.set(announcement.symbol, announcement.an_dt)
    if (parseNseTime(announcement.an_dt) < eventCutoff) continue
    events.push({
      symbol: announcement.symbol, kind, time: announcement.an_dt,
      headline: (announcement.attchmntText ?? announcement.desc).replace(/\s+/g, " ").replace(/^.*? has (informed|submitted to) the Exchange,? (about |regarding |that )?/i, "").slice(0, 130),
      link: announcement.attchmntFile ?? "",
    })
  }

  // Open-market buys/sells by ≥5% holders and promoters (SAST Reg 29); inter-se transfers and gifts move nothing
  const deals: ShareholderDeal[] = (sast?.data ?? [])
    .filter((row) => /market/i.test(row.acquisitionMode))
    .map((row) => {
      const side = row.acqSaleType === "Acquisition" ? "buy" as const : "sell" as const
      return {
        symbol: row.symbol, side, acquirer: row.acquirerName, isPromoter: row.promoterType === "Y",
        percent: Number((side === "buy" ? row.totAcqShare : row.totSaleShare) ?? 0) || 0, period: row.acquirerDate,
      }
    })
    .filter((deal) => deal.percent > 0 && (deal.isPromoter || deal.percent >= 1))

  // Dividends are routine; splits/bonuses/buybacks/demergers/rights are the special situations
  const specialSituations = (corporateActions ?? [])
    .filter((action) => /demerger|buy ?back|bonus|split|sub-division|rights|arrangement|capital reduction/i.test(action.subject))
    .map((action) => ({ symbol: action.symbol, subject: action.subject, exDate: action.exDate }))

  // GSM = weak fundamentals with a run-up (pump-and-dump risk); ASM stage II+ = trade-for-trade / deposits.
  // ASM stage I (100% margin) and the F&O ban don't stop a cash delivery trade — they're cautions.
  const vetoes = new Map<string, string>()
  const cautions = new Map<string, string>()
  for (const row of [...(asm?.longterm?.data ?? []), ...(asm?.shortterm?.data ?? [])]) {
    const description = row.survDesc ?? "ASM surveillance"
    if (/stage i$/i.test(description.trim())) cautions.set(row.symbol, `${description} — no leverage, volatile`)
    else vetoes.set(row.symbol, description)
  }
  for (const row of gsm ?? []) vetoes.set(row.symbol, row.survDesc ?? "GSM surveillance")
  const banCsv = banResponse?.ok ? await banResponse.text() : ""
  for (const line of banCsv.split("\n").slice(1)) {
    const symbol = line.split(",")[1]?.trim()
    if (symbol) cautions.set(symbol, "F&O ban — derivatives crowded (open interest > 95% of the limit)")
  }

  // Results in the next ~3 days: a fresh swing entry would be a coin-flip on the numbers
  const resultsSoon = new Map<string, string>()
  const resultsHorizon = daysFromNow(3.5)
  for (const row of calendar ?? []) {
    const date = parseNseTime(row.date)
    if (/result/i.test(row.purpose) && date >= daysFromNow(-0.5) && date <= resultsHorizon) resultsSoon.set(row.symbol, row.date)
  }

  return { events, resultsLastWeek, deals, specialSituations, vetoes, cautions, resultsSoon }
}
