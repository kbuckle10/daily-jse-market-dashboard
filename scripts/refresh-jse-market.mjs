import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE = 'data.js';
const JSE_URL = 'https://www.jamstockex.com/trading/trade-summary/';

function readDashboard() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const m = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}
function writeDashboard(data) { fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(data, null, 2)};\n`); }
function num(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[$,%(),]/g, '').replace(/−/g, '-').trim();
  if (!cleaned || cleaned === '-' || /^n\/?a$/i.test(cleaned)) return null;
  const n = Number(cleaned); return Number.isFinite(n) ? n : null;
}
function norm(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function headerIndex(headers, patterns) {
  const lowered = headers.map(h => norm(h).toLowerCase());
  for (const re of patterns) { const i = lowered.findIndex(h => re.test(h)); if (i >= 0) return i; }
  return -1;
}
function formatDate(value) {
  const s=String(value??'').trim();
  if(!s) return null;
  let d=null;
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  if(!d && (m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/))) d=new Date(Date.UTC(Number(m[3]),Number(m[1])-1,Number(m[2])));
  if(!d) { const parsed=new Date(s); if(!Number.isNaN(parsed.valueOf())) d=parsed; }
  if(!d || Number.isNaN(d.valueOf())) return null;
  return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}).format(d);
}
function extractTradeDateFromText(body) {
  const candidates = [
    /(?:trade|trading)\s*date\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    /(?:trade|trading)\s*date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
    /(?:trade|trading)\s*date\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i,
    /(?:market|trade)\s*summary\s*(?:for|as\s+of)?\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    /(?:market|trade)\s*summary\s*(?:for|as\s+of)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
  ];
  for (const re of candidates) { const m = body.match(re); if (m) { const label = formatDate(m[1]); if (label) return label; } }
  return null;
}
async function extractTradeDate(page,body){
  const textDate=extractTradeDateFromText(body);
  if(textDate) return {label:textDate,source:'page text'};
  const controls=await page.locator('input, select').evaluateAll(els=>els.map(el=>{
    const id=el.id||''; const name=el.getAttribute('name')||''; const cls=el.className||'';
    const label=id?document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent||'':'';
    const parent=(el.closest('form, .form-group, .field, .filter, .date, .datepicker')?.textContent||el.parentElement?.textContent||'').replace(/\s+/g,' ').trim().slice(0,300);
    const selected=el.tagName==='SELECT' ? el.options[el.selectedIndex]?.text||'' : '';
    return {id,name,cls,label,parent,value:el.value||'',selected};
  })).catch(()=>[]);
  const bad=/record|payment|pay\s*date|ex[-\s]?date|dividend|financial|report|year\s*end|fiscal/i;
  const good=/trade|trading|market|summary|as\s*of|date/i;
  const ranked=[];
  for(const c of controls){
    const context=`${c.id} ${c.name} ${c.cls} ${c.label} ${c.parent}`;
    if(bad.test(context)) continue;
    for(const raw of [c.value,c.selected]){
      const label=formatDate(raw); if(!label) continue;
      let score=0;
      if(/trade|trading/.test(context.toLowerCase())) score+=100;
      if(/market|summary/.test(context.toLowerCase())) score+=60;
      if(/date/.test(context.toLowerCase())) score+=20;
      if(good.test(context)) score+=10;
      ranked.push({label,score,raw,context});
    }
  }
  ranked.sort((a,b)=>b.score-a.score);
  if(ranked.length){
    const best=ranked[0];
    console.log(`JSE trade date control candidate: ${best.raw} -> ${best.label} (score ${best.score})`);
    return {label:best.label,source:'page control'};
  }
  return {label:null,source:null};
}
async function dismissOverlays(page) {
  for (const text of ['Accept','Accept All','I Agree','Agree','Got it','Close']) {
    const btn = page.getByRole('button', {name:new RegExp(`^${text}$`,'i')});
    if (await btn.count().catch(()=>0)) await btn.first().click({timeout:1500}).catch(()=>{});
  }
  await page.keyboard.press('Escape').catch(()=>{});
}
async function gotoJse(page) {
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      const response=await page.goto(JSE_URL,{waitUntil:'domcontentloaded',timeout:45000});
      console.log(`JSE navigation attempt ${attempt}: HTTP ${response?.status() ?? 'unknown'}`);
      await page.waitForLoadState('load',{timeout:12000}).catch(()=>{}); await page.waitForTimeout(2500+attempt*500); await dismissOverlays(page);
      const text=await page.locator('body').innerText().catch(()=>'');
      if(text.length>500&&!/access denied|forbidden|just a moment|verify you are human/i.test(text)) return true;
    } catch(err) { console.warn(`JSE navigation attempt ${attempt} failed: ${err.message}`); }
    if(attempt<3) await page.waitForTimeout(1500*attempt);
  }
  return false;
}
async function extractTables(page) {
  return page.locator('table').evaluateAll(tables=>tables.map(table=>{
    const headers=Array.from(table.querySelectorAll('thead th')).map(x=>(x.textContent||'').trim());
    let effectiveHeaders=headers;
    if(!effectiveHeaders.length){const first=table.querySelector('tr');effectiveHeaders=first?Array.from(first.querySelectorAll('th,td')).map(x=>(x.textContent||'').trim()):[];}
    const rows=Array.from(table.querySelectorAll('tbody tr')).map(tr=>Array.from(tr.querySelectorAll('td,th')).map(td=>(td.textContent||'').replace(/\s+/g,' ').trim()));
    return {headers:effectiveHeaders,rows};
  })).catch(()=>[]);
}
function scoreTable(table,tickers){
  const text=`${table.headers.join(' ')} ${table.rows.flat().join(' ')}`.toUpperCase();
  const tickerHits=tickers.filter(t=>new RegExp(`(^|\\W)${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\W|$)`).test(text)).length;
  const headerText=table.headers.join(' ').toLowerCase();
  return tickerHits*10+(/symbol|ticker|security/.test(headerText)?2:0)+(/close|closing|last/.test(headerText)?2:0);
}
function parseTable(table,tickers){
  const headers=table.headers.map(norm);
  console.log('JSE table headers:',headers.join(' | '));
  const symbolIdx=headerIndex(headers,[/^symbol$/,/ticker/,/security\\s*code/,/symbol/]);
  const closeIdx=headerIndex(headers,[/closing\\s*price/,/^close$/,/close\\s*price/,/last\\s*traded\\s*price/,/^last$/]);
  const changeIdx=headerIndex(headers,[/price\\s*change/,/^change$/,/change\\s*\\(?j\\$?\\)?/]);
  const pctIdx=headerIndex(headers,[/%\\s*change/,/change\\s*%/,/percent/]);
  const volumeIdx=headerIndex(headers,[/^volume$/,/volume\\s*traded/,/shares\\s*traded/,/^units$/, /units\\s*traded/]);
  const valueIdx=headerIndex(headers,[/^value$/, /value\\s*traded/, /trade\\s*value/]);
  const tradesIdx=headerIndex(headers,[/^trades$/, /no\\.?\\s*(?:of\\s*)?trades/, /number\\s*of\\s*trades/, /#\\s*trades/]);
  const out=new Map();
  for(const row of table.rows){
    const upper=row.map(v=>norm(v).toUpperCase());
    let ticker=symbolIdx>=0&&tickers.includes(upper[symbolIdx])?upper[symbolIdx]:null;
    if(!ticker) ticker=tickers.find(t=>upper.some(cell=>cell===t))??null;
    if(!ticker) continue;
    // Never guess columns from arbitrary numeric cells. A JSE activity table is
    // accepted only when its headers explicitly identify the fields.
    const price=closeIdx>=0?num(row[closeIdx]):null;
    const volume=volumeIdx>=0?num(row[volumeIdx]):null;
    if(price==null && volume==null) continue;
    const dayJmd=changeIdx>=0?num(row[changeIdx]):null;
    let dayPct=pctIdx>=0?num(row[pctIdx]):null;
    if(dayPct==null&&dayJmd!=null&&price!=null&&price-dayJmd>0) dayPct=dayJmd/(price-dayJmd)*100;
    out.set(ticker,{
      price:price>0?price:null,
      dayJmd,dayPct,volume,
      valueTraded:valueIdx>=0?num(row[valueIdx]):null,
      trades:tradesIdx>=0?num(row[tradesIdx]):null,
      row
    });
  }
  return out;
}
function activityQuality(table,parsed){
  const h=table.headers.map(norm).join(' ').toLowerCase();
  let score=0;
  if(/volume|shares\\s*traded|units/.test(h))score+=100;
  if(/symbol|ticker|security/.test(h))score+=30;
  if(/close|closing|last/.test(h))score+=15;
  if(/value\\s*traded|trade\\s*value/.test(h))score+=10;
  if(/number\\s*of\\s*trades|no\\.?\\s*of\\s*trades|#\\s*trades/.test(h))score+=10;
  score+=parsed.size;
  return score;
}

const data=readDashboard();
const tickers=data.stocks.map(s=>String(s.ticker).toUpperCase());
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1100},locale:'en-US',timezoneId:'America/Jamaica',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',extraHTTPHeaders:{'Accept-Language':'en-US,en;q=0.9'}});
const page=await context.newPage();
let captured=new Map(); let tradeDate=null;
try {
  if(await gotoJse(page)){
    const body=await page.locator('body').innerText().catch(()=>'');
    const td=await extractTradeDate(page,body); tradeDate=td.label;
    // JSE can leave the Trade Summary date control on an older session. Try to
    // advance any trade-date control to the newest available option before
    // accepting the page as the latest completed close.
    const dateControls=page.locator('select');
    for(let i=0;i<await dateControls.count().catch(()=>0);i++){
      const el=dateControls.nth(i),meta=((await el.getAttribute('id').catch(()=>''))||'')+' '+((await el.getAttribute('name').catch(()=>''))||'')+' '+((await el.getAttribute('class').catch(()=>''))||'');
      if(!/date|trade|market|summary/i.test(meta))continue;
      const opts=await el.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:(o.textContent||'').trim()}))).catch(()=>[]);
      const dated=opts.map(o=>({...o,d:formatDate(o.t)||formatDate(o.v)})).filter(o=>o.d).sort((a,b)=>new Date(b.d)-new Date(a.d));
      if(dated.length&&dated[0].d!==tradeDate){
        console.log(`Advancing JSE Trade Summary selector from ${tradeDate||'unknown'} to ${dated[0].d}`);
        await el.selectOption(dated[0].v).catch(()=>{});
        await page.waitForTimeout(1800);
        const refreshed=await page.locator('body').innerText().catch(()=>body),next=await extractTradeDate(page,refreshed);
        tradeDate=next.label||dated[0].d;
        break;
      }
    }
    const tables=await extractTables(page);
    console.log(`JSE rendered ${tables.length} table(s); ${tradeDate?`detected trade date ${tradeDate} from ${td.source}`:'trade date not proven — existing price dates will be preserved until direct-instrument verification'}.`);
    const securityTables=tables.filter(table=>{
      const h=table.headers.map(norm).join(' ').toLowerCase();
      const text=table.rows.flat().map(norm).join(' ').toUpperCase();
      return /symbol|security/.test(h) && /volume|units/.test(h) && tickers.some(t=>text.includes(t));
    });
    console.log(`JSE security activity tables found: ${securityTables.length}`);
    const candidates=securityTables.map(table=>({table,parsed:parseTable(table,tickers)})).filter(x=>x.parsed.size);
    candidates.sort((a,b)=>activityQuality(b.table,b.parsed)-activityQuality(a.table,a.parsed)||scoreTable(b.table,tickers)-scoreTable(a.table,tickers));
    for(const {table,parsed} of candidates){
      console.log(`JSE candidate activity score ${activityQuality(table,parsed)}; rows ${parsed.size}`);
      for(const [ticker,quote] of parsed){
        const prior=captured.get(ticker);
        if(!prior){captured.set(ticker,quote);continue;}
        // Prefer explicit activity values from the strongest activity table, while
        // retaining valid quote fields already captured.
        captured.set(ticker,{...prior,...Object.fromEntries(Object.entries(quote).filter(([,v])=>v!=null))});
      }
    }
    if(!captured.size) console.warn(body.slice(0,3000));
  }
} finally { await browser.close(); }
let updated=0;
for(const stock of data.stocks){
  const quote=captured.get(String(stock.ticker).toUpperCase()); if(!quote) continue;
  stock.price=Number(quote.price.toFixed(2));
  if(quote.dayJmd!=null)stock.dayJmd=Number(quote.dayJmd.toFixed(2));
  if(quote.dayPct!=null)stock.dayPct=Number(quote.dayPct.toFixed(2));
  if(quote.volume!=null)stock.volume=quote.volume;
  if(quote.valueTraded!=null)stock.valueTraded=quote.valueTraded;
  if(quote.trades!=null)stock.numberOfTrades=quote.trades;
  const avg20=num(stock.averageVolume20D), shares=num(stock.sharesOutstanding), vol=num(quote.volume);
  stock.relativeVolume20D=vol!=null&&avg20>0?Number((vol/avg20).toFixed(2)):null;
  stock.turnoverPct=vol!=null&&shares>0?Number((vol/shares*100).toFixed(6)):null;
  stock.marketActivity={
    volume:vol,
    valueTraded:num(quote.valueTraded),
    trades:num(quote.trades),
    averageVolume20D:avg20,
    relativeVolume20D:stock.relativeVolume20D,
    sharesOutstanding:shares,
    turnoverPct:stock.turnoverPct,
    tradeDate:tradeDate||null,
    volumeSource:'JSE Trade Summary',
    baselineSource:avg20!=null?'StockAnalysis 20D average volume':null,
    sharesSource:shares!=null?(stock.statisticsSource||'StockAnalysis Statistics'):null
  };
  if(tradeDate) stock.priceDate=`${tradeDate} • JSE`;
  stock.source='JSE';
  if(stock.ttmDps!=null&&stock.price>0)stock.trailingYield=Number((stock.ttmDps/stock.price*100).toFixed(2));
  if(stock.buyLow!=null&&stock.buyHigh!=null)stock.zoneStatus=stock.price<stock.buyLow?'below':stock.price>stock.buyHigh?'above':'in';
  updated++; console.log(`${stock.ticker}: J$${stock.price}${tradeDate?` • ${tradeDate}`:' • date unchanged (not proven by Trade Summary)'}`);
}
if(updated){
  if(tradeDate)data.updated=tradeDate.replace(/^([A-Z][a-z]{2})/,m=>({Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December'}[m]||m));
  data.priceLabel='JSE official close where available / StockAnalysis delayed fallback'; writeDashboard(data);
  console.log(`SUCCESS: JSE updated ${updated}/${tickers.length}; collector run date was never used as a trade date.`);
}else console.warn(`WARNING: JSE updated 0/${tickers.length}; preserving fallback values.`);
