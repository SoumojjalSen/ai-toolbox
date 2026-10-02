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
      if (cellIndex === 0 && rowTintMarker) return `<td${attributes} style="${EMAIL_STYLE.td}">${trimmedText.slice(2).trim()}</td>`
      const textColor = trimmedText.startsWith("🟢") ? EMAIL_STYLE.green : trimmedText.startsWith("🔴") ? EMAIL_STYLE.red : undefined
      if (!textColor) return `<td${attributes} style="${EMAIL_STYLE.td}">${cellText}</td>`
      // the color carries the meaning — drop the dot, it's noise in every row
      return `<td${attributes} style="${EMAIL_STYLE.td};color:${textColor}">${trimmedText.slice(2).trim()}</td>`
    })
    return `<tr style="background-color:${parentBackground}">${styledCells.join("")}</tr>`
  })
}

// Inline styles, not a <style> block — Gmail and Outlook drop or rewrite <style> in many cases
export function convertMarkdownToEmailHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true })
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
