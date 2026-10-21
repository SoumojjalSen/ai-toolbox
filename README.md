# ai-toolbox

Internal API for n8n on the Oracle VM: `/ai` runs headless Claude Code with native skills (`.claude/skills`) and subagents (`.claude/agents`); `/mcp/:server` calls Groww/Kite MCP tools. Listens on `127.0.0.1:8080` only — it has no auth.

Pushing to `main` builds the image and deploys it to the VM (`.github/workflows/docker.yml`).

## Testing changes before you push

The VM's n8n calls your Mac's ai-toolbox through a reverse SSH tunnel, so you get the real email from your local code:

```bash
npm run dev                                                              # terminal 1
ssh -i ~/.ssh/oracle_key -N -R 18080:127.0.0.1:8080 ubuntu@140.238.229.137   # terminal 2
```

Then in n8n (`http://140.238.229.137:5678`) open **📊 Market Research**, set **🧪 Test settings** → `baseUrl` to `http://127.0.0.1:18080` (= your Mac) and `job` to `daily` / `movers` / `weekly`, and click **▶️ Test Run** — it emails a `[TEST]` report. Skill and agent edits apply on the next run; edits under `src/` restart the dev server.

The tunnel listens on the VM's loopback only — nothing is exposed publicly.

## Market report

- **8:00 weekdays** `POST /ai` with `skill: market-analyst` (skipped on NSE holidays) — the code scan (`src/services/market/scan.ts`, `lenses.ts`) attaches the regime (risk per trade), GIFT Nifty and fund flows, backtested swing setups, each candidate's **90 days of NSE filings** and what earlier news checks found, big-shareholder deals, holdings and your open trades from earlier picks, the live track record (`scorecard.ts`) and NSE's official IPO data (`ipo.ts`). Sources NSE didn't return are marked "not verified", never "none". Claude runs a full news checklist per stock and writes; every stock that passes is a pick (no fixed number). The report starts with a **Do now** box and ends with a findings log (saved, not emailed). A prompt containing "weekly" adds multibagger & value ideas (Saturday workflow).
- **10:00 and 14:00 weekdays** `GET /market/alert` — *Market check*: Do now box, buy or skip for the morning picks at the live price, your trades from earlier picks (stop / target / sell-by), holdings moving ≥2%, and the top movers on unusual volume with their filing or news. The 14:00 run adds the early read for IPOs closing that day (apply now if QIB ≥ 20×, else apply and wait). Code only, no AI.
- **16:15 weekdays** `GET /market/ipo-final` — on IPO closing days only: keep or cancel from the final QIB number (QIB bidding closes at 4 PM; retail can cancel until 5 PM).
- **19:30 weekdays** `GET /market/scorecard` — a **system check** (picks that failed fast and the filings before them, stocks re-picked after a drop, IPO calls vs final QIB and listing, data gaps), today's picks, the track record, label accuracy, missed moves, holdings. Code only.
- **Emails** — every table is rendered as phone-width cards (`src/formats.ts`).
- **Holdings** — run `/sync-holdings` in Claude Code on the Mac after days you trade: it copies Groww holdings to the VM (`/var/lib/ai-toolbox/market/holdings.txt`, mounted at `/data`). Data in `/data/market/`: `prices/` (NSE daily price files), `picks/` (top code setups), `report-picks/` (the report's picks), `findings/` (news-check findings), `alerts/` (market-check runs), `ipo-calls/`, `data-gaps/`.

## Tests

```bash
npm test
```
