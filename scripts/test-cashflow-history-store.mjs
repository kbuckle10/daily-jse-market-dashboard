// Simulates separate workflow executions with independent processes and persisted repository file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadHistoryStore,saveHistoryStore,updateHistoryStore} from './lib/cashflow-history-store.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jse-history-store-'));
const filename=path.join(dir,'cashflow-history.json');
const years=[2021,2022,2023,2024,2025];
const h={status:'captured',currency:'USD',units:'millions',annual:years.map((year,i)=>({period:String(year),operatingCashFlow:1e8+i*1e7,capitalExpenditures:-2e7,freeCashFlow:8e7+i*1e7})),ttm:{period:'TTM',operatingCashFlow:1.6e8,capitalExpenditures:-2e7,freeCashFlow:1.4e8}};
try{
 const first=updateHistoryStore(loadHistoryStore(filename),{TJH:h});
 saveHistoryStore(filename,first.store);
 assert.equal(first.statuses.TJH.status,'captured');
 const baseline=JSON.stringify(loadHistoryStore(filename).stocks.TJH.history);
 const second=updateHistoryStore(loadHistoryStore(filename),{TJH:null});
 saveHistoryStore(filename,second.store);
 assert.equal(second.statuses.TJH.status,'retained-last-good');
 assert.equal(JSON.stringify(loadHistoryStore(filename).stocks.TJH.history),baseline);
 const third=updateHistoryStore(loadHistoryStore(filename),{TJH:{...h,currency:'JMD'}});
 saveHistoryStore(filename,third.store);
 assert.equal(JSON.stringify(loadHistoryStore(filename).stocks.TJH.history),baseline);
 assert.equal(Object.keys(loadHistoryStore(filename).stocks).length,1);
 assert.equal(fs.existsSync(path.join(dir,'data.js')),false);
 console.log('PASS: standalone repository history store retains last good data across disk reloads and invalid refreshes; data.js untouched');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
