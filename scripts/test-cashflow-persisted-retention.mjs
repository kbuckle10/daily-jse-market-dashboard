// Simulate two separate collector executions using persisted disk state.
// No production data.js access or network required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {mergeHistoricalCashFlow} from './lib/cashflow-history-retention.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cashflow-retention-'));
const file=path.join(dir,'pilot-history.json');
const annual=[2021,2022,2023,2024,2025].map((y,i)=>({period:String(y),operatingCashFlow:1e8+i*1e7,capitalExpenditures:-2e7,freeCashFlow:8e7+i*1e7}));
const captured={status:'captured',currency:'USD',units:'millions',annual,ttm:{period:'TTM',operatingCashFlow:1.6e8,capitalExpenditures:-2e7,freeCashFlow:1.4e8}};
function executeCollector(incoming){
 const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{ticker:'TJH',rating:'HOLD',incomeScore:72};
 const result=mergeHistoricalCashFlow(state,incoming,{expectedCurrency:'USD',now:'2026-10-08T00:00:00.000Z'});
 if(result.cashFlowHistory)state.cashFlowHistory=result.cashFlowHistory;
 state.cashFlowHistoryStatus=result.cashFlowHistoryStatus;
 fs.writeFileSync(file,JSON.stringify(state,null,2));
 return state;
}
try{
 const first=executeCollector(captured);
 assert.equal(first.cashFlowHistoryStatus,'captured');
 const baseline=JSON.stringify(first.cashFlowHistory);
 // Second independent execution loads persisted history and simulates blocked source.
 const second=executeCollector(null);
 assert.equal(second.cashFlowHistoryStatus,'retained-last-good');
 assert.equal(JSON.stringify(second.cashFlowHistory),baseline);
 assert.equal(second.rating,'HOLD');
 assert.equal(second.incomeScore,72);
 // Third execution with invalid source must also preserve the exact persisted history.
 const third=executeCollector({...captured,currency:'JMD'});
 assert.equal(third.cashFlowHistoryStatus,'retained-last-good');
 assert.equal(JSON.stringify(third.cashFlowHistory),baseline);
 console.log('PASS: disk-persisted history survives independent collector executions and source failures; rating unchanged');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
