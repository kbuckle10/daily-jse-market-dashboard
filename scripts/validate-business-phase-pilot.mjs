import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'research/business-phase-four-stock-pilot.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const expected = ['TJH', 'SEP', 'SVL', 'JSE'];
const metrics = ['revenue', 'operatingProfit', 'operatingCashFlow', 'capitalExpenditures', 'freeCashFlow'];
const pct = (a, b) => b > 0 ? +(100 * a / b).toFixed(2) : null;
const results = {};
const warningsGlobal = [];

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
  const comparableProfit = Boolean(fy.operatingProfitDefinition && fy.operatingProfitDefinition === prior.operatingProfitDefinition);
  if (!comparableProfit) warnings.push('Operating-profit growth suppressed: FY2024 and FY2025 definitions not proven comparable');
  if (!ttm.reconciledToIssuer2025AnnualReport && !ttm.reconciledToIssuer2025AuditedConsolidatedStatements) warnings.push('TTM income and cash flow remain provisional; metrics are research-only');
  if (ticker === 'TJH') warnings.push('Concession rights and maintenance obligations not captured by conventional PPE CapEx');
  results[ticker] = {
    businessModel: stock.businessModelCategory,
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
    sourceValidation: 'pending external reconciliation',
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
console.log('PASS: four-stock pilot structure, arithmetic and derived metrics; external source validation PENDING');
for (const [ticker, result] of Object.entries(results)) console.log(ticker, JSON.stringify(result.ttm));
