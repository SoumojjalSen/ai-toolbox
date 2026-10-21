import { marked } from "marked"
import { OutputFormat } from "./constants.js"

// Claude writes Markdown; the HTML styling lives here, not in the model's output — consistent every run,
// and ~half the output tokens (inline CSS was 55% of a model-written report).
export const FORMAT_INSTRUCTIONS: Record<OutputFormat, string> = {
  [OutputFormat.HTML]: [
    "Write GitHub-flavored Markdown — it is converted to a styled email, so no HTML and no code fences.",
    "Use # for the title, ## for sections, tables, bullet lists, **bold** and [links](url).",
    "Email conventions:",
    "each table row is shown as a card on a phone: the first cell is its title, a short second cell (≤ 24 characters, e.g. 'Buy', '🔴 Exit') a badge next to it, the other cells labelled lines — so keep cells short;",
    "a table row whose first cell starts with ↳ (all other cells empty) becomes a detail line on the card above;",
    "a table cell starting with 🟢 renders green, 🔴 renders red (the emoji itself is hidden);",
    "if a row's FIRST cell starts with 🟢 / 🔴, the card gets a green / red edge (use for picks and verdicts);",
    "a > quote renders as a callout box — grey by default, amber if it starts with ⚠️, red with 🔴, green with 🟢;",
    "a paragraph starting with 'Sources:' renders as a small grey line.",
  ].join(" "),
}

// Phone-first: every table becomes a stack of cards (a 4–5 column table doesn't fit a phone and gets cut off)
const EMAIL_STYLE = {
  body: "max-width:600px;margin:0 auto;padding:12px;background-color:#ffffff;color:#1a1a1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;overflow-wrap:anywhere",
  h1: "margin:0 0 14px;padding:14px 16px;background-color:#1e3a5f;color:#ffffff;font-size:19px;border-radius:8px",
  h2: "margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #1e3a5f;color:#1e3a5f;font-size:17px",
  h3: "margin:16px 0 6px;color:#1e3a5f;font-size:15px",
  card: "margin:8px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px",
  cardTitle: "font-size:15px;font-weight:600;line-height:1.4",
  cardLine: "margin-top:4px;font-size:14px",
  cardLabel: "color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.03em",
  cardDetail: "margin-top:6px;padding-top:6px;border-top:1px dashed #e5e7eb;color:#374151;font-size:13px",
  badge: "display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:600;vertical-align:middle",
  badgeColors: { "🟢": "background-color:#dcfce7;color:#166534", "🔴": "background-color:#fee2e2;color:#991b1b", default: "background-color:#f3f4f6;color:#374151" },
  cardTints: { "🟢": "border-left:4px solid #16a34a;background-color:#f0fdf4", "🔴": "border-left:4px solid #dc2626;background-color:#fef2f2", default: "border-left:4px solid #cbd5e1;background-color:#ffffff" },
  callout: "margin:12px 0;padding:10px 14px;color:#1a1a1a;border-radius:8px",
  calloutColors: {
    "⚠️": { background: "#fef3c7", border: "#d97706" },
    "🔴": { background: "#fee2e2", border: "#dc2626" },
    "🟢": { background: "#f0fdf4", border: "#16a34a" },
    default: { background: "#f3f4f6", border: "#1e3a5f" },
  },
  sources: "margin:4px 0 12px;color:#6b7280;font-size:12px",
  link: "color:#2563eb",
  green: "#16a34a",
  red: "#dc2626",
}

const DETAIL_ROW_MARKER = "↳"
const MAX_BADGE_LENGTH = 24 // a short second cell ("Buy", "🔴 Exit", "Watch") sits next to the name as a badge

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Model output can echo web content — show any raw HTML as text instead of rendering it
marked.use({ renderer: { html: ({ text }) => escapeHtml(text) } })

const textOf = (html: string) => html.replace(/<[^>]+>/g, "").trim()
const colorMarker = (html: string) => (["🟢", "🔴"] as const).find((marker) => textOf(html).startsWith(marker))
const dropMarker = (html: string) => html.replace(/🟢|🔴/, "").trim()

// One card per row: first cell = title (🟢/🔴 at its start tints the card), a short second cell = badge, the rest =
// "LABEL value" lines; a "↳" row (other cells empty) becomes a detail line on the card above; 🟢/🔴 cells are coloured.
function convertTablesToCards(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_table, tableHtml: string) => {
    const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((match) => textOf(match[1]))
    const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1].trim()))
      .filter((cells) => cells.length)
    const cards: { open: string; body: string[] }[] = []
    for (const cells of rows) {
      const [first = "", ...rest] = cells
      if (textOf(first).startsWith(DETAIL_ROW_MARKER) && rest.every((cell) => !textOf(cell))) {
        cards.at(-1)?.body.push(`<div style="${EMAIL_STYLE.cardDetail}">${first.replace(DETAIL_ROW_MARKER, "").trim()}</div>`)
        continue
      }
      const tint = EMAIL_STYLE.cardTints[colorMarker(first) ?? "default"]
      const second = rest[0] ?? ""
      const isBadge = !!textOf(second) && textOf(second).length <= MAX_BADGE_LENGTH
      const badge = isBadge ? `<span style="${EMAIL_STYLE.badge};${EMAIL_STYLE.badgeColors[colorMarker(second) ?? "default"]}">${dropMarker(second)}</span>` : ""
      const lines = rest.map((cell, index) => ({ cell, label: headers[index + 1] ?? "" })).slice(isBadge ? 1 : 0)
        .filter(({ cell }) => textOf(cell))
        .map(({ cell, label }) => {
          const marker = colorMarker(cell)
          const value = marker ? `<span style="color:${marker === "🟢" ? EMAIL_STYLE.green : EMAIL_STYLE.red}">${dropMarker(cell)}</span>` : cell
          return `<div style="${EMAIL_STYLE.cardLine}">${label ? `<span style="${EMAIL_STYLE.cardLabel}">${label}</span> ` : ""}${value}</div>`
        })
      cards.push({ open: `<div style="${EMAIL_STYLE.card};${tint}"><div style="${EMAIL_STYLE.cardTitle}">${dropMarker(first)}${badge}</div>`, body: lines })
    }
    return cards.map((card) => `${card.open}${card.body.join("")}</div>`).join("\n")
  })
}

// Glossary at the bottom of every email — only the terms that email actually uses
const GLOSSARY: [RegExp, string, string][] = [
  [/[+−-]?\d+(\.\d+)?R\b|\bavg [+−-]?\d+(\.\d+)?R\b/, "R", "result as a multiple of the amount risked: +2R = won twice what you risked, −1R = lost what you risked"],
  [/\bSL\b|stop loss/i, "SL / stop loss", "the price at which you sell to cap the loss"],
  [/\btarget\b/i, "Target", "the price at which you sell to take the profit"],
  [/sell[- ]by/i, "Sell by", "sell on this date if neither the target nor the stop loss was reached"],
  [/buy zone/i, "Buy zone", "from the planned buy price to half a stop-loss distance above it — higher than that, skip"],
  [/\bRS\b/, "RS", "relative strength, 1–99: how the stock did vs all others over 6 months (99 = top 1%)"],
  [/stage 2/i, "Stage 2", "a steady uptrend: price above its 50-, 150- and 200-day averages, each above the next"],
  [/tight (10-day )?range/i, "Tight range", "the price barely moved for 10 days — often comes before a move"],
  [/\bATR\b|average daily range/i, "ATR", "the stock's normal daily move in ₹"],
  [/\b(50|200)-day average/i, "50- / 200-day average", "average closing price of the last 50 / 200 trading days (~2 / ~10 months)"],
  [/20-day (low|breakdown)/i, "20-day low", "closed below the lowest price of the last 20 trading days"],
  [/normal volume|vol×avg/i, "× normal volume", "shares traded vs what usually trades by that time of day"],
  [/ex-date|ex-dividend/i, "Ex-date", "the day a dividend or split is taken out of the price — the drop isn't a real fall"],
  [/\bQIB\b/, "QIB", "big institutions (mutual funds, insurers, foreign funds) bidding in an IPO"],
  [/\bNII\b|\bHNI\b/, "NII", "wealthy individuals bidding over ₹2 lakh in an IPO"],
  [/\bretail\b/i, "Retail", "individuals bidding up to ₹2 lakh in an IPO"],
  [/(QIB|NII|Retail|Total|subscri\w*)[^|.]{0,20}\d+(\.\d+)?×/i, "× (subscription)", "how many times the shares on offer were bid for"],
  [/\bGMP\b|grey[- ]market/i, "GMP", "grey-market premium: the unofficial price people pay for IPO shares before listing"],
  [/\bOFS\b|offer for sale/i, "OFS", "offer for sale: existing owners sell their shares — the company gets no money"],
  [/\banchor/i, "Anchor investors", "big investors who buy before an IPO opens; they may sell 30 and 90 days after allotment"],
  [/\bRHP\b/, "RHP", "the IPO's offer document, filed just before it opens"],
  [/allot/i, "Allotment", "who gets IPO shares — a lottery for small investors"],
  [/shareholder quota/i, "Shareholder quota", "IPO shares kept for shareholders of the parent company"],
  [/\bP\/E\b|times (its )?earnings|× earnings/i, "P/E", "price ÷ yearly profit per share — how expensive the stock is"],
  [/\bROE\b/, "ROE", "return on equity: yearly profit as a % of the shareholders' money"],
  [/rights issue|\bQIP\b|preferential (issue|allotment)|dilut/i, "Rights issue / QIP / preferential issue", "the company issues new shares — each existing share owns a smaller part"],
  [/\bpromoter/i, "Promoter", "the founders or controlling owners"],
  [/\bpledg/i, "Pledge", "promoters borrowing against their shares — forced selling if the price falls"],
  [/\bASM\b|\bGSM\b|surveillance/i, "ASM / GSM", "NSE surveillance lists for risky or manipulated stocks"],
  [/F&O ban/i, "F&O ban", "derivatives trading paused because positions are too crowded"],
  [/\bFII\b|\bFPI\b|\bDII\b/, "FII / DII", "foreign / Indian institutions — their daily net buying or selling"],
  [/GIFT Nifty/i, "GIFT Nifty", "Nifty futures traded before India opens — an early sign of the open"],
  [/\bVIX\b/, "VIX", "the market's fear gauge — above 20 means a nervous market"],
  [/\bregime\b|market mood/i, "Market mood", "strong / neutral / weak, from how many stocks are rising — sets how much to risk per trade"],
]

export function buildGlossary(markdown: string): string {
  const used = GLOSSARY.filter(([pattern]) => pattern.test(markdown))
  return used.length ? `## Words used\n\n${used.map(([, term, meaning]) => `**${term}** — ${meaning}`).join("  \n")}` : ""
}

// Inline styles, not a <style> block — Gmail and Outlook drop or rewrite <style> in many cases
export function convertMarkdownToEmailHtml(markdown: string): string {
  const html = marked.parse([markdown, buildGlossary(markdown)].filter(Boolean).join("\n\n"), { async: false, gfm: true })
  const styledHtml = convertTablesToCards(html)
    .replace(/<h1>/g, `<h1 style="${EMAIL_STYLE.h1}">`)
    .replace(/<h2>/g, `<h2 style="${EMAIL_STYLE.h2}">`)
    .replace(/<h3>/g, `<h3 style="${EMAIL_STYLE.h3}">`)
    .replace(/<blockquote>\s*<p>(⚠️|🔴|🟢)?/g, (_tag, marker?: "⚠️" | "🔴" | "🟢") => {
      const { background, border } = EMAIL_STYLE.calloutColors[marker ?? "default"]
      return `<div style="${EMAIL_STYLE.callout};background-color:${background};border-left:4px solid ${border}"><p style="margin:0">${marker ?? ""}`
    })
    .replace(/<p>Sources:/g, `<p style="${EMAIL_STYLE.sources}">Sources:`)
    .replace(/<\/blockquote>/g, "</div>")
    .replace(/<a href=/g, `<a style="${EMAIL_STYLE.link}" href=`)
  return `<div style="${EMAIL_STYLE.body}">${styledHtml}</div>`
}

// Text from outside (headlines, filings) can contain "|", which would split a table cell
export const tableCell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim()

// A Markdown table whose rows sit on consecutive lines (a blank line between rows breaks the table)
export function markdownTable(heading: string, header: string, rows: string[]): string {
  return [heading, header, header.replace(/[^|]+/g, "---"), ...rows].join("\n")
}
