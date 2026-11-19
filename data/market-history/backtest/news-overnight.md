# Overnight company news — bought at the next open (2023-11-01 → 2026-11-17)

A material NSE filing (lenses.ts's classifier: acquisition, order, fund raise, rating change, regulatory action…; results are excluded — they have their own rules) made after a session's close and before the next open, on a stock liquid enough to scan. Bought at that open, which is the price the 9:09 pre-open check shows; no buy limit, since the news is the reason for the gap. Period 1 sets which cells are kept; period 2 confirms them.

**Kept cells (filing type · gap · market type):** swing · main · acquisition · below 0% · strong; swing · main · acquisition · 0–2% · strong; swing · main · acquisition · 2–5% · weak; swing · main · corporate action · below 0% · weak; swing · main · corporate action · 0–2% · weak; swing · main · corporate action · 2–5% · weak; swing · main · rating change · below 0% · weak; swing · main · regulatory · below 0% · strong; swing · main · regulatory · below 0% · weak; swing · main · regulatory · 2–5% · weak; intraday · main · corporate action · below 0% · strong; intraday · main · rating change · below 0% · weak; intraday · main · regulatory · 2–5% · weak

## Swing (2× daily range stop, 3R target, hold 30 sessions) — main board

Each cell: trades · average R after costs · win rate · average open→close move on day 1. ✅ = kept (period 1: ≥ 30 trades and ≥ +0.05R a trade; period 2: ≥ 10 trades and positive in total).

| Filing type | Gap at the open | Market | Period 1 (set) | Period 2 (confirm) | |
|---|---|---|---|---|---|
| acquisition | below 0% | strong | 135 · +0.16R · 39% · day 1 +0.0% | 70 · +0.05R · 39% · day 1 -0.0% | ✅ |
| acquisition | below 0% | neutral | 246 · -0.01R · 37% · day 1 -0.1% | 173 · +0.19R · 41% · day 1 -0.0% |  |
| acquisition | below 0% | weak | 218 · +0.20R · 46% · day 1 +0.3% | 153 · -0.03R · 34% · day 1 -0.5% |  |
| acquisition | below 0% | all | 599 · +0.11R · 41% · day 1 +0.1% | 396 · +0.08R · 38% · day 1 -0.2% | ✅ |
| acquisition | 0–2% | strong | 498 · +0.08R · 39% · day 1 -0.2% | 186 · +0.04R · 39% · day 1 -0.2% | ✅ |
| acquisition | 0–2% | neutral | 686 · -0.15R · 33% · day 1 -0.2% | 375 · -0.44R · 23% · day 1 -0.3% |  |
| acquisition | 0–2% | weak | 321 · -0.07R · 36% · day 1 -0.1% | 268 · -0.08R · 31% · day 1 -0.4% |  |
| acquisition | 0–2% | all | 1505 · -0.05R · 35% · day 1 -0.1% | 829 · -0.21R · 29% · day 1 -0.3% |  |
| acquisition | 2–5% | strong | 70 · -0.29R · 29% · day 1 -1.3% | 25 · +0.15R · 36% · day 1 -1.4% |  |
| acquisition | 2–5% | neutral | 86 · -0.16R · 30% · day 1 -0.9% | 56 · -0.29R · 27% · day 1 -1.0% |  |
| acquisition | 2–5% | weak | 49 · +0.29R · 43% · day 1 -0.1% | 36 · +0.31R · 47% · day 1 -0.0% | ✅ |
| acquisition | 2–5% | all | 205 · -0.10R · 33% · day 1 -0.8% | 117 · -0.01R · 35% · day 1 -0.8% |  |
| acquisition | 5–10% | strong | 20 · +0.23R · 35% · day 1 +0.0% | 2 · -0.19R · 50% · day 1 -3.8% |  |
| acquisition | 5–10% | neutral | 15 · -0.13R · 27% · day 1 -0.7% | 11 · -0.32R · 36% · day 1 -2.0% |  |
| acquisition | 5–10% | weak | 10 · +1.47R · 60% · day 1 -1.9% | 10 · +1.66R · 80% · day 1 +2.2% |  |
| acquisition | 5–10% | all | 45 · +0.39R · 38% · day 1 -0.7% | 23 · +0.55R · 57% · day 1 -0.3% | ✅ |
| acquisition | 10%+ | strong | 2 · -0.05R · 50% · day 1 -3.8% | 4 · +1.96R · 75% · day 1 +3.0% |  |
| acquisition | 10%+ | neutral | 2 · +0.04R · 100% · day 1 +5.2% | 1 · -1.03R · 0% · day 1 -9.9% |  |
| acquisition | 10%+ | all | 4 · -0.01R · 75% · day 1 +0.7% | 5 · +1.36R · 60% · day 1 +0.4% |  |
| acquisition | all gaps | strong | 725 · +0.07R · 38% · day 1 -0.2% | 287 · +0.08R · 39% · day 1 -0.2% | ✅ |
| acquisition | all gaps | neutral | 1035 · -0.11R · 33% · day 1 -0.2% | 616 · -0.25R · 28% · day 1 -0.3% |  |
| acquisition | all gaps | weak | 598 · +0.08R · 40% · day 1 +0.0% | 467 · +0.01R · 34% · day 1 -0.3% | ✅ |
| acquisition | all gaps | all | 2358 · -0.01R · 37% · day 1 -0.2% | 1370 · -0.09R · 33% · day 1 -0.3% |  |
| any | below 0% | strong | 1366 · -0.01R · 34% · day 1 -0.2% | 705 · -0.04R · 36% · day 1 -0.4% |  |
| any | below 0% | neutral | 2267 · -0.15R · 31% · day 1 -0.1% | 1805 · -0.15R · 30% · day 1 -0.1% |  |
| any | below 0% | weak | 1706 · +0.12R · 43% · day 1 +0.2% | 1438 · -0.04R · 34% · day 1 -0.4% |  |
| any | below 0% | all | 5339 · -0.03R · 36% · day 1 -0.0% | 3948 · -0.09R · 32% · day 1 -0.3% |  |
| any | 0–2% | strong | 4168 · -0.04R · 34% · day 1 -0.3% | 1643 · +0.01R · 37% · day 1 -0.3% |  |
| any | 0–2% | neutral | 4910 · -0.22R · 29% · day 1 -0.4% | 3008 · -0.28R · 27% · day 1 -0.2% |  |
| any | 0–2% | weak | 2502 · +0.04R · 40% · day 1 -0.1% | 1933 · -0.19R · 29% · day 1 -0.2% |  |
| any | 0–2% | all | 11580 · -0.10R · 33% · day 1 -0.3% | 6584 · -0.18R · 30% · day 1 -0.3% |  |
| any | 2–5% | strong | 686 · -0.19R · 28% · day 1 -0.9% | 265 · -0.22R · 29% · day 1 -0.6% |  |
| any | 2–5% | neutral | 800 · -0.27R · 26% · day 1 -0.9% | 577 · -0.13R · 31% · day 1 -0.8% |  |
| any | 2–5% | weak | 599 · +0.14R · 41% · day 1 -0.4% | 424 · +0.23R · 41% · day 1 -0.4% | ✅ |
| any | 2–5% | all | 2085 · -0.13R · 31% · day 1 -0.7% | 1266 · -0.03R · 34% · day 1 -0.6% |  |
| any | 5–10% | strong | 131 · -0.24R · 25% · day 1 -1.3% | 62 · +0.22R · 37% · day 1 -0.7% |  |
| any | 5–10% | neutral | 153 · -0.17R · 26% · day 1 -1.2% | 151 · -0.24R · 30% · day 1 -0.8% |  |
| any | 5–10% | weak | 118 · +0.04R · 37% · day 1 -0.9% | 94 · +0.34R · 40% · day 1 -0.0% |  |
| any | 5–10% | all | 402 · -0.13R · 29% · day 1 -1.1% | 307 · +0.03R · 35% · day 1 -0.5% |  |
| any | 10%+ | strong | 36 · -0.16R · 36% · day 1 -1.4% | 19 · +0.33R · 42% · day 1 -0.5% |  |
| any | 10%+ | neutral | 22 · +0.05R · 36% · day 1 -1.1% | 28 · -0.30R · 18% · day 1 -4.5% |  |
| any | 10%+ | weak | 14 · +0.63R · 43% · day 1 -2.9% | 6 · -1.04R · 0% · day 1 -5.7% |  |
| any | 10%+ | all | 72 · +0.06R · 38% · day 1 -1.6% | 53 · -0.16R · 25% · day 1 -3.2% |  |
| any | all gaps | strong | 6387 · -0.05R · 33% · day 1 -0.4% | 2694 · -0.02R · 36% · day 1 -0.4% |  |
| any | all gaps | neutral | 8152 · -0.20R · 29% · day 1 -0.4% | 5569 · -0.22R · 28% · day 1 -0.3% |  |
| any | all gaps | weak | 4939 · +0.08R · 41% · day 1 -0.1% | 3895 · -0.08R · 32% · day 1 -0.3% |  |
| any | all gaps | all | 19478 · -0.08R · 34% · day 1 -0.3% | 12158 · -0.13R · 31% · day 1 -0.3% |  |
| corporate action | below 0% | strong | 380 · -0.00R · 35% · day 1 +0.3% | 202 · +0.08R · 45% · day 1 +0.4% |  |
| corporate action | below 0% | neutral | 613 · -0.08R · 34% · day 1 +0.1% | 365 · +0.19R · 40% · day 1 +0.0% |  |
| corporate action | below 0% | weak | 246 · +0.38R · 52% · day 1 +0.9% | 212 · +0.16R · 42% · day 1 -0.5% | ✅ |
| corporate action | below 0% | all | 1239 · +0.04R · 38% · day 1 +0.3% | 779 · +0.15R · 42% · day 1 -0.0% |  |
| corporate action | 0–2% | strong | 1419 · -0.18R · 30% · day 1 -0.3% | 517 · +0.13R · 40% · day 1 -0.1% |  |
| corporate action | 0–2% | neutral | 1170 · -0.12R · 33% · day 1 -0.2% | 637 · -0.04R · 38% · day 1 -0.0% |  |
| corporate action | 0–2% | weak | 436 · +0.14R · 44% · day 1 +0.2% | 289 · +0.09R · 40% · day 1 +0.1% | ✅ |
| corporate action | 0–2% | all | 3025 · -0.11R · 33% · day 1 -0.2% | 1443 · +0.05R · 39% · day 1 -0.0% |  |
| corporate action | 2–5% | strong | 90 · -0.53R · 23% · day 1 -1.0% | 31 · -0.25R · 32% · day 1 -1.3% |  |
| corporate action | 2–5% | neutral | 96 · +0.01R · 32% · day 1 -0.6% | 99 · +0.31R · 45% · day 1 -0.3% |  |
| corporate action | 2–5% | weak | 94 · +0.30R · 47% · day 1 +0.4% | 49 · +0.58R · 51% · day 1 -0.4% | ✅ |
| corporate action | 2–5% | all | 280 · -0.07R · 34% · day 1 -0.4% | 179 · +0.28R · 45% · day 1 -0.5% |  |
| corporate action | 5–10% | strong | 14 · -0.67R · 14% · day 1 -3.1% | 5 · +0.10R · 40% · day 1 -1.5% |  |
| corporate action | 5–10% | neutral | 20 · -0.58R · 15% · day 1 -2.6% | 14 · -0.13R · 50% · day 1 -0.2% |  |
| corporate action | 5–10% | weak | 11 · +0.54R · 45% · day 1 -0.6% | 6 · +0.56R · 50% · day 1 +1.5% |  |
| corporate action | 5–10% | all | 45 · -0.34R · 22% · day 1 -2.2% | 25 · +0.08R · 48% · day 1 -0.0% |  |
| corporate action | 10%+ | strong | 3 · +0.31R · 33% · day 1 -5.0% | – |  |
| corporate action | 10%+ | neutral | 4 · -1.04R · 0% · day 1 -2.5% | 4 · +0.21R · 25% · day 1 -3.7% |  |
| corporate action | 10%+ | weak | 3 · +1.29R · 67% · day 1 -2.8% | 1 · -1.05R · 0% · day 1 +1.5% |  |
| corporate action | 10%+ | all | 10 · +0.06R · 30% · day 1 -3.3% | 5 · -0.04R · 20% · day 1 -2.6% |  |
| corporate action | all gaps | strong | 1906 · -0.16R · 30% · day 1 -0.2% | 755 · +0.10R · 41% · day 1 -0.0% |  |
| corporate action | all gaps | neutral | 1903 · -0.11R · 33% · day 1 -0.2% | 1119 · +0.07R · 40% · day 1 -0.0% |  |
| corporate action | all gaps | weak | 790 · +0.24R · 47% · day 1 +0.4% | 557 · +0.16R · 42% · day 1 -0.1% | ✅ |
| corporate action | all gaps | all | 4599 · -0.07R · 34% · day 1 -0.1% | 2431 · +0.10R · 41% · day 1 -0.1% |  |
| expansion | below 0% | strong | 12 · +0.12R · 42% · day 1 +1.0% | 18 · +0.43R · 56% · day 1 +0.1% |  |
| expansion | below 0% | neutral | 21 · -0.46R · 14% · day 1 -0.1% | 31 · +0.26R · 42% · day 1 +0.2% |  |
| expansion | below 0% | weak | 32 · -0.07R · 28% · day 1 -0.7% | 42 · +0.44R · 43% · day 1 -0.1% |  |
| expansion | below 0% | all | 65 · -0.16R · 26% · day 1 -0.2% | 91 · +0.38R · 45% · day 1 +0.1% |  |
| expansion | 0–2% | strong | 47 · -0.02R · 34% · day 1 +0.2% | 38 · +0.09R · 50% · day 1 -0.9% |  |
| expansion | 0–2% | neutral | 85 · -0.63R · 15% · day 1 -0.5% | 93 · -0.14R · 31% · day 1 +0.1% |  |
| expansion | 0–2% | weak | 69 · +0.02R · 36% · day 1 -0.0% | 57 · +0.22R · 39% · day 1 +0.0% |  |
| expansion | 0–2% | all | 201 · -0.27R · 27% · day 1 -0.2% | 188 · +0.02R · 37% · day 1 -0.1% |  |
| expansion | 2–5% | strong | – | 14 · +0.18R · 43% · day 1 -0.1% |  |
| expansion | 2–5% | neutral | 11 · -0.56R · 18% · day 1 -1.0% | 14 · -0.02R · 36% · day 1 -0.1% |  |
| expansion | 2–5% | weak | 7 · +0.05R · 43% · day 1 +0.2% | 15 · +1.13R · 67% · day 1 +1.5% |  |
| expansion | 2–5% | all | 18 · -0.32R · 28% · day 1 -0.5% | 43 · +0.45R · 49% · day 1 +0.5% |  |
| expansion | 5–10% | strong | – | 2 · -0.14R · 50% · day 1 -0.9% |  |
| expansion | 5–10% | neutral | 1 · -1.04R · 0% · day 1 -8.0% | 6 · -0.73R · 17% · day 1 +0.7% |  |
| expansion | 5–10% | weak | 4 · -0.49R · 25% · day 1 -3.1% | 2 · +0.97R · 50% · day 1 -1.4% |  |
| expansion | 5–10% | all | 5 · -0.60R · 20% · day 1 -4.1% | 10 · -0.27R · 30% · day 1 -0.0% |  |
| expansion | 10%+ | strong | – | 1 · -1.03R · 0% · day 1 -4.3% |  |
| expansion | 10%+ | neutral | 1 · +2.18R · 100% · day 1 +2.9% | – |  |
| expansion | 10%+ | weak | 2 · +0.96R · 50% · day 1 -3.4% | – |  |
| expansion | 10%+ | all | 3 · +1.37R · 67% · day 1 -1.3% | 1 · -1.03R · 0% · day 1 -4.3% |  |
| expansion | all gaps | strong | 59 · +0.01R · 36% · day 1 +0.3% | 73 · +0.17R · 49% · day 1 -0.5% |  |
| expansion | all gaps | neutral | 119 · -0.58R · 16% · day 1 -0.5% | 144 · -0.07R · 33% · day 1 +0.1% |  |
| expansion | all gaps | weak | 114 · -0.01R · 34% · day 1 -0.4% | 116 · +0.43R · 44% · day 1 +0.1% |  |
| expansion | all gaps | all | 292 · -0.24R · 27% · day 1 -0.3% | 333 · +0.16R · 41% · day 1 -0.0% |  |
| fund raise | below 0% | strong | 64 · +0.05R · 36% · day 1 +0.1% | 40 · -0.29R · 23% · day 1 -1.0% |  |
| fund raise | below 0% | neutral | 143 · -0.18R · 32% · day 1 -0.2% | 108 · -0.22R · 30% · day 1 +0.1% |  |
| fund raise | below 0% | weak | 85 · +0.25R · 53% · day 1 -0.3% | 79 · -0.41R · 22% · day 1 -0.4% |  |
| fund raise | below 0% | all | 292 · -0.00R · 39% · day 1 -0.2% | 227 · -0.30R · 26% · day 1 -0.3% |  |
| fund raise | 0–2% | strong | 255 · -0.07R · 36% · day 1 -0.6% | 70 · -0.05R · 39% · day 1 -1.1% |  |
| fund raise | 0–2% | neutral | 273 · -0.37R · 25% · day 1 -0.6% | 172 · -0.29R · 27% · day 1 -0.3% |  |
| fund raise | 0–2% | weak | 144 · +0.00R · 38% · day 1 -0.3% | 93 · -0.76R · 11% · day 1 -0.5% |  |
| fund raise | 0–2% | all | 672 · -0.18R · 32% · day 1 -0.5% | 335 · -0.37R · 25% · day 1 -0.5% |  |
| fund raise | 2–5% | strong | 62 · -0.27R · 27% · day 1 -1.4% | 11 · -0.11R · 36% · day 1 -0.4% |  |
| fund raise | 2–5% | neutral | 57 · -0.56R · 19% · day 1 -1.2% | 25 · +0.02R · 36% · day 1 -0.1% |  |
| fund raise | 2–5% | weak | 40 · +0.04R · 40% · day 1 -0.4% | 26 · +0.33R · 38% · day 1 -1.2% |  |
| fund raise | 2–5% | all | 159 · -0.30R · 28% · day 1 -1.1% | 62 · +0.13R · 37% · day 1 -0.6% |  |
| fund raise | 5–10% | strong | 4 · -0.04R · 25% · day 1 -3.2% | 9 · +0.80R · 56% · day 1 +2.8% |  |
| fund raise | 5–10% | neutral | 6 · +1.21R · 67% · day 1 +1.2% | 10 · +0.49R · 50% · day 1 +2.3% |  |
| fund raise | 5–10% | weak | 4 · +0.97R · 50% · day 1 -0.7% | 4 · +2.17R · 100% · day 1 +7.2% |  |
| fund raise | 5–10% | all | 14 · +0.78R · 50% · day 1 -0.6% | 23 · +0.91R · 61% · day 1 +3.3% |  |
| fund raise | 10%+ | strong | 2 · -1.13R · 0% · day 1 -7.2% | 1 · +2.96R · 100% · day 1 +7.6% |  |
| fund raise | 10%+ | neutral | 2 · +0.24R · 50% · day 1 -3.7% | – |  |
| fund raise | 10%+ | weak | 1 · -0.75R · 0% · day 1 -8.4% | – |  |
| fund raise | 10%+ | all | 5 · -0.50R · 20% · day 1 -6.0% | 1 · +2.96R · 100% · day 1 +7.6% |  |
| fund raise | all gaps | strong | 387 · -0.09R · 34% · day 1 -0.6% | 131 · -0.05R · 35% · day 1 -0.7% |  |
| fund raise | all gaps | neutral | 481 · -0.31R · 27% · day 1 -0.6% | 315 · -0.21R · 30% · day 1 -0.1% |  |
| fund raise | all gaps | weak | 274 · +0.10R · 43% · day 1 -0.3% | 202 · -0.42R · 20% · day 1 -0.4% |  |
| fund raise | all gaps | all | 1142 · -0.14R · 33% · day 1 -0.5% | 648 · -0.25R · 28% · day 1 -0.3% |  |
| governance | below 0% | strong | 3 · -0.67R · 33% · day 1 -4.4% | – |  |
| governance | below 0% | neutral | 2 · -0.01R · 50% · day 1 -1.1% | 6 · +0.27R · 33% · day 1 -0.3% |  |
| governance | below 0% | weak | 1 · -0.18R · 0% · day 1 +1.4% | 5 · -0.52R · 20% · day 1 -2.9% |  |
| governance | below 0% | all | 6 · -0.37R · 33% · day 1 -2.3% | 11 · -0.09R · 27% · day 1 -1.5% |  |
| governance | 0–2% | strong | 4 · -0.77R · 25% · day 1 -2.3% | 3 · -0.23R · 33% · day 1 -1.5% |  |
| governance | 0–2% | neutral | 8 · -0.04R · 38% · day 1 +0.3% | 2 · -0.29R · 50% · day 1 +1.1% |  |
| governance | 0–2% | weak | 2 · -0.23R · 0% · day 1 +0.1% | 2 · -0.47R · 50% · day 1 -0.9% |  |
| governance | 0–2% | all | 14 · -0.28R · 29% · day 1 -0.5% | 7 · -0.32R · 43% · day 1 -0.6% |  |
| governance | 2–5% | strong | 1 · -1.02R · 0% · day 1 -3.1% | 1 · -0.74R · 0% · day 1 -3.3% |  |
| governance | 2–5% | neutral | 1 · -1.01R · 0% · day 1 -3.7% | 3 · -1.03R · 0% · day 1 -3.9% |  |
| governance | 2–5% | all | 2 · -1.02R · 0% · day 1 -3.4% | 4 · -0.96R · 0% · day 1 -3.7% |  |
| governance | 5–10% | strong | 1 · -1.02R · 0% · day 1 -8.9% | 1 · -1.02R · 0% · day 1 -7.2% |  |
| governance | 5–10% | all | 1 · -1.02R · 0% · day 1 -8.9% | 1 · -1.02R · 0% · day 1 -7.2% |  |
| governance | all gaps | strong | 9 · -0.79R · 22% · day 1 -3.8% | 5 · -0.49R · 20% · day 1 -3.0% |  |
| governance | all gaps | neutral | 11 · -0.12R · 36% · day 1 -0.3% | 11 · -0.19R · 27% · day 1 -1.0% |  |
| governance | all gaps | weak | 3 · -0.21R · 0% · day 1 +0.5% | 7 · -0.51R · 29% · day 1 -2.3% |  |
| governance | all gaps | all | 23 · -0.40R · 26% · day 1 -1.6% | 23 · -0.35R · 26% · day 1 -1.8% |  |
| management exit | below 0% | strong | 43 · -0.31R · 21% · day 1 +0.0% | 29 · -0.22R · 28% · day 1 +0.2% |  |
| management exit | below 0% | neutral | 66 · -0.28R · 23% · day 1 -0.1% | 67 · -0.24R · 28% · day 1 -0.6% |  |
| management exit | below 0% | weak | 65 · +0.06R · 40% · day 1 -0.3% | 47 · -0.27R · 32% · day 1 -1.1% |  |
| management exit | below 0% | all | 174 · -0.16R · 29% · day 1 -0.2% | 143 · -0.25R · 29% · day 1 -0.6% |  |
| management exit | 0–2% | strong | 99 · -0.19R · 28% · day 1 -0.7% | 36 · -0.20R · 25% · day 1 -0.5% |  |
| management exit | 0–2% | neutral | 135 · -0.27R · 30% · day 1 -0.7% | 64 · -0.57R · 16% · day 1 -0.4% |  |
| management exit | 0–2% | weak | 76 · -0.12R · 39% · day 1 +0.0% | 45 · -0.48R · 18% · day 1 -0.3% |  |
| management exit | 0–2% | all | 310 · -0.21R · 32% · day 1 -0.5% | 145 · -0.45R · 19% · day 1 -0.4% |  |
| management exit | 2–5% | strong | 15 · -0.30R · 20% · day 1 +0.2% | 6 · -0.68R · 17% · day 1 -0.9% |  |
| management exit | 2–5% | neutral | 13 · -0.43R · 38% · day 1 -1.7% | 10 · -0.43R · 30% · day 1 -1.0% |  |
| management exit | 2–5% | weak | 18 · +0.32R · 44% · day 1 -2.5% | 10 · +0.51R · 40% · day 1 -0.5% |  |
| management exit | 2–5% | all | 46 · -0.09R · 35% · day 1 -1.4% | 26 · -0.13R · 31% · day 1 -0.7% |  |
| management exit | 5–10% | strong | 2 · +0.92R · 50% · day 1 +9.8% | 2 · -1.04R · 0% · day 1 +0.9% |  |
| management exit | 5–10% | neutral | 2 · +0.97R · 50% · day 1 -3.3% | 3 · -1.04R · 0% · day 1 -1.3% |  |
| management exit | 5–10% | weak | 1 · +0.13R · 100% · day 1 -0.9% | 2 · +2.97R · 100% · day 1 +0.5% |  |
| management exit | 5–10% | all | 5 · +0.78R · 60% · day 1 +2.4% | 7 · +0.11R · 29% · day 1 -0.2% |  |
| management exit | 10%+ | strong | 3 · -1.41R · 0% · day 1 -1.2% | 2 · +0.97R · 50% · day 1 +5.9% |  |
| management exit | 10%+ | neutral | 1 · -1.03R · 0% · day 1 -8.4% | – |  |
| management exit | 10%+ | weak | 1 · +2.98R · 100% · day 1 -1.7% | – |  |
| management exit | 10%+ | all | 5 · -0.45R · 20% · day 1 -2.7% | 2 · +0.97R · 50% · day 1 +5.9% |  |
| management exit | all gaps | strong | 162 · -0.24R · 25% · day 1 -0.3% | 75 · -0.24R · 25% · day 1 -0.0% |  |
| management exit | all gaps | neutral | 217 · -0.27R · 29% · day 1 -0.6% | 144 · -0.42R · 22% · day 1 -0.6% |  |
| management exit | all gaps | weak | 161 · +0.02R · 41% · day 1 -0.4% | 104 · -0.22R · 28% · day 1 -0.7% |  |
| management exit | all gaps | all | 540 · -0.18R · 31% · day 1 -0.5% | 323 · -0.31R · 25% · day 1 -0.5% |  |
| order | below 0% | strong | 25 · +0.16R · 40% · day 1 +0.5% | 24 · -0.35R · 21% · day 1 -1.3% |  |
| order | below 0% | neutral | 50 · +0.30R · 48% · day 1 +0.6% | 60 · -0.05R · 32% · day 1 +0.3% |  |
| order | below 0% | weak | 55 · +0.21R · 42% · day 1 +0.7% | 68 · -0.08R · 26% · day 1 -0.9% |  |
| order | below 0% | all | 130 · +0.24R · 44% · day 1 +0.6% | 152 · -0.11R · 28% · day 1 -0.5% |  |
| order | 0–2% | strong | 189 · -0.32R · 26% · day 1 -0.0% | 105 · -0.33R · 25% · day 1 -0.2% |  |
| order | 0–2% | neutral | 288 · -0.32R · 26% · day 1 -0.4% | 238 · -0.50R · 18% · day 1 -0.5% |  |
| order | 0–2% | weak | 163 · +0.04R · 39% · day 1 -0.6% | 181 · -0.39R · 27% · day 1 -0.4% |  |
| order | 0–2% | all | 640 · -0.23R · 29% · day 1 -0.4% | 524 · -0.43R · 23% · day 1 -0.4% |  |
| order | 2–5% | strong | 85 · -0.10R · 27% · day 1 -0.5% | 51 · -0.32R · 22% · day 1 -0.7% |  |
| order | 2–5% | neutral | 146 · -0.55R · 16% · day 1 -1.2% | 84 · -0.51R · 17% · day 1 -1.0% |  |
| order | 2–5% | weak | 82 · +0.07R · 41% · day 1 -0.2% | 107 · -0.02R · 35% · day 1 -1.0% |  |
| order | 2–5% | all | 313 · -0.26R · 26% · day 1 -0.8% | 242 · -0.25R · 26% · day 1 -0.9% |  |
| order | 5–10% | strong | 18 · +0.46R · 39% · day 1 -3.1% | 10 · -0.07R · 30% · day 1 -2.2% |  |
| order | 5–10% | neutral | 28 · +0.11R · 32% · day 1 -1.2% | 43 · -0.45R · 21% · day 1 +0.0% |  |
| order | 5–10% | weak | 28 · -0.33R · 29% · day 1 -0.9% | 33 · -0.19R · 24% · day 1 -1.4% |  |
| order | 5–10% | all | 74 · +0.03R · 32% · day 1 -1.5% | 86 · -0.30R · 23% · day 1 -0.8% |  |
| order | 10%+ | strong | 8 · -1.16R · 0% · day 1 -3.2% | 2 · -1.03R · 0% · day 1 -6.6% |  |
| order | 10%+ | neutral | 3 · -1.03R · 0% · day 1 +1.1% | 7 · -0.95R · 0% · day 1 -3.8% |  |
| order | 10%+ | weak | 2 · -1.02R · 0% · day 1 -7.4% | 2 · -1.03R · 0% · day 1 -2.5% |  |
| order | 10%+ | all | 13 · -1.11R · 0% · day 1 -2.8% | 11 · -0.98R · 0% · day 1 -4.0% |  |
| order | all gaps | strong | 325 · -0.20R · 27% · day 1 -0.4% | 192 · -0.32R · 23% · day 1 -0.7% |  |
| order | all gaps | neutral | 515 · -0.30R · 25% · day 1 -0.6% | 432 · -0.44R · 20% · day 1 -0.5% |  |
| order | all gaps | weak | 330 · +0.04R · 39% · day 1 -0.4% | 391 · -0.22R · 28% · day 1 -0.7% |  |
| order | all gaps | all | 1170 · -0.18R · 30% · day 1 -0.5% | 1015 · -0.33R · 24% · day 1 -0.6% |  |
| press release | below 0% | strong | 432 · -0.00R · 36% · day 1 -0.5% | 229 · -0.17R · 30% · day 1 -0.9% |  |
| press release | below 0% | neutral | 594 · -0.15R · 31% · day 1 -0.2% | 534 · -0.32R · 25% · day 1 -0.6% |  |
| press release | below 0% | weak | 588 · -0.04R · 38% · day 1 -0.2% | 385 · -0.21R · 28% · day 1 -0.4% |  |
| press release | below 0% | all | 1614 · -0.07R · 35% · day 1 -0.3% | 1148 · -0.25R · 27% · day 1 -0.6% |  |
| press release | 0–2% | strong | 898 · +0.13R · 38% · day 1 -0.1% | 358 · -0.08R · 34% · day 1 -0.7% |  |
| press release | 0–2% | neutral | 1311 · -0.13R · 30% · day 1 -0.5% | 744 · -0.32R · 24% · day 1 -0.4% |  |
| press release | 0–2% | weak | 751 · +0.02R · 40% · day 1 -0.2% | 573 · -0.17R · 30% · day 1 -0.1% |  |
| press release | 0–2% | all | 2960 · -0.01R · 35% · day 1 -0.3% | 1675 · -0.22R · 28% · day 1 -0.3% |  |
| press release | 2–5% | strong | 273 · -0.07R · 31% · day 1 -0.5% | 111 · -0.22R · 28% · day 1 -0.4% |  |
| press release | 2–5% | neutral | 348 · -0.17R · 29% · day 1 -0.8% | 225 · -0.11R · 31% · day 1 -0.8% |  |
| press release | 2–5% | weak | 250 · +0.04R · 38% · day 1 -0.4% | 153 · +0.03R · 34% · day 1 -0.4% |  |
| press release | 2–5% | all | 871 · -0.08R · 32% · day 1 -0.6% | 489 · -0.09R · 31% · day 1 -0.6% |  |
| press release | 5–10% | strong | 73 · -0.27R · 25% · day 1 -0.7% | 38 · +0.32R · 39% · day 1 -0.5% |  |
| press release | 5–10% | neutral | 79 · -0.11R · 28% · day 1 -1.1% | 69 · -0.03R · 33% · day 1 -0.6% |  |
| press release | 5–10% | weak | 59 · -0.09R · 37% · day 1 -0.8% | 38 · +0.07R · 32% · day 1 -0.5% |  |
| press release | 5–10% | all | 211 · -0.16R · 29% · day 1 -0.9% | 145 · +0.09R · 34% · day 1 -0.5% |  |
| press release | 10%+ | strong | 15 · +0.79R · 60% · day 1 +1.5% | 12 · +0.12R · 42% · day 1 -0.5% |  |
| press release | 10%+ | neutral | 9 · +0.75R · 44% · day 1 -1.7% | 15 · -0.30R · 20% · day 1 -4.8% |  |
| press release | 10%+ | weak | 8 · +0.97R · 50% · day 1 -1.8% | 4 · -1.04R · 0% · day 1 -8.3% |  |
| press release | 10%+ | all | 32 · +0.82R · 53% · day 1 -0.3% | 31 · -0.23R · 26% · day 1 -3.6% |  |
| press release | all gaps | strong | 1691 · +0.05R · 36% · day 1 -0.3% | 748 · -0.10R · 32% · day 1 -0.7% |  |
| press release | all gaps | neutral | 2341 · -0.14R · 30% · day 1 -0.5% | 1587 · -0.28R · 26% · day 1 -0.6% |  |
| press release | all gaps | weak | 1656 · +0.00R · 39% · day 1 -0.3% | 1153 · -0.15R · 30% · day 1 -0.3% |  |
| press release | all gaps | all | 5688 · -0.04R · 35% · day 1 -0.4% | 3488 · -0.20R · 29% · day 1 -0.5% |  |
| price-move query | below 0% | strong | 205 · -0.28R · 26% · day 1 -0.7% | 78 · +0.19R · 37% · day 1 -0.8% |  |
| price-move query | below 0% | neutral | 298 · -0.29R · 24% · day 1 -0.6% | 234 · -0.39R · 24% · day 1 +0.1% |  |
| price-move query | below 0% | weak | 117 · +0.05R · 41% · day 1 -0.2% | 168 · -0.08R · 30% · day 1 +0.3% |  |
| price-move query | below 0% | all | 620 · -0.22R · 28% · day 1 -0.6% | 480 · -0.19R · 28% · day 1 +0.0% |  |
| price-move query | 0–2% | strong | 516 · +0.03R · 36% · day 1 -0.7% | 163 · +0.01R · 35% · day 1 -0.1% |  |
| price-move query | 0–2% | neutral | 471 · -0.39R · 23% · day 1 -0.5% | 299 · -0.13R · 29% · day 1 -0.2% |  |
| price-move query | 0–2% | weak | 131 · +0.08R · 37% · day 1 -0.8% | 159 · -0.27R · 25% · day 1 -0.6% |  |
| price-move query | 0–2% | all | 1118 · -0.14R · 31% · day 1 -0.6% | 621 · -0.13R · 29% · day 1 -0.3% |  |
| price-move query | 2–5% | strong | 88 · -0.27R · 25% · day 1 -1.8% | 31 · -0.23R · 32% · day 1 -0.3% |  |
| price-move query | 2–5% | neutral | 73 · -0.40R · 21% · day 1 -1.3% | 63 · -0.06R · 30% · day 1 -0.5% |  |
| price-move query | 2–5% | weak | 25 · -0.07R · 32% · day 1 -2.1% | 33 · +0.19R · 42% · day 1 -0.2% |  |
| price-move query | 2–5% | all | 186 · -0.29R · 24% · day 1 -1.6% | 127 · -0.04R · 34% · day 1 -0.4% |  |
| price-move query | 5–10% | strong | 13 · -1.42R · 0% · day 1 -4.2% | 2 · -0.66R · 0% · day 1 +6.7% |  |
| price-move query | 5–10% | neutral | 12 · -1.20R · 0% · day 1 -2.2% | 11 · -0.59R · 9% · day 1 -6.6% |  |
| price-move query | 5–10% | weak | 1 · -1.02R · 0% · day 1 -14.8% | 4 · -0.02R · 25% · day 1 +3.0% |  |
| price-move query | 5–10% | all | 26 · -1.30R · 0% · day 1 -3.7% | 17 · -0.46R · 12% · day 1 -2.8% |  |
| price-move query | 10%+ | strong | 3 · -1.29R · 33% · day 1 -5.0% | 1 · -1.02R · 0% · day 1 -6.4% |  |
| price-move query | 10%+ | neutral | – | 3 · +0.30R · 33% · day 1 -4.5% |  |
| price-move query | 10%+ | all | 3 · -1.29R · 33% · day 1 -5.0% | 4 · -0.03R · 25% · day 1 -5.0% |  |
| price-move query | all gaps | strong | 825 · -0.11R · 32% · day 1 -0.9% | 275 · +0.03R · 35% · day 1 -0.3% |  |
| price-move query | all gaps | neutral | 854 · -0.37R · 23% · day 1 -0.6% | 610 · -0.23R · 27% · day 1 -0.3% |  |
| price-move query | all gaps | weak | 274 · +0.05R · 38% · day 1 -0.7% | 364 · -0.14R · 29% · day 1 -0.1% |  |
| price-move query | all gaps | all | 1953 · -0.20R · 29% · day 1 -0.8% | 1249 · -0.15R · 29% · day 1 -0.2% |  |
| rating change | below 0% | strong | 11 · -0.85R · 9% · day 1 +0.4% | 10 · -0.24R · 30% · day 1 -0.9% |  |
| rating change | below 0% | neutral | 35 · -0.32R · 23% · day 1 -0.3% | 36 · +0.00R · 33% · day 1 +0.2% |  |
| rating change | below 0% | weak | 40 · +0.07R · 40% · day 1 +1.8% | 35 · +0.07R · 37% · day 1 -0.2% | ✅ |
| rating change | below 0% | all | 86 · -0.21R · 29% · day 1 +0.7% | 81 · +0.00R · 35% · day 1 -0.1% |  |
| rating change | 0–2% | strong | 39 · +0.04R · 44% · day 1 -0.2% | 38 · +0.08R · 45% · day 1 -0.3% |  |
| rating change | 0–2% | neutral | 88 · -0.21R · 28% · day 1 -0.1% | 77 · -0.65R · 16% · day 1 -0.0% |  |
| rating change | 0–2% | weak | 60 · -0.06R · 37% · day 1 +0.2% | 44 · -0.21R · 27% · day 1 +0.6% |  |
| rating change | 0–2% | all | 187 · -0.11R · 34% · day 1 -0.0% | 159 · -0.36R · 26% · day 1 +0.1% |  |
| rating change | 2–5% | strong | 6 · -0.25R · 33% · day 1 +0.7% | 2 · +0.97R · 50% · day 1 +1.8% |  |
| rating change | 2–5% | neutral | 4 · -0.70R · 25% · day 1 -0.8% | 5 · -0.70R · 20% · day 1 -4.3% |  |
| rating change | 2–5% | weak | 4 · +1.23R · 50% · day 1 +0.5% | 1 · -1.02R · 0% · day 1 -1.4% |  |
| rating change | 2–5% | all | 14 · +0.05R · 36% · day 1 +0.2% | 8 · -0.32R · 25% · day 1 -2.4% |  |
| rating change | 5–10% | neutral | – | 1 · +2.98R · 100% · day 1 -1.6% |  |
| rating change | 5–10% | weak | 2 · -0.26R · 50% · day 1 -0.2% | – |  |
| rating change | 5–10% | all | 2 · -0.26R · 50% · day 1 -0.2% | 1 · +2.98R · 100% · day 1 -1.6% |  |
| rating change | 10%+ | neutral | 1 · -1.03R · 0% · day 1 -5.1% | 1 · -1.04R · 0% · day 1 +0.5% |  |
| rating change | 10%+ | all | 1 · -1.03R · 0% · day 1 -5.1% | 1 · -1.04R · 0% · day 1 +0.5% |  |
| rating change | all gaps | strong | 56 · -0.16R · 36% · day 1 +0.0% | 50 · +0.05R · 42% · day 1 -0.3% |  |
| rating change | all gaps | neutral | 128 · -0.26R · 27% · day 1 -0.2% | 120 · -0.43R · 22% · day 1 -0.2% |  |
| rating change | all gaps | weak | 106 · +0.03R · 39% · day 1 +0.8% | 80 · -0.10R · 31% · day 1 +0.2% |  |
| rating change | all gaps | all | 290 · -0.13R · 33% · day 1 +0.2% | 250 · -0.23R · 29% · day 1 -0.1% |  |
| regulatory | below 0% | strong | 117 · +0.22R · 40% · day 1 +0.1% | 54 · +0.04R · 41% · day 1 +0.0% | ✅ |
| regulatory | below 0% | neutral | 272 · -0.28R · 26% · day 1 +0.1% | 289 · -0.35R · 22% · day 1 -0.1% |  |
| regulatory | below 0% | weak | 334 · +0.10R · 42% · day 1 +0.5% | 309 · +0.10R · 40% · day 1 -0.2% | ✅ |
| regulatory | below 0% | all | 723 · -0.02R · 36% · day 1 +0.3% | 652 · -0.10R · 32% · day 1 -0.1% |  |
| regulatory | 0–2% | strong | 312 · +0.03R · 34% · day 1 -0.3% | 184 · -0.04R · 35% · day 1 -0.3% |  |
| regulatory | 0–2% | neutral | 533 · -0.38R · 22% · day 1 -0.4% | 427 · -0.37R · 21% · day 1 -0.2% |  |
| regulatory | 0–2% | weak | 446 · +0.07R · 42% · day 1 -0.1% | 301 · -0.22R · 26% · day 1 -0.5% |  |
| regulatory | 0–2% | all | 1291 · -0.13R · 32% · day 1 -0.3% | 912 · -0.25R · 26% · day 1 -0.3% |  |
| regulatory | 2–5% | strong | 24 · +0.11R · 33% · day 1 -0.6% | 11 · +0.10R · 36% · day 1 +0.1% |  |
| regulatory | 2–5% | neutral | 26 · -0.33R · 23% · day 1 -0.8% | 31 · -0.38R · 26% · day 1 -1.5% |  |
| regulatory | 2–5% | weak | 60 · +0.29R · 43% · day 1 -0.5% | 28 · +1.29R · 71% · day 1 +0.9% | ✅ |
| regulatory | 2–5% | all | 110 · +0.10R · 36% · day 1 -0.6% | 70 · +0.37R · 46% · day 1 -0.3% | ✅ |
| regulatory | 5–10% | neutral | 2 · -1.03R · 0% · day 1 -2.1% | 7 · -0.99R · 14% · day 1 -2.8% |  |
| regulatory | 5–10% | weak | 10 · -0.45R · 20% · day 1 +0.1% | 5 · +0.36R · 60% · day 1 -1.0% |  |
| regulatory | 5–10% | all | 12 · -0.54R · 17% · day 1 -0.2% | 12 · -0.43R · 33% · day 1 -2.1% |  |
| regulatory | 10%+ | strong | 1 · +0.17R · 100% · day 1 +2.2% | – |  |
| regulatory | 10%+ | neutral | – | 1 · -1.04R · 0% · day 1 -1.6% |  |
| regulatory | 10%+ | all | 1 · +0.17R · 100% · day 1 +2.2% | 1 · -1.04R · 0% · day 1 -1.6% |  |
| regulatory | all gaps | strong | 454 · +0.08R · 36% · day 1 -0.2% | 249 · -0.01R · 37% · day 1 -0.2% |  |
| regulatory | all gaps | neutral | 833 · -0.35R · 24% · day 1 -0.2% | 755 · -0.37R · 22% · day 1 -0.2% |  |
| regulatory | all gaps | weak | 850 · +0.09R · 42% · day 1 +0.1% | 643 · +0.00R · 35% · day 1 -0.3% | ✅ |
| regulatory | all gaps | all | 2137 · -0.08R · 34% · day 1 -0.1% | 1647 · -0.17R · 29% · day 1 -0.3% |  |

## Swing (2× daily range stop, 3R target, hold 30 sessions) — sme board

Each cell: trades · average R after costs · win rate · average open→close move on day 1. ✅ = kept (period 1: ≥ 30 trades and ≥ +0.05R a trade; period 2: ≥ 10 trades and positive in total).

| Filing type | Gap at the open | Market | Period 1 (set) | Period 2 (confirm) | |
|---|---|---|---|---|---|

## Intraday (buy the open, sell the close; 0.5× daily range stop) — main board

Each cell: trades · average R after costs · win rate · average open→close move on day 1. ✅ = kept (period 1: ≥ 30 trades and ≥ +0.05R a trade; period 2: ≥ 10 trades and positive in total).

| Filing type | Gap at the open | Market | Period 1 (set) | Period 2 (confirm) | |
|---|---|---|---|---|---|
| acquisition | below 0% | strong | 135 · +0.00R · 37% · day 1 +0.0% | 70 · -0.07R · 41% · day 1 -0.0% |  |
| acquisition | below 0% | neutral | 246 · -0.09R · 39% · day 1 -0.1% | 194 · -0.13R · 40% · day 1 -0.1% |  |
| acquisition | below 0% | weak | 218 · +0.04R · 43% · day 1 +0.3% | 178 · -0.22R · 31% · day 1 -0.2% |  |
| acquisition | below 0% | all | 599 · -0.02R · 40% · day 1 +0.1% | 442 · -0.16R · 37% · day 1 -0.1% |  |
| acquisition | 0–2% | strong | 498 · -0.26R · 32% · day 1 -0.2% | 186 · -0.20R · 32% · day 1 -0.2% |  |
| acquisition | 0–2% | neutral | 686 · -0.15R · 35% · day 1 -0.2% | 402 · -0.25R · 33% · day 1 -0.3% |  |
| acquisition | 0–2% | weak | 322 · -0.19R · 42% · day 1 -0.1% | 296 · -0.28R · 32% · day 1 -0.3% |  |
| acquisition | 0–2% | all | 1506 · -0.19R · 35% · day 1 -0.1% | 884 · -0.25R · 32% · day 1 -0.3% |  |
| acquisition | 2–5% | strong | 70 · -0.47R · 21% · day 1 -1.3% | 26 · -0.32R · 27% · day 1 -1.5% |  |
| acquisition | 2–5% | neutral | 86 · -0.53R · 20% · day 1 -0.9% | 61 · -0.61R · 16% · day 1 -1.1% |  |
| acquisition | 2–5% | weak | 49 · -0.06R · 33% · day 1 -0.1% | 40 · -0.21R · 35% · day 1 -0.0% |  |
| acquisition | 2–5% | all | 205 · -0.40R · 23% · day 1 -0.8% | 127 · -0.42R · 24% · day 1 -0.8% |  |
| acquisition | 5–10% | strong | 20 · +0.19R · 20% · day 1 +0.0% | 2 · -1.07R · 0% · day 1 -3.8% |  |
| acquisition | 5–10% | neutral | 15 · -0.61R · 20% · day 1 -0.7% | 11 · -0.52R · 18% · day 1 -2.0% |  |
| acquisition | 5–10% | weak | 10 · -0.39R · 20% · day 1 -1.9% | 11 · +0.55R · 36% · day 1 +2.8% |  |
| acquisition | 5–10% | all | 45 · -0.21R · 20% · day 1 -0.7% | 24 · -0.07R · 25% · day 1 +0.0% |  |
| acquisition | 10%+ | strong | 2 · -1.08R · 0% · day 1 -3.8% | 4 · -0.08R · 25% · day 1 +3.0% |  |
| acquisition | 10%+ | neutral | 2 · +1.12R · 50% · day 1 +5.2% | 1 · -1.06R · 0% · day 1 -9.9% |  |
| acquisition | 10%+ | all | 4 · +0.02R · 25% · day 1 +0.7% | 5 · -0.27R · 20% · day 1 +0.4% |  |
| acquisition | all gaps | strong | 725 · -0.22R · 31% · day 1 -0.2% | 288 · -0.18R · 33% · day 1 -0.3% |  |
| acquisition | all gaps | neutral | 1035 · -0.17R · 34% · day 1 -0.2% | 669 · -0.25R · 33% · day 1 -0.3% |  |
| acquisition | all gaps | weak | 599 · -0.10R · 41% · day 1 +0.0% | 525 · -0.24R · 32% · day 1 -0.2% |  |
| acquisition | all gaps | all | 2359 · -0.17R · 35% · day 1 -0.2% | 1482 · -0.23R · 33% · day 1 -0.3% |  |
| any | below 0% | strong | 1373 · -0.14R · 34% · day 1 -0.2% | 707 · -0.19R · 34% · day 1 -0.4% |  |
| any | below 0% | neutral | 2275 · -0.08R · 39% · day 1 -0.1% | 1991 · -0.18R · 35% · day 1 -0.1% |  |
| any | below 0% | weak | 1709 · -0.01R · 41% · day 1 +0.2% | 1621 · -0.22R · 34% · day 1 -0.3% |  |
| any | below 0% | all | 5357 · -0.07R · 38% · day 1 -0.0% | 4319 · -0.19R · 35% · day 1 -0.2% |  |
| any | 0–2% | strong | 4181 · -0.24R · 30% · day 1 -0.3% | 1653 · -0.22R · 32% · day 1 -0.3% |  |
| any | 0–2% | neutral | 4927 · -0.23R · 32% · day 1 -0.4% | 3247 · -0.21R · 33% · day 1 -0.2% |  |
| any | 0–2% | weak | 2509 · -0.20R · 36% · day 1 -0.1% | 2145 · -0.22R · 33% · day 1 -0.2% |  |
| any | 0–2% | all | 11617 · -0.23R · 32% · day 1 -0.3% | 7045 · -0.22R · 33% · day 1 -0.2% |  |
| any | 2–5% | strong | 687 · -0.28R · 24% · day 1 -0.9% | 267 · -0.13R · 28% · day 1 -0.6% |  |
| any | 2–5% | neutral | 802 · -0.37R · 25% · day 1 -0.9% | 645 · -0.31R · 28% · day 1 -0.7% |  |
| any | 2–5% | weak | 599 · -0.10R · 36% · day 1 -0.4% | 467 · -0.26R · 30% · day 1 -0.3% |  |
| any | 2–5% | all | 2088 · -0.26R · 28% · day 1 -0.7% | 1379 · -0.26R · 29% · day 1 -0.6% |  |
| any | 5–10% | strong | 131 · -0.36R · 16% · day 1 -1.3% | 62 · -0.33R · 23% · day 1 -0.7% |  |
| any | 5–10% | neutral | 153 · -0.36R · 22% · day 1 -1.2% | 161 · -0.17R · 25% · day 1 -0.6% |  |
| any | 5–10% | weak | 118 · -0.48R · 19% · day 1 -0.9% | 107 · -0.15R · 30% · day 1 +0.2% |  |
| any | 5–10% | all | 402 · -0.40R · 19% · day 1 -1.1% | 330 · -0.20R · 26% · day 1 -0.4% |  |
| any | 10%+ | strong | 36 · -0.43R · 22% · day 1 -1.4% | 19 · -0.06R · 21% · day 1 -0.5% |  |
| any | 10%+ | neutral | 22 · -0.48R · 14% · day 1 -1.1% | 29 · -0.58R · 14% · day 1 -3.8% |  |
| any | 10%+ | weak | 14 · -1.05R · 0% · day 1 -2.9% | 6 · -1.08R · 0% · day 1 -5.7% |  |
| any | 10%+ | all | 72 · -0.56R · 15% · day 1 -1.6% | 54 · -0.45R · 15% · day 1 -2.9% |  |
| any | all gaps | strong | 6408 · -0.22R · 30% · day 1 -0.4% | 2708 · -0.20R · 32% · day 1 -0.4% |  |
| any | all gaps | neutral | 8179 · -0.21R · 33% · day 1 -0.4% | 6073 · -0.21R · 33% · day 1 -0.3% |  |
| any | all gaps | weak | 4949 · -0.13R · 37% · day 1 -0.1% | 4346 · -0.22R · 33% · day 1 -0.2% |  |
| any | all gaps | all | 19536 · -0.19R · 33% · day 1 -0.3% | 13127 · -0.21R · 33% · day 1 -0.3% |  |
| corporate action | below 0% | strong | 386 · +0.08R · 43% · day 1 +0.3% | 202 · +0.06R · 43% · day 1 +0.4% | ✅ |
| corporate action | below 0% | neutral | 615 · -0.02R · 42% · day 1 +0.1% | 383 · -0.13R · 38% · day 1 -0.0% |  |
| corporate action | below 0% | weak | 247 · +0.20R · 48% · day 1 +0.9% | 226 · -0.20R · 36% · day 1 -0.4% |  |
| corporate action | below 0% | all | 1248 · +0.06R · 44% · day 1 +0.3% | 811 · -0.10R · 39% · day 1 -0.0% |  |
| corporate action | 0–2% | strong | 1430 · -0.25R · 31% · day 1 -0.3% | 522 · -0.15R · 36% · day 1 -0.1% |  |
| corporate action | 0–2% | neutral | 1187 · -0.22R · 33% · day 1 -0.2% | 662 · -0.13R · 36% · day 1 -0.0% |  |
| corporate action | 0–2% | weak | 439 · -0.16R · 36% · day 1 +0.2% | 320 · -0.16R · 37% · day 1 +0.2% |  |
| corporate action | 0–2% | all | 3056 · -0.23R · 33% · day 1 -0.2% | 1504 · -0.15R · 36% · day 1 -0.0% |  |
| corporate action | 2–5% | strong | 91 · -0.42R · 22% · day 1 -0.9% | 31 · -0.44R · 29% · day 1 -1.3% |  |
| corporate action | 2–5% | neutral | 98 · -0.23R · 26% · day 1 -0.6% | 114 · -0.16R · 38% · day 1 -0.2% |  |
| corporate action | 2–5% | weak | 94 · +0.12R · 51% · day 1 +0.4% | 50 · -0.30R · 36% · day 1 -0.3% |  |
| corporate action | 2–5% | all | 283 · -0.18R · 33% · day 1 -0.4% | 195 · -0.24R · 36% · day 1 -0.4% |  |
| corporate action | 5–10% | strong | 14 · -0.44R · 7% · day 1 -3.1% | 5 · -0.35R · 20% · day 1 -1.5% |  |
| corporate action | 5–10% | neutral | 20 · -0.42R · 20% · day 1 -2.6% | 14 · +0.21R · 43% · day 1 -0.2% |  |
| corporate action | 5–10% | weak | 11 · -0.54R · 18% · day 1 -0.6% | 7 · +1.12R · 71% · day 1 +1.5% |  |
| corporate action | 5–10% | all | 45 · -0.46R · 16% · day 1 -2.2% | 26 · +0.35R · 46% · day 1 +0.0% |  |
| corporate action | 10%+ | strong | 3 · -1.06R · 0% · day 1 -5.0% | – |  |
| corporate action | 10%+ | neutral | 4 · -1.10R · 0% · day 1 -2.5% | 4 · +0.18R · 25% · day 1 -3.7% |  |
| corporate action | 10%+ | weak | 3 · -1.07R · 0% · day 1 -2.8% | 1 · -1.08R · 0% · day 1 +1.5% |  |
| corporate action | 10%+ | all | 10 · -1.08R · 0% · day 1 -3.3% | 5 · -0.07R · 20% · day 1 -2.6% |  |
| corporate action | all gaps | strong | 1924 · -0.20R · 33% · day 1 -0.2% | 760 · -0.11R · 37% · day 1 -0.0% |  |
| corporate action | all gaps | neutral | 1924 · -0.16R · 35% · day 1 -0.2% | 1177 · -0.13R · 37% · day 1 -0.1% |  |
| corporate action | all gaps | weak | 794 · -0.03R · 41% · day 1 +0.4% | 604 · -0.17R · 37% · day 1 -0.1% |  |
| corporate action | all gaps | all | 4642 · -0.15R · 35% · day 1 -0.1% | 2541 · -0.14R · 37% · day 1 -0.0% |  |
| expansion | below 0% | strong | 12 · +0.05R · 42% · day 1 +1.0% | 18 · -0.12R · 39% · day 1 +0.1% |  |
| expansion | below 0% | neutral | 21 · +0.08R · 48% · day 1 -0.1% | 34 · -0.35R · 29% · day 1 +0.2% |  |
| expansion | below 0% | weak | 32 · -0.28R · 28% · day 1 -0.7% | 51 · -0.42R · 24% · day 1 -0.3% |  |
| expansion | below 0% | all | 65 · -0.10R · 37% · day 1 -0.2% | 103 · -0.34R · 28% · day 1 -0.1% |  |
| expansion | 0–2% | strong | 47 · +0.01R · 30% · day 1 +0.2% | 39 · -0.34R · 28% · day 1 -0.7% |  |
| expansion | 0–2% | neutral | 85 · -0.30R · 31% · day 1 -0.5% | 105 · -0.27R · 28% · day 1 +0.0% |  |
| expansion | 0–2% | weak | 69 · -0.15R · 33% · day 1 -0.0% | 64 · -0.02R · 44% · day 1 +0.1% |  |
| expansion | 0–2% | all | 201 · -0.18R · 31% · day 1 -0.2% | 208 · -0.21R · 33% · day 1 -0.1% |  |
| expansion | 2–5% | strong | – | 14 · +0.79R · 57% · day 1 -0.1% |  |
| expansion | 2–5% | neutral | 11 · -0.49R · 9% · day 1 -1.0% | 16 · -0.36R · 19% · day 1 +0.2% |  |
| expansion | 2–5% | weak | 7 · +0.28R · 57% · day 1 +0.2% | 17 · +0.28R · 35% · day 1 +1.3% |  |
| expansion | 2–5% | all | 18 · -0.19R · 28% · day 1 -0.5% | 47 · +0.21R · 36% · day 1 +0.5% |  |
| expansion | 5–10% | strong | – | 2 · -0.83R · 0% · day 1 -0.9% |  |
| expansion | 5–10% | neutral | 1 · -1.10R · 0% · day 1 -8.0% | 6 · +0.52R · 33% · day 1 +0.7% |  |
| expansion | 5–10% | weak | 4 · -1.06R · 0% · day 1 -3.1% | 2 · -1.08R · 0% · day 1 -1.4% |  |
| expansion | 5–10% | all | 5 · -1.07R · 0% · day 1 -4.1% | 10 · -0.07R · 20% · day 1 -0.0% |  |
| expansion | 10%+ | strong | – | 1 · -1.07R · 0% · day 1 -4.3% |  |
| expansion | 10%+ | neutral | 1 · -1.12R · 0% · day 1 +2.9% | – |  |
| expansion | 10%+ | weak | 2 · -1.10R · 0% · day 1 -3.4% | – |  |
| expansion | 10%+ | all | 3 · -1.11R · 0% · day 1 -1.3% | 1 · -1.07R · 0% · day 1 -4.3% |  |
| expansion | all gaps | strong | 59 · +0.02R · 32% · day 1 +0.3% | 74 · -0.09R · 35% · day 1 -0.5% |  |
| expansion | all gaps | neutral | 119 · -0.26R · 31% · day 1 -0.5% | 161 · -0.27R · 27% · day 1 +0.1% |  |
| expansion | all gaps | weak | 114 · -0.21R · 32% · day 1 -0.4% | 134 · -0.15R · 34% · day 1 +0.0% |  |
| expansion | all gaps | all | 292 · -0.18R · 32% · day 1 -0.3% | 369 · -0.19R · 31% · day 1 -0.0% |  |
| fund raise | below 0% | strong | 64 · -0.11R · 34% · day 1 +0.1% | 41 · -0.43R · 22% · day 1 -1.1% |  |
| fund raise | below 0% | neutral | 143 · -0.06R · 44% · day 1 -0.2% | 123 · -0.19R · 33% · day 1 +0.1% |  |
| fund raise | below 0% | weak | 86 · -0.29R · 30% · day 1 -0.3% | 96 · -0.10R · 41% · day 1 -0.1% |  |
| fund raise | below 0% | all | 293 · -0.14R · 38% · day 1 -0.2% | 260 · -0.20R · 34% · day 1 -0.2% |  |
| fund raise | 0–2% | strong | 255 · -0.33R · 29% · day 1 -0.6% | 70 · -0.41R · 30% · day 1 -1.1% |  |
| fund raise | 0–2% | neutral | 273 · -0.31R · 27% · day 1 -0.6% | 190 · -0.25R · 34% · day 1 -0.3% |  |
| fund raise | 0–2% | weak | 144 · -0.23R · 33% · day 1 -0.3% | 99 · -0.22R · 30% · day 1 -0.3% |  |
| fund raise | 0–2% | all | 672 · -0.30R · 29% · day 1 -0.5% | 359 · -0.27R · 32% · day 1 -0.4% |  |
| fund raise | 2–5% | strong | 62 · -0.56R · 16% · day 1 -1.4% | 11 · -0.14R · 36% · day 1 -0.4% |  |
| fund raise | 2–5% | neutral | 57 · -0.50R · 30% · day 1 -1.2% | 33 · +0.13R · 33% · day 1 +0.1% |  |
| fund raise | 2–5% | weak | 40 · -0.08R · 38% · day 1 -0.4% | 30 · -0.44R · 27% · day 1 -0.8% |  |
| fund raise | 2–5% | all | 159 · -0.42R · 26% · day 1 -1.1% | 74 · -0.14R · 31% · day 1 -0.3% |  |
| fund raise | 5–10% | strong | 4 · -1.08R · 0% · day 1 -3.2% | 9 · +0.59R · 44% · day 1 +2.8% |  |
| fund raise | 5–10% | neutral | 6 · +0.33R · 50% · day 1 +1.2% | 11 · +0.08R · 27% · day 1 +1.8% |  |
| fund raise | 5–10% | weak | 4 · -0.68R · 25% · day 1 -0.7% | 4 · +0.51R · 50% · day 1 +7.2% |  |
| fund raise | 5–10% | all | 14 · -0.36R · 29% · day 1 -0.6% | 24 · +0.34R · 38% · day 1 +3.1% |  |
| fund raise | 10%+ | strong | 2 · -1.05R · 0% · day 1 -7.2% | 1 · -1.10R · 0% · day 1 +7.6% |  |
| fund raise | 10%+ | neutral | 2 · -1.06R · 0% · day 1 -3.7% | – |  |
| fund raise | 10%+ | weak | 1 · -1.03R · 0% · day 1 -8.4% | – |  |
| fund raise | 10%+ | all | 5 · -1.05R · 0% · day 1 -6.0% | 1 · -1.10R · 0% · day 1 +7.6% |  |
| fund raise | all gaps | strong | 387 · -0.34R · 28% · day 1 -0.6% | 132 · -0.33R · 29% · day 1 -0.7% |  |
| fund raise | all gaps | neutral | 481 · -0.25R · 32% · day 1 -0.6% | 357 · -0.19R · 33% · day 1 -0.1% |  |
| fund raise | all gaps | weak | 275 · -0.24R · 32% · day 1 -0.3% | 229 · -0.19R · 34% · day 1 -0.2% |  |
| fund raise | all gaps | all | 1143 · -0.28R · 31% · day 1 -0.5% | 718 · -0.21R · 33% · day 1 -0.2% |  |
| governance | below 0% | strong | 3 · -1.06R · 0% · day 1 -4.4% | – |  |
| governance | below 0% | neutral | 2 · -0.62R · 0% · day 1 -1.1% | 7 · -0.18R · 43% · day 1 +0.3% |  |
| governance | below 0% | weak | 1 · +0.89R · 100% · day 1 +1.4% | 6 · -0.81R · 17% · day 1 -2.3% |  |
| governance | below 0% | all | 6 · -0.59R · 17% · day 1 -2.3% | 13 · -0.47R · 31% · day 1 -0.9% |  |
| governance | 0–2% | strong | 4 · -0.46R · 50% · day 1 -2.3% | 3 · -0.65R · 33% · day 1 -1.5% |  |
| governance | 0–2% | neutral | 8 · -0.36R · 38% · day 1 +0.3% | 2 · +1.07R · 50% · day 1 +1.1% |  |
| governance | 0–2% | weak | 2 · -0.01R · 50% · day 1 +0.1% | 3 · -1.06R · 0% · day 1 -0.9% |  |
| governance | 0–2% | all | 14 · -0.34R · 43% · day 1 -0.5% | 8 · -0.37R · 25% · day 1 -0.6% |  |
| governance | 2–5% | strong | 1 · -1.05R · 0% · day 1 -3.1% | 1 · -1.05R · 0% · day 1 -3.3% |  |
| governance | 2–5% | neutral | 1 · -0.79R · 0% · day 1 -3.7% | 3 · -1.06R · 0% · day 1 -3.9% |  |
| governance | 2–5% | all | 2 · -0.92R · 0% · day 1 -3.4% | 4 · -1.06R · 0% · day 1 -3.7% |  |
| governance | 5–10% | strong | 1 · -1.05R · 0% · day 1 -8.9% | 1 · -1.05R · 0% · day 1 -7.2% |  |
| governance | 5–10% | all | 1 · -1.05R · 0% · day 1 -8.9% | 1 · -1.05R · 0% · day 1 -7.2% |  |
| governance | all gaps | strong | 9 · -0.79R · 22% · day 1 -3.8% | 5 · -0.81R · 20% · day 1 -3.0% |  |
| governance | all gaps | neutral | 11 · -0.44R · 27% · day 1 -0.3% | 12 · -0.19R · 33% · day 1 -0.6% |  |
| governance | all gaps | weak | 3 · +0.29R · 67% · day 1 +0.5% | 9 · -0.89R · 11% · day 1 -1.8% |  |
| governance | all gaps | all | 23 · -0.48R · 30% · day 1 -1.6% | 26 · -0.55R · 23% · day 1 -1.5% |  |
| management exit | below 0% | strong | 44 · -0.09R · 34% · day 1 -0.0% | 29 · -0.02R · 34% · day 1 +0.2% |  |
| management exit | below 0% | neutral | 67 · -0.25R · 39% · day 1 -0.1% | 75 · -0.34R · 31% · day 1 -0.7% |  |
| management exit | below 0% | weak | 66 · -0.18R · 36% · day 1 -0.2% | 48 · -0.39R · 23% · day 1 -1.1% |  |
| management exit | below 0% | all | 177 · -0.18R · 37% · day 1 -0.1% | 152 · -0.29R · 29% · day 1 -0.6% |  |
| management exit | 0–2% | strong | 99 · -0.41R · 28% · day 1 -0.7% | 36 · -0.11R · 28% · day 1 -0.5% |  |
| management exit | 0–2% | neutral | 136 · -0.27R · 27% · day 1 -0.6% | 71 · -0.32R · 32% · day 1 -0.5% |  |
| management exit | 0–2% | weak | 76 · -0.06R · 42% · day 1 +0.0% | 51 · -0.35R · 25% · day 1 -0.2% |  |
| management exit | 0–2% | all | 311 · -0.26R · 31% · day 1 -0.5% | 158 · -0.28R · 29% · day 1 -0.4% |  |
| management exit | 2–5% | strong | 15 · -0.68R · 7% · day 1 +0.2% | 6 · -0.32R · 17% · day 1 -0.9% |  |
| management exit | 2–5% | neutral | 13 · -0.20R · 15% · day 1 -1.7% | 11 · -0.35R · 27% · day 1 -0.8% |  |
| management exit | 2–5% | weak | 18 · -0.42R · 22% · day 1 -2.5% | 11 · -0.16R · 36% · day 1 -0.1% |  |
| management exit | 2–5% | all | 46 · -0.44R · 15% · day 1 -1.4% | 28 · -0.27R · 29% · day 1 -0.6% |  |
| management exit | 5–10% | strong | 2 · +4.94R · 100% · day 1 +9.8% | 2 · -1.09R · 0% · day 1 +0.9% |  |
| management exit | 5–10% | neutral | 2 · -1.08R · 0% · day 1 -3.3% | 3 · -1.08R · 0% · day 1 -1.3% |  |
| management exit | 5–10% | weak | 1 · -1.07R · 0% · day 1 -0.9% | 2 · -0.68R · 0% · day 1 +0.5% |  |
| management exit | 5–10% | all | 5 · +1.33R · 40% · day 1 +2.4% | 7 · -0.97R · 0% · day 1 -0.2% |  |
| management exit | 10%+ | strong | 3 · -1.06R · 0% · day 1 -1.2% | 2 · -1.08R · 0% · day 1 +5.9% |  |
| management exit | 10%+ | neutral | 1 · -1.06R · 0% · day 1 -8.4% | – |  |
| management exit | 10%+ | weak | 1 · -0.63R · 0% · day 1 -1.7% | – |  |
| management exit | 10%+ | all | 5 · -0.97R · 0% · day 1 -2.7% | 2 · -1.08R · 0% · day 1 +5.9% |  |
| management exit | all gaps | strong | 163 · -0.29R · 28% · day 1 -0.3% | 75 · -0.14R · 28% · day 1 -0.0% |  |
| management exit | all gaps | neutral | 219 · -0.27R · 30% · day 1 -0.6% | 160 · -0.35R · 31% · day 1 -0.6% |  |
| management exit | all gaps | weak | 162 · -0.16R · 37% · day 1 -0.4% | 112 · -0.35R · 25% · day 1 -0.6% |  |
| management exit | all gaps | all | 544 · -0.24R · 31% · day 1 -0.5% | 347 · -0.30R · 28% · day 1 -0.5% |  |
| order | below 0% | strong | 25 · +0.10R · 40% · day 1 +0.5% | 24 · -0.64R · 13% · day 1 -1.3% |  |
| order | below 0% | neutral | 50 · +0.16R · 56% · day 1 +0.6% | 64 · -0.10R · 44% · day 1 +0.2% |  |
| order | below 0% | weak | 55 · +0.20R · 51% · day 1 +0.7% | 78 · -0.47R · 28% · day 1 -0.9% |  |
| order | below 0% | all | 130 · +0.17R · 51% · day 1 +0.6% | 166 · -0.35R · 32% · day 1 -0.6% |  |
| order | 0–2% | strong | 189 · -0.13R · 36% · day 1 -0.0% | 105 · -0.22R · 29% · day 1 -0.2% |  |
| order | 0–2% | neutral | 288 · -0.23R · 34% · day 1 -0.4% | 265 · -0.30R · 31% · day 1 -0.4% |  |
| order | 0–2% | weak | 163 · -0.33R · 29% · day 1 -0.6% | 191 · -0.22R · 32% · day 1 -0.4% |  |
| order | 0–2% | all | 640 · -0.22R · 33% · day 1 -0.4% | 561 · -0.26R · 31% · day 1 -0.4% |  |
| order | 2–5% | strong | 85 · -0.34R · 24% · day 1 -0.5% | 51 · -0.51R · 22% · day 1 -0.7% |  |
| order | 2–5% | neutral | 146 · -0.47R · 22% · day 1 -1.2% | 90 · -0.31R · 30% · day 1 -0.8% |  |
| order | 2–5% | weak | 82 · -0.18R · 35% · day 1 -0.2% | 113 · -0.53R · 22% · day 1 -0.8% |  |
| order | 2–5% | all | 313 · -0.36R · 26% · day 1 -0.8% | 254 · -0.45R · 25% · day 1 -0.8% |  |
| order | 5–10% | strong | 18 · -0.68R · 17% · day 1 -3.1% | 10 · -0.22R · 30% · day 1 -2.2% |  |
| order | 5–10% | neutral | 28 · -0.73R · 14% · day 1 -1.2% | 44 · +0.01R · 27% · day 1 +0.1% |  |
| order | 5–10% | weak | 28 · -0.73R · 18% · day 1 -0.9% | 33 · -0.14R · 30% · day 1 -1.4% |  |
| order | 5–10% | all | 74 · -0.72R · 16% · day 1 -1.5% | 87 · -0.07R · 29% · day 1 -0.7% |  |
| order | 10%+ | strong | 8 · -0.77R · 13% · day 1 -3.2% | 2 · -1.08R · 0% · day 1 -6.6% |  |
| order | 10%+ | neutral | 3 · +0.41R · 33% · day 1 +1.1% | 7 · -0.55R · 29% · day 1 -3.8% |  |
| order | 10%+ | weak | 2 · -1.06R · 0% · day 1 -7.4% | 2 · -1.06R · 0% · day 1 -2.5% |  |
| order | 10%+ | all | 13 · -0.54R · 15% · day 1 -2.8% | 11 · -0.74R · 18% · day 1 -4.0% |  |
| order | all gaps | strong | 325 · -0.21R · 31% · day 1 -0.4% | 192 · -0.36R · 24% · day 1 -0.7% |  |
| order | all gaps | neutral | 515 · -0.28R · 32% · day 1 -0.6% | 470 · -0.25R · 32% · day 1 -0.4% |  |
| order | all gaps | weak | 330 · -0.24R · 33% · day 1 -0.4% | 417 · -0.35R · 28% · day 1 -0.7% |  |
| order | all gaps | all | 1170 · -0.25R · 32% · day 1 -0.5% | 1079 · -0.31R · 29% · day 1 -0.6% |  |
| press release | below 0% | strong | 432 · -0.22R · 28% · day 1 -0.5% | 229 · -0.32R · 25% · day 1 -0.9% |  |
| press release | below 0% | neutral | 596 · -0.12R · 34% · day 1 -0.2% | 630 · -0.24R · 29% · day 1 -0.5% |  |
| press release | below 0% | weak | 589 · -0.20R · 32% · day 1 -0.2% | 458 · -0.25R · 32% · day 1 -0.3% |  |
| press release | below 0% | all | 1617 · -0.18R · 32% · day 1 -0.3% | 1317 · -0.26R · 30% · day 1 -0.5% |  |
| press release | 0–2% | strong | 899 · -0.13R · 31% · day 1 -0.1% | 359 · -0.32R · 28% · day 1 -0.7% |  |
| press release | 0–2% | neutral | 1311 · -0.27R · 31% · day 1 -0.5% | 834 · -0.23R · 30% · day 1 -0.4% |  |
| press release | 0–2% | weak | 752 · -0.19R · 34% · day 1 -0.2% | 662 · -0.14R · 35% · day 1 +0.0% |  |
| press release | 0–2% | all | 2962 · -0.21R · 32% · day 1 -0.3% | 1855 · -0.22R · 31% · day 1 -0.3% |  |
| press release | 2–5% | strong | 273 · -0.05R · 27% · day 1 -0.5% | 111 · -0.07R · 28% · day 1 -0.4% |  |
| press release | 2–5% | neutral | 348 · -0.36R · 25% · day 1 -0.8% | 255 · -0.27R · 26% · day 1 -0.7% |  |
| press release | 2–5% | weak | 250 · -0.04R · 33% · day 1 -0.4% | 178 · -0.09R · 32% · day 1 -0.3% |  |
| press release | 2–5% | all | 871 · -0.17R · 28% · day 1 -0.6% | 544 · -0.17R · 28% · day 1 -0.5% |  |
| press release | 5–10% | strong | 73 · -0.46R · 16% · day 1 -0.7% | 38 · -0.35R · 24% · day 1 -0.5% |  |
| press release | 5–10% | neutral | 79 · -0.20R · 22% · day 1 -1.1% | 78 · -0.16R · 27% · day 1 -0.3% |  |
| press release | 5–10% | weak | 59 · -0.43R · 19% · day 1 -0.8% | 47 · -0.40R · 23% · day 1 -0.1% |  |
| press release | 5–10% | all | 211 · -0.35R · 19% · day 1 -0.9% | 163 · -0.27R · 25% · day 1 -0.3% |  |
| press release | 10%+ | strong | 15 · +0.18R · 40% · day 1 +1.5% | 12 · +0.19R · 25% · day 1 -0.5% |  |
| press release | 10%+ | neutral | 9 · -0.58R · 11% · day 1 -1.7% | 16 · -0.63R · 13% · day 1 -3.5% |  |
| press release | 10%+ | weak | 8 · -1.03R · 0% · day 1 -1.8% | 4 · -1.08R · 0% · day 1 -8.3% |  |
| press release | 10%+ | all | 32 · -0.34R · 22% · day 1 -0.3% | 32 · -0.38R · 16% · day 1 -2.9% |  |
| press release | all gaps | strong | 1692 · -0.15R · 29% · day 1 -0.3% | 749 · -0.28R · 27% · day 1 -0.7% |  |
| press release | all gaps | neutral | 2343 · -0.24R · 30% · day 1 -0.5% | 1813 · -0.24R · 29% · day 1 -0.5% |  |
| press release | all gaps | weak | 1658 · -0.18R · 32% · day 1 -0.3% | 1349 · -0.18R · 33% · day 1 -0.1% |  |
| press release | all gaps | all | 5693 · -0.20R · 31% · day 1 -0.4% | 3911 · -0.23R · 30% · day 1 -0.4% |  |
| price-move query | below 0% | strong | 205 · -0.39R · 26% · day 1 -0.7% | 78 · -0.35R · 32% · day 1 -0.8% |  |
| price-move query | below 0% | neutral | 298 · -0.22R · 32% · day 1 -0.6% | 258 · -0.12R · 36% · day 1 +0.1% |  |
| price-move query | below 0% | weak | 117 · -0.07R · 42% · day 1 -0.2% | 180 · +0.02R · 40% · day 1 +0.3% |  |
| price-move query | below 0% | all | 620 · -0.25R · 32% · day 1 -0.6% | 516 · -0.11R · 37% · day 1 +0.1% |  |
| price-move query | 0–2% | strong | 517 · -0.32R · 24% · day 1 -0.7% | 165 · -0.20R · 33% · day 1 -0.2% |  |
| price-move query | 0–2% | neutral | 471 · -0.26R · 31% · day 1 -0.5% | 313 · -0.17R · 34% · day 1 -0.2% |  |
| price-move query | 0–2% | weak | 131 · -0.37R · 31% · day 1 -0.8% | 167 · -0.32R · 31% · day 1 -0.6% |  |
| price-move query | 0–2% | all | 1119 · -0.30R · 28% · day 1 -0.6% | 645 · -0.22R · 33% · day 1 -0.3% |  |
| price-move query | 2–5% | strong | 88 · -0.45R · 19% · day 1 -1.8% | 32 · +0.12R · 28% · day 1 -0.3% |  |
| price-move query | 2–5% | neutral | 73 · -0.23R · 23% · day 1 -1.3% | 67 · -0.26R · 30% · day 1 -0.6% |  |
| price-move query | 2–5% | weak | 25 · -0.45R · 24% · day 1 -2.1% | 36 · -0.45R · 25% · day 1 -0.2% |  |
| price-move query | 2–5% | all | 186 · -0.37R · 22% · day 1 -1.6% | 135 · -0.22R · 28% · day 1 -0.5% |  |
| price-move query | 5–10% | strong | 13 · -1.01R · 0% · day 1 -4.2% | 2 · +1.79R · 50% · day 1 +6.7% |  |
| price-move query | 5–10% | neutral | 12 · -0.73R · 17% · day 1 -2.2% | 11 · -1.06R · 0% · day 1 -6.6% |  |
| price-move query | 5–10% | weak | 1 · -1.05R · 0% · day 1 -14.8% | 6 · +0.17R · 33% · day 1 +2.0% |  |
| price-move query | 5–10% | all | 26 · -0.88R · 8% · day 1 -3.7% | 19 · -0.37R · 16% · day 1 -2.5% |  |
| price-move query | 10%+ | strong | 3 · -1.06R · 0% · day 1 -5.0% | 1 · -1.05R · 0% · day 1 -6.4% |  |
| price-move query | 10%+ | neutral | – | 3 · -1.08R · 0% · day 1 -4.5% |  |
| price-move query | 10%+ | all | 3 · -1.06R · 0% · day 1 -5.0% | 4 · -1.07R · 0% · day 1 -5.0% |  |
| price-move query | all gaps | strong | 826 · -0.36R · 24% · day 1 -0.9% | 278 · -0.19R · 32% · day 1 -0.3% |  |
| price-move query | all gaps | neutral | 854 · -0.25R · 31% · day 1 -0.6% | 652 · -0.18R · 34% · day 1 -0.2% |  |
| price-move query | all gaps | weak | 274 · -0.25R · 35% · day 1 -0.7% | 389 · -0.17R · 35% · day 1 -0.1% |  |
| price-move query | all gaps | all | 1954 · -0.30R · 28% · day 1 -0.8% | 1319 · -0.18R · 34% · day 1 -0.2% |  |
| rating change | below 0% | strong | 11 · +0.07R · 55% · day 1 +0.4% | 10 · -0.54R · 30% · day 1 -0.9% |  |
| rating change | below 0% | neutral | 35 · -0.21R · 34% · day 1 -0.3% | 38 · -0.01R · 39% · day 1 +0.1% |  |
| rating change | below 0% | weak | 40 · +0.34R · 55% · day 1 +1.8% | 40 · +0.02R · 45% · day 1 +0.3% | ✅ |
| rating change | below 0% | all | 86 · +0.08R · 47% · day 1 +0.7% | 88 · -0.06R · 41% · day 1 +0.1% |  |
| rating change | 0–2% | strong | 39 · -0.18R · 36% · day 1 -0.2% | 38 · -0.24R · 24% · day 1 -0.3% |  |
| rating change | 0–2% | neutral | 88 · -0.04R · 45% · day 1 -0.1% | 80 · -0.08R · 41% · day 1 -0.2% |  |
| rating change | 0–2% | weak | 60 · -0.02R · 45% · day 1 +0.2% | 50 · -0.05R · 36% · day 1 +0.0% |  |
| rating change | 0–2% | all | 187 · -0.06R · 43% · day 1 -0.0% | 168 · -0.11R · 36% · day 1 -0.1% |  |
| rating change | 2–5% | strong | 6 · -0.13R · 33% · day 1 +0.7% | 2 · +0.96R · 50% · day 1 +1.8% |  |
| rating change | 2–5% | neutral | 4 · -0.52R · 25% · day 1 -0.8% | 5 · -0.93R · 0% · day 1 -4.3% |  |
| rating change | 2–5% | weak | 4 · +0.26R · 50% · day 1 +0.5% | 2 · -0.74R · 0% · day 1 -1.2% |  |
| rating change | 2–5% | all | 14 · -0.13R · 36% · day 1 +0.2% | 9 · -0.47R · 11% · day 1 -2.3% |  |
| rating change | 5–10% | neutral | – | 1 · -0.66R · 0% · day 1 -1.6% |  |
| rating change | 5–10% | weak | 2 · +0.37R · 50% · day 1 -0.2% | – |  |
| rating change | 5–10% | all | 2 · +0.37R · 50% · day 1 -0.2% | 1 · -0.66R · 0% · day 1 -1.6% |  |
| rating change | 10%+ | neutral | 1 · -1.08R · 0% · day 1 -5.1% | 1 · +0.23R · 100% · day 1 +0.5% |  |
| rating change | 10%+ | all | 1 · -1.08R · 0% · day 1 -5.1% | 1 · +0.23R · 100% · day 1 +0.5% |  |
| rating change | all gaps | strong | 56 · -0.12R · 39% · day 1 +0.0% | 50 · -0.25R · 26% · day 1 -0.3% |  |
| rating change | all gaps | neutral | 128 · -0.11R · 41% · day 1 -0.2% | 125 · -0.10R · 39% · day 1 -0.3% |  |
| rating change | all gaps | weak | 106 · +0.13R · 49% · day 1 +0.8% | 92 · -0.04R · 39% · day 1 +0.1% |  |
| rating change | all gaps | all | 290 · -0.02R · 44% · day 1 +0.2% | 267 · -0.10R · 37% · day 1 -0.1% |  |
| regulatory | below 0% | strong | 117 · -0.13R · 37% · day 1 +0.1% | 55 · +0.01R · 47% · day 1 +0.0% |  |
| regulatory | below 0% | neutral | 275 · -0.03R · 41% · day 1 +0.1% | 297 · -0.17R · 37% · day 1 -0.1% |  |
| regulatory | below 0% | weak | 334 · +0.13R · 50% · day 1 +0.5% | 340 · -0.21R · 36% · day 1 -0.2% |  |
| regulatory | below 0% | all | 726 · +0.03R · 44% · day 1 +0.2% | 692 · -0.18R · 37% · day 1 -0.1% |  |
| regulatory | 0–2% | strong | 314 · -0.25R · 30% · day 1 -0.3% | 185 · -0.24R · 35% · day 1 -0.3% |  |
| regulatory | 0–2% | neutral | 533 · -0.21R · 35% · day 1 -0.4% | 454 · -0.22R · 32% · day 1 -0.2% |  |
| regulatory | 0–2% | weak | 448 · -0.18R · 37% · day 1 -0.1% | 332 · -0.34R · 29% · day 1 -0.4% |  |
| regulatory | 0–2% | all | 1295 · -0.21R · 35% · day 1 -0.3% | 971 · -0.27R · 32% · day 1 -0.3% |  |
| regulatory | 2–5% | strong | 24 · -0.20R · 29% · day 1 -0.6% | 11 · +0.06R · 36% · day 1 +0.1% |  |
| regulatory | 2–5% | neutral | 26 · -0.05R · 35% · day 1 -0.8% | 33 · -0.46R · 24% · day 1 -1.6% |  |
| regulatory | 2–5% | weak | 60 · +0.06R · 40% · day 1 -0.5% | 29 · +0.04R · 48% · day 1 +0.7% | ✅ |
| regulatory | 2–5% | all | 110 · -0.03R · 36% · day 1 -0.6% | 73 · -0.18R · 36% · day 1 -0.4% |  |
| regulatory | 5–10% | neutral | 2 · +0.25R · 50% · day 1 -2.1% | 7 · -1.07R · 0% · day 1 -2.8% |  |
| regulatory | 5–10% | weak | 10 · -0.31R · 10% · day 1 +0.1% | 5 · -0.28R · 40% · day 1 -1.0% |  |
| regulatory | 5–10% | all | 12 · -0.22R · 17% · day 1 -0.2% | 12 · -0.74R · 17% · day 1 -2.1% |  |
| regulatory | 10%+ | strong | 1 · +0.88R · 100% · day 1 +2.2% | – |  |
| regulatory | 10%+ | neutral | – | 1 · -1.09R · 0% · day 1 -1.6% |  |
| regulatory | 10%+ | all | 1 · +0.88R · 100% · day 1 +2.2% | 1 · -1.09R · 0% · day 1 -1.6% |  |
| regulatory | all gaps | strong | 456 · -0.22R · 32% · day 1 -0.2% | 251 · -0.17R · 38% · day 1 -0.2% |  |
| regulatory | all gaps | neutral | 836 · -0.15R · 37% · day 1 -0.2% | 792 · -0.22R · 33% · day 1 -0.2% |  |
| regulatory | all gaps | weak | 852 · -0.04R · 42% · day 1 +0.1% | 706 · -0.26R · 33% · day 1 -0.3% |  |
| regulatory | all gaps | all | 2144 · -0.12R · 38% · day 1 -0.1% | 1749 · -0.23R · 34% · day 1 -0.3% |  |

## Intraday (buy the open, sell the close; 0.5× daily range stop) — sme board

Each cell: trades · average R after costs · win rate · average open→close move on day 1. ✅ = kept (period 1: ≥ 30 trades and ≥ +0.05R a trade; period 2: ≥ 10 trades and positive in total).

| Filing type | Gap at the open | Market | Period 1 (set) | Period 2 (confirm) | |
|---|---|---|---|---|---|

Every case: `backtest/news-overnight.csv` (symbol, board, signal day, filing types, gap %, market type, day-1 open→close %, swing R).