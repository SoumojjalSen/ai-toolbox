// Local run of the daily market report: same request the n8n workflow sends, result opened in the browser.
// Needs `npm run dev` running in another terminal. Holdings come from STOCK_HOLDINGS in .env (keep in sync with n8n).
import { request } from "node:http"
import { writeFileSync } from "node:fs"
import { execFile } from "node:child_process"

const REPORT_FILE = "report.html"

const today = new Date().toLocaleDateString("en-GB", {
  day: "2-digit", month: "long", year: "numeric", weekday: "long", timeZone: "Asia/Kolkata",
})
const holdingsLine = process.env.STOCK_HOLDINGS ? `\n\nMy holdings (symbol:quantity@average price): ${process.env.STOCK_HOLDINGS}` : ""
const requestBody = JSON.stringify({
  prompt: `Today is ${today}. Research today's Indian market and write the pre-market briefing.${holdingsLine}`,
  skill: "market-analyst",
  format: "html",
})

// node:http instead of fetch — fetch gives up after 5 min waiting for headers, and a report takes ~7
const aiRequest = request(
  { host: "127.0.0.1", port: process.env.PORT || 8080, path: "/ai", method: "POST", headers: { "Content-Type": "application/json" } },
  (aiResponse) => {
    let responseText = ""
    aiResponse.on("data", (chunk) => (responseText += chunk))
    aiResponse.on("end", () => {
      if (aiResponse.statusCode !== 200) {
        console.error(`/ai ${aiResponse.statusCode}: ${responseText}`)
        process.exit(1)
      }
      const { response, sessionId } = JSON.parse(responseText)
      writeFileSync(REPORT_FILE, response)
      console.log(`${REPORT_FILE} written · session ${sessionId}`)
      execFile("open", [REPORT_FILE])
    })
  },
)
aiRequest.on("error", (requestError) => {
  console.error(`Can't reach ai-toolbox — is \`npm run dev\` running? (${requestError.message})`)
  process.exit(1)
})
console.log(`Requesting report for ${today} — takes several minutes…`)
aiRequest.end(requestBody)
