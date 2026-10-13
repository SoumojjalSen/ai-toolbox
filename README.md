# ai-toolbox

Internal API for n8n on the Oracle VM: `/ai` runs headless Claude Code with native skills (`.claude/skills`) and subagents (`.claude/agents`); `/mcp/:server` calls Groww/Kite MCP tools. Listens on `127.0.0.1:8080` only — it has no auth.

Pushing to `main` builds the image and deploys it to the VM (`.github/workflows/docker.yml`).

## Testing changes before you push

The VM's n8n calls your Mac's ai-toolbox through a reverse SSH tunnel, so you get the real email from your local code:

```bash
npm run dev                                                              # terminal 1
ssh -i ~/.ssh/oracle_key -N -R 18080:127.0.0.1:8080 ubuntu@140.238.229.137   # terminal 2
```

Then in n8n (`http://140.238.229.137:5678`) run **🧪 Daily Market Research (dev)** — it calls `127.0.0.1:18080` on the VM (= your Mac) and emails a `[DEV]` report. Skill and agent edits apply on the next run; edits under `src/` restart the dev server.

The tunnel listens on the VM's loopback only — nothing is exposed publicly.

## Market report

- **8:00 weekdays** `POST /ai` with `skill: market-analyst` — the code scan (`src/services/marketScan.ts`, `marketLenses.ts`) attaches the regime, backtested swing setups, NSE filings, big-shareholder deals, holdings and the live track record (`scorecard.ts`); Claude news-checks and writes. A prompt containing "weekly" adds multibagger & value ideas (Saturday workflow).
- **9:30 weekdays** `GET /market/alert` — stocks moving ≥3% on heavy volume since the open, with their filings. Code only, no AI.
- **Holdings** — run `/sync-holdings` in Claude Code on the Mac after days you trade: it copies Groww holdings to the VM (`/var/lib/ai-toolbox/market/holdings.txt`, mounted at `/data`). Picks for the scorecard are kept in `/data/market/picks/`.

## Tests

```bash
npm test
```
