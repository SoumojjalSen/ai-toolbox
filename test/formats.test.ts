import { test } from "node:test"
import assert from "node:assert/strict"
import { convertMarkdownToEmailHtml, buildGlossary } from "../src/formats.js"

test("convertMarkdownToEmailHtml: detail rows, colors, callouts, raw HTML", () => {
  const html = convertMarkdownToEmailHtml(
    [
      "## IPO watch",
      "| IPO | Band | GMP | Verdict |",
      "|---|---|---|---|",
      "| **Orient Cables** | ₹258–272 | 🟢 ₹107 | 🟢 Book gains |",
      "| ↳ Risk: GMP slipping. [src](https://example.com) | | | |",
      "| **Nityas** | ₹70–75 | 🔴 ₹3 | 🔴 Avoid |",
      "| 🟢 **SRIT** | ₹123–130 | 🟢 ₹53 | 🟢 Allottees: sell half |",
      "| ↳ Risk: NII money flips fast. | | | |",
      "",
      "> Expected open: flat",
      "",
      "> ⚠️ Markets shut today",
      "",
      "Sources: [Yahoo](https://example.com)",
      "",
      "<script>alert(1)</script>",
    ].join("\n"),
  )

  // each row is a card: title, short verdict as a badge, the rest as labelled lines; ↳ rows become detail lines
  assert.doesNotMatch(html, /<table|<tr|<td/)
  assert.match(html, /<strong>Orient Cables<\/strong><span style="[^"]*">Book gains<\/span>|<strong>Orient Cables<\/strong>/)
  assert.match(html, /Risk: GMP slipping\. <a style="[^"]*" href="https:\/\/example\.com">src<\/a><\/div>/)
  assert.doesNotMatch(html, /↳/)
  // 🟢 first cell → green-edged card, marker removed
  assert.match(html, /border-left:4px solid #16a34a;background-color:#f0fdf4"><div[^>]*><strong>SRIT/)
  // 🟢 / 🔴 cells coloured, dot removed; header names label the lines
  assert.match(html, /color:#16a34a">₹107/)
  assert.match(html, />GMP<\/span>/)
  assert.doesNotMatch(html, />🟢|>🔴/)
  // callout + escaped raw HTML
  assert.match(html, /background-color:#f3f4f6;border-left:4px solid #1e3a5f"><p style="margin:0">Expected open: flat/)
  assert.match(html, /background-color:#fef3c7;border-left:4px solid #d97706"><p style="margin:0">⚠️ Markets shut today/)
  assert.match(html, /<p style="margin:4px 0 12px;color:#6b7280[^"]*">Sources:/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test("buildGlossary lists only the terms the email uses", () => {
  const glossary = buildGlossary("SSWL open, −0.15R · SL ₹378 · QIB 47×")
  assert.match(glossary, /\*\*R\*\*/)
  assert.match(glossary, /\*\*SL \/ stop loss\*\*/)
  assert.match(glossary, /\*\*QIB\*\*/)
  assert.doesNotMatch(glossary, /GMP|Promoter|VIX/)
  assert.equal(buildGlossary("Nothing technical here"), "")
})
