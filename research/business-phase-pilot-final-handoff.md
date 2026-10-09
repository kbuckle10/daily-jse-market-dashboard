# Four-stock Business Phase pilot — final research handoff (9 October 2026)

**Disposition: RESEARCH PILOT COMPLETE / PRODUCTION PROMOTION HOLD.** This is a final bounded assessment, not a request for additional incremental dashboard features. No production ratings, Fresh Capital allocations, dividend data, collectors or production pages were changed.

## FY2021–2025 evidence summary

| Stock | Model | Positive FCF years | Positive OCF years | FY2025 conventional FCF | Provisional business-phase hypothesis | Confidence |
|---|---|---:|---:|---:|---|---|
| TJH | Asset-heavy toll-road concession | 5/5 | 5/5 | US$50.210m | Mature cash generator **candidate**, conditional on debt service, restricted cash, concession upkeep and 2025 audited reconciliation | Low |
| SEP | Asset-heavy manufacturing/distribution | 4/5 | 4/5 | J$5,664.137m | Self-funding growth **candidate**, conditional on comparable profit definitions, acquisition and maintenance/growth CapEx analysis | Low |
| SVL | Asset-light lottery/betting | 4/5 | 5/5 | J$1,916.912m | Mature cash generator **candidate**, conditional on software/intangible investment, cash conversion and regulatory obligations | Low |
| JSE | Asset-light exchange operator | 5/5 | 5/5 | J$361.096m | Mature cash generator **candidate**, conditional on market-cycle sensitivity, software investment and capital returns | Low |

**These are analyst hypotheses, not published classifications.** The JSON `phase` field deliberately remains `unclassified` for all four companies. The word *candidate* does not assert that phase gates have been met. Do not feed hypotheses into BUY/HOLD/WATCH, Income Score, Growth Score, Fresh Capital or production screens.

## Important accounting distinctions

- **TJH:** FY2025 OCF US$52.47m and conventional FCF US$50.21m are third-party figures, not reconciled to issuer FY2025 audited cash flow. The staging US$96.42m broader revenue series is not directly comparable to approximately US$91.2m issuer toll revenue. Suppress FY2025 revenue growth and treat revenue-based margins as unverified. FY2024 conventional FCF US$42.529m is not distributable cash: debt principal, restricted cash funding, lease principal and dividends consume cash.
- **SEP:** FY2024 and FY2025 consolidated operating profit were corrected to issuer definitions; FY2021–2023 and TTM operating-profit definitions are not harmonized. The page withholds SEP TTM profit-based ratios.
- **SVL/JSE:** FY2024–2025 conventional FCF includes PPE **and intangible** asset purchases. Older years and TTM remain research snapshots.
- **All:** Cash flow and income TTM dates may differ. FCF = OCF minus specified cash CapEx, not free cash available after financing, acquisitions, required reserves or distributions. Different reporting currencies prohibit comparing absolute amounts directly.

## Verification and release gates

| Gate | Result |
|---|---|
| Four-company schema and FY2021–2025 + TTM coverage | PASS — 24 records |
| Internal FCF arithmetic (OCF + signed CapEx) | PASS — 24/24 within 0.011 million |
| No unsupported phase assignments | PASS — 4/4 unclassified |
| Issuer FY2024–2025 cash-flow spot checks | PARTIAL — 7/8 company-years |
| Three or more consistently defined audited annual years | NOT MET |
| TJH FY2025 audited cash-flow and toll/total revenue reconciliation | NOT MET |
| ROIC, leverage, sector obligations, capital returns | NOT MET |
| GitHub Actions workflow execution and browser rendering | NOT CONFIRMED |

The staging workflow runs `scripts/validate-business-phase-pilot.mjs` and `scripts/smoke-test-business-phase-pilot.mjs`. These scripts and the staging HTML are committed, but an actual successful GitHub Actions run and browser rendering have **not** been independently verified. Static repository inspection is not a substitute for executing the workflow.

## Final recommendation

**Close the four-stock research implementation as delivered. HOLD production promotion and HOLD automated phase labels.** Keep this handoff as the acceptance record. Reopen only when new issuer evidence and a confirmed successful CI/browser test justify phase publication. This is a deliberate evidence-based finish, not an incomplete production rollout.
