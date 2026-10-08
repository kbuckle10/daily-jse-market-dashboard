import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const report=JSON.parse(fs.readFileSync('artifacts/cashflow-feasibility.json','utf8'));
const raw=fs.readFileSync('data.js','utf8');
const match=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!match)throw new Error('Cannot read dashboard data.js');
const data=vm.runInNewContext('('+match[1]+')');
const required=['SEP','TJH','NCBFG','GK','GHL'];
for(const ticker of required){
 const r=report.results.find(x=>x.ticker===ticker);
 if(!r||r.status!=='parsed'||r.history?.status!=='captured')throw new Error(ticker+': validated history missing');
 const h=r.history;
 if(h.annual.length<5||!h.currency||!h.ttm)throw new Error(ticker+': incomplete annual/TTM/currency');
 if(!h.annual.every(p=>['operatingCashFlow','capitalExpenditures','freeCashFlow'].every(k=>Number.isFinite(p[k]))))throw new Error(ticker+': incomplete cash-flow metrics');
 const s=data.stocks.find(x=>x.ticker===ticker);
 if(!s)throw new Error(ticker+': not found in dashboard data');
 s.cashFlowHistory={source:'StockAnalysis',sourceUrl:r.url,currency:h.currency,units:h.units,annual:h.annual,ttm:h.ttm,updatedAt:report.generatedAt};
 s.cashFlowHistoryStatus='captured';
}
fs.mkdirSync('artifacts/dashboard-preview',{recursive:true});
for(const name of ['index.html','app.js','manifest.webmanifest','sw.js','favicon.ico','icon-192.png','icon-512.png']){
 if(fs.existsSync(name))fs.copyFileSync(name,path.join('artifacts/dashboard-preview',name));
}
fs.writeFileSync('artifacts/dashboard-preview/data.js','window.JSE_DASHBOARD_DATA = '+JSON.stringify(data,null,2)+';\n');
const updated=JSON.parse(fs.readFileSync('artifacts/dashboard-preview/data.js','utf8').replace(/^window\.JSE_DASHBOARD_DATA\s*=\s*/,'').replace(/;\s*$/,''));
for(const ticker of required){
 const before=data.stocks.find(x=>x.ticker===ticker),after=updated.stocks.find(x=>x.ticker===ticker);
 if(!after.cashFlowHistory?.annual?.length)throw new Error(ticker+': missing preview data');
}
console.log('Preview built: '+required.join(', ')+'. No production data files modified.');
