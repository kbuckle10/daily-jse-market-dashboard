import assert from 'node:assert/strict';
import {mergeHistoricalCashFlow} from './lib/cashflow-history-retention.mjs';
const annual=[2021,2022,2023,2024,2025].map((y,i)=>({period:String(y),operatingCashFlow:100+i*10,capitalExpenditures:-20,freeCashFlow:80+i*10}));
const history={status:'captured',currency:'USD',units:'millions',annual,ttm:{operatingCashFlow:160,capitalExpenditures:-20,freeCashFlow:140}};
const previous={cashFlowHistory:{currency:'USD',annual:[{period:'2024'}],updatedAt:'2026-01-01'},rating:'HOLD',score:72};
const ok=mergeHistoricalCashFlow(previous,history,{expectedCurrency:'USD'});
assert.equal(ok.cashFlowHistoryStatus,'captured');
assert.equal(ok.cashFlowHistory.annual.length,5);
assert.equal(previous.rating,'HOLD');assert.equal(previous.score,72);
for(const [name,bad] of [
 ['HTTP 403',null],
 ['wrong currency',{...history,currency:'JMD'}],
 ['missing years',{...history,annual:annual.slice(1)}],
 ['duplicate year',{...history,annual:[...annual.slice(0,4),annual[3]]}],
 ['bad FCF',{...history,annual:annual.map((x,i)=>i===0?{...x,freeCashFlow:999}:x)}],
 ['missing TTM',{...history,ttm:null}],
 ['bad TTM FCF',{...history,ttm:{...history.ttm,freeCashFlow:999}}],
 ['older source',{...history,annual:[2019,2020,2021,2022,2023].map((y,i)=>({...annual[i],period:String(y)}))}]
]){
 const out=mergeHistoricalCashFlow(previous,bad,{expectedCurrency:'USD'});
 assert.equal(out.cashFlowHistoryStatus,'retained-last-good',name);
 assert.deepEqual(out.cashFlowHistory,previous.cashFlowHistory,name);
}
assert.equal(mergeHistoricalCashFlow({},null,{expectedCurrency:'USD'}).cashFlowHistoryStatus,'unavailable');
console.log('PASS: good capture, 8 failure scenarios retain last good, no rating/score mutation');
