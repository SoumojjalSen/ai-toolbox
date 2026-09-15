import { OutputFormat } from "./constants.js"

export const FORMAT_INSTRUCTIONS: Record<OutputFormat, string> = {
  [OutputFormat.HTML]: [
    "Respond in clean, semantic HTML with inline CSS.",
    "Mobile-friendly, max-width 640px, responsive layout.",
    "Use a professional color palette with good contrast.",
    "No markdown, no code fences — only valid HTML.",
  ].join(" "),
}
