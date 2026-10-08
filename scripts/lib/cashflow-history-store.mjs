// Durable, standalone history store. No writes to data.js or scoring.
import fs from 'node:fs';
import path from 'node:path';
import {mergeHistoricalCashFlow} from './cashflow-history-retention.mjs';
export const PILOT_CURRENCIES=Object.freeze({SEP:'JMD',TJH:'USD',NCBFG:'JMD',GK:'JMD',GHL:'TTD'});
export function updateHistoryStore(previous,results,{now=new Date().toISOString()}={}){
 const old=previous&&typeof previous==='object'&&previous.stocks&&typeof previous.stocks==='object'?previous:{version:1,stocks:{}};
 const next={version:1,updatedAt:now,stocks:{...old.stocks}};
 const statuses={};
 for(const [ticker,currency] of Object.entries(PILOT_CURRENCIES)){
  const prior=old.stocks[ticker]?.history??null;
  const incoming=results[ticker]??null;
  const merged=mergeHistoricalCashFlow({cashFlowHistory:prior},incoming,{expectedCurrency:currency,now});
  if(merged.cashFlowHistory)next.stocks[ticker]={history:merged.cashFlowHistory};
  statuses[ticker]={status:merged.cashFlowHistoryStatus,reason:merged.reason};
 }
 return {store:next,statuses};
}
export function loadHistoryStore(filename){
 if(!fs.existsSync(filename))return {version:1,stocks:{}};
 const data=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(data.version!==1||!data.stocks||typeof data.stocks!=='object'||Array.isArray(data.stocks))throw Error('Invalid history store schema');
 return data;
}
export function saveHistoryStore(filename,store){
 fs.mkdirSync(path.dirname(filename),{recursive:true});
 const tmp=filename+'.tmp-'+process.pid;
 try{fs.writeFileSync(tmp,JSON.stringify(store,null,2)+'\n');fs.renameSync(tmp,filename);}
 finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
