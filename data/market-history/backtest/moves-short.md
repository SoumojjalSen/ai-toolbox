# Sharp rises in the last year (2025-11-17 → 2026-11-17) — what the system knew the evening before

Every NSE stock (main board and SME) on every session: did it close 10%+ higher within 1, 2, 3 or 5 sessions? Each case is put in one group by what the system said at the close before the rise began (first match): **live buy** (a rule fired and is traded in that market type — strategies.ts), **rule fired (watchlist)** (a rule fired in the last 5 sessions but isn't traded in that market type), **long-term screen** (compounders or CANSLIM passed, main board), **not flagged** (scanned, nothing said), **not scanned** (turnover under ₹50 lakh a day, SME ₹10 lakh).

**How to read it:** "Chance of a rise" is how often a stock in that group rose 10%+ next; "vs base rate" compares it with any stock (1.00× = no better than chance). A flag only helps if it is well above 1.00×.

### Rose 10%+ within 1 session — 4814 rises (5260 stock-days, base rate 0.8% of all stock-days)

| What the system said at the close before | Stock-days | Rises that followed | Share of all rises | Chance of a rise | vs base rate |
|---|---|---|---|---|---|
| live buy | 1142 | 26 | 0.5% | 2.3% | 2.74× |
| rule fired (watchlist) | 26822 | 182 | 3.5% | 0.7% | 0.82× |
| long-term screen | 20760 | 141 | 2.7% | 0.7% | 0.82× |
| not flagged | 416090 | 3052 | 58.0% | 0.7% | 0.88× |
| not scanned (illiquid) | 167642 | 1859 | 35.3% | 1.1% | 1.33× |

### Rose 10%+ within 2 sessions — 10423 rises (16011 stock-days, base rate 2.6% of all stock-days)

| What the system said at the close before | Stock-days | Rises that followed | Share of all rises | Chance of a rise | vs base rate |
|---|---|---|---|---|---|
| live buy | 1140 | 51 | 0.3% | 4.5% | 1.75× |
| rule fired (watchlist) | 26641 | 673 | 4.2% | 2.5% | 0.99× |
| long-term screen | 20603 | 390 | 2.4% | 1.9% | 0.74× |
| not flagged | 413694 | 9582 | 59.8% | 2.3% | 0.91× |
| not scanned (illiquid) | 165146 | 5315 | 33.2% | 3.2% | 1.26× |

### Rose 10%+ within 3 sessions — 12787 rises (25116 stock-days, base rate 4.0% of all stock-days)

| What the system said at the close before | Stock-days | Rises that followed | Share of all rises | Chance of a rise | vs base rate |
|---|---|---|---|---|---|
| live buy | 1131 | 71 | 0.3% | 6.3% | 1.55× |
| rule fired (watchlist) | 26465 | 1073 | 4.3% | 4.1% | 1.00× |
| long-term screen | 20453 | 676 | 2.7% | 3.3% | 0.82× |
| not flagged | 411291 | 15136 | 60.3% | 3.7% | 0.91× |
| not scanned (illiquid) | 162563 | 8160 | 32.5% | 5.0% | 1.24× |

### Rose 10%+ within 5 sessions — 14127 rises (40698 stock-days, base rate 6.7% of all stock-days)

| What the system said at the close before | Stock-days | Rises that followed | Share of all rises | Chance of a rise | vs base rate |
|---|---|---|---|---|---|
| live buy | 1119 | 105 | 0.3% | 9.4% | 1.41× |
| rule fired (watchlist) | 26017 | 1939 | 4.8% | 7.5% | 1.12× |
| long-term screen | 20175 | 1181 | 2.9% | 5.9% | 0.88× |
| not flagged | 406540 | 25910 | 63.7% | 6.4% | 0.96× |
| not scanned (illiquid) | 157317 | 11563 | 28.4% | 7.4% | 1.10× |

Every rise with its group: `backtest/moves-short.csv` (sessions, symbol, board, start, % rise, group).