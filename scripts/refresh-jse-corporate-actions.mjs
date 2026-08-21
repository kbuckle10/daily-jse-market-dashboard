import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE='data.js';
function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
function parseAmount(text){const s=String(text||'').replace(/\s+/g,' ').trim();const m=s.match(/\b(TTD|JMD|USD)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i)||s.match(/\b(TT\$|J\$|US\$)\s*([0-9]+(?:\.[0-9]+)?)/i);if(!m)return null;const raw=m[1].toUpperCase();const currency=raw.startsWith('TT')?'TTD':raw.startsWith('US')?'USD':'JMD';const amount=Number(m[2]);return Number.isFinite(amount)?{amount,currency}:null;}
function dateValue(v){const d=new Date(v);return Number.isNaN(d.valueOf())?0:d.valueOf();}
async function load(page,url){for(let i=0;i<3;i++){try{const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});await page.waitForLoadState('load',{timeout:7000}).catch(()=>{});await page.waitForTimeout(1200);await page.keyboard.press('Escape').catch(()=>{});const text=await page.locator('body').innerText().catch(()=>'');if((r?.status()||200)<400&&text.length>300&&!/access denied|forbidden|verify you are human/i.test(text))return true;}catch{}await page.waitForTimeout(800*(i+1));}return false;}
async function latestDividend(page){const tables=page.locator('table');let best=null;for(let i=0;i<await tables.count();i++){const t=tables.nth(i);const headers=(await t.locator('thead th').allTextContents().catch(()=>[])).map(x=>x.replace(/\s+/g,' ').trim().toLowerCase());if(!headers.length)continue;const recIdx=headers.findIndex(h=>/record date/.test(h)),actIdx=headers.findIndex(h=>/^action$/.test(h)),exIdx=headers.findIndex(h=>/ex-date|ex date/.test(h)),payIdx=headers.findIndex(h=>/payment date|pay date/.test(h)),amtIdx=headers.findIndex(h=>/dividend amount|amount/.test(h));if(actIdx<0||amtIdx<0)continue;const rows=await t.locator('tbody tr').all();for(const tr of rows){const cells=(await tr.locator('td').allTextContents().catch(()=>[])).map(x=>x.replace(/\s+/g,' ').trim());if(!/dividend/i.test(cells[actIdx]||''))continue;const parsed=parseAmount(cells[amtIdx]);if(!parsed)continue;const row={recordDate:cells[recIdx]||null,exDate:cells[exIdx]||null,payDate:cells[payIdx]||null,...parsed};if(!best||dateValue(row.exDate||row.recordDate)>dateValue(best.exDate||best.recordDate))best=row;}}
return best;}

const data=readData();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:950},locale:'en-US',timezoneId:'America/Jamaica',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'});
const queue=data.stocks.filter(s=>/jamstockex\.com\/trading\/instruments\/\?instrument=/i.test(s.jse||''));
let cursor=0,updated=0,errors=0;
async function worker(){while(true){const i=cursor++;if(i>=queue.length)return;const s=queue[i],page=await context.newPage();try{if(!await load(page,s.jse)){errors++;s.jseCorporateActionStatus='scraper-error';console.warn(`${s.ticker}: JSE instrument page failed`);continue;}const row=await latestDividend(page);if(!row){s.jseCorporateActionStatus='not-found';console.log(`${s.ticker}: no JSE dividend corporate action found`);continue;}s.latestDividend=Number(row.amount.toFixed(5));s.latestDividendCurrency=row.currency;s.exDate=row.exDate||s.exDate;s.recordDate=row.recordDate||s.recordDate;s.payDate=row.payDate||s.payDate;s.dividendUrl=s.jse;s.dividendStatus=`Official JSE corporate action dividend (${row.currency})`;s.latestDividendDataStatus='official-jse';s.jseCorporateActionStatus='ok';updated++;console.log(`${s.ticker}: ${row.currency} ${row.amount} Ex ${row.exDate||'N/A'} Record ${row.recordDate||'N/A'} Pay ${row.payDate||'N/A'}`);}catch(e){errors++;s.jseCorporateActionStatus='scraper-error';console.warn(`${s.ticker}: ${e.message}`);}finally{await page.close();}}}
await Promise.all(Array.from({length:Math.min(6,queue.length)},()=>worker()));
await browser.close();
writeData(data);
console.log(`JSE corporate actions: updated ${updated}/${queue.length}; scraper errors ${errors}.`);
