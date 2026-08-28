import fs from 'node:fs';
import vm from 'node:vm';

const DATA_FILE='data.js';
const ONLY_TICKER=String(process.env.TICKER||'').trim().toUpperCase();
function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
async function fxRate(currency,date){
  if(currency==='JMD')return 1;
  const d=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:new Date().toISOString().slice(0,10);
  const url=`https://api.frankfurter.app/${d}?from=${currency}&to=JMD`;
  try{const r=await fetch(url);if(!r.ok)throw new Error(String(r.status));const j=await r.json();const n=Number(j?.rates?.JMD);return Number.isFinite(n)&&n>0?n:null;}catch(e){console.warn(`FX ${currency}/JMD ${d}: ${e.message}`);return null;}
}
const iso=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.valueOf())?null:d.toISOString().slice(0,10);};
const data=readData();
let queue=data.stocks;
if(ONLY_TICKER)queue=queue.filter(s=>String(s.ticker).toUpperCase()===ONLY_TICKER);
if(ONLY_TICKER&&!queue.length)throw new Error(`Ticker ${ONLY_TICKER} not found in data.js`);
for(const s of queue){
  const currency=String(s.latestDividendCurrency||'JMD').toUpperCase();
  const amount=Number(s.latestDividend);
  s.latestDividendOriginalAmount=Number.isFinite(amount)?amount:null;
  s.latestDividendOriginalCurrency=currency;
  if(!Number.isFinite(amount))continue;
  if(currency==='JMD'){
    s.latestDividendJmd=amount;s.latestDividendFxRate=1;s.latestDividendFxDate=null;s.latestDividendFxSource='native JMD declaration';s.latestDividendDisplayCurrency='JMD';continue;
  }
  const basis=iso(s.exDate)||iso(s.recordDate)||iso(s.payDate)||new Date().toISOString().slice(0,10);
  const rate=await fxRate(currency,basis);
  if(rate){s.latestDividendJmd=Number((amount*rate).toFixed(6));s.latestDividendFxRate=Number(rate.toFixed(6));s.latestDividendFxDate=basis;s.latestDividendFxSource='Frankfurter historical FX (ECB/reference-rate based where supported)';s.latestDividendDisplayCurrency=amount<0.01?'JMD':currency;s.latestDividendFxStatus='converted';}
  else{s.latestDividendJmd=null;s.latestDividendFxRate=null;s.latestDividendFxDate=basis;s.latestDividendFxSource=null;s.latestDividendDisplayCurrency=currency;s.latestDividendFxStatus='unavailable';}
}
writeData(data);
console.log(`Dividend FX${ONLY_TICKER?` (${ONLY_TICKER})`:''}: processed ${queue.length} ticker(s).`);
