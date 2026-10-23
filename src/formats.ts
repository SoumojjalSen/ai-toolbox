import { marked } from "marked"
import { OutputFormat } from "./constants.js"

// Claude writes Markdown; the HTML styling lives here, not in the model's output — consistent every run,
// and ~half the output tokens (inline CSS was 55% of a model-written report).
export const FORMAT_INSTRUCTIONS: Record<OutputFormat, string> = {
  [OutputFormat.HTML]: [
    "Write GitHub-flavored Markdown — it is converted to a styled email, so no HTML and no code fences.",
    "Use # for the title, ## for sections, tables, bullet lists, **bold** and [links](url).",
    "Email conventions:",
    "a table row whose first cell starts with ↳ (all other cells empty) becomes a full-width detail row under the row above;",
    "a table cell starting with 🟢 renders green, 🔴 renders red (the emoji itself is hidden);",
    "if a row's FIRST cell starts with 🟢 / 🔴, the whole row gets a light green / red background (use for picks and verdicts);",
    "a > quote renders as a callout box — grey by default, amber if it starts with ⚠️, red with 🔴, green with 🟢;",
    "a paragraph starting with 'Sources:' renders as a small grey line.",
  ].join(" "),
}

const EMAIL_STYLE = {
  body: "max-width:640px;margin:0 auto;padding:16px;background-color:#ffffff;color:#1a1a1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5",
  h1: "margin:0 0 16px;padding:16px;background-color:#1e3a5f;color:#ffffff;font-size:20px;border-radius:6px",
  h2: "margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #1e3a5f;color:#1e3a5f;font-size:17px",
  h3: "margin:16px 0 6px;color:#1e3a5f;font-size:15px",
  table: "width:100%;border-collapse:collapse;margin:8px 0;font-size:13px",
  th: "padding:8px;border:1px solid #d1d5db;background-color:#e5e7eb;color:#1a1a1a;text-align:left",
  td: "padding:8px;border:1px solid #d1d5db;color:#1a1a1a;vertical-align:top",
  detailTd: "padding:6px 8px 10px;border:1px solid #d1d5db;color:#374151;font-size:12px",
  cellList: "margin:0;padding-left:16px",
  callout: "margin:12px 0;padding:10px 14px;color:#1a1a1a;border-radius:4px",
  // palette from the 2 Oct report the user liked
  calloutColors: {
    "⚠️": { background: "#fef3c7", border: "#d97706" },
    "🔴": { background: "#fee2e2", border: "#dc2626" },
    "🟢": { background: "#f0fdf4", border: "#16a34a" },
    default: { background: "#f3f4f6", border: "#1e3a5f" },
  },
  rowTints: { "🟢": "#f0fdf4", "🔴": "#fef2f2" },
  sources: "margin:4px 0 12px;color:#6b7280;font-size:12px",
  link: "color:#2563eb",
  rowBackgrounds: ["#ffffff", "#f9fafb"],
  green: "#16a34a",
  red: "#dc2626",
}

const DETAIL_ROW_MARKER = "↳"
const CELL_POINT_SEPARATOR = " · "
const MIN_BULLETED_CELL_LENGTH = 40 // "₹100 · SL ₹90" stays on one line

// A long cell written as "point · point · point" reads as a paragraph on a phone — show it as bullets
function bulletCell(cellHtml: string): string {
  const points = cellHtml.split(CELL_POINT_SEPARATOR)
  if (points.length < 2 || cellHtml.replace(/<[^>]+>/g, "").length < MIN_BULLETED_CELL_LENGTH) return cellHtml
  return `<ul style="${EMAIL_STYLE.cellList}">${points.map((point) => `<li>${point.trim()}</li>`).join("")}</ul>`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Model output can echo web content — show any raw HTML as text instead of rendering it
marked.use({ renderer: { html: ({ text }) => escapeHtml(text) } })

// Each <tr>: merge "↳" rows into one full-width cell; background = alternating, or a green/red tint when the
// first cell starts with 🟢 / 🔴 (a detail row keeps its parent's background); other 🟢 / 🔴 cells get colored text.
function styleTableRows(html: string): string {
  let rowIndex = -1
  let parentBackground = EMAIL_STYLE.rowBackgrounds[0]
  return html.replace(/<tr>([\s\S]*?)<\/tr>/g, (_row, rowContent: string) => {
    const cells = [...rowContent.matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/g)]
    const isHeaderRow = cells.every((cell) => cell[1] === "th")
    if (isHeaderRow) return `<tr>${rowContent}</tr>`

    const firstCellText = cells[0]?.[3].trim() ?? ""
    const isDetailRow = firstCellText.startsWith(DETAIL_ROW_MARKER) && cells.slice(1).every((cell) => cell[3].trim() === "")
    if (isDetailRow) {
      const detailText = firstCellText.slice(DETAIL_ROW_MARKER.length).trim()
      return `<tr style="background-color:${parentBackground}"><td colspan="${cells.length}" style="${EMAIL_STYLE.detailTd}">${detailText}</td></tr>`
    }

    rowIndex++
    const rowTintMarker = (["🟢", "🔴"] as const).find((marker) => firstCellText.startsWith(marker))
    parentBackground = rowTintMarker ? EMAIL_STYLE.rowTints[rowTintMarker] : EMAIL_STYLE.rowBackgrounds[rowIndex % 2]
    const styledCells = cells.map(([, , attributes, cellText], cellIndex) => {
      const trimmedText = cellText.trim()
      if (cellIndex === 0) return `<td${attributes} style="${EMAIL_STYLE.td}">${rowTintMarker ? trimmedText.slice(2).trim() : cellText}</td>`
      const textColor = trimmedText.startsWith("🟢") ? EMAIL_STYLE.green : trimmedText.startsWith("🔴") ? EMAIL_STYLE.red : undefined
      if (!textColor) return `<td${attributes} style="${EMAIL_STYLE.td}">${bulletCell(trimmedText)}</td>`
      // the color carries the meaning — drop the dot, it's noise in every row
      return `<td${attributes} style="${EMAIL_STYLE.td};color:${textColor}">${bulletCell(trimmedText.slice(2).trim())}</td>`
    })
    return `<tr style="background-color:${parentBackground}">${styledCells.join("")}</tr>`
  })
}

// Glossary at the bottom of every email — only the terms that email actually uses
const GLOSSARY: [RegExp, string, string][] = [
  [/[+−-]?\d+(\.\d+)?R\b|\bavg [+−-]?\d+(\.\d+)?R\b/, "R", "result as a multiple of the amount risked: +2R = won twice what you risked, −1R = lost what you risked"],
  [/\bSL\b|stop loss/i, "SL / stop loss", "the price at which you sell to cap the loss"],
  [/\btarget\b/i, "Target", "the price at which you sell to take the profit"],
  [/sell[- ]by/i, "Sell by", "sell on this date if neither the target nor the stop loss was reached"],
  [/buy limit|no higher than/i, "Buy limit", "the most to pay: 1% above the planned buy price — higher than that, skip"],
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
  [/\bregime\b|market mood/i, "Market mood", "strong / neutral / weak, from how many stocks are rising — buys only when strong"],
]

export function buildGlossary(markdown: string): string {
  const used = GLOSSARY.filter(([pattern]) => pattern.test(markdown))
  return used.length ? `## Words used\n\n${used.map(([, term, meaning]) => `- **${term}** — ${meaning}`).join("\n")}` : ""
}

// Inline styles, not a <style> block — Gmail and Outlook drop or rewrite <style> in many cases
export function convertMarkdownToEmailHtml(markdown: string): string {
  const html = marked.parse([markdown, buildGlossary(markdown)].filter(Boolean).join("\n\n"), { async: false, gfm: true })
  const styledHtml = styleTableRows(html)
    .replace(/<h1>/g, `<h1 style="${EMAIL_STYLE.h1}">`)
    .replace(/<h2>/g, `<h2 style="${EMAIL_STYLE.h2}">`)
    .replace(/<h3>/g, `<h3 style="${EMAIL_STYLE.h3}">`)
    .replace(/<table>/g, `<table style="${EMAIL_STYLE.table}">`)
    .replace(/<th(\s[^>]*)?>/g, (_tag, attributes = "") => `<th${attributes} style="${EMAIL_STYLE.th}">`)
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
