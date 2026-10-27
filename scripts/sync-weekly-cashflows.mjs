import fs from 'node:fs/promises';
const upstream='https://raw.githubusercontent.com/kbuckle10/jse-main-market-dashboard/main/cashflow-data.json';
const path='research/cashflow-history.json';
const response=await fetch(upstream,{headers:{'User-Agent':'jse-cashflow-sync'},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Weekly cash-flow source HTTP '+response.status);
const upstreamData=await response.json();
if(!Array.isArray(upstreamData.companies)||upstreamData.companies.length<45)throw new Error('Upstream coverage unexpectedly low; refusing to publish');
const daily=JSON.parse(await fs.readFile(path,'utf8'));
const numeric=['operatingCashFlow','capitalExpenditures','freeCashFlow','investingCashFlow','realEstateAcquisitions','realEstateSales','leveredFreeCashFlow','unleveredFreeCashFlow'];
const convert=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,numeric.includes(k)&&Number.isFinite(v)?Math.round(v*1e6):v]));
let changed=0,kept=0;
for(const c of upstreamData.companies){
 if(!c.ticker||!Array.isArray(c.periods)||c.periods.length<3)continue;
 const current=daily.stocks[c.ticker]?.history;
 if(current&&current.source!=='StockAnalysis'){kept++;continue;}
 const annual=c.periods.filter(p=>p.period!=='TTM').map(convert);
 const ttm=c.periods.find(p=>p.period==='TTM');
 const validAnnualYears=new Set(annual.filter(p=>typeof p.operatingCashFlow==='number'&&Number.isFinite(p.operatingCashFlow)).map(p=>String(p.periodEnding||p.period||'').match(/20\d{2}/)?.[0]).filter(Boolean)).size;
 if(validAnnualYears<3||!c.currency||!c.url)continue;
 const next={source:'StockAnalysis',currency:c.currency,units:'actual',annual,ttm:ttm?convert(ttm):null,sourceUrl:c.url};
 const previous=current?{source:current.source,currency:current.currency,units:current.units,annual:current.annual,ttm:current.ttm,sourceUrl:current.sourceUrl}:null;
 if(JSON.stringify(next)===JSON.stringify(previous))continue;
 daily.stocks[c.ticker]={...(daily.stocks[c.ticker]||{}),history:{...(current||{}),...next,updatedAt:new Date().toISOString()}};
 changed++;
}
if(changed){daily.updatedAt=new Date().toISOString();await fs.writeFile(path,JSON.stringify(daily,null,2)+'\n');}
console.log('Upstream:',upstreamData.companies.length,'Updated:',changed,'Preserved official:',kept,'Daily total:',Object.keys(daily.stocks).length);
