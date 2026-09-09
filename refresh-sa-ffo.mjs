import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE='data.js';
const CONCURRENCY=Math.max(1,Math.min(6,Number(process.env.SA_FFO_CONCURRENCY||4)));
const CROSSLISTED={GHL:{market:'ttse',ticker:'GHL',currency:'TTD'}};

function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
function marketConfig(s){return CROSSLISTED[s.ticker]||{market:'jmse',ticker:s.ticker,currency:'JMD'};}
function parseScaled(value,mult=1){if(value==null)return null;let s=String(value).trim();if(!s||/^(?:n\/?a|--|-|—)$/i.test(s))return null;const neg=/^\(.*\)$/.test(s);s=s.replace(/[()\s]/g,'').replace(/^(?:JMD|TTD|USD|J\$|TT\$|US\$|\$)/i,'').replace(/,/g,'');const m=s.match(/^([+-]?[0-9]*\.?[0-9]+)([KMBT])?$/i);if(!m)return null;const suffix=String(m[2]||'').toUpperCase();const explicit={K:1e3,M:1e6,B:1e9,T:1e12}[suffix]||null;const n=Number(m[1])*(explicit??mult)*(neg?-1:1);return Number.isFinite(n)?n:null;}
function parsePlain(value){if(value==null)return null;const s=String(value).trim();if(!s||/^(?:n\/?a|--|-|—)$/i.test(s))return null;const n=Number(s.replace(/[,$%x]/gi,'').replace(/,/g,'').trim());return Number.isFinite(n)?n:null;}
async function goto(page,url){for(let i=0;i<3;i++){try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForLoadState('load',{timeout:8000}).catch(()=>{});await page.keyboard.press('Escape').catch(()=>{});return true;}catch(e){if(i===2)console.warn(`goto failed ${url}: ${e.message}`);else await page.waitForTimeout(1000*(i+1));}}return false;}
async function statementMultiplier(page){const text=await page.locator('body').innerText().catch(()=>'');if(/financials?\s+in\s+billions|in\s+billions/i.test(text))return 1e9;if(/financials?\s+in\s+millions|in\s+millions/i.test(text))return 1e6;if(/financials?\s+in\s+thousands|in\s+thousands/i.test(text))return 1e3;return 1;}
async function metricRow(page,labelRegex,parser){const tables=page.locator('table');for(let i=0;i<await tables.count();i++){const rows=tables.nth(i).locator('tbody tr');for(let r=0;r<await rows.count();r++){const cells=await rows.nth(r).locator('th,td').allTextContents().catch(()=>[]);if(cells.length<2||!labelRegex.test(String(cells[0]).trim()))continue;const vals=cells.slice(1).map(v=>parser(v)).filter(v=>v!=null);if(vals.length)return{current:vals[0]??null,prior:vals[1]??null};}}return{current:null,prior:null};}
function growth(cur,prior){if(cur==null||prior==null||Number(prior)===0)return null;return Number(((Number(cur)/Number(prior)-1)*100).toFixed(2));}

async function scrapeStock(context,s){const cfg=marketConfig(s),url=`https://stockanalysis.com/quote/${cfg.market}/${cfg.ticker}/financials/`;const page=await context.newPage();console.log(`\n=== ${s.ticker} FFO/AFFO (${cfg.market.toUpperCase()}) ===`);try{if(!await goto(page,url)){s.ffoDataStatus='scraper-error';return;}await page.waitForTimeout(250);const mult=await statementMultiplier(page);const scaled=v=>parseScaled(v,mult);
const ffo=await metricRow(page,/^(?:funds from operations|funds from operations \(ffo\)|ffo)$/i,scaled);
const affo=await metricRow(page,/^(?:adjusted funds from operations|adjusted funds from operations \(affo\)|affo)$/i,scaled);
const ffoPs=await metricRow(page,/^(?:ffo per share|funds from operations per share)$/i,parsePlain);
const affoPs=await metricRow(page,/^(?:affo per share|adjusted funds from operations per share)$/i,parsePlain);
const directFfoPayout=await metricRow(page,/^(?:ffo payout ratio|funds from operations payout ratio)$/i,parsePlain);
const directAffoPayout=await metricRow(page,/^(?:affo payout ratio|adjusted funds from operations payout ratio)$/i,parsePlain);
const found=[ffo.current,affo.current,ffoPs.current,affoPs.current,directFfoPayout.current,directAffoPayout.current].some(v=>v!=null);
if(ffo.current!=null)s.ffo=ffo.current;if(ffo.prior!=null)s.ffoPrior=ffo.prior;if(ffo.current!=null&&ffo.prior!=null)s.ffoGrowth=growth(ffo.current,ffo.prior);
if(affo.current!=null)s.affo=affo.current;if(affo.prior!=null)s.affoPrior=affo.prior;if(affo.current!=null&&affo.prior!=null)s.affoGrowth=growth(affo.current,affo.prior);
if(ffoPs.current!=null)s.ffoPerShare=ffoPs.current;if(affoPs.current!=null)s.affoPerShare=affoPs.current;
const annualDps=parsePlain(s.currentAnnualDps)??parsePlain(s.ttmDps);
if(directFfoPayout.current!=null)s.ffoPayoutRatio=directFfoPayout.current;else if(annualDps!=null&&s.ffoPerShare>0)s.ffoPayoutRatio=Number((annualDps/s.ffoPerShare*100).toFixed(2));
if(directAffoPayout.current!=null)s.affoPayoutRatio=directAffoPayout.current;else if(annualDps!=null&&s.affoPerShare>0)s.affoPayoutRatio=Number((annualDps/s.affoPerShare*100).toFixed(2));
s.ffoCurrency=cfg.currency;s.ffoSource='StockAnalysis Financials';s.ffoUrl=url;s.ffoUpdated=new Date().toISOString();s.ffoDataStatus=found?'captured':'not-found';
console.log(`${s.ticker}: FFO=${s.ffo??'N/A'} FFO/share=${s.ffoPerShare??'N/A'} FFO growth=${s.ffoGrowth??'N/A'}% FFO payout=${s.ffoPayoutRatio??'N/A'}% AFFO=${s.affo??'N/A'} AFFO/share=${s.affoPerShare??'N/A'} status=${s.ffoDataStatus}`);
}finally{await page.close();}}

async function runPool(items,worker,count){let next=0;const runners=Array.from({length:Math.min(count,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)return;await worker(items[i],i);}});await Promise.all(runners);}

const data=readData();const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'});console.log(`FFO/AFFO collector concurrency=${CONCURRENCY} stocks=${data.stocks.length}`);await runPool(data.stocks,s=>scrapeStock(context,s),CONCURRENCY);await browser.close();writeData(data);console.log(`FFO/AFFO refresh complete for ${data.stocks.length} stocks.`);