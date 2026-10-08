import assert from 'node:assert/strict';
import { parseCashAmount, extractCashFlowHistory } from './lib/cashflow-history.mjs';
assert.equal(parseCashAmount('(2.26)',1e6),-2260000);
assert.equal(parseCashAmount('50.21',1e6),50210000);
assert.equal(parseCashAmount('—',1e6),null);
assert.equal(parseCashAmount('1.5B',1e6),1500000000);
const rows=[
 ['Operating Cash Flow','65.69','52.47','43.87','41.67','7.25','13.99'],
 ['Capital Expenditures','(0.83)','(2.26)','(1.34)','(0.46)','(0.07)','(0.19)'],
 ['Free Cash Flow','64.87','50.21','42.53','41.22','7.18','13.80']
];
const mockPage={
 locator(selector){
  if(selector==='body')return {innerText:async()=> 'Financials in millions USD'};
  if(selector==='table')return {
    count:async()=>1,
    nth:()=>({
      locator(s){
        if(s==='thead tr')return {count:async()=>1,first:()=>({locator:()=>({allTextContents:async()=>['','TTM','FY 2025','FY 2024','FY 2023','FY 2022','FY 2021']})})};
        if(s==='tbody tr')return {count:async()=>rows.length,nth:i=>({locator:()=>({allTextContents:async()=>rows[i]})})};
      }
    })
  };
 }
};
const h=await extractCashFlowHistory(mockPage);
assert.equal(h.status,'captured');
assert.equal(h.currency,'USD');
assert.equal(h.annual.length,5);
assert.equal(h.annual[4].period,'2025');
assert.equal(h.annual[4].freeCashFlow,50210000);
assert.equal(h.ttm.freeCashFlow,64870000);
assert.equal(h.reconciliation.length,5);
assert.ok(h.reconciliation.every(x=>Math.abs(x.discrepancy)<=20000));
console.log('Cash-flow history parser regression tests passed');
