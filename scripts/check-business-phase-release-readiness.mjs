import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('research/business-phase-four-stock-pilot.json', 'utf8'));
const required = ['TJH','SEP','SVL','JSE'];
const flags = ['reconciledToIssuer2024AnnualReport','reconciledToIssuer2025AnnualReport','reconciledToIssuer2025AuditedConsolidatedStatements'];
const issuerCoverage = Object.fromEntries(required.map(ticker => {
  const stock = data.stocks[ticker];
  return [ticker, [2024,2025].filter(year => {
    const row = stock?.records.find(r => r.period === year);
    return row && flags.some(flag => row[flag] === true);
  })];
}));
const gates = [
  { id: 'internal_arithmetic', passed: required.every(t => data.stocks[t]?.records.length === 6 && data.stocks[t].records.every(r => Math.abs(r.operatingCashFlow + r.capitalExpenditures - r.freeCashFlow) <= .011)), evidence: 'FCF arithmetic across 24 records' },
  { id: 'issuer_cashflow_2024_2025', passed: required.every(t => issuerCoverage[t].length === 2), evidence: issuerCoverage },
  { id: 'tjh_fy2025_audited', passed: data.stocks.TJH.records.find(r => r.period === 2025)?.reconciledToIssuer2025AnnualReport === true, evidence: 'TJH audited 2025 cash flow not reconciled' },
  { id: 'historical_3yr_comparability', passed: data.validation?.threeYearComparableIssuerStatements === 'verified', evidence: 'No three-year comparable audited series certified' },
  { id: 'capital_returns_and_leverage', passed: data.validation?.capitalReturnsAndROIC === 'verified', evidence: data.validation?.capitalReturnsAndROIC || 'Not verified' },
  { id: 'ttm_period_alignment', passed: data.validation?.fiscalYearAndTTMAlignment === 'verified', evidence: data.validation?.fiscalYearAndTTMAlignment || 'Not verified' },
  { id: 'phase_classification_approved', passed: data.validation?.phaseClassification === 'approved', evidence: data.validation?.phaseClassification || 'Not approved' }
];
const result = { status: gates.every(g => g.passed) ? 'READY_FOR_HUMAN_REVIEW' : 'HOLD_NO_PRODUCTION_PROMOTION', generatedAt: new Date().toISOString(), scope: 'four-stock staging research; independent of production ratings', gates };
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/business-phase-release-readiness.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!gates[0].passed) process.exitCode = 1; // internal corruption fails CI; unmet research gates keep staging CI green but block promotion
