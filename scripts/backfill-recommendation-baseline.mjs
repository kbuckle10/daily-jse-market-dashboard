// Verified dashboard inception: 2026-08-18, initial GitHub commit 73f46aa83e12cb75ba661f8b0228fbb76b86b247.
import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATE='2026-08-18';
const FILE='data/recommendation-history.json';
const data=vm.runInNewContext('('+fs.readFileSync('data.js','utf8').match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/)[1]+')');
const existing=fs.existsSync(FILE)?JSON.parse(fs.readFileSync(FILE,'utf8')):{version:1,baselineDate:DATE,baselineSource:'StockAnalysis historical daily close',baseline:{},recommendations:[],trackingStarts:'2026-11-23'};
if(existing.baselineDate!==DATE)throw Error('Baseline date mismatch: refusing overwrite');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
let captured=0;
try {
  for(const stock of data.stocks){
    const ticker=stock.ticker;
    if(existing.baseline[ticker]?.close>0)continue;
    const page=await context.newPage();
    try{
      const response=await page.goto('https://stockanalysis.com/quote/jmse/'+encodeURIComponent(ticker)+'/history/',{waitUntil:'domcontentloaded',timeout:30000});
      if(!response?.ok())throw Error('HTTP '+response?.status());
      const year=page.getByRole('button',{name:'1Y',exact:true}).first();
      if(await year.isVisible({timeout:3000}).catch(()=>false)){await year.click({timeout:3000});await page.waitForTimeout(700);}
      for(let n=0;n<15;n++){
        const tr=page.locator('table tbody tr');
        const count=await tr.count();
        for(let i=0;i<count;i++){
          const cells=(await tr.nth(i).locator('td').allTextContents()).map(x=>x.trim());
          if(!cells.length)continue;
          const dt=new Date(cells[0]);
          if(Number.isNaN(dt.valueOf())||dt.toISOString().slice(0,10)!==DATE)continue;
          // StockAnalysis history columns: Date, Open, High, Low, Close, Adj Close, Change, Volume.
          const headers=(await page.locator('table thead th').allTextContents()).map(x=>x.trim().toLowerCase());
          const idx=headers.findIndex(x=>x==='close');
          if(idx<0||idx>=cells.length)throw Error('Close column not identifiable');
          const close=Number(cells[idx].replace(/[$,]/g,''));
          if(!(close>0))throw Error('Invalid close '+cells[idx]);
          existing.baseline[ticker]={date:DATE,close,currency:'JMD',source:'StockAnalysis',url:page.url(),status:'verified-historical-close'};
          captured++;
          break;
        }
        if(existing.baseline[ticker])break;
        const before=(await tr.first().locator('td').first().textContent().catch(()=>''))||'';
        const candidates=page.locator('button, a[aria-label], a[rel="next"]');
        let advanced=false;
        for(let j=0;j<await candidates.count();j++){
          const btn=candidates.nth(j);
          if(!await btn.isVisible().catch(()=>false)||await btn.isDisabled().catch(()=>false))continue;
          const label=((await btn.getAttribute('aria-label'))||'')+' '+((await btn.getAttribute('title'))||'')+' '+((await btn.textContent())||'');
          if(!/next|›|→/i.test(label))continue;
          await btn.click({timeout:3000}).catch(()=>{});
          await page.waitForTimeout(650);
          const after=(await page.locator('table tbody tr').first().locator('td').first().textContent().catch(()=>''))||'';
          if(after&&after!==before){advanced=true;break;}
        }
        if(!advanced)break;
      }
      if(!existing.baseline[ticker])console.warn(ticker+': August 18 close not located; leaving unavailable');
    }catch(err){console.warn(ticker+': '+err.message);}
    finally{await page.close();}
  }
}finally{await browser.close();}
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(FILE,JSON.stringify(existing,null,2)+'\n');
console.log('Historical closes captured this run: '+captured+'; total: '+Object.keys(existing.baseline).length+'/'+data.stocks.length);
