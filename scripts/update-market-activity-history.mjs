import fs from 'node:fs';
import vm from 'node:vm';
const DATA='data.js', OUT='data/market-activity-history.json', MAX=260;
const raw=fs.readFileSync(DATA,'utf8'),m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!m)throw Error('Unable to parse data.js');
const d=vm.runInNewContext(`(${m[1]})`);
let store={version:1,updatedAt:null,tickers:{}};
if(fs.existsSync(OUT)){try{store=JSON.parse(fs.readFileSync(OUT,'utf8'));}catch{}}
store.tickers ||= {};
const iso=x=>{const s=String(x||'').replace(/\s*•.*$/,'').trim();if(!s)return null;const dt=new Date(s);return Number.isNaN(dt.valueOf())?null:dt.toISOString().slice(0,10)};
const num=x=>Number.isFinite(Number(x))?Number(x):null;
let written=0;
for(const s of d.stocks||[]){
 const t=String(s.ticker||'').toUpperCase(), date=iso(s.marketActivity?.tradeDate||s.priceDate);
 if(!t||!date||!String(s.priceDate||'').includes('JSE'))continue;
 const row={date,close:num(s.price),volume:num(s.volume),valueTraded:num(s.valueTraded),trades:num(s.numberOfTrades),sharesOutstanding:num(s.sharesOutstanding),floatShares:num(s.floatShares)};
 if(row.volume==null&&row.valueTraded==null&&row.trades==null)continue;
 const arr=Array.isArray(store.tickers[t])?store.tickers[t]:[];
 const i=arr.findIndex(x=>x.date===date); if(i>=0)arr[i]={...arr[i],...row};else arr.push(row);
 arr.sort((a,b)=>a.date.localeCompare(b.date)); store.tickers[t]=arr.slice(-MAX); written++;
}
store.updatedAt=new Date().toISOString();fs.mkdirSync('data',{recursive:true});fs.writeFileSync(OUT,JSON.stringify(store,null,2)+'\n');
console.log(`Market activity history: ${written} ticker snapshots upserted; retention ${MAX} sessions.`);
