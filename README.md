# Daily JSE Market Dashboard

A mobile-first, installable Jamaica Stock Exchange investor dashboard focused on dividend income, valuation, quality, growth, financial strength, momentum and market liquidity. It can run in the browser or be installed as a standalone Progressive Web App (PWA) on supported mobile devices.

The dashboard uses a configurable watchlist rather than a fixed ticker list, so the tracked universe can grow without redesigning the UI.

## Current features

- Responsive desktop table and mobile stock cards
- Installable Progressive Web App (PWA) with standalone mobile experience
- Android-safe app icons, web app manifest and service-worker shell
- In-dashboard refresh control for reloading the latest published dashboard without clearing saved preferences
- Configurable watchlist with Add / Remove / Analyze controls
- Watchlist filters for All, Tracked and Untracked stocks
- Searchable Focus / Compare control supporting up to 4 tracked tickers
- Dark/light mode
- Color-coded gains, losses, ratings and target buy-zone status
- Interactive market filters and sorting
- Direct JSE and StockAnalysis links
- Price vs Book Value valuation lens with sector-aware P/B relevance
- Financial/cash-flow metrics including payout ratio, free cash flow and related coverage metrics where available
- Dividend Investor Ranking / Fresh Capital analysis
- Six-lens expert scorecard: Valuation, Quality, Growth, Financial Strength, Dividend and Momentum
- Overall Expert Score using weighted available lenses
- Dividend Income vs Bank Savings interactive comparison
- Adjustable investment amount from J$10,000 to J$10,000,000
- Suggested New-Money Allocation for Buy-class stocks using Overall Expert Score and entry-price context
- Dividend payment recency warnings so stale historical dividends are not presented as current income
- Market Activity / liquidity context using available trading activity, relative volume, participation and turnover signals
- Liquidity-aware Fresh Capital narrative so attractive fundamentals are distinguished from practical execution capacity
- Dynamic Main Market universe discovery/validation rather than relying only on a permanently fixed ticker list

## Install as a mobile app

The dashboard is a Progressive Web App (PWA) and can be installed as a standalone app on supported Android/Chrome devices.

On Android with Chrome:

1. Open the production dashboard in Chrome.
2. Open the Chrome menu (**⋮**).
3. Choose **Install and create shortcut**.
4. Select **Install** — not **Create shortcut**.
5. Launch **JSE Dashboard** from the Android home screen.

A successful PWA installation opens in standalone mode without the normal Chrome address bar or Chrome badge on the app icon. **Create shortcut** is different: it creates a browser shortcut that continues to open in Chrome.

The PWA uses a web app manifest, Android-safe RGBA/maskable icons and a service worker. Installing or refreshing the app does not intentionally clear the dashboard's saved watchlist, holdings, average-buy-price or other local browser preferences.

The **↻ Refresh** control reloads the current published dashboard and is available both in the browser and installed app.

## Expert score framework

The visible Overall Expert Score is built from the six analytical lenses using these target weights:

| Lens | Weight |
| --- | ---: |
| Valuation | 20% |
| Quality | 20% |
| Growth | 15% |
| Financial Strength | 15% |
| Dividend | 20% |
| Momentum | 10% |

When a lens cannot be calculated because its underlying metrics are unavailable, the available weights are rebalanced rather than treating missing information as a zero score.

The score provides analytical context and does not replace the primary Buy / Hold / Avoid rating, valuation signal or target buy zone.

## Suggested allocation

Only Buy-class stocks are eligible for Suggested New-Money Allocation. Hold, Watch and Avoid-rated stocks receive 0% new-money allocation.

For eligible stocks, the dashboard currently uses:

`allocation weight = Overall Expert Score × entry-price multiplier`

Entry-price multipliers:

- Below target buy zone: 1.10×
- In target buy zone: 1.00×
- Above target buy zone: 0.80×

Eligible weights are normalized to 100% across the applicable tracked/focused stocks.

## Market Activity and liquidity

Market Activity is used as an execution and position-sizing modifier rather than as a replacement for company fundamentals.

The long-term investor framework keeps the majority of analytical emphasis on fundamentals, income, valuation and dividend safety, while liquidity/activity provides secondary context. Where the required market data is available, the dashboard can incorporate measures such as relative volume, recent market participation and turnover into the narrative.

This matters particularly for less-liquid JSE securities: a stock can have an attractive income or valuation profile while still being difficult to accumulate in a large position at one price. The Fresh Capital analysis can therefore distinguish **investment attractiveness** from **execution pace**, including staged-entry context where appropriate.

Liquidity does not automatically change a company's underlying fundamental quality. It informs how realistically new capital may be deployed.

## Dividend model

Dividend fields intentionally distinguish historical paid income from the current annual income rate:

- **Paid TTM DPS** — calculated from official JSE Corporate Actions by summing qualifying dividends in the trailing 12-month window. Payment date is the preferred date basis, with fallback handling when necessary.
- **Current Annual DPS** — the current annual dividend figure collected from StockAnalysis Statistics. This can reflect an already-declared upcoming dividend and is used by the Dividend Income opportunity calculation.
- **Latest official dividend / dates** — JSE Corporate Actions remains authoritative for the latest dividend amount, ex-date, record date and payment date.
- **Projected / earnings-implied DPS** — an analytical estimate based on earnings and payout information where shown; it is not treated as an officially declared dividend.

The dashboard does not assume that every company pays quarterly. TTM calculations are date-based and therefore support quarterly, semiannual, annual and irregular dividend schedules.

## Data sources and priority

1. **Jamaica Stock Exchange (JSE)** — authoritative source for the latest completed Jamaica close and official corporate actions, including declared dividend amount, declared currency, ex-date, record date and payment date. Direct JSE instrument pages and their Corporate Actions tables are preferred when available.
2. **StockAnalysis** — research/history source for delayed/historical performance, Statistics-tab fundamentals and current annual dividend metrics. For dividends, the newest valid declared event may be displayed while the official JSE table catches up.
3. **Foreign-currency events** — the declared dividend currency is preserved. Where a JMD equivalent is shown, the conversion should retain FX provenance rather than silently treating a foreign-currency dividend as JMD.

Source/date metadata should be preserved so the UI can distinguish official JSE information from StockAnalysis research data.

## Data and collectors

Generated dashboard values are stored in `data.js`, separated from presentation logic. The repository collectors/workflows refresh prices, performance, dividends, corporate actions, financial/statistical metrics and source metadata.

The production GitHub Actions workflow is **Refresh Daily JSE Main Market**. The dashboard is deployed through GitHub Pages.

The weekday production schedule is maintained in UTC for GitHub Actions reliability:

- **21:30 UTC / 4:30 PM Jamaica** — primary refresh
- **22:05 UTC / 5:05 PM Jamaica** — guarded fallback
- **23:05 UTC / 6:05 PM Jamaica** — guarded safety fallback

Fallback runs check whether a sufficiently fresh same-day Jamaica refresh has already been published and skip unnecessary duplicate collection. The workflow also uses concurrency and stale-publish protections so an older collector run does not overwrite newer repository/data changes.

Collector logic should be fixed at the source when a metric is wrong rather than patching individual ticker values in the UI.

## Focus / Compare

The watchlist itself is intentionally not capped. Focus is a separate analytical control:

- No focus selection = All tracked stocks
- One selected ticker = single-company focus
- 2–4 selected tickers = comparison mode
- Maximum comparison set = 4 tickers to preserve desktop and mobile usability

Focus selections are displayed as removable ticker chips and can be found by typing either ticker or company name.

## Disclaimer

For research and monitoring only — not personal financial advice. Dividend income is variable equity income rather than guaranteed bank interest. Share prices can fall and companies can reduce or suspend dividends. Verify official corporate actions with the Jamaica Stock Exchange before trading.