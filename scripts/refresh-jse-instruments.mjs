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
const isoDate=(value)=>{
  if(!value)return null;
  const s=String(value).trim();
  const ymd=s.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);
  if(ymd)return `${ymd[1]}-${String(ymd[2]).padStart(2,'0')}-${String(ymd[3]).padStart(2,'0')}`;
  const mdy=s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+([0-3]?\d),?\s+(20\d{2})\b/i);
  if(mdy){const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};return `${mdy[3]}-${months[mdy[1].slice(0,3).toLowerCase()]}-${String(mdy[2]).padStart(2,'0')}`;}
  const dmy=s.match(/\b([0-3]?\d)\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);
  if(dmy){const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};return `${dmy[3]}-${months[dmy[2].slice(0,3).toLowerCase()]}-${String(dmy[1]).padStart(2,'0')}`;}
  return null;
};
const quoteDateFromText=text=>{
  for(const label of ['Closing Date','Close Date','Trade Date','Trading Date','As of','Last Updated']){
    const re=new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n|]{4,40})`,'i');
    const m=text.match(re);if(m){const d=isoDate(m[1]);if(d)return d;}
  }
  return null;
};
const heroQuoteFromText=text=>{
  const afterIsin=text.match(/ISIN\s*:[^\n]*\n+([\s\S]{0,320})/i)?.[1]||'';
  const m=afterIsin.match(/(?:J\$|\$)\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:\n|\s)*(?:▲|△|▼|▽|\+|-)?\s*(?:J\$|\$)?\s*([0-9][0-9,]*(?:\.\d+)?)?\s*(?:\(([+-]?[0-9]+(?:\.\d+)?)%\))?/i);
  if(!m)return null;
  const price=num(m[1]);if(!(price>0))return null;
  const dayJmd=m[2]!=null?num(m[2]):null;
  const dayPct=m[3]!=null?num(m[3]):null;
  return {price,dayJmd,dayPct};
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

    // The large quote immediately below ISIN is the current instrument quote shown by JSE.
    // Prefer it over generic labels/tables, which can contain stale/historical values.
    const hero=heroQuoteFromText(body);
    let price=hero?.price??null;
    let dayJmd=hero?.dayJmd??null;
    let dayPct=hero?.dayPct??null;
    let quoteDate=quoteDateFromText(body);
    let volume=labeledNumber(body,['Volume','Volume Traded','Shares Traded']);

    if(price==null)price=labeledNumber(body,['Closing Price','Close Price','Last Traded Price','Last Price','Last Trade Price']);
    if(dayJmd==null)dayJmd=labeledNumber(body,['Price Change','Change']);
    if(dayPct==null)dayPct=labeledNumber(body,['Percentage Change','Percent Change','% Change']);

    const tables=await page.locator('table').evaluateAll(ts=>ts.map(t=>Array.from(t.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(x=>(x.textContent||'').replace(/\s+/g,' ').trim())))).catch(()=>[]);
    if(price==null){
      for(const rows of tables){
        for(const row of rows){
          const joined=row.join(' | '),upper=joined.toUpperCase();
          if(/(CLOSING PRICE|CLOSE PRICE|LAST TRADED PRICE|LAST PRICE)/.test(upper)){const vals=row.map(num).filter(v=>v!=null&&v>0);if(vals.length){price=vals.at(-1);break;}}
        }
        if(price!=null)break;
      }
    }
    if(!(price>0))return null;
    return {price,dayJmd,dayPct,volume,quoteDate,url,http:r?.status(),quoteSource:hero?'hero':'fallback'};
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
    // Never label a quote with the collector run date unless JSE itself supplied that date.
    // If JSE does not expose a parseable quote date, preserve the prior priceDate and rely on verifiedAt.
    if(q.quoteDate)stock.priceDate=`${q.quoteDate} • JSE`;
    stock.source='JSE';stock.jseQuoteVerifiedAt=new Date().toISOString();stock.jseQuoteUrl=q.url;stock.jseQuoteSource=q.quoteSource;
    if(stock.ttmDps!=null&&stock.price>0)stock.trailingYield=Number((stock.ttmDps/stock.price*100).toFixed(2));
    if(stock.buyLow!=null&&stock.buyHigh!=null)stock.zoneStatus=stock.price<stock.buyLow?'below':stock.price>stock.buyHigh?'above':'in';
    updated++;
    console.log(`${stock.ticker}: direct JSE ${priorPrice} (${priorDate}) -> J$${stock.price} (${stock.priceDate||'date not supplied'}) [${q.quoteSource}] via ${q.url}`);
  }
}finally{await browser.close();}
if(updated){data.updated=refreshDate;write();}
console.log(`Direct JSE instrument verification: updated ${updated}/${data.stocks.length}; collector date ${refreshDate}; missing URL ${missingUrl}; page/parse failures ${failed}.`);
