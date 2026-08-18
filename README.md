# Daily JSE Market Dashboard

A mobile-friendly Jamaica Stock Exchange dividend-investor dashboard for:

- TJH — TransJamaican Highway Limited
- CAR — Carreras Limited
- NCBFG — NCB Financial Group Limited
- SVL — Supreme Ventures Limited
- GK — GraceKennedy Limited
- JMMBGL — JMMB Group Limited

## Features

- Responsive desktop table and mobile stock cards
- Dark/light mode
- Color-coded gains, losses, ratings and target buy-zone status
- Interactive filter tiles and sorting
- Dividend dates/status
- Dividend investor ranking and allocation view
- Direct links to JSE and StockAnalysis
- Netlify-ready static deployment

## Data model

Daily values are stored in `data.js`, deliberately separated from presentation logic. Update the objects in that file to refresh prices, performance, dividends, ratings, target buy zones, and allocations without redesigning the UI.

Source policy: official Jamaica Stock Exchange information should be treated as primary for declarations and official market data. StockAnalysis can be used as a delayed/historical fallback where required.

## Deploy to Netlify

1. In Netlify, choose **Add new project → Import an existing project**.
2. Connect GitHub and select `kbuckle10/daily-jse-market-dashboard`.
3. Build command: leave blank.
4. Publish directory: `.`
5. Deploy.

The included `netlify.toml` already defines the publish directory and SPA fallback.

> The repository may remain private. Netlify can deploy a private GitHub repository when the Netlify GitHub integration has permission to access it.

## Disclaimer

For research and monitoring only. Verify corporate actions and market information with official JSE sources before making investment decisions.