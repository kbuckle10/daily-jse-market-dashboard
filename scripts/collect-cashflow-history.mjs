import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const OUTPUT='research/cashflow-history.json';
const raw=fs.readFileSync('data.js','utf8');
const match=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!match)throw Error('Cannot read dashboard stock universe');
const universe=vm.runInNewContext('('+match[1]+')').stocks;
const previous=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));
const stocks={...previous.stocks};
const max=Math.min(8,Math.max(1,Number(process.env.CASHFLOW_CONCURRENCY||6)));
const outcomes={updated:[],retained:[],unavailable:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const numeric=s=>{if(s==null||String(s).trim()==='')return null;let t=String(s).trim().replace(/,/g,'').replace(/[$£€]/g,'');if(/^(?:-|—|N\/A)$/i.test(t))return null;const neg=t.startsWith('(')&&t.endsWith(')');t=t.replace(/[()]/g,'');const m=t.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i);if(!m)return null;return Number(m[1])*({K:1e3,M:1e6,B:1e9,T:1e12}[m[2]?.toUpperCase()]||1)*(neg?-1:1)};
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const keyFor=s=>/^operating cash flow$|^cash from operating activities$|^net cash provided by operating activities$/i.test(s)?'operatingCashFlow':/^capital expenditures?$|^capex$/i.test(s)?'capitalExpenditures':/^free cash flow$/i.test(s)?'freeCashFlow':null;
async function collect(browser,stock){
 const ticker=String(stock.ticker||'').toUpperCase(),ttse=ticker==='GHL',market=ttse?'ttse':'jmse',currency=ttse?'TTD':'JMD';
 const url='https://stockanalysis.com/quote/'+market+'/'+encodeURIComponent(ticker)+'/financials/cash-flow-statement/';
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  if(!response?.ok())throw Error('HTTP '+response?.status()+' (source denied access)');
  const result=await page.evaluate(()=>({body:document.body.innerText.slice(0,3000),tables:[...document.querySelectorAll('table')].map(t=>({headers:[...t.querySelectorAll('thead tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(c=>c.innerText.trim())),rows:[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(c=>c.innerText.trim()))}))}));
  const scale=/financials?\s+in\s+billions/i.test(result.body)?1e9:/financials?\s+in\s+millions/i.test(result.body)?1e6:/financials?\s+in\s+thousands/i.test(result.body)?1e3:1;
  let best=null;
  for(const table of result.tables){
   const headers=table.headers.find(h=>h.some(x=>/20\d{2}|TTM/i.test(x)))||table.headers.at(-1)||[];
   const periods=headers.slice(1).map(x=>{const m=x.match(/20\d{2}|TTM/i);return m?m[0].toUpperCase():null});
   if(periods.filter(p=>p&&p!=='TTM').length<5)continue;
   const rows={};
   for(const row of table.rows){const key=keyFor(norm(row[0]));if(key)rows[key]=row.slice(1).map(x=>{const v=numeric(x);return v===null?null:v*scale})}
   if(!rows.operatingCashFlow||!rows.capitalExpenditures)continue;
   const annual=[],ttms=[];
   periods.forEach((period,i)=>{if(!period)return;const ocf=rows.operatingCashFlow[i],capex=rows.capitalExpenditures[i],fcf=rows.freeCashFlow?.[i]??(ocf!==null&&capex!==null?ocf+capex:null);if(![ocf,capex,fcf].every(Number.isFinite))return;const record={period,operatingCashFlow:ocf,capitalExpenditures:capex,freeCashFlow:fcf};if(period==='TTM')ttms.push(record);else annual.push(record)});
   annual.sort((a,b)=>Number(a.period)-Number(b.period));
   if(annual.length>=5){best={annual:annual.slice(-5),ttm:ttms[0]||null};break}
  }
  if(!best)throw Error('Insufficient five-year cash flow data');
  const prior=stocks[ticker]?.history;
  const next={source:'StockAnalysis',sourceUrl:url,currency,units:'millions',annual:best.annual,ttm:best.ttm||prior?.ttm||null};
  if(prior&&JSON.stringify(prior.annual)===JSON.stringify(next.annual)&&JSON.stringify(prior.ttm)===JSON.stringify(next.ttm)){
    outcomes.retained.push(ticker);console.log(ticker+' unchanged');
  }else{
    stocks[ticker]={history:{...next,updatedAt:new Date().toISOString()}};
    outcomes.updated.push(ticker);console.log(ticker+' updated');
  }
 }catch(e){outcomes.unavailable.push({ticker,reason:e.message});console.warn(ticker+' retained prior data: '+e.message)}finally{await page.close()}
}
const browser=await chromium.launch({headless:true});
let index=0;let blocked=0;await Promise.all(Array.from({length:max},async()=>{while(index<universe.length){const stock=universe[index++];if(blocked>=3){outcomes.unavailable.push({ticker:stock.ticker,reason:'Skipped: source access blocked (403)'});continue;}const before=outcomes.unavailable.length;await collect(browser,stock);if(outcomes.unavailable.length>before&&/HTTP 403/.test(outcomes.unavailable.at(-1).reason))blocked++;else if(outcomes.unavailable.length===before)blocked=0;await sleep(1200)}}));
await browser.close();
const valid=Object.fromEntries(Object.entries(stocks).filter(([,v])=>v?.history?.annual?.length>=2));
if(Object.keys(valid).length<Math.max(12,Object.keys(previous.stocks).length))throw Error('Coverage regression: refusing to overwrite history');
const report={runAt:new Date().toISOString(),universe:universe.length,coverage:Object.keys(valid).length,updated:outcomes.updated,unchanged:outcomes.retained,unavailable:outcomes.unavailable};
fs.writeFileSync('research/cashflow-coverage-report.json',JSON.stringify(report,null,2)+'\n');
if(outcomes.updated.length)fs.writeFileSync(OUTPUT,JSON.stringify({version:1,updatedAt:report.runAt,stocks:valid},null,2)+'\n');
console.log('COVERAGE SUMMARY '+JSON.stringify({universe:report.universe,coverage:report.coverage,updated:report.updated.length,unchanged:report.unchanged.length,unavailable:report.unavailable.length}));
