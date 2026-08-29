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
const runDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/Jamaica',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
const refreshDate=`${runDate.year}-${runDate.month}-${runDate.day}`;
const labeledNumber=(text,labels)=>{
  for(const label of labels){const re=new RegExp(`${label}\\s*[:\\-]?\\s*(?:J\\$|\\$)?\\s*([0-9]+(?:\\.[0-9]+)?)`,'i');const m=text.match(re);if(m){const n=num(m[1]);if(n!=null)return n;}}
  return null;
};

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
    const tables=await page.locator('table').evaluateAll(ts=>ts.map(t=>Array.from(t.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(x=>(x.textContent||'').replace(/\s+/g,' ').trim())))).catch(()=>[]);
    for(const rows of tables){
      for(const row of rows){
        const joined=row.join(' | '),upper=joined.toUpperCase();
        if(price==null&&/(CLOSING PRICE|CLOSE PRICE|LAST TRADED PRICE|LAST PRICE)/.test(upper)){const vals=row.map(num).filter(v=>v!=null&&v>0);if(vals.length)price=vals.at(-1);}
      }
    }
    if(!(price>0))return null;
    return {price,dayJmd,dayPct,volume,url,http:r?.status()};
  }catch(e){console.warn(`${stock.ticker}: direct JSE instrument failed: ${e.message}`);return null;}
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:1000},locale:'en-US',timezoneId:'America/Jamaica',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
const page=await context.newPage();
let updated=0,missingUrl=0,failed=0;
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
    stock.priceDate=`${refreshDate} • JSE`;
    stock.source='JSE';stock.jseQuoteVerifiedAt=new Date().toISOString();stock.jseQuoteUrl=q.url;
    if(stock.ttmDps!=null&&stock.price>0)stock.trailingYield=Number((stock.ttmDps/stock.price*100).toFixed(2));
    if(stock.buyLow!=null&&stock.buyHigh!=null)stock.zoneStatus=stock.price<stock.buyLow?'below':stock.price>stock.buyHigh?'above':'in';
    updated++;
    console.log(`${stock.ticker}: direct JSE ${priorPrice} (${priorDate}) -> J$${stock.price} (${refreshDate}) via ${q.url}`);
  }
}finally{await browser.close();}
if(updated){data.updated=refreshDate;write();}
console.log(`Direct JSE instrument verification: updated ${updated}/${data.stocks.length}; refresh date ${refreshDate}; missing URL ${missingUrl}; page/parse failures ${failed}.`);
