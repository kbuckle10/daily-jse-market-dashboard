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
const arithmeticFailures = [];

for (const ticker of expected) {
  const stock = data.stocks[ticker];
  assert.equal(stock.phase, 'unclassified', ticker + ': research pilot must not publish a phase before source verification');
  assert.equal(stock.sourceVerification, 'pending', ticker + ': issuer source verification cannot be silently marked complete');
  assert.ok(stock, 'Missing stock ' + ticker);
  assert.equal(stock.records.length, 6, ticker + ': requires 5 annual + TTM');
  assert.deepEqual(stock.records.map(x => String(x.period)), ['2021','2022','2023','2024','2025','TTM']);
  const warnings = [];
  for (const record of stock.records) {
    for (const metric of metrics) assert.ok(Number.isFinite(record[metric]), ticker + ' ' + record.period + ' invalid ' + metric);
    assert.ok(record.revenue > 0, ticker + ' ' + record.period + ' revenue must be positive');
    const tolerance = 0.011; // data expressed in millions; allow 0.01m rounding, not a percentage-based mismatch
    const difference = +(record.operatingCashFlow + record.capitalExpenditures - record.freeCashFlow).toFixed(6);
    if (Math.abs(difference) > tolerance) arithmeticFailures.push({ ticker, period: record.period, differenceMillions: difference, toleranceMillions: tolerance });
    if (record.capitalExpenditures > 0) warnings.push(record.period + ': positive CapEx; verify sign');
  }
  const ttm = stock.records.at(-1), fy = stock.records.at(-2), prior = stock.records.at(-3);
  const spotCheck = data.validation?.issuerStatementSpotChecks?.[ticker];
  const auditedYears = sourceYears.filter(year => {
    const record = stock.records.find(x => x.period === year);
    return Boolean(spotCheck?.source && spotCheck?.years?.includes(year) && acceptedEvidenceFlags.some(flag => record?.[flag] === true));
  });
  const issuerCoverage = { auditedYears, targetYears: sourceYears, complete: auditedYears.length === 2 };
  const issuerEvidenceCount = auditedYears.length;
  assert.ok(issuerEvidenceCount <= 2, 'Invalid issuer evidence count');
  const sourceStatus = Object.fromEntries(stock.records.map(record => [
    String(record.period),
    acceptedEvidenceFlags.some(flag => record[flag] === true) ? 'issuer-spot-check' : (record.sourceStatus || 'provisional')
  ]));
  const sourceCoverage = { verified: Object.values(sourceStatus).filter(x => x === 'issuer-spot-check').length, total: stock.records.length, byPeriod: sourceStatus };
  const annual = stock.records.filter(x => typeof x.period === 'number');
  const historicalQuality = {
    annualPeriods: annual.length,
    positiveFcfYears: annual.filter(x => x.freeCashFlow > 0).length,
    positiveOcfYears: annual.filter(x => x.operatingCashFlow > 0).length,
    annualFcfMarginsPct: Object.fromEntries(annual.map(x => [String(x.period), pct(x.freeCashFlow, x.revenue)])),
    fiveYearFcfSumMillions: +annual.reduce((sum, x) => sum + x.freeCashFlow, 0).toFixed(3),
    fiveYearOcfSumMillions: +annual.reduce((sum, x) => sum + x.operatingCashFlow, 0).toFixed(3),
    dataStatus: 'mixed issuer spot checks and provisional research; not an investment score'
  };
  if (!issuerCoverage.complete) warnings.push('Issuer reconciliation incomplete for FY2024–FY2025');
  if (annual.length !== 5) warnings.push('Five annual records required for historical trend');
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
    sourceCoverage,
    historicalQuality,
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
assert.equal(data.validation.phaseClassification, 'disabled pending evidence', 'Pilot classification must remain disabled until verified');
fs.mkdirSync('artifacts', {recursive:true});
fs.writeFileSync('artifacts/business-phase-four-stock-validation.json', JSON.stringify({
  generatedAt: new Date().toISOString(), status: arithmeticFailures.length ? 'arithmetic-fail-source-reconciliation-required' : 'internal-arithmetic-pass-external-source-pending',
  arithmeticFailures,
  methodology: 'FCF=OCF+negative CapEx, with maximum 0.011 million rounding tolerance; TTM growth deliberately not calculated against fiscal-year figures. Source flags indicate issuer spot-checks only, not full audit of all five metrics.',
  stocks: results
}, null, 2) + '\n');
if (arithmeticFailures.length) {
  console.error('FAIL: ' + arithmeticFailures.length + ' source/arithmetic discrepancies; report saved to artifacts/business-phase-four-stock-validation.json');
  for (const failure of arithmeticFailures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
} else console.log('PASS: four-stock pilot structure and arithmetic; issuer source validation remains PARTIAL');
for (const [ticker, result] of Object.entries(results)) console.log(ticker, JSON.stringify(result.ttm));
