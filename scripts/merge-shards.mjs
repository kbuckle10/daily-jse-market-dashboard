import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const parse=file=>{const raw=fs.readFileSync(file,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error(`Unable to parse ${file}`);return vm.runInNewContext(`(${m[1]})`);};
const baseline=parse('data.js');
const root=process.env.SHARD_ROOT||'shards';
const files=[];
for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(entry.isDirectory()){
    const f=path.join(root,entry.name,'data.js');if(fs.existsSync(f))files.push(f);
  }else if(entry.isFile()&&entry.name.endsWith('.js')) files.push(path.join(root,entry.name));
}
if(!files.length)throw new Error(`No shard data files found under ${root}`);
const merged=new Map(baseline.stocks.map(s=>[String(s.ticker).toUpperCase(),s]));
const seen=new Set();
for(const file of files){
  const shard=parse(file);
  for(const s of shard.stocks||[]){
    const t=String(s.ticker||'').toUpperCase();if(!t)continue;
    if(seen.has(t))throw new Error(`Duplicate ticker across shards: ${t}`);
    seen.add(t);merged.set(t,s);
  }
}
const missing=baseline.stocks.map(s=>String(s.ticker).toUpperCase()).filter(t=>!seen.has(t));
if(missing.length)throw new Error(`Shard merge missing ${missing.length} ticker(s): ${missing.join(', ')}`);
baseline.stocks=baseline.stocks.map(s=>merged.get(String(s.ticker).toUpperCase()));

// Derive the dataset close date from actual refreshed JSE quote dates instead of
// carrying forward the previous top-level `updated` value. Only JSE-sourced
// quote dates participate; StockAnalysis fallback/history dates must not advance
// the official-close banner.
const parseQuoteDate=value=>{
  if(!value)return null;
  const text=String(value).replace(/\s*•.*$/,'').trim();
  const d=new Date(text);
  return Number.isNaN(d.getTime())?null:d;
};
const jseDates=baseline.stocks
  .filter(s=>String(s.priceSource||s.source||'').toUpperCase().includes('JSE')||/•\s*JSE\s*$/i.test(String(s.priceDate||'')))
  .map(s=>parseQuoteDate(s.priceDate||s.jsePriceDate||s.quoteDate))
  .filter(Boolean);
if(jseDates.length){
  const latest=new Date(Math.max(...jseDates.map(d=>d.getTime())));
  baseline.updated=latest.toISOString().slice(0,10);
}
baseline.priceLabel='Latest completed JSE close';
baseline.priceSourcePolicy='JSE Trade Summary/Trade Quotes primary; StockAnalysis historical/fallback; direct JSE instrument pages retained for company links and corporate actions.';
baseline.refreshedAt=new Date().toISOString();
delete baseline.shard;
fs.writeFileSync('data.js',`window.JSE_DASHBOARD_DATA = ${JSON.stringify(baseline,null,2)};\n`);
console.log(`Merged ${files.length} shards covering ${seen.size} dynamic Main Market tickers; updated=${baseline.updated}; refreshedAt=${baseline.refreshedAt}`);
