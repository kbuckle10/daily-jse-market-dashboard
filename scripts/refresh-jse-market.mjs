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
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return null;
  return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}).format(d);
}
function extractTradeDate(body) {
  const candidates = [
    /(?:trade|trading)\s*date\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    /(?:trade|trading)\s*date\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i,
    /(?:as\s+of|for)\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i
  ];
  for (const re of candidates) { const m = body.match(re); if (m) { const label = formatDate(m[1]); if (label) return label; } }
  return null;
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
  const headers=table.headers;
  const symbolIdx=headerIndex(headers,[/^symbol$/,/ticker/,/security\s*code/,/symbol/]);
  const closeIdx=headerIndex(headers,[/closing\s*price/,/^close$/,/close\s*price/,/last\s*traded\s*price/,/^last$/]);
  const changeIdx=headerIndex(headers,[/price\s*change/,/^change$/,/change\s*\(?j\$?\)?/]);
  const pctIdx=headerIndex(headers,[/%\s*change/,/change\s*%/,/percent/]);
  const volumeIdx=headerIndex(headers,[/volume/,/shares\s*traded/]);
  const out=new Map();
  for(const row of table.rows){
    const upper=row.map(v=>norm(v).toUpperCase()); let ticker=null;
    if(symbolIdx>=0&&upper[symbolIdx]&&tickers.includes(upper[symbolIdx])) ticker=upper[symbolIdx];
    if(!ticker) ticker=tickers.find(t=>upper.some(cell=>cell===t))??null;
    if(!ticker) continue;
    let price=closeIdx>=0?num(row[closeIdx]):null;
    if(price==null){const symbolCell=upper.findIndex(cell=>cell===ticker);const numericAfter=row.slice(symbolCell+1).map(num).filter(v=>v!=null);if(numericAfter.length) price=numericAfter.at(-1);}
    if(!(price>0)) continue;
    const dayJmd=changeIdx>=0?num(row[changeIdx]):null; let dayPct=pctIdx>=0?num(row[pctIdx]):null;
    if(dayPct==null&&dayJmd!=null&&price-dayJmd>0) dayPct=dayJmd/(price-dayJmd)*100;
    const volume=volumeIdx>=0?num(row[volumeIdx]):null;
    out.set(ticker,{price,dayJmd,dayPct,volume,row});
  }
  return out;
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
    tradeDate=extractTradeDate(body);
    const tables=await extractTables(page);
    console.log(`JSE rendered ${tables.length} table(s); ${tradeDate?`detected trade date ${tradeDate}`:'trade date not proven — existing price dates will be preserved until direct-instrument verification'}.`);
    const ranked=[...tables].sort((a,b)=>scoreTable(b,tickers)-scoreTable(a,tickers));
    for(const table of ranked){const parsed=parseTable(table,tickers);for(const [ticker,quote] of parsed)if(!captured.has(ticker))captured.set(ticker,quote);if(captured.size===tickers.length)break;}
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
