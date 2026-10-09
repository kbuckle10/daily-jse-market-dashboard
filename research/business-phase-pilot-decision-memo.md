# Business Phase four-stock pilot — consolidated decision memo

**Status:** Research-only staging. No changes to production dashboard, BUY/HOLD/WATCH, Fresh Capital, income scores or collector. **No phase classifications approved.**

## Preliminary FY2025 operating profile

All percentages calculated from existing staging records, not independently certified. Revenue growth compares FY2025 with FY2024; operating and FCF margins use FY2025 revenue; FCF/OCF is cash conversion. Companies report in their own currencies; do not compare absolute USD and JMD amounts.

| Stock | Business model (provisional) | FY25 revenue growth | FY25 operating margin | FY25 FCF margin | FY25 FCF/OCF | Issuer cash-flow spot checks |
|---|---|---:|---:|---:|---:|---|
| TJH | asset heavy operating | 11.3% | 64.5% | 52.1% | 95.7% | 2024 only |
| SEP | asset heavy operating | 14.0% | 7.3% | 3.7% | 60.8% | 2024, 2025 |
| SVL | asset light operating | 3.5% | 5.9% | 3.5% | 68.7% | 2024, 2025 |
| JSE | asset light operating | 9.6% | 21.4% | 13.0% | 73.0% | 2024, 2025 |

**Interpretation limits:** SEP operating profit was restated in this research dataset to match the FY2025 consolidated-statement definition; historical and TTM definitions remain unharmonized. TJH FY2025 remains third-party research only. FCF here deducts recorded PPE/intangible purchases but does not include acquisition financing, mandatory concession cash reserves, or debt repayments. These are NOT phase scores.

## Proposed five business phases (research definitions, not an assertion about the original Stock Simplifier taxonomy)

1. **Early / investment:** revenue growth, weak or negative FCF, capital being invested ahead of profits.
2. **Scaling:** expanding revenue and improving unit economics, reinvestment remains high.
3. **Self-funding growth:** sustained positive FCF and profitable growth; growth spending funded internally.
4. **Mature cash generator:** moderate growth, durable FCF, controlled reinvestment, regular distributions.
5. **Declining / restructuring:** sustained contraction or deteriorating returns; distribution sustainability at risk.

Do not assign a phase based on one year of FCF or a high FCF margin. At least 3 comparable audited annual years plus current interim data and sector-specific return-on-capital/debt analysis should be available. A mature company can have a temporarily negative FCF year because of a one-off acquisition.

## Sector-specific classification gates

- **TJH / asset-heavy concession:** validate concession intangible assets, cash restricted for debt service, maintenance and handback commitments, debt service coverage, leverage, dividends, and expansion acquisitions. Conventional CapEx alone is misleading.
- **SEP / manufacturing and distribution:** verify maintenance versus growth CapEx, working-capital swings, acquisition cash flow, ROIC and consistent consolidated operating-profit definition.
- **SVL / asset-light platform and betting:** include software/intangible purchases, platform leases, license and regulatory costs, operating cash conversion, capital distributions.
- **JSE / exchange and technology infrastructure:** include software/intangible purchases, recurring revenue, technology reinvestment, operating leverage, capital returns and market-volume cyclicality.

## Evidence and QA status

- Four companies, FY2021–FY2025 plus TTM = 24 records.
- FCF arithmetic computed as OCF plus signed negative CapEx. Four prior small discrepancies were repaired by deriving FCF from recorded inputs, with original reported research FCF preserved in `originalResearchFreeCashFlow` and source status kept provisional.
- Issuer cash-flow spot-check flags cover **7 of 8** FY2024–FY2025 company-years: TJH FY2024; SEP, SVL and JSE FY2024 and FY2025. This does **not** certify all metrics or older years.
- TJH FY2025, all earlier annual periods, and TTM require issuer verification. Period alignment, operating-profit consistency and ROIC/debt metrics are unresolved.
- Validator workflow has been committed but a successful GitHub Actions run has **not** been confirmed.

## Decision and next execution gate

**Decision: HOLD all phase classifications; continue research in staging.** Do not block existing production refreshes or change production investment ratings. To graduate: (1) reconcile audited FY2025 TJH; (2) standardize 3-year income and FCF definitions; (3) add leverage/ROIC and sector-specific obligations; (4) confirm GitHub Actions and browser rendering; (5) only then propose provisional phases for review.

**Research source references:** TJH https://www.transjamhighways.com/investor-relations/ ; SEP https://www.seprod.com/investor-relations/ ; SVL https://supremeventures.com/financial-reports/annual-report/annual-report-2025/ ; JSE https://www.jamstockex.com/
