import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const FILE='data.js';
const raw=fs.readFileSync(FILE,'utf8');
const match=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!match) throw new Error('Unable to parse data.js');
const data=vm.runInNewContext(`(${match[1]})`);
const write=()=>fs.writeFileSync(FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(data,null,2)};\n`);
const num=v=>{if(v==null)return null;const n=Number(String(v).replace(/[$,%(),]/g,'').replace(/−/g,'-').trim());return Number.isFinite(n)?n:null;};
const validInstrumentUrl=u=>/^https:\/\/www\.jamstockex\.com\/trading\/instruments\/\?instrument=\d+$/i.test(String(u||''));
const labelDate=d=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(d);
const parseDate=v=>{
  const s=String(v??'').trim();
  const patterns=[/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/];
  if(!patterns.some(re=>re.test(s))) return null;
  const d=new Date(s);
  if(Number.isNaN(d.valueOf())) return null;
  return d;
};
const dateFromText=text=>{
  const patterns=[/(?:trade|trading|price)\s*date\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,/(?:trade|trading|price)\s*date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,/(?:as\s+of|date)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i];
  for(const re of patterns){const m=text.match(re);if(m){const d=parseDate(m[1]);if(d)return labelDate(d);}}
  return null;
};
const labeledNumber=(text,labels)=>{
  for(const label of labels){const re=new RegExp(`${label}\\s*[:\\-]?\\s*(?:J\\$|\\$)?\\s*([0-9]+(?:\\.[0-9]+)?)`,'i');const m=text.match(re);if(m){const n=num(m[1]);if(n!=null)return n;}}
  return null;
};
const nearly=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<0.005;

function tradeDateFromTables(tables,price){
  const matches=[];
  for(const rows of tables){
    let headerIndex=-1,dateIdx=-1,closeIdx=-1;
    for(let i=0;i<Math.min(rows.length,4);i++){
      const h=rows[i].map(c=>String(c).trim().toLowerCase());
      const d=h.findIndex(c=>/^date$|trade date|trading date/.test(c));
      const c=h.findIndex(c=>/^close$|closing price|close price|last traded price|last price/.test(c));
      if(d>=0&&c>=0){headerIndex=i;dateIdx=d;closeIdx=c;break;}
    }
    if(headerIndex>=0){
      for(const row of rows.slice(headerIndex+1)){
        const d=parseDate(row[dateIdx]);
        const close=num(row[closeIdx]);
        if(d&&nearly(close,price)) matches.push(d);
      }
    }
    for(const row of rows){
      const d=row.map(parseDate).find(Boolean);
      if(!d) continue;
      const nums=row.map(num).filter(v=>v!=null);
      if(nums.some(v=>nearly(v,price))) matches.push(d);
    }
  }
  if(!matches.length)return null;
  const latest=new Date(Math.max(...matches.map(d=>d.valueOf())));
  return labelDate(latest);
}

async function dismiss(page){for(const t of ['Accept','Accept All','I Agree','Agree','Got it','Close']){const b=page.getByRole('button',{name:new RegExp(`^${t}$`,'i')});if(await b.count().catch(()=>0))await b.first().click({timeout:800}).catch(()=>{});}await page.keyboard.press('Escape').catch(()=>{});}
async function parseInstrument(page,stock){
  const url=stock.jse;
  if(!validInstrumentUrl(url)) return null;
  try{
    const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForLoadState('load',{timeout:8000}).catch(()=>{});await page.waitForTimeout(1200);await dismiss(page);
    const body=await page.locator('body').innerText().catch(()=>'');
    if(!body||/access denied|forbidden|verify you are human/i.test(body))return null;
    let price=labeledNumber(body,['Closing Price','Close Price','Last Traded Price','Last Price','Last Trade Price','Close']);
    let dayJmd=labeledNumber(body,['Price Change','Change']);
    let dayPct=labeledNumber(body,['Percentage Change','Percent Change','% Change']);
    let volume=labeledNumber(body,['Volume','Volume Traded','Shares Traded']);
    let tradeDate=dateFromText(body);
    const tables=await page.locator('table').evaluateAll(ts=>ts.map(t=>Array.from(t.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(x=>(x.textContent||'').replace(/\s+/g,' ').trim())))).catch(()=>[]);
    for(const rows of tables){
      for(const row of rows){
        const joined=row.join(' | '),upper=joined.toUpperCase();
        if(price==null&&/(CLOSING PRICE|CLOSE PRICE|LAST TRADED PRICE|LAST PRICE)/.test(upper)){const vals=row.map(num).filter(v=>v!=null&&v>0);if(vals.length)price=vals.at(-1);}
      }
    }
    if(!(price>0))return null;
    tradeDate=tradeDate||tradeDateFromTables(tables,price);
    return {price,dayJmd,dayPct,volume,tradeDate,url,http:r?.status()};
  }catch(e){console.warn(`${stock.ticker}: direct JSE instrument failed: ${e.message}`);return null;}
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:1000},locale:'en-US',timezoneId:'America/Jamaica',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
const page=await context.newPage();
let updated=0,missingUrl=0,failed=0,dated=0;
try{
  for(const stock of data.stocks){
    if(!validInstrumentUrl(stock.jse)){missingUrl++;console.warn(`${stock.ticker}: no direct JSE instrument URL; cannot verify official quote.`);continue;}
    const q=await parseInstrument(page,stock);
    if(!q){failed++;console.warn(`${stock.ticker}: direct instrument page did not yield a quote; preserving prior value.`);continue;}
    const priorPrice=stock.price,priorDate=stock.priceDate;
    stock.price=Number(q.price.toFixed(2));
    if(q.dayJmd!=null)stock.dayJmd=Number(q.dayJmd.toFixed(2));
    if(q.dayPct!=null)stock.dayPct=Number(q.dayPct.toFixed(2));
    if(q.volume!=null)stock.volume=q.volume;
    if(q.tradeDate){stock.priceDate=`${q.tradeDate} • JSE`;dated++;}
    stock.source='JSE';stock.jseQuoteVerifiedAt=new Date().toISOString();stock.jseQuoteUrl=q.url;
    if(stock.ttmDps!=null&&stock.price>0)stock.trailingYield=Number((stock.ttmDps/stock.price*100).toFixed(2));
    if(stock.buyLow!=null&&stock.buyHigh!=null)stock.zoneStatus=stock.price<stock.buyLow?'below':stock.price>stock.buyHigh?'above':'in';
    updated++;
    console.log(`${stock.ticker}: direct JSE ${priorPrice} (${priorDate}) -> J$${stock.price}${q.tradeDate?` (${q.tradeDate})`:' (date not proven; prior date preserved)'} via ${q.url}`);
  }
}finally{await browser.close();}
if(updated)write();
console.log(`Direct JSE instrument verification: updated ${updated}/${data.stocks.length}; dated ${dated}; missing URL ${missingUrl}; page/parse failures ${failed}.`);
