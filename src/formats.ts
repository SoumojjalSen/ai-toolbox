import { OutputFormat } from "./constants.js"

export const FORMAT_INSTRUCTIONS: Record<OutputFormat, string> = {
  [OutputFormat.HTML]: [
    "Respond in clean HTML with inline CSS.",
    "MUST use light background (#ffffff) with dark text (#1a1a1a) — many email clients don't support dark mode.",
    "Use explicit background-color and color on every container — never rely on defaults or inherit.",
    "Mobile-friendly, max-width 640px, responsive layout.",
    "Use green (#16a34a) for bullish/gains, red (#dc2626) for bearish/losses.",
    "Tables must have border-collapse, cell padding, and alternating row backgrounds for readability.",
    "No markdown, no code fences — only valid HTML that renders in Gmail, Outlook, and Apple Mail.",
  ].join(" "),
}
