import { test } from "node:test"
import assert from "node:assert/strict"
import { convertMarkdownToEmailHtml } from "./formats.js"

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

  // ↳ row → one full-width cell with the marker removed, same background as its parent row
  assert.match(html, /<tr style="background-color:#ffffff"><td colspan="4"[^>]*>Risk: GMP slipping\. <a style="[^"]*" href="https:\/\/example\.com">src<\/a><\/td><\/tr>/)
  assert.doesNotMatch(html, /↳/)
  // next real row alternates
  assert.match(html, /<tr style="background-color:#f9fafb"><td[^>]*><strong>Nityas/)
  // 🟢 in the first cell tints the row and its detail row, marker removed
  assert.match(html, /<tr style="background-color:#f0fdf4"><td[^>]*><strong>SRIT/)
  assert.match(html, /<tr style="background-color:#f0fdf4"><td colspan="4"[^>]*>Risk: NII money flips fast\./)
  // 🟢 / 🔴 cells colored, dot removed
  assert.match(html, /color:#16a34a">₹107/)
  assert.match(html, /color:#dc2626">Avoid/)
  assert.doesNotMatch(html, /<td[^>]*>🟢/)
  // callout + escaped raw HTML
  assert.match(html, /background-color:#f3f4f6;border-left:4px solid #1e3a5f"><p style="margin:0">Expected open: flat/)
  assert.match(html, /background-color:#fef3c7;border-left:4px solid #d97706"><p style="margin:0">⚠️ Markets shut today/)
  assert.match(html, /<p style="margin:4px 0 12px;color:#6b7280[^"]*">Sources:/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})
