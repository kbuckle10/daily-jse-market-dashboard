import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE='data.js';
function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
const num=s=>{if(s==null)return null;const m=String(s).replace(/,/g,'').match(/-?[0-9]+(?:\.[0-9]+)?/);return m?Number(m[0]):null;};
const dateValue=v=>{const d=new Date(v);return Number.isNaN(d.valueOf())?0:d.valueOf();};
function currencyFromText(text,fallback='JMD'){const s=String(text||'').toUpperCase();if(/TTD|TT\$/.test(s))return 'TTD';if(/USD|US\$/.test(s))return 'USD';if(/JMD|J\$/.test(s))return 'JMD';return fallback;}
async function goto(page,url){for(let i=0;i<3;i++){try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForLoadState('load',{timeout:8000}).catch(()=>{});return true;}catch(e){if(i===2)console.warn(`goto failed ${url}: ${e.message}`);else await page.waitForTimeout(1000*(i+1));}}return false;}
async function firstDividendRow(page){
  const tables=page.locator('table');
  const n=await tables.count().catch(()=>0);
  for(let i=0;i<n;i++){
    const table=tables.nth(i);
    const headers=(await table.locator('thead th').allTextContents().catch(()=>[])).map(x=>x.trim().toLowerCase());
    const row=table.locator('tbody tr').first();
    if(!(await row.count().catch(()=>0)))continue;
    if(!headers.some(h=>/ex-dividend|ex date/.test(h)) || !headers.some(h=>/cash amount|amount/.test(h)))continue;
    const cells=await row.locator('td').allTextContents().catch(()=>[]);
    const val=re=>{const idx=headers.findIndex(h=>re.test(h));return idx>=0?cells[idx]?.trim()||null:null;};
    const amountText=val(/cash amount|^amount$/);
    return {exDate:val(/ex-dividend|ex date/),amount:num(amountText),currency:currencyFromText(amountText),recordDate:val(/record date|record/),payDate:val(/pay date|payment/)};
  }
  return null;
}

const data=readData();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'});
for(const s of data.stocks){
  const page=await context.newPage();
  try{
    const url=`https://stockanalysis.com/quote/jmse/${s.ticker}/dividend/`;
    if(!await goto(page,url)){s.saLatestDividendStatus='scraper-error';continue;}
    await page.waitForTimeout(500);
    const row=await firstDividendRow(page);
    if(!row||row.amount==null){s.saLatestDividendStatus='not-found';continue;}
    const existingDate=Math.max(dateValue(s.exDate),dateValue(s.recordDate),dateValue(s.payDate));
    const saDate=Math.max(dateValue(row.exDate),dateValue(row.recordDate),dateValue(row.payDate));
    s.saLatestDividendStatus='captured';
    s.saLatestDividend={amount:row.amount,currency:row.currency,exDate:row.exDate,recordDate:row.recordDate,payDate:row.payDate,url};
    if(saDate>existingDate){
      s.latestDividend=row.amount;
      s.latestDividendCurrency=row.currency||s.latestDividendCurrency||'JMD';
      s.exDate=row.exDate||s.exDate||'N/A';
      s.recordDate=row.recordDate||s.recordDate||'N/A';
      s.payDate=row.payDate||s.payDate||'N/A';
      s.dividendUrl=url;
      s.dividendStatus='StockAnalysis newer declared dividend — JSE corporate-action table pending/cross-check JSE news';
      s.latestDividendDataStatus='sa-newer-declaration';
      console.log(`${s.ticker}: SA newer event ${s.latestDividendCurrency} ${row.amount}; ex=${row.exDate} record=${row.recordDate} pay=${row.payDate}`);
    } else if(saDate===existingDate && /official-jse/i.test(String(s.latestDividendDataStatus||''))){
      s.latestDividendDataStatus='official-jse-sa-confirmed';
    }
  }catch(e){console.warn(`${s.ticker}: ${e.message}`);s.saLatestDividendStatus='scraper-error';}
  finally{await page.close();}
}
await browser.close();
writeData(data);
