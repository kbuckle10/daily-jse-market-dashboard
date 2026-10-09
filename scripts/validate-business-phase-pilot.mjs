import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'research/business-phase-four-stock-pilot.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const expected = ['TJH', 'SEP', 'SVL', 'JSE'];
const metrics = ['revenue', 'operatingProfit', 'operatingCashFlow', 'capitalExpenditures', 'freeCashFlow'];
const sourceYears = [2024, 2025];
const acceptedEvidenceFlags = ['reconciledToIssuer2025AnnualReport', 'reconciledToIssuer2025AuditedConsolidatedStatements', 'reconciledToIssuer2024AnnualReport'];
const pct = (a, b) => b > 0 ? +(100 * a / b).toFixed(2) : null;
const results = {};

for (const ticker of expected) {
  const stock = data.stocks[ticker];
  assert.ok(stock, 'Missing stock ' + ticker);
  assert.equal(stock.records.length, 6, ticker + ': requires 5 annual + TTM');
  assert.deepEqual(stock.records.map(x => String(x.period)), ['2021','2022','2023','2024','2025','TTM']);
  const warnings = [];
  for (const record of stock.records) {
    for (const metric of metrics) assert.ok(Number.isFinite(record[metric]), ticker + ' ' + record.period + ' invalid ' + metric);
    assert.ok(record.revenue > 0, ticker + ' ' + record.period + ' revenue must be positive');
    const tolerance = Math.max(2, Math.abs(record.freeCashFlow) * 0.02);
    assert.ok(Math.abs(record.operatingCashFlow + record.capitalExpenditures - record.freeCashFlow) <= tolerance,
      ticker + ' ' + record.period + ' FCF reconciliation failed');
    if (record.capitalExpenditures > 0) warnings.push(record.period + ': positive CapEx; verify sign');
  }
  const ttm = stock.records.at(-1), fy = stock.records.at(-2), prior = stock.records.at(-3);
  const spotCheck = data.validation?.issuerStatementSpotChecks?.[ticker];
  const auditedYears = sourceYears.filter(year => {
    const record = stock.records.find(x => x.period === year);
    return Boolean(spotCheck?.source && spotCheck?.years?.includes(year) && acceptedEvidenceFlags.some(flag => record?.[flag] === true));
  });
  const issuerCoverage = { auditedYears, targetYears: sourceYears, complete: auditedYears.length === 2 };
  if (!issuerCoverage.complete) warnings.push('Issuer reconciliation incomplete for FY2024–FY2025');
  if (ticker === 'SEP' && ![fy,prior].every(x => x.operatingProfitDefinition?.includes('Audited consolidated'))) warnings.push('Seprod operating-profit definitions require review');
  const comparableProfit = Boolean(fy.operatingProfitDefinition && fy.operatingProfitDefinition === prior.operatingProfitDefinition);
  if (!comparableProfit) warnings.push('Operating-profit growth suppressed: FY2024 and FY2025 definitions not proven comparable');
  if (!ttm.reconciledToIssuer2025AnnualReport && !ttm.reconciledToIssuer2025AuditedConsolidatedStatements) warnings.push('TTM income and cash flow remain provisional; metrics are research-only');
  if (ticker === 'TJH') {
    warnings.push('Concession rights and maintenance obligations not captured by conventional PPE CapEx');
    assert.equal(fy.sourceStatus, 'third_party_research_not_issuer_reconciled', 'TJH FY2025 must not be presented as issuer audited until source reconciliation');
    const bridge = stock.infrastructureCashFlowReview?.fy2024;
    if (bridge) {
      const expected = bridge.conventionalFreeCashFlow - bridge.principalDebtRepayment - bridge.leasePrincipalRepayment - bridge.restrictedCashIncrease;
      assert.ok(Math.abs(expected - bridge.illustrativeCashAfterDebtPrincipalAndRestrictedCash) < 0.001, 'TJH restricted cash bridge arithmetic');
      assert.ok(Math.abs(expected - bridge.dividendsPaid - bridge.illustrativeCashAfterDebtRestrictedCashAndDividends) < 0.001, 'TJH dividend bridge arithmetic');
    }
  }
  results[ticker] = {
    businessModel: stock.businessModelCategory,
    issuerCoverage,
    phase: 'unclassified',
    confidence: 'insufficient evidence',
    ttm: {
      operatingMarginPct: pct(ttm.operatingProfit, ttm.revenue),
      fcfConversionOfOperatingProfitPct: pct(ttm.freeCashFlow, ttm.operatingProfit),
      capexToOperatingCashFlowPct: pct(Math.abs(ttm.capitalExpenditures), Math.abs(ttm.operatingCashFlow)),
      fcfMarginPct: pct(ttm.freeCashFlow, ttm.revenue)
    },
    latestFiscalYear: {
      revenueGrowthPct: pct(fy.revenue - prior.revenue, prior.revenue),
      operatingProfitGrowthPct: comparableProfit ? pct(fy.operatingProfit - prior.operatingProfit, Math.abs(prior.operatingProfit)) : null
    },
    sourceValidation: issuerCoverage.complete ? 'FY2024–2025 issuer cash-flow spot checks only; earlier periods and TTM pending' : 'FY2024–2025 issuer cash-flow spot checks incomplete',
    warnings
  };
}
assert.equal(Object.keys(data.stocks).length, 4, 'Pilot must contain only four stocks');
assert.equal(data.modelFramework.categories.length, 4, 'Four analytical categories required');
fs.mkdirSync('artifacts', {recursive:true});
fs.writeFileSync('artifacts/business-phase-four-stock-validation.json', JSON.stringify({
  generatedAt: new Date().toISOString(), status: 'internal-arithmetic-pass-external-source-pending',
  methodology: 'FCF=OCF+negative CapEx; TTM growth deliberately not calculated against fiscal-year figures',
  stocks: results
}, null, 2) + '\n');
console.log('PASS: four-stock pilot structure and arithmetic; issuer source validation remains PARTIAL');
for (const [ticker, result] of Object.entries(results)) console.log(ticker, JSON.stringify(result.ttm));
