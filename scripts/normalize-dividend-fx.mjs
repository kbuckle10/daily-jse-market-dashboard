import fs from 'node:fs';
import vm from 'node:vm';

const DATA_FILE='data.js';
const ONLY_TICKER=String(process.env.TICKER||'').trim().toUpperCase();
const FX_CACHE=new Map();
const BOJ_FALLBACK={rate:158.9911,buy:157.7752,sell:160.2070,rateDate:'2026-10-01',source:'Bank of Jamaica 01 Oct 2026 published USD/JMD midpoint (resilient fallback)'};
function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
async function latestUsdJmd(){
  if(FX_CACHE.has('USD:latest'))return FX_CACHE.get('USD:latest');
  let out=null;
  for(const url of ['https://boj.org.jm/','https://egate.boj.org.jm/egate/']){
    try{
      const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (JSE dividend monitor)'},signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw new Error(String(r.status));
      const html=await r.text(),text=html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ');
      const m=text.match(/USD\s+\$?([0-9]+(?:\.[0-9]+)?)\s+\$?([0-9]+(?:\.[0-9]+)?)/i);
      if(!m)throw new Error('USD rates not found');
      const buy=Number(m[1]),sell=Number(m[2]),rate=(buy+sell)/2;
      const dm=text.match(/([0-9]{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:20)?([0-9]{2})/i);
      const months={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
      const rateDate=dm?`20${dm[3]}-${months[dm[2].toLowerCase()]}-${String(dm[1]).padStart(2,'0')}`:null;
      out={rate,buy,sell,rateDate,source:'Bank of Jamaica latest USD/JMD buy-sell midpoint'};
      break;
    }catch(e){console.warn(`BOJ USD/JMD ${url}: ${e.message}`);}
  }
  out=out||BOJ_FALLBACK;
  FX_CACHE.set('USD:latest',out);
  return out;
}
async function fxRate(currency,date){
  if(currency==='JMD')return {rate:1,source:'native JMD'};
  if(currency==='USD')return latestUsdJmd();
  // Barbados dollar is officially pegged at BBD 2 = USD 1.
  if(currency==='BBD'){
    try{
      const usd=await latestUsdJmd();
      const usdJmd=Number(usd?.rate);
      if(Number.isFinite(usdJmd)&&usdJmd>0)return {rate:usdJmd/2,source:'BOJ USD/JMD midpoint; official BBD 2:USD 1 peg',rateDate:usd?.rateDate||null};
    }catch(e){console.warn('BBD/JMD cross: '+e.message);}
  }
  // Frankfurter does not provide TTD/JMD. Derive the cross from BOJ's
  // latest USD/JMD midpoint and the Trinidad & Tobago dollar's long-standing
  // USD conversion basis. This is for JMD-equivalent display/yield math.
  if(currency==='TTD'){
    try{
      const usd=await latestUsdJmd();
      const usdJmd=Number(usd?.rate);
      const TTD_PER_USD=6.8;
      if(Number.isFinite(usdJmd)&&usdJmd>0)return {rate:usdJmd/TTD_PER_USD,source:'BOJ USD/JMD midpoint; TTD/USD cross basis',rateDate:usd?.rateDate||null};
    }catch(e){console.warn(`TTD/JMD cross: ${e.message}`);}
  }
  const d=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:new Date().toISOString().slice(0,10);
  const url=`https://api.frankfurter.app/${d}?from=${currency}&to=JMD`;
  try{const r=await fetch(url);if(!r.ok)throw new Error(String(r.status));const j=await r.json();const n=Number(j?.rates?.JMD);return Number.isFinite(n)&&n>0?{rate:n,source:'Frankfurter historical FX'}:null;}catch(e){console.warn(`FX ${currency}/JMD ${d}: ${e.message}`);return null;}
}
const iso=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.valueOf())?null:d.toISOString().slice(0,10);};
const data=readData();
let queue=data.stocks;
if(ONLY_TICKER)queue=queue.filter(s=>String(s.ticker).toUpperCase()===ONLY_TICKER);
if(ONLY_TICKER&&!queue.length)throw new Error(`Ticker ${ONLY_TICKER} not found in data.js`);
function indicatedYieldFromJmd(s){
  const price=Number(s.price),jmd=Number(s.latestDividendJmd);
  if(!(price>0)||!Number.isFinite(jmd))return;
  if(String(s.yieldBasis||'')==='indicated-first-public-dividend'){
    s.indicatedDividendJmd=jmd;
    s.indicatedYield=Number((jmd/price*100).toFixed(2));
    s.trailingYield=s.indicatedYield;
    s.ttmDps=jmd;
    s.ttmDpsCurrency='JMD';
    s.ttmDpsStatus='indicated-first-public-dividend-fx-normalized';
    s.ttmDividendCount=1;
    s.dividendDataStatus='validated-indicated-yield';
    s.currentAnnualDps=jmd;s.currentAnnualDpsCurrency='JMD';s.currentDividendYield=s.indicatedYield;
    if(Number(s.buyLow)>0&&Number(s.buyHigh)>0){s.buyYieldLow=Number((jmd/Number(s.buyHigh)*100).toFixed(2));s.buyYieldHigh=Number((jmd/Number(s.buyLow)*100).toFixed(2));}
  }
}
for(const s of queue){
  // SCI declares ordinary dividends in USD even for the SCIJMD share class.
  // JMD holders receive the JMD equivalent. JSE's raw corporate-action amount
  // can therefore not be treated as a native-JMD DPS.
  if(String(s.ticker||'').toUpperCase()==='SCIJMD'){
    const annual=Number(s.currentAnnualDps),price=Number(s.price);
    if(Number.isFinite(annual)&&annual>0&&Number.isFinite(price)&&price>0){
      s.ttmDps=annual;
      s.ttmDpsCurrency='JMD';
      s.trailingYield=Number((annual/price*100).toFixed(2));
      s.ttmDpsStatus='normalized-from-current-annual-dps-mixed-currency-history';
      s.dividendDataStatus='validated-fx-normalized';
    }
  }
  const pendingForeignSa=/^sa-newer-declaration$/i.test(String(s.latestDividendDataStatus||''))
    && String(s.latestDividendDeclaredAmountStatus||'')==='pending-official-jse-declaration'
    && String(s.latestDividendOriginalCurrency||'JMD').toUpperCase()!=='JMD';

  if(pendingForeignSa){
    const jmd=Number(s.latestDividendJmdEquivalent??s.latestDividendJmd??s.latestDividend);
    if(Number.isFinite(jmd)){
      s.latestDividendJmd=jmd;
      s.latestDividendJmdEquivalent=jmd;
      s.latestDividendDisplayCurrency='JMD';
      s.latestDividendFxRate=null;
      s.latestDividendFxDate=null;
      s.latestDividendFxSource='StockAnalysis JMSE displayed JMD equivalent; no reverse conversion performed';
      s.latestDividendFxStatus='sa-jmd-equivalent';
    }
    continue;
  }

  const currency=String(s.latestDividendCurrency||'JMD').toUpperCase();
  // Keep today's valuation FX separate from the event conversion. Current
  // income comparisons use this field; historical dividend records remain frozen.
  if(currency!=='JMD'){
    const currentFx=await fxRate(currency,null);
    const currentRate=Number(currentFx?.rate);
    if(Number.isFinite(currentRate)&&currentRate>0){
      s.currentFxRate=Number(currentRate.toFixed(6));
      s.currentFxDate=currentFx.rateDate||new Date().toISOString().slice(0,10);
      s.currentFxSource=currentFx.source;
      const ttmCurrency=String(s.ttmDpsCurrency||'').toUpperCase();
      const foreignTtm=ttmCurrency===currency?Number(s.ttmDps):null;
      if(Number.isFinite(foreignTtm)&&foreignTtm>0&&Number(s.price)>0){
        s.currentAnnualDpsJmd=Number((foreignTtm*currentRate).toFixed(6));
        s.currentFxYield=Number((s.currentAnnualDpsJmd/Number(s.price)*100).toFixed(2));
        s.trailingYield=s.currentFxYield;
        s.ttmDpsJmd=s.currentAnnualDpsJmd;
      }else if(String(s.yieldBasis||'')==='indicated-first-public-dividend'&&Number.isFinite(Number(s.latestDividend))&&Number(s.price)>0){
        s.currentAnnualDpsJmd=Number((Number(s.latestDividend)*currentRate).toFixed(6));
        s.currentFxYield=Number((s.currentAnnualDpsJmd/Number(s.price)*100).toFixed(2));
        s.trailingYield=s.currentFxYield;
        s.indicatedYield=s.currentFxYield;
        s.ttmDps=s.currentAnnualDpsJmd;
        s.ttmDpsCurrency='JMD';
        s.ttmDpsJmd=s.currentAnnualDpsJmd;
      }
    }
  }
  const amount=Number(s.latestDividend);
  s.latestDividendOriginalAmount=Number.isFinite(amount)?amount:null;
  s.latestDividendOriginalCurrency=currency;
  s.latestDividendDeclaredAmountStatus='official-or-native';
  if(!Number.isFinite(amount))continue;
  if(currency==='JMD'){
    s.latestDividendJmd=amount;s.latestDividendFxRate=1;s.latestDividendFxDate=null;s.latestDividendFxSource='native JMD declaration';s.latestDividendDisplayCurrency='JMD';indicatedYieldFromJmd(s);continue;
  }
  const basis=iso(s.exDate)||iso(s.recordDate)||iso(s.payDate)||new Date().toISOString().slice(0,10);
  const fx=await fxRate(currency,basis);const rate=Number(fx?.rate);
  if(Number.isFinite(rate)&&rate>0){s.latestDividendJmd=Number((amount*rate).toFixed(6));s.latestDividendJmdEquivalent=s.latestDividendJmd;s.latestDividendFxRate=Number(rate.toFixed(6));s.latestDividendFxDate=fx.rateDate||basis;s.latestDividendFxSource=fx.source;s.latestDividendFxBuy=fx.buy??null;s.latestDividendFxSell=fx.sell??null;s.latestDividendDisplayCurrency=currency;s.latestDividendFxStatus='converted';indicatedYieldFromJmd(s);}
  else{s.latestDividendJmd=null;s.latestDividendFxRate=null;s.latestDividendFxDate=basis;s.latestDividendFxSource=null;s.latestDividendDisplayCurrency=currency;s.latestDividendFxStatus='unavailable';}
}
writeData(data);
console.log(`Dividend FX${ONLY_TICKER?` (${ONLY_TICKER})`:''}: processed ${queue.length} ticker(s).`);
