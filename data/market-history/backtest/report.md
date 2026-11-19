# Backtest — every rule on every NSE stock (main board + SME)

Data: 954 sessions, 2023-01-02 → 2026-11-17, 3543 symbols; prices adjusted for splits/bonuses. Signals from 2023-11-01.
Periods: **1 set** = 2023-11-01 → 2025-11-01 (rules may be judged here); **2 confirm** = 2025-11-01 → 2026-11-17 (checked once, never tuned on).
Trades: bought at the next open (skipped if >1% above the signal close or locked at the upper limit); stop 2× the average daily range, target 3R, sell-by 30 sessions (60 for results-day and insider-buy). Costs per round trip: main 0.25%, SME 0.5%. R = profit ÷ amount risked.
Intraday: bought at the open, sold at the close or a stop 0.5× the average daily range below; costs main 0.15%, SME 0.3%.

## Swing rules — by rule, board and period
| Group | Closed trades | Win rate | Avg R | Total R | Avg sessions held | Skipped |
|---|---|---|---|---|---|---|
| acquisition-news · main · 1 set | 1743 | 37% | -0.01 | -16 | 17 | 4 |
| acquisition-news · main · 2 confirm | 1030 | 32% | -0.11 | -111 | 16 | 4 |
| bulk-deal-buy · main · 1 set | 881 | 40% | +0.09 | +76 | 17 | 424 |
| bulk-deal-buy · main · 2 confirm | 463 | 33% | -0.11 | -53 | 16 | 212 |
| bulk-deal-buy · sme · 1 set | 40 | 25% | -0.24 | -10 | 12 | 33 |
| bulk-deal-buy · sme · 2 confirm | 30 | 17% | -0.36 | -11 | 10 | 37 |
| insider-buy · main · 1 set | 353 | 35% | +0.18 | +63 | 28 | 115 |
| insider-buy · main · 2 confirm | 199 | 33% | +0.08 | +15 | 23 | 39 |
| insider-buy · sme · 1 set | 23 | 39% | +0.24 | +6 | 24 | 16 |
| insider-buy · sme · 2 confirm | 12 | 25% | -0.18 | -2 | 28 | 3 |
| leader-pullback · main · 1 set | 3407 | 34% | -0.02 | -55 | 17 | 1357 |
| leader-pullback · main · 2 confirm | 1694 | 31% | -0.09 | -158 | 16 | 473 |
| leader-pullback · sme · 1 set | 268 | 33% | -0.16 | -43 | 16 | 210 |
| leader-pullback · sme · 2 confirm | 251 | 37% | +0.02 | +5 | 14 | 190 |
| new-listing-breakout · main · 1 set | 316 | 35% | +0.02 | +5 | 16 | 261 |
| new-listing-breakout · main · 2 confirm | 247 | 38% | +0.11 | +28 | 16 | 170 |
| new-listing-breakout · sme · 1 set | 234 | 31% | -0.08 | -18 | 12 | 545 |
| new-listing-breakout · sme · 2 confirm | 92 | 38% | +0.36 | +33 | 15 | 93 |
| results-day · main · 1 set | 652 | 30% | +0.03 | +18 | 23 | 371 |
| results-day · main · 2 confirm | 388 | 21% | -0.25 | -97 | 19 | 251 |
| sector-leader · main · 1 set | 547 | 39% | +0.10 | +57 | 17 | 127 |
| sector-leader · main · 2 confirm | 270 | 32% | -0.08 | -22 | 15 | 41 |
| stage2-tight · main · 1 set | 5666 | 39% | +0.12 | +678 | 17 | 1327 |
| stage2-tight · main · 2 confirm | 1733 | 35% | -0.04 | -62 | 17 | 315 |
| stage2-tight · sme · 1 set | 363 | 31% | -0.13 | -46 | 15 | 373 |
| stage2-tight · sme · 2 confirm | 336 | 35% | +0.01 | +4 | 14 | 232 |

## Swing rules — by market type and period (market type is measured on the main board)
| Group | Closed trades | Win rate | Avg R | Total R | Avg sessions held | Skipped |
|---|---|---|---|---|---|---|
| acquisition-news · main · neutral · 1 set | 756 | 36% | -0.06 | -45 | 17 | 2 |
| acquisition-news · main · neutral · 2 confirm | 457 | 28% | -0.25 | -115 | 16 | 3 |
| acquisition-news · main · strong · 1 set | 539 | 37% | +0.04 | +22 | 17 | 2 |
| acquisition-news · main · strong · 2 confirm | 205 | 38% | +0.05 | +11 | 17 | 1 |
| acquisition-news · main · weak · 1 set | 448 | 38% | +0.02 | +7 | 17 | 0 |
| acquisition-news · main · weak · 2 confirm | 368 | 33% | -0.02 | -7 | 15 | 0 |
| bulk-deal-buy · main · neutral · 1 set | 412 | 38% | +0.03 | +12 | 17 | 182 |
| bulk-deal-buy · main · neutral · 2 confirm | 186 | 28% | -0.17 | -31 | 16 | 110 |
| bulk-deal-buy · main · strong · 1 set | 293 | 43% | +0.16 | +47 | 18 | 173 |
| bulk-deal-buy · main · strong · 2 confirm | 89 | 47% | +0.30 | +27 | 19 | 45 |
| bulk-deal-buy · main · weak · 1 set | 176 | 39% | +0.10 | +17 | 19 | 69 |
| bulk-deal-buy · main · weak · 2 confirm | 188 | 30% | -0.26 | -49 | 14 | 57 |
| bulk-deal-buy · sme · neutral · 1 set | 22 | 27% | -0.30 | -7 | 14 | 14 |
| bulk-deal-buy · sme · neutral · 2 confirm | 14 | 7% | -0.74 | -10 | 10 | 23 |
| bulk-deal-buy · sme · strong · 1 set | 7 | 14% | -0.47 | -3 | 13 | 12 |
| bulk-deal-buy · sme · strong · 2 confirm | 2 | 50% | +0.93 | +2 | 10 | 6 |
| bulk-deal-buy · sme · weak · 1 set | 11 | 27% | +0.01 | +0 | 5 | 7 |
| bulk-deal-buy · sme · weak · 2 confirm | 14 | 21% | -0.15 | -2 | 11 | 8 |
| insider-buy · main · neutral · 1 set | 143 | 28% | -0.07 | -10 | 25 | 53 |
| insider-buy · main · neutral · 2 confirm | 57 | 11% | -0.58 | -33 | 20 | 10 |
| insider-buy · main · strong · 1 set | 83 | 41% | +0.51 | +42 | 26 | 20 |
| insider-buy · main · strong · 2 confirm | 1 | 0% | -1.05 | -1 | 24 | 0 |
| insider-buy · main · weak · 1 set | 127 | 40% | +0.24 | +31 | 33 | 42 |
| insider-buy · main · weak · 2 confirm | 141 | 42% | +0.35 | +49 | 25 | 29 |
| insider-buy · sme · neutral · 1 set | 8 | 25% | -0.02 | -0 | 16 | 5 |
| insider-buy · sme · neutral · 2 confirm | 6 | 33% | +0.04 | +0 | 33 | 0 |
| insider-buy · sme · strong · 1 set | 4 | 50% | +0.41 | +2 | 25 | 5 |
| insider-buy · sme · weak · 1 set | 11 | 45% | +0.37 | +4 | 30 | 6 |
| insider-buy · sme · weak · 2 confirm | 6 | 17% | -0.40 | -2 | 22 | 3 |
| leader-pullback · main · neutral · 1 set | 1780 | 33% | -0.04 | -79 | 17 | 681 |
| leader-pullback · main · neutral · 2 confirm | 835 | 31% | -0.13 | -108 | 16 | 254 |
| leader-pullback · main · strong · 1 set | 864 | 37% | +0.10 | +84 | 16 | 404 |
| leader-pullback · main · strong · 2 confirm | 268 | 41% | +0.18 | +48 | 18 | 83 |
| leader-pullback · main · weak · 1 set | 763 | 35% | -0.08 | -60 | 17 | 272 |
| leader-pullback · main · weak · 2 confirm | 591 | 28% | -0.16 | -97 | 15 | 136 |
| leader-pullback · sme · neutral · 1 set | 125 | 30% | -0.29 | -36 | 16 | 102 |
| leader-pullback · sme · neutral · 2 confirm | 105 | 33% | -0.17 | -18 | 14 | 99 |
| leader-pullback · sme · strong · 1 set | 64 | 36% | +0.02 | +1 | 17 | 60 |
| leader-pullback · sme · strong · 2 confirm | 48 | 52% | +0.52 | +25 | 17 | 23 |
| leader-pullback · sme · weak · 1 set | 79 | 37% | -0.10 | -8 | 15 | 48 |
| leader-pullback · sme · weak · 2 confirm | 98 | 33% | -0.02 | -2 | 13 | 68 |
| new-listing-breakout · main · neutral · 1 set | 158 | 34% | -0.09 | -14 | 16 | 107 |
| new-listing-breakout · main · neutral · 2 confirm | 120 | 38% | +0.01 | +1 | 16 | 89 |
| new-listing-breakout · main · strong · 1 set | 140 | 37% | +0.16 | +22 | 15 | 133 |
| new-listing-breakout · main · strong · 2 confirm | 77 | 40% | +0.27 | +21 | 16 | 55 |
| new-listing-breakout · main · weak · 1 set | 18 | 33% | -0.18 | -3 | 18 | 21 |
| new-listing-breakout · main · weak · 2 confirm | 50 | 34% | +0.12 | +6 | 14 | 26 |
| new-listing-breakout · sme · neutral · 1 set | 108 | 31% | -0.00 | -0 | 13 | 216 |
| new-listing-breakout · sme · neutral · 2 confirm | 53 | 45% | +0.50 | +27 | 14 | 35 |
| new-listing-breakout · sme · strong · 1 set | 96 | 25% | -0.29 | -28 | 11 | 294 |
| new-listing-breakout · sme · strong · 2 confirm | 19 | 37% | +0.61 | +12 | 18 | 34 |
| new-listing-breakout · sme · weak · 1 set | 30 | 53% | +0.33 | +10 | 13 | 35 |
| new-listing-breakout · sme · weak · 2 confirm | 20 | 20% | -0.26 | -5 | 15 | 24 |
| results-day · main · neutral · 1 set | 253 | 34% | +0.21 | +52 | 22 | 152 |
| results-day · main · neutral · 2 confirm | 197 | 21% | -0.22 | -44 | 19 | 124 |
| results-day · main · strong · 1 set | 155 | 30% | +0.06 | +10 | 20 | 121 |
| results-day · main · strong · 2 confirm | 98 | 33% | +0.13 | +13 | 21 | 77 |
| results-day · main · weak · 1 set | 244 | 26% | -0.18 | -43 | 26 | 98 |
| results-day · main · weak · 2 confirm | 93 | 10% | -0.71 | -66 | 16 | 50 |
| sector-leader · main · neutral · 1 set | 255 | 34% | -0.04 | -10 | 16 | 57 |
| sector-leader · main · neutral · 2 confirm | 100 | 27% | -0.20 | -20 | 16 | 16 |
| sector-leader · main · strong · 1 set | 181 | 39% | +0.14 | +26 | 17 | 50 |
| sector-leader · main · strong · 2 confirm | 67 | 45% | +0.32 | +22 | 16 | 17 |
| sector-leader · main · weak · 1 set | 111 | 50% | +0.37 | +41 | 19 | 20 |
| sector-leader · main · weak · 2 confirm | 103 | 29% | -0.23 | -24 | 12 | 8 |
| stage2-tight · main · neutral · 1 set | 2326 | 33% | -0.05 | -122 | 17 | 536 |
| stage2-tight · main · neutral · 2 confirm | 877 | 33% | -0.09 | -79 | 17 | 188 |
| stage2-tight · main · strong · 1 set | 2756 | 42% | +0.25 | +698 | 18 | 621 |
| stage2-tight · main · strong · 2 confirm | 406 | 48% | +0.41 | +167 | 19 | 68 |
| stage2-tight · main · weak · 1 set | 584 | 45% | +0.17 | +101 | 19 | 170 |
| stage2-tight · main · weak · 2 confirm | 450 | 25% | -0.34 | -151 | 15 | 59 |
| stage2-tight · sme · neutral · 1 set | 180 | 34% | -0.01 | -2 | 15 | 162 |
| stage2-tight · sme · neutral · 2 confirm | 164 | 32% | -0.00 | -1 | 14 | 124 |
| stage2-tight · sme · strong · 1 set | 116 | 25% | -0.26 | -30 | 14 | 138 |
| stage2-tight · sme · strong · 2 confirm | 63 | 56% | +0.72 | +45 | 16 | 42 |
| stage2-tight · sme · weak · 1 set | 67 | 30% | -0.21 | -14 | 14 | 73 |
| stage2-tight · sme · weak · 2 confirm | 109 | 26% | -0.37 | -40 | 12 | 66 |

## Intraday rules — by rule, board and period
| Group | Closed trades | Win rate | Avg R | Total R | Avg sessions held | Skipped |
|---|---|---|---|---|---|---|
| intraday-accumulation · main · 1 set | 8365 | 29% | -0.23 | -1947 | 0 | 70 |
| intraday-accumulation · main · 2 confirm | 3687 | 31% | -0.19 | -709 | 0 | 29 |
| intraday-accumulation · sme · 1 set | 1499 | 29% | -0.23 | -347 | 0 | 135 |
| intraday-accumulation · sme · 2 confirm | 823 | 34% | -0.06 | -50 | 0 | 60 |
| intraday-results-gap · main · 1 set | 6991 | 23% | -0.35 | -2442 | 0 | 46 |
| intraday-results-gap · main · 2 confirm | 4272 | 23% | -0.34 | -1445 | 0 | 20 |
| intraday-stage2 · main · 1 set | 55095 | 34% | -0.20 | -11107 | 0 | 83 |
| intraday-stage2 · main · 2 confirm | 17677 | 36% | -0.18 | -3190 | 0 | 54 |
| intraday-stage2 · sme · 1 set | 3184 | 32% | -0.11 | -341 | 0 | 360 |
| intraday-stage2 · sme · 2 confirm | 3128 | 34% | -0.10 | -301 | 0 | 250 |

## Long-term screen (top 20 by 12-month return ÷ volatility, above the 200-day average, every 21 sessions)
| Held | Rebalances | Picks' avg return | All stocks' avg return | Picks beat the market |
|---|---|---|---|---|
| 126 sessions | 27 | +7.4% | +2.3% | 19 of 27 |
| 252 sessions | 21 | +15.1% | -1.5% | 20 of 21 |

Picks made in period 2 only (2025-11-01 →; a 252-session hold can't finish yet):
| Held | Rebalances | Picks' avg return | All stocks' avg return | Picks beat the market |
|---|---|---|---|---|
| 126 sessions | 6 | +10.5% | +10.6% | 3 of 6 |
| 252 sessions | 0 | – | – | – |

## One account — 10% cap on open risk, % of capital per year (simple, not compounded)
Kept (period 1: ≥ 30 trades and ≥ +0.05R a trade), sized: results-day · main · neutral (0.5%); insider-buy · main · strong (1%); bulk-deal-buy · main · strong (1%); new-listing-breakout · main · strong (1%); stage2-tight · main · strong (1%); sector-leader · main · strong (1%); leader-pullback · main · strong (1%); results-day · main · strong (1%); stage2-tight · main · weak (0.25%); bulk-deal-buy · main · weak (0.25%); insider-buy · main · weak (0.25%); sector-leader · main · weak (0.25%); new-listing-breakout · sme · weak (0.25%)

Strong market only: insider-buy · main · strong (1%); bulk-deal-buy · main · strong (1%); new-listing-breakout · main · strong (1%); stage2-tight · main · strong (1%); sector-leader · main · strong (1%); leader-pullback · main · strong (1%); results-day · main · strong (1%)

Period 1 (rules chosen here):
| Setup | Trades | Skipped (risk cap) | 2023 | 2024 | 2025 | 2026 | Total | Worst drop from a peak |
|---|---|---|---|---|---|---|---|---|
| Before (pushed 18 Nov morning): stage2-tight, main board, 1% / 0.5% / 0.25% | 590 | 5076 | +6.1% | +22.3% | -26.1% | +1.5% | +3.8% | −46.1% |
| **Live now** (strategies.ts LIVE_RISK_PERCENT) | 140 | 4285 | +0.5% | +38.6% | +7.3% | +0.0% | +46.3% | −16.8% |
| Kept rules, sized by market type | 600 | 5040 | +19.6% | +29.5% | -13.1% | -0.4% | +35.7% | −37.0% |
| Kept rules, strong market only | 140 | 4285 | +0.5% | +38.6% | +7.3% | +0.0% | +46.3% | −16.8% |

Period 2 only (2025-11-01 →, the check):
| Setup | Trades | Skipped (risk cap) | 2025 | 2026 | Total | Worst drop from a peak |
|---|---|---|---|---|---|---|
| Before (pushed 18 Nov morning): stage2-tight, main board, 1% / 0.5% / 0.25% | 333 | 1400 | +0.5% | -1.5% | -0.9% | −15.1% |
| **Live now** (strategies.ts LIVE_RISK_PERCENT) | 53 | 936 | +0.0% | +38.2% | +38.2% | −4.3% |
| Kept rules, sized by market type | 370 | 1682 | -6.2% | +12.1% | +6.0% | −26.4% |
| Kept rules, strong market only | 53 | 936 | +0.0% | +38.2% | +38.2% | −4.3% |

## Big moves — whole period (2023-11-01 → 2026-11-17), all swing rules
**Rises of 20%+ within 30 sessions since 2023-11-01: 21378** (16493 in stocks the scan covered that day)

| Result | Moves | Examples |
|---|---|---|
| missed: no rule fired | 11130 (52%) | 20MICRONS +26% from 2024-03-13; 20MICRONS +23% from 2025-02-11; 20MICRONS +23% from 2025-03-17; 20MICRONS +22% from 2025-06-10; 20MICRONS +22% from 2026-03-16; 3IINFOLTD +30% from 2023-11-01 |
| caught | 4864 (23%) | 20MICRONS +27% from 2024-05-08; 20MICRONS +31% from 2024-06-24; 20MICRONS +23% from 2024-08-05; 20MICRONS +22% from 2026-05-18; 20MICRONS +21% from 2026-08-11; 3IINFOLTD +20% from 2023-11-24 |
| missed: not scanned (turnover under ₹50 lakh) | 2895 (14%) | 21STCENMGM +64% from 2023-11-01; 21STCENMGM +165% from 2023-12-18; 21STCENMGM +22% from 2025-11-14; 21STCENMGM +22% from 2026-03-25; 21STCENMGM +21% from 2026-06-12; 21STCENMGM +27% from 2026-09-03 |
| missed: not scanned (SME, turnover under ₹10 lakh) | 1406 (7%) | AISL +21% from 2023-11-17; AISL +22% from 2024-02-02; AISL +25% from 2024-02-19; AISL +20% from 2025-02-07; AISL +25% from 2025-04-25; AISL +21% from 2025-07-09 |
| rule fired but skipped (above buy limit) | 709 (3%) | 3MINDIA +21% from 2024-04-29; AAREYDRUGS +38% from 2024-07-16; AAVAS +22% from 2024-03-13; ABB +22% from 2024-01-24; ADANIENT +26% from 2026-04-29; ADORWELD +24% from 2024-06-04 |
| missed: too new (under 6 sessions) | 326 (2%) | CCCL +47% from 2024-09-10; DOLPHIN +29% from 2024-04-15; ARE&M +26% from 2023-11-01; SICALLOG +22% from 2026-07-01; SAMPANN +44% from 2023-11-01; TCLCONS +123% from 2023-11-01 |
| rule fired but skipped (locked at upper limit) | 48 (0%) | DHRUV +37% from 2024-02-06; E2E +28% from 2025-03-25; GTLINFRA +28% from 2024-02-02; INDOTECH +21% from 2025-04-04; KPIGREEN +49% from 2024-01-31; OMAXAUTO +97% from 2024-01-03 |

Caught, by rule (a move can be caught by more than one rule; R = what the trade made, closed trades only):

| Rule | Moves caught | Avg R on those trades |
|---|---|---|
| stage2-tight | 2889 | +1.23 |
| leader-pullback | 2072 | +1.01 |
| acquisition-news | 806 | +1.12 |
| new-listing-breakout | 447 | +0.84 |
| bulk-deal-buy | 418 | +1.15 |
| results-day | 398 | +0.76 |
| sector-leader | 300 | +1.09 |
| insider-buy | 223 | +1.26 |

**Falls of 20%+ within 30 sessions since 2023-11-01: 15208.** A swing trade was open (or bought) during 3639 of them (23.9%); those trades made -3598R in total (stops limit the damage).

## Final test — the last year (2025-11-17 → 2026-11-17), all swing rules
| Group | Closed trades | Win rate | Avg R | Total R | Avg sessions held | Skipped |
|---|---|---|---|---|---|---|
| acquisition-news · main | 979 | 32% | -0.08 | -82 | 16 | 4 |
| bulk-deal-buy · main | 444 | 33% | -0.10 | -45 | 16 | 206 |
| bulk-deal-buy · sme | 27 | 19% | -0.25 | -7 | 11 | 35 |
| insider-buy · main | 191 | 34% | +0.12 | +22 | 24 | 38 |
| insider-buy · sme | 12 | 25% | -0.18 | -2 | 28 | 3 |
| leader-pullback · main | 1626 | 31% | -0.10 | -160 | 16 | 463 |
| leader-pullback · sme | 242 | 37% | +0.03 | +7 | 14 | 188 |
| new-listing-breakout · main | 237 | 38% | +0.10 | +24 | 16 | 162 |
| new-listing-breakout · sme | 86 | 40% | +0.41 | +35 | 15 | 84 |
| results-day · main | 326 | 24% | -0.15 | -47 | 19 | 230 |
| sector-leader · main | 266 | 32% | -0.08 | -22 | 15 | 41 |
| stage2-tight · main | 1661 | 34% | -0.04 | -61 | 17 | 306 |
| stage2-tight · sme | 323 | 35% | +0.04 | +14 | 14 | 225 |

**Rises of 20%+ within 30 sessions since 2025-11-17: 7641** (5338 in stocks the scan covered that day)

| Result | Moves | Examples |
|---|---|---|
| missed: no rule fired | 3759 (49%) | 20MICRONS +22% from 2026-03-16; 3IINFOLTD +21% from 2026-02-25; 3IINFOLTD +24% from 2026-06-10; 3IINFOLTD +40% from 2026-07-24; 5PAISA +22% from 2025-12-03; 5PAISA +22% from 2026-03-23 |
| caught | 1469 (19%) | 20MICRONS +22% from 2026-05-18; 20MICRONS +21% from 2026-08-11; 63MOONS +29% from 2026-07-14; 63MOONS +22% from 2026-10-05; AAREYDRUGS +22% from 2026-01-12; AAREYDRUGS +22% from 2026-03-02 |
| missed: not scanned (turnover under ₹50 lakh) | 1338 (18%) | 21STCENMGM +24% from 2025-11-17; 21STCENMGM +22% from 2026-03-25; 21STCENMGM +21% from 2026-06-12; 21STCENMGM +27% from 2026-09-03; 21STCENMGM +25% from 2026-10-21; 3PLAND +23% from 2026-03-16 |
| missed: not scanned (SME, turnover under ₹10 lakh) | 733 (10%) | AISL +23% from 2026-06-01; AISL +21% from 2026-08-05; AISL +35% from 2026-10-09; AMIABLE +50% from 2025-11-17; AMIABLE +24% from 2026-03-25; AMIABLE +28% from 2026-05-11 |
| rule fired but skipped (above buy limit) | 195 (3%) | ADANIENT +26% from 2026-04-29; ALLCARGO +44% from 2026-08-07; APLLTD +23% from 2026-09-28; APOLLOPIPE +23% from 2026-01-14; ASTRAMICRO +33% from 2026-04-28; AUSOMENT +31% from 2026-05-18 |
| missed: too new (under 6 sessions) | 136 (2%) | SICALLOG +22% from 2026-07-01; DIGJAMLMTD +32% from 2025-12-09; TEAMGTY +29% from 2025-11-17; CAPILLARY +21% from 2025-11-21; MEESHO +38% from 2025-12-10; WAAREEINDO +35% from 2026-04-06 |
| rule fired but skipped (locked at upper limit) | 11 (0%) | TERASOFT +26% from 2026-01-27; EXCEL +32% from 2025-12-08; IBULLSLTD +21% from 2026-08-21; GRETEX +35% from 2025-11-17; MOS +21% from 2026-09-09; AGUL +21% from 2026-02-06 |

Caught, by rule (a move can be caught by more than one rule; R = what the trade made, closed trades only):

| Rule | Moves caught | Avg R on those trades |
|---|---|---|
| stage2-tight | 695 | +1.17 |
| leader-pullback | 692 | +1.00 |
| acquisition-news | 298 | +1.03 |
| new-listing-breakout | 170 | +1.12 |
| bulk-deal-buy | 156 | +1.03 |
| results-day | 128 | +0.84 |
| sector-leader | 79 | +1.14 |
| insider-buy | 69 | +1.35 |

**Falls of 20%+ within 30 sessions since 2025-11-17: 6000.** A swing trade was open (or bought) during 1155 of them (19.3%); those trades made -1301R in total (stops limit the damage).


Every rise, with its result: `backtest/moves-up.csv` (symbol, board, start, peak, %, result, rules that caught it).