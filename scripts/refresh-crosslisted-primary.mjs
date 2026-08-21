import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE = 'data.js';
const CONFIG = {
  GHL: { market: 'ttse', nativeCurrency: 'TTD', primaryTicker: 'GHL' }
};
const PERIODS = [['m1','1M'],['ytd','YTD'],['m3','3M'],['m6','6M'],['y1','1Y']];

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const m = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}
function writeData(d) { fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(d, null, 2)};\n`); }
const num = s => {
  if (s == null) return null;
  const v = Number(String(s).replace(/[,$%x]/gi, '').trim());
  return Number.isFinite(v) ? v : null;
};
function grab(text, patterns) {
  for (const p of patterns) { const m = text.match(p); if (m) return m[1].trim(); }
  return null;
}
async function goto(page, url) {
  for (let i=0;i<3;i++) try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForLoadState('load',{timeout:8000}).catch(()=>{});
    await page.keyboard.press('Escape').catch(()=>{});
    return true;
  } catch(e) { if(i===2) console.warn(`goto failed ${url}: ${e.message}`); else await page.waitForTimeout(1000*(i+1)); }
  return false;
}
function parseStats(text) {
  return {
    pe: num(grab(text,[/PE Ratio\s*([0-9.]+)/i,/P\/E Ratio\s*([0-9.]+)/i])),
    forwardPe: num(grab(text,[/Forward PE\s*([0-9.]+)/i,/Forward P\/E\s*([0-9.]+)/i])),
    pb: num(grab(text,[/PB Ratio\s*([0-9.]+)/i,/P\/B Ratio\s*([0-9.]+)/i,/Price\/Book\s*([0-9.]+)/i])),
    roe: num(grab(text,[/Return on Equity \(ROE\)\s*([+-]?[0-9.]+)%/i,/ROE\s*([+-]?[0-9.]+)%/i])),
    roa: num(grab(text,[/Return on Assets \(ROA\)\s*([+-]?[0-9.]+)%/i,/ROA\s*([+-]?[0-9.]+)%/i])),
    eps: num(grab(text,[/EPS \(ttm\)\s*([+-]?[0-9.]+)/i,/EPS\s*([+-]?[0-9.]+)/i])),
    epsGrowth: num(grab(text,[/EPS Growth\s*([+-]?[0-9.]+)%/i])),
    revenueGrowth: num(grab(text,[/Revenue Growth\s*([+-]?[0-9.]+)%/i])),
    netIncomeGrowth: num(grab(text,[/Net Income Growth\s*([+-]?[0-9.]+)%/i])),
    debtEquity: num(grab(text,[/Debt \/ Equity Ratio\s*([0-9.]+)/i,/Debt\/Equity\s*([0-9.]+)/i]))
  };
}
function parseDividend(text) {
  const pair=text.match(/Dividend\s*(?:TT\$|J\$|US\$|\$)?\s*([0-9.]+)\s*\(([0-9.]+)%\)/i);
  return {
    annualDps:num(grab(text,[/Annual Dividend\s*(?:TT\$|J\$|US\$|\$)?\s*([0-9.]+)/i,/Dividend \(ttm\)\s*(?:TT\$|J\$|US\$|\$)?\s*([0-9.]+)/i])) ?? (pair?num(pair[1]):null),
    yield:num(grab(text,[/Dividend Yield\s*([0-9.]+)%/i])) ?? (pair?num(pair[2]):null),
    payout:num(grab(text,[/Payout Ratio\s*([0-9.]+)%/i])),
    growth:num(grab(text,[/Dividend Growth\s*([+-]?[0-9.]+)%/i])),
    exDate:grab(text,[/Ex-Dividend Date\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4})/i])
  };
}
function returnRegex(label){
  const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`([+-]?\\d+(?:\\.\\d+)?)%\\s*\\(${e}\\)`,'i');
}
async function clickExactLabel(page,label){
  const candidates=[page.getByText(label,{exact:true}),page.locator('button').filter({hasText:new RegExp(`^\\s*${label}\\s*$`)}),page.locator('[role="button"]').filter({hasText:new RegExp(`^\\s*${label}\\s*$`)}),page.locator('a').filter({hasText:new RegExp(`^\\s*${label}\\s*$`)})];
  for(const loc of candidates){
    const n=await loc.count().catch(()=>0);
    for(let i=0;i<n;i++){
      const el=loc.nth(i);
      if(!await el.isVisible().catch(()=>false)) continue;
      await el.scrollIntoViewIfNeeded().catch(()=>{});
      const clicked=await el.click({force:true,timeout:2500}).then(()=>true).catch(()=>false);
      if(clicked) return true;
    }
  }
  return false;
}
async function capturePeriod(page,label){
  if(!await clickExactLabel(page,label)) return null;
  const re=returnRegex(label);
  for(let i=0;i<16;i++){
    await page.waitForTimeout(300);
    const body=await page.locator('body').innerText().catch(()=>'');
    const m=body.match(re);
    if(m) return Number(m[1]);
  }
  return null;
}
async function firstDividendRow(page) {
  const tables=page.locator('table');
  for(let i=0;i<await tables.count();i++){
    const t=tables.nth(i), headers=(await t.locator('thead th').allTextContents().catch(()=>[])).map(x=>x.trim().toLowerCase());
    if(!headers.some(x=>/ex-dividend|ex date/.test(x))) continue;
    if(!(await t.locator('tbody tr').count().catch(()=>0))) continue;
    const cells=await t.locator('tbody tr').first().locator('td').allTextContents();
    const obj={}; cells.forEach((v,j)=>obj[headers[j]||`c${j}`]=v.trim());
    const get=re=>{const k=Object.keys(obj).find(x=>re.test(x));return k?obj[k]:null;};
    return {exDate:get(/ex-dividend|ex date/),recordDate:get(/record/),payDate:get(/payment|pay date/),amount:num(get(/cash amount|amount|dividend/))};
  }
  return null;
}
async function extractHistoryRows(page){
  const rows=await page.locator('table tbody tr').evaluateAll(trs=>trs.map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.textContent?.trim()||''))).catch(()=>[]);
  return rows.filter(r=>r.length>=5).map(r=>({date:new Date(r[0]),close:Number(String(r[4]).replace(/,/g,''))})).filter(r=>!Number.isNaN(r.date.valueOf())&&Number.isFinite(r.close));
}
function historicalReturn(rows,days){
  if(rows.length<2) return null;
  const sorted=[...rows].sort((a,b)=>b.date-a.date), latest=sorted[0];
  const target=new Date(latest.date); target.setDate(target.getDate()-days);
  const comparison=sorted.find(r=>r.date<=target);
  return comparison ? ((latest.close/comparison.close)-1)*100 : null;
}

const data=readData();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'});

for(const [ticker,cfg] of Object.entries(CONFIG)){
  const s=data.stocks.find(x=>x.ticker===ticker); if(!s) continue;
  console.log(`\n=== ${ticker}: primary listing ${cfg.market.toUpperCase()} ===`);
  let research='', dividend='', row=null, ok=false;
  const overview=await context.newPage();
  try{
    const url=`https://stockanalysis.com/quote/${cfg.market}/${cfg.primaryTicker}/`;
    if(await goto(overview,url)){
      const text=await overview.locator('body').innerText().catch(()=>'');
      if(text){research+='\n'+text;ok=true;}
      s.performanceFieldStatus=s.performanceFieldStatus||{};
      for(const [field,label] of PERIODS){
        const value=await capturePeriod(overview,label);
        if(value!=null&&Number.isFinite(value)){
          s[field]=Number(value.toFixed(2));
          s.performanceFieldStatus[field]='primary-listing-captured';
          console.log(`${label}: ${s[field]}% (${cfg.market.toUpperCase()} primary)`);
        }
      }
    }
  } finally { await overview.close(); }

  for(const suffix of ['financials/', 'statistics/']){
    const p=await context.newPage();
    try{const url=`https://stockanalysis.com/quote/${cfg.market}/${cfg.primaryTicker}/${suffix}`; if(await goto(p,url)){const text=await p.locator('body').innerText().catch(()=>''); if(text){research+='\n'+text;ok=true;}}}finally{await p.close();}
  }
  const p=await context.newPage();
  try{const url=`https://stockanalysis.com/quote/${cfg.market}/${cfg.primaryTicker}/dividend/`; if(await goto(p,url)){dividend=await p.locator('body').innerText().catch(()=>''); row=await firstDividendRow(p);}}finally{await p.close();}
  if(!ok){s.primaryListingResearchStatus='scraper-error'; console.warn(`${ticker}: TTSE research failed; preserving prior values`); continue;}

  const historyPage=await context.newPage();
  try{
    const url=`https://stockanalysis.com/quote/${cfg.market}/${cfg.primaryTicker}/history/`;
    if(await goto(historyPage,url)){
      await historyPage.waitForSelector('table tbody tr',{timeout:12000}).catch(()=>{});
      const rows=await extractHistoryRows(historyPage);
      const w1=historicalReturn(rows,7);
      if(w1!=null&&Number.isFinite(w1)){
        s.w1=Number(w1.toFixed(2));
        s.performanceFieldStatus=s.performanceFieldStatus||{};
        s.performanceFieldStatus.w1='primary-listing-history-derived';
        console.log(`1W: ${s.w1}% (${cfg.market.toUpperCase()} history)`);
      }
    }
  } finally { await historyPage.close(); }

  const st=parseStats(research), dv=parseDividend(dividend), jmdPrice=num(s.price);
  s.pe=st.pe ?? s.pe; s.forwardPe=st.forwardPe ?? s.forwardPe; s.pb=st.pb ?? s.pb; s.roe=st.roe ?? s.roe; s.roa=st.roa ?? s.roa;
  s.epsGrowth=st.epsGrowth ?? s.epsGrowth; s.revenueGrowth=st.revenueGrowth ?? s.revenueGrowth; s.netIncomeGrowth=st.netIncomeGrowth ?? s.netIncomeGrowth; s.debtEquity=st.debtEquity ?? s.debtEquity;
  s.payoutRatio=dv.payout ?? s.payoutRatio; s.dividendGrowth=dv.growth ?? s.dividendGrowth;

  // Keep the actual JSE/JMD share price, but use the primary TTSE listing for
  // company ratios, fundamentals, dividends, and performance/history context.
  if(jmdPrice && st.pe>0) s.epsTtm=Number((jmdPrice/st.pe).toFixed(4));
  if(jmdPrice && st.pb>0) s.bookValuePerShare=Number((jmdPrice/st.pb).toFixed(4));
  if(jmdPrice && dv.yield!=null){s.trailingYield=Number(dv.yield.toFixed(2)); s.ttmDps=Number((jmdPrice*dv.yield/100).toFixed(4)); s.dividendDataStatus='validated-primary-listing';}

  s.primaryListing={market:cfg.market.toUpperCase(),ticker:cfg.primaryTicker,currency:cfg.nativeCurrency,source:'StockAnalysis',url:`https://stockanalysis.com/quote/${cfg.market}/${cfg.primaryTicker}/`};
  s.nativeEps=st.eps; s.nativeAnnualDps=dv.annualDps; s.nativeLatestDividend=row?.amount ?? null;
  s.nativeDividendCurrency=cfg.nativeCurrency;
  s.primaryListingResearchStatus='ok';

  if(row?.amount!=null && dv.annualDps>0 && s.ttmDps!=null){
    s.latestDividend=Number((s.ttmDps*(row.amount/dv.annualDps)).toFixed(4));
    s.latestDividendDataStatus='primary-listing-derived-jmd';
    s.exDate=row.exDate || dv.exDate || s.exDate; s.recordDate=row.recordDate || s.recordDate; s.payDate=row.payDate || s.payDate;
    s.dividendStatus=`Primary listing ${cfg.market.toUpperCase()} dividend; JMD amount derived for JSE comparison`;
  }
  s.performanceSource=`StockAnalysis ${cfg.market.toUpperCase()} primary listing`;
  s.researchSource=`StockAnalysis ${cfg.market.toUpperCase()} primary listing`;
  s.sa=`https://stockanalysis.com/quote/${cfg.market}/${cfg.primaryTicker}/`;
  s.researchUpdated=new Date().toISOString();
  console.log(`PE=${s.pe} PB=${s.pb} ROE=${s.roe} nativeEPS=${st.eps} JMD-equiv EPS=${s.epsTtm} nativeDPS=${dv.annualDps} JMD-equiv DPS=${s.ttmDps} yield=${s.trailingYield}% latestNative=${row?.amount ?? 'N/A'} latestJMD=${s.latestDividend ?? 'N/A'}`);
}
await browser.close();
writeData(data);
