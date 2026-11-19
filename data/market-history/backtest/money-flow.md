# Money flow — where big buyers go when the market is weak (tested 19 Nov 2026)

Idea: when FIIs and DIIs sell, the money goes somewhere; follow the traces big buyers leave in each stock. Three traces
were tested on every liquid NSE stock (Nov 2023 → Nov 2026), signals fixed before looking at results, bought at the
next open with the standard swing plan (2× daily range stop, 3R target, 30 sessions), judged on period 1 and
confirmed on period 2, after costs.

## 1. Bulk and block deals — `deals-report.md` (src/backtest/deals-run.ts)
A buyer counts only if it didn't sell the stock the same day (most bulk deals are high-speed traders who do both).
- Strong market: beats a random stock in both periods (kept ≥ ₹5 cr: +0.25R then +0.37R; random +0.04R / +0.09R).
  As the **bulk-deal-buy** rule in the one-account test it lifted period 1 from +22.5% to +46.3% (worst drop −19.1% →
  −16.8%) and period 2 from +28.5% to +38.2% — **live in a strong market** (strategies.ts).
- Weak market: lost in period 2 — even when a fund bought (fund ≥ ₹10 cr: +0.52R, then −0.71R; kept ≥ ₹5 cr: +0.20R,
  then −0.21R). Not traded.

## 2. Delivery spikes (shares taken home, not traded the same day)
Run as candidate rules in run.ts on 19 Nov 2026, then removed — none traded.
- delivery-spike: delivered shares ≥ 3× the 20-day average, up ≥ 2%, closing in the top half of the range
- delivery-spike-leader: the same in a Stage 2 uptrend
- steady-accumulation: 10 sessions of delivered shares ≥ 2× the 50 before, above the 50-day average, 20-day return 0 to +15%

| Rule · board · market · period | Closed trades | Win rate | Avg R | Total R | Avg sessions held | Skipped |
|---|---|---|---|---|---|---|
| delivery-spike · main · 1 set | 7685 | 31% | -0.08 | -634 | 15 | 4492 |
| delivery-spike · main · 2 confirm | 3939 | 27% | -0.19 | -732 | 14 | 1638 |
| delivery-spike-leader · main · 1 set | 2489 | 32% | -0.05 | -115 | 14 | 1711 |
| delivery-spike-leader · main · 2 confirm | 775 | 29% | -0.11 | -86 | 14 | 291 |
| steady-accumulation · main · 1 set | 4721 | 38% | +0.04 | +183 | 18 | 1566 |
| steady-accumulation · main · 2 confirm | 2284 | 33% | -0.09 | -199 | 18 | 636 |
| delivery-spike · main · neutral · 1 set | 3262 | 28% | -0.17 | -552 | 15 | 1777 |
| delivery-spike · main · neutral · 2 confirm | 1816 | 24% | -0.30 | -547 | 14 | 806 |
| delivery-spike · main · strong · 1 set | 3370 | 33% | -0.04 | -121 | 15 | 2257 |
| delivery-spike · main · strong · 2 confirm | 1075 | 35% | +0.05 | +53 | 15 | 498 |
| delivery-spike · main · weak · 1 set | 1053 | 38% | +0.04 | +39 | 17 | 458 |
| delivery-spike · main · weak · 2 confirm | 1048 | 26% | -0.23 | -239 | 13 | 334 |
| delivery-spike-leader · main · neutral · 1 set | 1057 | 28% | -0.19 | -198 | 14 | 646 |
| delivery-spike-leader · main · neutral · 2 confirm | 432 | 26% | -0.24 | -102 | 14 | 169 |
| delivery-spike-leader · main · strong · 1 set | 1199 | 34% | +0.05 | +63 | 14 | 913 |
| delivery-spike-leader · main · strong · 2 confirm | 163 | 44% | +0.34 | +56 | 18 | 71 |
| delivery-spike-leader · main · weak · 1 set | 233 | 39% | +0.08 | +20 | 17 | 152 |
| delivery-spike-leader · main · weak · 2 confirm | 180 | 23% | -0.22 | -40 | 12 | 51 |
| steady-accumulation · main · neutral · 1 set | 1933 | 36% | +0.00 | +5 | 18 | 642 |
| steady-accumulation · main · neutral · 2 confirm | 1178 | 32% | -0.12 | -139 | 18 | 355 |
| steady-accumulation · main · strong · 1 set | 2054 | 39% | +0.06 | +114 | 18 | 601 |
| steady-accumulation · main · strong · 2 confirm | 524 | 41% | +0.18 | +95 | 20 | 114 |
| steady-accumulation · main · weak · 1 set | 734 | 40% | +0.09 | +64 | 20 | 323 |
| steady-accumulation · main · weak · 2 confirm | 582 | 27% | -0.27 | -155 | 17 | 167 |
| delivery-spike · main | 3752 | 28% | -0.17 | -648 | 14 | 1583 |
| delivery-spike-leader · main | 723 | 29% | -0.10 | -74 | 14 | 281 |
| steady-accumulation · main | 2167 | 33% | -0.07 | -142 | 18 | 608 |

Weak market: all three made a little in period 1 and lost in period 2 (−0.23R, −0.22R, −0.27R). Strong market: two
passed per trade, but adding them to the account made period 1 worse (+22.5% → +20.0%, worst drop −19.1% → −30.6%), so
they were not kept.

## 3. Quarterly shareholding change (FII / DII / mutual fund %) — not tested yet
The split is only inside each quarterly XBRL filing (~200 KB; ~20,000 files for 1,700 stocks × 12 quarters) and is
published ~45 days after the quarter — a fit for the long-term screens rather than swing buys.

## The pattern
In the check period (Nov 2025 → Nov 2026) every way of buying in a weak market lost — price setups, news, delivery,
even fund buying. A random liquid stock bought in a weak market lost −0.24R a trade in that period.
