import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE='data.js';
const PAGES=['','financials/','statistics/','dividend/'];
function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
const num=s=>{if(s==null)return null;const v=Number(String(s).replace(/[,$%x]/gi,'').trim());return Number.isFinite(v)?v:null;};
const pctNum=s=>num(s);
function grab(text,patterns){for(const p of patterns){const m=text.match(p);if(m)return m[1].trim();}return null;}
async function goto(page,url){for(let i=0;i<3;i++){try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForLoadState('load',{timeout:8000}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});return true;}catch(e){if(i===2)console.warn(`goto failed ${url}: ${e.message}`);else await page.waitForTimeout(1000*(i+1));}}return false;}
function parseStats(text){return {
 pe:num(grab(text,[/PE Ratio\s*([0-9.]+)/i,/P\/E Ratio\s*([0-9.]+)/i])),
 forwardPe:num(grab(text,[/Forward PE\s*([0-9.]+)/i,/Forward P\/E\s*([0-9.]+)/i])),
 pb:num(grab(text,[/PB Ratio\s*([0-9.]+)/i,/P\/B Ratio\s*([0-9.]+)/i,/Price\/Book\s*([0-9.]+)/i])),
 roe:pctNum(grab(text,[/Return on Equity \(ROE\)\s*([+-]?[0-9.]+)%/i,/ROE\s*([+-]?[0-9.]+)%/i])),
 roa:pctNum(grab(text,[/Return on Assets \(ROA\)\s*([+-]?[0-9.]+)%/i,/ROA\s*([+-]?[0-9.]+)%/i])),
 payout:pctNum(grab(text,[/Payout Ratio\s*([+-]?[0-9.]+)%/i])),
 eps:num(grab(text,[/EPS\s*([0-9.]+)/i,/EPS \(ttm\)\s*([0-9.]+)/i])),
 epsGrowth:pctNum(grab(text,[/EPS Growth\s*([+-]?[0-9.]+)%/i])),
 revenueGrowth:pctNum(grab(text,[/Revenue Growth\s*([+-]?[0-9.]+)%/i])),
 netIncomeGrowth:pctNum(grab(text,[/Net Income Growth\s*([+-]?[0-9.]+)%/i])),
 debtEquity:num(grab(text,[/Debt \/ Equity Ratio\s*([0-9.]+)/i,/Debt\/Equity\s*([0-9.]+)/i])),
 currentRatio:num(grab(text,[/Current Ratio\s*([0-9.]+)/i])),
 marketCap:grab(text,[/Market Cap\s*([A-Z$0-9.,]+[BMKT]?)/i]),
};}
function parseDividendSummary(text){return {
 annualDps:num(grab(text,[/Annual Dividend\s*(?:J\$)?([0-9.]+)/i,/Dividend \(ttm\)\s*(?:J\$)?([0-9.]+)/i])),
 yield:pctNum(grab(text,[/Dividend Yield\s*([0-9.]+)%/i,/Yield\s*([0-9.]+)%/i])),
 payout:pctNum(grab(text,[/Payout Ratio\s*([0-9.]+)%/i])),
 dividendGrowth:pctNum(grab(text,[/Dividend Growth\s*([+-]?[0-9.]+)%/i])),
};}
async function firstDividendRow(page){try{const tables=page.locator('table');const n=await tables.count();for(let i=0;i<n;i++){const table=tables.nth(i);const headers=await table.locator('thead th').allTextContents().catch(()=>[]);const rows=await table.locator('tbody tr').count().catch(()=>0);if(!rows)continue;const h=headers.map(x=>x.trim().toLowerCase());if(!h.some(x=>/ex-dividend|ex date|dividend/.test(x)))continue;const cells=await table.locator('tbody tr').first().locator('td').allTextContents();const out={};for(let j=0;j<cells.length;j++)out[h[j]||`c${j}`]=cells[j].trim();const get=(re)=>{const k=Object.keys(out).find(x=>re.test(x));return k?out[k]:null;};return {exDate:get(/ex-dividend|ex date/),recordDate:get(/record/),payDate:get(/payment|pay date/),amount:num(get(/amount|dividend/))};}return null;}catch{return null;}}
function sectorTargetPE(sector=''){const s=sector.toLowerCase();if(/bank|financial|investment|insurance/.test(s))return 11;if(/utility|infrastructure|transport/.test(s))return 14;if(/consumer|manufactur|food|beverage/.test(s))return 15;return 13;}
function targetYield(sector=''){const s=sector.toLowerCase();if(/bank|financial|investment/.test(s))return 4.5;if(/consumer|staple|tobacco/.test(s))return 4.25;if(/infrastructure|transport/.test(s))return 3.5;return 4.0;}
function autoAnalyze(s){const price=num(s.price),eps=num(s.epsTtm),dps=num(s.ttmDps),pe=num(s.pe),roe=num(s.roe),growth=num(s.epsGrowth),payout=num(s.payoutRatio);let fair=null;
 const peFair=eps&&eps>0?eps*sectorTargetPE(s.sector):null;const yieldFair=dps&&dps>0?dps/(targetYield(s.sector)/100):null;
 if(peFair&&yieldFair)fair=(peFair*0.65+yieldFair*0.35);else fair=peFair||yieldFair;
 if(fair&&fair>0){const low=fair*0.78,high=fair*0.9;if(s.buyLow==null||s.analysisSource==='AUTO-SA')s.buyLow=Number(low.toFixed(2));if(s.buyHigh==null||s.analysisSource==='AUTO-SA')s.buyHigh=Number(high.toFixed(2));s.fairValue=Number(fair.toFixed(2));if(dps){s.buyYieldLow=Number((dps/s.buyHigh*100).toFixed(2));s.buyYieldHigh=Number((dps/s.buyLow*100).toFixed(2));}if(price)s.zoneStatus=price<s.buyLow?'below':price>s.buyHigh?'above':'in';}
 let score=50;if(pe&&pe>0){if(pe<10)score+=14;else if(pe<14)score+=9;else if(pe>22)score-=10;}if(roe!=null){if(roe>=18)score+=12;else if(roe>=12)score+=7;else if(roe<7)score-=8;}if(growth!=null){if(growth>=15)score+=12;else if(growth>=5)score+=6;else if(growth<0)score-=10;}if(payout!=null){if(payout<=65)score+=7;else if(payout>100)score-=12;}if(s.trailingYield>=4)score+=7;else if(s.trailingYield>=3)score+=4;if(price&&fair){const upside=fair/price-1;if(upside>=.25)score+=10;else if(upside>=.1)score+=5;else if(upside<-.1)score-=10;}score=Math.max(0,Math.min(100,score));
 const rating=score>=78?'Strong Buy':score>=65?'Buy/Accumulate':score>=52?'Hold':score>=40?'Watch/Wait':'Avoid';if(!s.rating||/pending|n\/a/i.test(s.rating)||s.analysisSource==='AUTO-SA'){s.rating=rating;s.ratingClass=/Buy/i.test(rating)?'buy':rating==='Avoid'?'avoid':'hold';s.reason=`Auto-SA fundamentals: P/E ${pe??'N/A'}, ROE ${roe!=null?roe+'%':'N/A'}, EPS growth ${growth!=null?growth+'%':'N/A'}, yield ${s.trailingYield!=null?s.trailingYield+'%':'N/A'}; score ${score}/100.`;s.allocation=Math.max(score,1);s.score=score;s.analysisSource='AUTO-SA';}
}

const data=readData();const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'});
for(const s of data.stocks){console.log(`\n=== ${s.ticker} research ===`);let combined='';let divRow=null;for(const suffix of PAGES){const page=await context.newPage();try{const url=`https://stockanalysis.com/quote/jmse/${s.ticker}/${suffix}`;if(!await goto(page,url))continue;await page.waitForTimeout(400);const text=await page.locator('body').innerText().catch(()=>'');combined+='\n'+text;if(suffix==='dividend/')divRow=await firstDividendRow(page);}finally{await page.close();}}
 const st=parseStats(combined),dv=parseDividendSummary(combined);s.pe=st.pe??s.pe??null;s.forwardPe=st.forwardPe??s.forwardPe??null;s.pb=st.pb??s.pb??null;s.roe=st.roe??s.roe??null;s.roa=st.roa??s.roa??null;s.epsTtm=st.eps??s.epsTtm??null;s.epsGrowth=st.epsGrowth??s.epsGrowth??null;s.revenueGrowth=st.revenueGrowth??s.revenueGrowth??null;s.netIncomeGrowth=st.netIncomeGrowth??s.netIncomeGrowth??null;s.debtEquity=st.debtEquity??s.debtEquity??null;s.currentRatio=st.currentRatio??s.currentRatio??null;s.payoutRatio=dv.payout??st.payout??s.payoutRatio??null;s.dividendGrowth=dv.dividendGrowth??s.dividendGrowth??null;
 if(dv.annualDps!=null){s.ttmDps=dv.annualDps;if(s.price)s.trailingYield=Number((dv.annualDps/s.price*100).toFixed(2));}else if(dv.yield!=null)s.trailingYield=dv.yield;
 if(divRow){if(s.latestDividend==null||/pending|no new declaration/i.test(s.dividendStatus||''))s.latestDividend=divRow.amount??s.latestDividend;if((!s.exDate||s.exDate==='N/A')&&divRow.exDate)s.exDate=divRow.exDate;if((!s.recordDate||s.recordDate==='N/A')&&divRow.recordDate)s.recordDate=divRow.recordDate;if((!s.payDate||s.payDate==='N/A')&&divRow.payDate)s.payDate=divRow.payDate;if(/pending/i.test(s.dividendStatus||''))s.dividendStatus='SA dividend history captured — verify JSE official announcement';}
 s.researchSource='StockAnalysis';s.researchUpdated=new Date().toISOString();autoAnalyze(s);console.log(`PE=${s.pe} PB=${s.pb} ROE=${s.roe} EPS=${s.epsTtm} DPS=${s.ttmDps} yield=${s.trailingYield} rating=${s.rating}`);
}
await browser.close();writeData(data);console.log(`\nResearch refresh complete for ${data.stocks.length} stocks.`);
