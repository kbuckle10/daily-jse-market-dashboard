import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE = 'data.js';
const PERIODS = [['m1','1M'],['ytd','YTD'],['m3','3M'],['m6','6M'],['y1','1Y']];

function readDashboard(){
  const raw=fs.readFileSync(DATA_FILE,'utf8');
  const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if(!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}
function writeDashboard(data){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(data,null,2)};\n`);}
function returnRegex(label){
  const e=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`([+-]?\\d+(?:\\.\\d+)?)%\\s*\\(${e}\\)`,'i');
}
async function dismissOverlays(page){
  for(const txt of ['Accept','Accept All','I Agree','Got it','Close']){
    const loc=page.getByRole('button',{name:new RegExp(`^${txt}$`,'i')});
    if(await loc.count().catch(()=>0)) await loc.first().click({timeout:1200}).catch(()=>{});
  }
  await page.keyboard.press('Escape').catch(()=>{});
}
async function clickExactLabel(page,label){
  const candidates=[page.getByText(label,{exact:true}),page.locator('button').filter({hasText:new RegExp(`^\\s*${label}\\s*$`)}),page.locator('[role="button"]').filter({hasText:new RegExp(`^\\s*${label}\\s*$`)}),page.locator('a').filter({hasText:new RegExp(`^\\s*${label}\\s*$`)})];
  for(const loc of candidates){
    const n=await loc.count().catch(()=>0);
    for(let i=0;i<n;i++){
      const el=loc.nth(i);
      if(!await el.isVisible().catch(()=>false)) continue;
      await el.scrollIntoViewIfNeeded().catch(()=>{});
      let clicked=await el.click({force:true,timeout:2500}).then(()=>true).catch(()=>false);
      if(!clicked) clicked=await el.evaluate(node=>{node.click();return true;}).catch(()=>false);
      if(clicked) return true;
    }
  }
  return false;
}
async function safeGoto(page,url){
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      await page.waitForLoadState('load',{timeout:8000}).catch(()=>{});
      return true;
    }catch(err){
      console.warn(`goto attempt ${attempt} failed for ${url}: ${err.message}`);
      if(attempt<3) await page.waitForTimeout(1200*attempt);
    }
  }
  return false;
}
async function capturePeriod(page,label){
  const target=returnRegex(label);
  if(!await clickExactLabel(page,label)) return null;
  for(let i=0;i<16;i++){
    await page.waitForTimeout(300);
    const body=await page.locator('body').innerText().catch(()=>'');
    const m=body.match(target);
    if(m) return Number(m[1]);
  }
  return null;
}
async function captureQuote(page){
  const body=await page.locator('body').innerText().catch(()=>'');
  const re=/Delayed Price\s*·\s*Currency is JMD\s*\n+\s*([0-9]+(?:\.[0-9]+)?)\s*\n+\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*\(([+-]?[0-9]+(?:\.[0-9]+)?)%\)\s*\n+\s*At close:\s*([^\n]+)/i;
  const m=body.match(re);
  if(!m) return null;
  return {price:Number(m[1]),dayJmd:Number(m[2]),dayPct:Number(m[3]),date:m[4].trim()};
}
async function extractHistoryRows(page){
  const rows=await page.locator('table tbody tr').evaluateAll(trs=>trs.map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.textContent?.trim()||''))).catch(()=>[]);
  return rows.filter(r=>r.length>=5).map(r=>({date:new Date(r[0]),close:Number(String(r[4]).replace(/,/g,''))})).filter(r=>!Number.isNaN(r.date.valueOf())&&Number.isFinite(r.close));
}
async function readHistoryRows(context,ticker){
  const page=await context.newPage();
  try{
    if(!await safeGoto(page,`https://stockanalysis.com/quote/jmse/${ticker}/history/`)) return [];
    await dismissOverlays(page);
    await page.waitForSelector('table tbody tr',{timeout:12000}).catch(()=>{});
    if(await clickExactLabel(page,'1Y')){
      await page.waitForTimeout(800);
      await page.waitForSelector('table tbody tr',{timeout:8000}).catch(()=>{});
    }
    const collected=[];
    const seen=new Set();
    for(let pageNo=0; pageNo<12; pageNo++){
      const rows=await extractHistoryRows(page);
      for(const r of rows){
        const key=`${r.date.toISOString().slice(0,10)}|${r.close}`;
        if(!seen.has(key)){seen.add(key);collected.push(r);}
      }
      const years=new Set(collected.map(r=>r.date.getFullYear()));
      if(years.size>=2) break;
      let clicked=false;
      const buttons=page.locator('button');
      const n=await buttons.count().catch(()=>0);
      for(let i=0;i<n;i++){
        const b=buttons.nth(i);
        if(!await b.isVisible().catch(()=>false) || await b.isDisabled().catch(()=>true)) continue;
        const txt=(await b.innerText().catch(()=>'' )).trim();
        const aria=(await b.getAttribute('aria-label').catch(()=>''))||'';
        const title=(await b.getAttribute('title').catch(()=>''))||'';
        if(/^(next|>|›|→)$/i.test(txt) || /next/i.test(aria) || /next/i.test(title)){
          const before=rows[0]?.date?.valueOf();
          if(await b.click({force:true,timeout:2000}).then(()=>true).catch(()=>false)){
            await page.waitForTimeout(600);
            const after=(await extractHistoryRows(page))[0]?.date?.valueOf();
            if(after!==before){clicked=true;break;}
          }
        }
      }
      if(!clicked) break;
    }
    return collected;
  }finally{await page.close();}
}
function historicalReturn(rows,days){
  if(rows.length<2) return null;
  const sorted=[...rows].sort((a,b)=>b.date-a.date), latest=sorted[0];
  const target=new Date(latest.date); target.setDate(target.getDate()-days);
  const comparison=sorted.find(r=>r.date<=target);
  return comparison ? ((latest.close/comparison.close)-1)*100 : null;
}
function ytdReturn(rows){
  if(rows.length<2) return null;
  const sorted=[...rows].sort((a,b)=>b.date-a.date), latest=sorted[0], priorYear=latest.date.getFullYear()-1;
  const priorClose=[...sorted].filter(r=>r.date.getFullYear()===priorYear).sort((a,b)=>b.date-a.date)[0];
  return priorClose ? ((latest.close/priorClose.close)-1)*100 : null;
}

const data=readDashboard();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1100},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'});
const unresolved=[];

for(const stock of data.stocks){
  const ticker=stock.ticker;
  stock.performanceFieldStatus = stock.performanceFieldStatus || {};
  console.log(`\n=== ${ticker} ===`);
  let overviewOk=false;
  const page=await context.newPage();
  try{
    if(await safeGoto(page,`https://stockanalysis.com/quote/jmse/${ticker}/`)){
      overviewOk=true;
      await dismissOverlays(page); await page.waitForTimeout(700);
      const quote=await captureQuote(page);
      if(quote){
        stock.price=quote.price; stock.dayJmd=quote.dayJmd; stock.dayPct=quote.dayPct;
        stock.priceDate=`${quote.date} • SA delayed`; stock.source='SA';
        if(stock.ttmDps!=null && quote.price>0) stock.trailingYield=Number((stock.ttmDps/quote.price*100).toFixed(2));
        if(stock.buyLow!=null && stock.buyHigh!=null) stock.zoneStatus=quote.price<stock.buyLow?'below':quote.price>stock.buyHigh?'above':'in';
        console.log(`quote: J$${quote.price} ${quote.dayPct}% ${quote.date}`);
      } else console.log('quote: not captured; preserving prior dashboard quote');
      for(const [field,label] of PERIODS){
        const value=await capturePeriod(page,label);
        if(value!=null && Number.isFinite(value)){
          stock[field]=Number(value.toFixed(2));
          stock.performanceFieldStatus[field]='captured';
          console.log(`${label}: ${stock[field]}% (displayed SA)`);
        } else console.log(`${label}: interactive value not captured; will try history fallback`);
      }
    }
  }catch(err){console.error(`${ticker} overview: ${err.message}`);}finally{await page.close();}

  try{
    const rows=await readHistoryRows(context,ticker);
    const fallbacks={w1:7,m1:30,m3:92,m6:183,y1:366};
    for(const [field,days] of Object.entries(fallbacks)){
      if(field==='w1' || stock[field]==null){
        const v=historicalReturn(rows,days);
        if(v!=null&&Number.isFinite(v)){
          stock[field]=Number(v.toFixed(2));
          stock.performanceFieldStatus[field]='history-derived';
          console.log(`${field}: ${stock[field]}% (SA history-derived)`);
        }
      }
    }
    if(stock.ytd==null){
      const v=ytdReturn(rows);
      if(v!=null&&Number.isFinite(v)){
        stock.ytd=Number(v.toFixed(2));
        stock.performanceFieldStatus.ytd='history-derived';
        console.log(`ytd: ${stock.ytd}% (SA history-derived)`);
      }
    }
    for(const field of ['w1','m1','ytd','m3','m6','y1']){
      if(stock[field]==null||!Number.isFinite(Number(stock[field]))){
        stock.performanceFieldStatus[field]=rows.length ? 'not-found' : (overviewOk ? 'not-found' : 'scraper-error');
        unresolved.push(`${stock.ticker} ${field}`);
      }
    }
    stock.performanceSource='SA';
  }catch(err){
    console.error(`${ticker} history: ${err.message}`);
    for(const field of ['w1','m1','ytd','m3','m6','y1']){
      if(stock[field]==null||!Number.isFinite(Number(stock[field]))) stock.performanceFieldStatus[field]='scraper-error';
    }
  }
}
await browser.close();

// Always publish the values that were successfully captured. A few unavailable
// intervals must not discard valid trend data for every other ticker.
writeDashboard(data);
if(unresolved.length){
  console.warn(`\nPARTIAL: ${unresolved.length} interval field(s) unresolved; preserved all successful SA captures.`);
  unresolved.forEach(x=>console.warn(` - ${x}`));
} else {
  console.log('\nSUCCESS: all Main Market tickers have refreshed SA 1W, 1M, YTD, 3M, 6M and 1Y values.');
}
