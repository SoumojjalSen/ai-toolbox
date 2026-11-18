# Popular stock screens — backtest on point-in-time NSE filings

Every 21 sessions from 2023-11-01: each liquid main-board stock (₹50 lakh+ a day) with 8 straight quarters of structured results is screened using only filings public by that day's close; every stock that passes is bought (equal weight) and its return measured. On average 1206 stocks could be screened per date. Returns are before costs and taxes; overlapping monthly windows are not independent tests.

Screens (thresholds from public Screener.in screens and the books; see the notes for what the data can't do):
- **P/E below 30** — Profitable and P/E < 30, market cap > ₹100 cr — the simplest value rule
- **Multibagger (Screener 'Tanmoy')** — Mcap > 100, sales and profit growth > 15%, ROCE > 15, D/E < 0.5, PEG < 1, P/E < 20. 1-year growth (5-year in the original); promoter, current ratio, P/B, payout left out
- **Multibagger (Screener 'TradingMargin')** — Mcap > 1000, profit growth > 20% (trailing year and latest quarter), D/E < 1, PEG < 1. 1-year growth (3-year in the original); promoter and pledge left out
- **Small-cap multibagger (Screener)** — Mcap < 5000, ROCE > 20, ROE > 20, sales and profit growth > 20%, D/E < 0.5, PEG < 1. 1-year growth (5-year in the original); promoter, industry P/E left out
- **Peter Lynch fast growers** — PEG 0–1, profit growth ≥ 20%, P/E ≤ 40, D/E < 0.3, mcap > 100. 1-year growth (5-year EPS growth in the original)
- **Clean-balance-sheet compounders (Screener)** — Sales and profit growth > 12%, ROCE > 18, ROE > 12, P/E 8–30, mcap > 100. 1-year growth (3-year in the original); pledge left out
- **Coffee Can (2-year version)** — Sales growth > 10% and ROCE > 15 in each of the last 2 years, mcap > 1000 (10 years in the original)
- **Magic Formula (Greenblatt), top 30** — Mcap > 400, ranked on earnings yield + ROCE (lower rank sum = better), best 30; banks and finance companies drop out (no revenue/ROCE in their filings)
- **CANSLIM (C + A + new high)** — Latest-quarter and trailing-year profit growth > 20%, within 15% of the 52-week high, 6-month return ≥ 20%, mcap > 100

## Period 1 (2023-11-01 → 2025-11-01)
| Screen | Stocks per month | Avg return, 63 sessions (~3 months) | 126 sessions (~6 months) | 252 sessions (~1 year) | Beat all stocks (6 months) | Rose 50%+ within a year |
|---|---|---|---|---|---|---|
| **All screened stocks (the benchmark)** | 1224 | +2.3% (median -1.5%) | +2.1% (median -3.7%) | +1.2% (median -8.5%) | – | 25% |
| P/E below 30 | 411 | +3.5% (median -0.3%) | +3.7% (median -1.9%) | +2.8% (median -6.8%) | 20 of 24 | 27% |
| Multibagger (Screener 'Tanmoy') | 18 | +1.2% (median -2.1%) | -0.6% (median -6.0%) | -2.5% (median -11.8%) | 5 of 24 | 26% |
| Multibagger (Screener 'TradingMargin') | 103 | +3.1% (median -0.6%) | +3.6% (median -3.0%) | +4.3% (median -6.8%) | 13 of 24 | 27% |
| Small-cap multibagger (Screener) | 9 | -3.8% (median -7.1%) | -6.4% (median -11.6%) | -6.0% (median -19.1%) | 2 of 24 | 29% |
| Peter Lynch fast growers | 119 | +2.4% (median -1.6%) | +2.3% (median -3.8%) | +0.9% (median -8.3%) | 8 of 24 | 26% |
| Clean-balance-sheet compounders (Screener) | 40 | +5.3% (median +0.7%) | +7.4% (median +0.0%) | +10.1% (median +0.7%) | 18 of 24 | 32% |
| Coffee Can (2-year version) | 139 | -0.2% (median -2.4%) | -2.0% (median -5.7%) | +0.6% (median -6.2%) | 15 of 15 | 19% |
| Magic Formula (Greenblatt), top 30 | 30 | -0.8% (median -2.3%) | -2.9% (median -5.7%) | -6.0% (median -13.2%) | 6 of 24 | 16% |
| CANSLIM (C + A + new high) | 74 | +3.5% (median +0.1%) | +5.1% (median -0.7%) | +6.6% (median -2.9%) | 16 of 24 | 30% |

## Period 2 — the check (2025-11-01 → 2026-11-17; 252-session holds not finished yet)
| Screen | Stocks per month | Avg return, 63 sessions (~3 months) | 126 sessions (~6 months) | 252 sessions (~1 year) | Beat all stocks (6 months) | Rose 50%+ within a year |
|---|---|---|---|---|---|---|
| **All screened stocks (the benchmark)** | 1170 | +3.3% (median -1.0%) | +11.2% (median +2.7%) | – | – | – |
| P/E below 30 | 474 | +3.5% (median -1.5%) | +11.1% (median +1.9%) | – | 1 of 6 | – |
| Multibagger (Screener 'Tanmoy') | 29 | +6.0% (median -1.2%) | +14.4% (median +2.4%) | – | 3 of 6 | – |
| Multibagger (Screener 'TradingMargin') | 119 | +6.7% (median +1.4%) | +19.2% (median +10.7%) | – | 6 of 6 | – |
| Small-cap multibagger (Screener) | 8 | +9.0% (median +1.2%) | +21.1% (median +7.8%) | – | 5 of 6 | – |
| Peter Lynch fast growers | 127 | +3.6% (median -1.9%) | +9.8% (median +0.7%) | – | 1 of 6 | – |
| Clean-balance-sheet compounders (Screener) | 56 | +5.6% (median -0.6%) | +18.0% (median +7.8%) | – | 6 of 6 | – |
| Coffee Can (2-year version) | 101 | +5.7% (median +2.0%) | +15.2% (median +8.6%) | – | 6 of 6 | – |
| Magic Formula (Greenblatt), top 30 | 30 | -1.8% (median -3.7%) | +0.7% (median -0.2%) | – | 0 of 6 | – |
| CANSLIM (C + A + new high) | 49 | +5.6% (median +1.4%) | +15.1% (median +10.4%) | – | 5 of 6 | – |