// Import validated research probe results into standalone history store.
// Does not access data.js; use only on isolated staging branches until approved.
import fs from 'node:fs';
import {loadHistoryStore,saveHistoryStore,updateHistoryStore,PILOT_CURRENCIES} from './lib/cashflow-history-store.mjs';
const source=process.env.CASHFLOW_PROBE_FILE||'artifacts/cashflow-feasibility.json';
const destination=process.env.CASHFLOW_HISTORY_STORE||'research/cashflow-history.json';
const report=JSON.parse(fs.readFileSync(source,'utf8'));
if(!Array.isArray(report.results))throw Error('Probe results missing');
const input={};
for(const r of report.results){
 if(!Object.hasOwn(PILOT_CURRENCIES,r.ticker))continue;
 input[r.ticker]=r.status==='parsed'?r.history:null;
}
const updated=updateHistoryStore(loadHistoryStore(destination),input);
saveHistoryStore(destination,updated.store);
for(const [ticker,s] of Object.entries(updated.statuses))console.log(ticker,s.status,s.reason??'');
const missing=Object.keys(PILOT_CURRENCIES).filter(t=>!updated.store.stocks[t]?.history);
if(missing.length)throw Error('Missing persisted pilot histories: '+missing.join(','));
console.log('Standalone history persisted:',destination,'(data.js unchanged)');
