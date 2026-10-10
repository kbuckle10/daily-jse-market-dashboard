import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const output='research/cashflow-history.json';
const sourceFile='research/official-cashflow-sources.json';
const sources=fs.existsSync(sourceFile)?JSON.parse(fs.readFileSync(sourceFile,'utf8')):{};
const pending=[];
const universe=vm.runInNewContext('('+fs.readFileSync('data.js','utf8').match(/window\\.JSE_DASHBOARD_DATA\\s*=\\s*([\\s\\S]*);\\s*$/)[1]+')').stocks;
const discovered=[];
const strip=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\\s+/g,' ').trim();
async function discover(stock){
 const ticker=String(stock.ticker).toUpperCase();
 if(sources[ticker]?.length)return;
 try{
  const api='https://www.jamstockex.com/wp-json/wp/v2/search?search='+encodeURIComponent(ticker+' annual report')+'&per_page=30';
  const res=await fetch(api,{signal:AbortSignal.timeout(14000)});
  if(!res.ok)throw Error('Discovery HTTP '+res.status);
  const items=await res.json();
  for(const item of items){
   const title=strip(item.title);const link=String(item.url||'');
   if(!/annual report|audited financial/i.test(title)||!new RegExp('(^|[^A-Z0-9])'+ticker+'([^A-Z0-9]|$)','i').test(title+' '+link))continue;
   discovered.push({ticker,title,url:link,source:'Jamaica Stock Exchange search',status:'report-page-needs-PDF-resolution'});
   try{
    const html=await (await fetch(link,{signal:AbortSignal.timeout(12000)})).text();
    const pdfs=[...html.matchAll(/(?:https?:)?\\/\\/[^\\s"'<>]+?\\.pdf(?:\\?[^\\s"'<>]*)?/ig)].map(m=>m[0].replace(/&amp;/g,'&'));
    for(const pdf of pdfs.slice(0,5)){
     if(!/jamstockex\\.com/i.test(pdf))continue;
     const y=title.match(/20\\d{2}/)?.[0]||pdf.match(/20\\d{2}/)?.[0];
     if(y)pending.push({ticker,year:Number(y),url:pdf,scale:'unknown',status:'requires-unit-verification'});
    }
   }catch(e){discovered.push({ticker,status:'page-resolution-failed',reason:e.message})}
  }
 }catch(e){discovered.push({ticker,status:'discovery-failed',reason:e.message})}
}
let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<universe.length)await discover(universe[next++])}));
const prior=JSON.parse(fs.readFileSync(output,'utf8'));
const stocks={...prior.stocks};
const lines=[];
const amount=(s,scale)=>{if(!s)return null;let t=s.replace(/,/g,'').trim();const neg=t.startsWith('(')&&t.endsWith(')');t=t.replace(/[()]/g,'');const n=Number(t);return Number.isFinite(n)?n*scale*(neg?-1:1):null};
function extract(text,label,scale){
 const rows=text.split(/\r?\n/);
 for(let i=0;i<rows.length;i++){
  if(!label.test(rows[i]))continue;
  const values=(rows[i].match(/\(?-?\d[\d,]*(?:\.\d+)?\)?/g)||[]).map(v=>amount(v,scale)).filter(Number.isFinite);
  if(values.length)return values[0];
 }
 return null;
}
for(const [ticker,entries] of Object.entries(sources)){
 const annual=[];
 for(const entry of entries){
  try{
   if(!/^https:\/\//.test(entry.url)||!/(?:\.pdf(?:\?|$)|\/download\/|\/sites\/)/i.test(entry.url))throw Error('Source must be an HTTPS annual-report PDF URL');
   const response=await fetch(entry.url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'JSE Financial Research (annual reports)'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('Not a PDF');
   const file='/tmp/jse-cashflow-'+ticker+'-'+entry.year+'.pdf';
   fs.writeFileSync(file,bytes);
   const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:20*1024*1024});
   fs.unlinkSync(file);
   const scale=entry.scale==='thousands'?1000:entry.scale==='millions'?1000000:1;
   const operatingCashFlow=extract(text,/net cash (?:generated from|provided by|from) operating activities|net cash from operating activities/i,scale);
   const capex=extract(text,/purchase of (?:property|plant)|acquisition of property,? plant|capital expenditure/i,scale);
   if(!Number.isFinite(operatingCashFlow)||!Number.isFinite(capex))throw Error('Cash-flow statement rows not reliably identified');
   // Asset purchases are cash outflows; financial statements may display them as positive numbers.
   const capitalExpenditures=-Math.abs(capex);
   annual.push({period:String(entry.year),operatingCashFlow,capitalExpenditures,freeCashFlow:operatingCashFlow+capitalExpenditures});
   lines.push({ticker,year:entry.year,status:'extracted',url:entry.url});
  }catch(e){lines.push({ticker,year:entry.year,status:'failed',reason:e.message,url:entry.url})}
 }
 // Extraction candidates require statement-level validation before production use.
 for(const record of annual)lines.push({ticker,year:record.period,status:'candidate-needs-review',...record});
}
// Do not modify production cash-flow history with unreviewed PDF text matches.
fs.writeFileSync('research/official-cashflow-extraction-report.json',JSON.stringify({runAt:new Date().toISOString(),configuredTickers:Object.keys(sources).length,discovered,pendingPdfCandidates:pending,results:lines},null,2)+'\n');
console.log('OFFICIAL REPORTS '+JSON.stringify({configuredTickers:Object.keys(sources).length,discovered:discovered.filter(x=>x.url).length,extracted:lines.filter(x=>x.status==='extracted').length,failed:lines.filter(x=>x.status==='failed').length}));
