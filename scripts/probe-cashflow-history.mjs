// Read-only feasibility probe. Does not modify data.js or dashboard scoring.
// Run: node scripts/probe-cashflow-history.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const tickers = [{ticker:'SEP',market:'jmse'},{ticker:'TJH',market:'jmse'},{ticker:'NCBFG',market:'jmse'},{ticker:'GK',market:'jmse'},{ticker:'GHL',market:'ttse'}];
const labels = {
  operatingCashFlow:/^(operating cash flow|cash from operating activities|net cash provided by operating activities)$/i,
  capitalExpenditures:/^(capital expenditures|capital expenditure|capex)$/i,
  freeCashFlow:/^free cash flow$/i,
  stockBasedCompensation:/^(stock[- ]based compensation|share[- ]based compensation|share[- ]based payments)$/i,
  shareRepurchases:/^(repurchase of (common )?stock|repurchase of shares|share repurchases|common stock repurchased|purchase of treasury stock|buyback of shares)$/i,
  shareIssuance:/^(issuance of (common )?stock|issuance of shares|proceeds from stock issuance|sale of common stock)$/i,
  debtIssued:/^(debt issued|issuance of debt|long[- ]term debt issued|proceeds from borrowings)$/i,
  debtRepaid:/^(debt repaid|repayment of debt|long[- ]term debt repaid|repayments of borrowings)$/i
};
function parseNumber(raw,scale) {
  const s=String(raw??'').trim();if(!s||/^(n\/?a|--|-|—)$/i.test(s))return null;
  const negative=/^\(.*\)$/.test(s);const m=s.replace(/[(),\s]/g,'').replace(/^(JMD|TTD|USD|J\$|TT\$|US\$|\$)/i,'').match(/^([+-]?\d*\.?\d+)([KMBT])?$/i);
  if(!m)return null;const suffix={K:1e3,M:1e6,B:1e9,T:1e12}[m[2]?.toUpperCase()]??scale;
  return Number(m[1])*suffix*(negative?-1:1);
}
async function probe(browser,stock){
  const url=`https://stockanalysis.com/quote/${stock.market}/${stock.ticker}/financials/cash-flow-statement/?p=annual`;
  const page=await browser.newPage();const out={...stock,url,status:'error',periods:[],metrics:{},notes:[]};
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    out.httpStatus=response?.status()??null;
    if(!response?.ok()){out.notes.push('HTTP response unsuccessful');return out;}
    const body=await page.locator('body').innerText();
    const scale=/financials?\s+in\s+billions|in\s+billions/i.test(body)?1e9:/financials?\s+in\s+millions|in\s+millions/i.test(body)?1e6:/financials?\s+in\s+thousands|in\s+thousands/i.test(body)?1e3:1;
    const tables=page.locator('table');
    for(let t=0;t<await tables.count();t++){
      const table=tables.nth(t);const headers=(await table.locator('thead tr').first().locator('th,td').allTextContents()).map(s=>s.trim());
      if(headers.length<3)continue;
      const periods=headers.slice(1).filter(Boolean);
      if(periods.length>out.periods.length)out.periods=periods;
      for(const row of await table.locator('tbody tr').all()){
        const cells=(await row.locator('th,td').allTextContents()).map(s=>s.trim());
        for(const [key,regex] of Object.entries(labels)){
          if(!regex.test(cells[0]??''))continue;
          const values={};headers.slice(1).forEach((period,i)=>{if(period)values[period]=parseNumber(cells[i+1],scale);});
          out.metrics[key]=values;
        }
      }
    }
    out.status=out.periods.length?'parsed':'no-periods';
    out.annualPeriods=out.periods.filter(x=>/^20\d{2}$|(?:FY\s*)?20\d{2}/i.test(x)).length;
    if(out.annualPeriods<5)out.notes.push('Fewer than five annual periods identified; inspect source availability');
    if(!Object.keys(out.metrics).length)out.notes.push('No expected cash flow row labels found');
  }catch(e){out.notes.push(e.message);}finally{await page.close();}
  return out;
}
const browser=await chromium.launch({headless:true});
const results=[];
try{for(const s of tickers){const r=await probe(browser,s);results.push(r);console.log(s.ticker,r.status,'annual periods',r.annualPeriods??0,'metrics',Object.keys(r.metrics).join(','));}}
finally{await browser.close();}
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/cashflow-feasibility.json',JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)+'\n');
console.log('Wrote artifacts/cashflow-feasibility.json (no production data changes)');
