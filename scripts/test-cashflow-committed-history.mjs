// Validates repository-persisted history without touching production data.
import assert from 'node:assert/strict';
import {loadHistoryStore,PILOT_CURRENCIES} from './lib/cashflow-history-store.mjs';
const store=loadHistoryStore(process.env.CASHFLOW_HISTORY_STORE||'research/cashflow-history.json');
for(const [ticker,currency] of Object.entries(PILOT_CURRENCIES)){
 const h=store.stocks?.[ticker]?.history;
 assert.ok(h,ticker+' missing');
 assert.equal(h.currency,currency,ticker+' currency');
 assert.ok(h.annual.length>=5,ticker+' years');
 assert.ok(h.ttm,ticker+' TTM');
 for(const p of [...h.annual,h.ttm]){
  assert.ok(['operatingCashFlow','capitalExpenditures','freeCashFlow'].every(k=>Number.isFinite(p[k])),ticker+' metrics');
  const difference=Math.abs(p.freeCashFlow-p.operatingCashFlow-p.capitalExpenditures);
  const tolerance=Math.max(0.01,Math.abs(p.operatingCashFlow)*0.02,Math.abs(p.freeCashFlow)*0.02);
  assert.ok(difference<=tolerance,ticker+' FCF reconciliation');
 }
 console.log('PASS',ticker,currency,h.annual.length,'years + TTM');
}
console.log('PASS: all five repository-persisted histories validated');
