import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = fs.readFileSync('business-phase-four-stock-pilot.html', 'utf8');
const data = JSON.parse(fs.readFileSync('research/business-phase-four-stock-pilot.json', 'utf8'));
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Pilot page must include an inline rendering script');
new vm.Script(match[1], { filename: 'business-phase-four-stock-pilot.html' });
for (const label of ['Source check', 'FY2021–25 positive FCF years', 'FY2021–25 positive OCF years', 'N/A — compare toll revenue separately']) {
  assert.ok(html.includes(label), 'Pilot page missing required label: ' + label);
}
assert.deepEqual(Object.keys(data.stocks).sort(), ['JSE', 'SEP', 'SVL', 'TJH']);
for (const [ticker, stock] of Object.entries(data.stocks)) {
  assert.equal(stock.phase, 'unclassified', ticker + ' phase must remain research-only');
  assert.equal(stock.sourceVerification, 'pending', ticker + ' issuer checks are not complete');
  assert.equal(stock.records.length, 6, ticker + ' needs FY2021–2025 and TTM');
  for (const record of stock.records) {
    const discrepancy = record.operatingCashFlow + record.capitalExpenditures - record.freeCashFlow;
    assert.ok(Math.abs(discrepancy) <= 0.011, ticker + ' ' + record.period + ' FCF arithmetic');
  }
}
const tjh = data.stocks.TJH.records.find(x => x.period === 2025);
assert.ok(tjh.issuerRevenueCrossCheck, 'TJH FY2025 revenue definitions must be documented');
assert.ok(html.includes("ticker==='TJH'?'N/A"), 'TJH growth must be withheld in staging display');
console.log('PASS: inline JavaScript syntax, 4-stock data, 24 FCF records, source warnings and TJH revenue safeguard');
