import fs from 'node:fs';
import vm from 'node:vm';

const path='data/recommendation-history.json';
const source=fs.readFileSync('data.js','utf8');
const m=source.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!m)throw Error('Missing dashboard data');
const data=vm.runInNewContext('('+m[1]+')');
const date=String(data.updated||'');
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid dataset date');
const history=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{version:1,baselineDate:'2026-08-18',baselineSource:'StockAnalysis historical daily close',baseline:{},recommendations:[],trackingStarts:'2026-11-23'};
if(history.baselineDate!=='2026-08-18')throw Error('Unexpected baseline date');
history.baseline ||= {};
history.recommendations ||= [];
history.trackingStarts ||= '2026-11-23';
const isBuy=s=>String(s.ratingClass||'').toLowerCase()==='buy';
const eligible=date>=history.trackingStarts;
for(const s of data.stocks){
  const base=history.baseline[s.ticker];
  const price=Number(s.price);
  const priceDate=String(s.priceDate||'');
  const parsedPriceDate=new Date(priceDate.split(' • ')[0]);
  const actualPriceDate=Number.isNaN(parsedPriceDate.valueOf())?'':parsedPriceDate.toISOString().slice(0,10);
  const validPrice=Number.isFinite(price)&&price>0&&actualPriceDate===date;
  // Prevent misleading cross-currency returns.
  const market=String(s.primaryListing?.market||'JMSE').toUpperCase();
  const baselineComparable=base&&base.close>0&&base.currency==='JMD'&&market==='JMSE'&&validPrice;
  s.inceptionPerformance=baselineComparable?{
    baselineDate:base.date,baselineClose:base.close,priceReturnPct:Number(((price/base.close-1)*100).toFixed(2)),source:base.source,status:'verified-price-only'
  }:{baselineDate:history.baselineDate,status:base?'price-or-currency-not-comparable':'historical-close-unavailable'};
  const previous=history.recommendations.filter(x=>x.ticker===s.ticker&&x.status==='active').at(-1);
  if(eligible&&validPrice){
    if(isBuy(s)&&!previous){
      history.recommendations.push({ticker:s.ticker,startDate:date,startPrice:price,currency:'JMD',rating:s.rating,score:s.score??null,status:'active',source:s.source||'unknown',startPriceDate:priceDate,baselineClassification:date===history.trackingStarts?'initial-observation':'new-buy'});
    }else if(!isBuy(s)&&previous){
      previous.status='closed';previous.endDate=date;previous.endPrice=price;previous.endRating=s.rating;
      previous.priceReturnPct=Number(((price/previous.startPrice-1)*100).toFixed(2));
    }
  }
  const current=history.recommendations.filter(x=>x.ticker===s.ticker&&x.status==='active').at(-1);
  if(current&&validPrice&&current.currency==='JMD'&&market==='JMSE'){
    s.buySignalPerformance={startDate:current.startDate,startPrice:current.startPrice,priceReturnPct:Number(((price/current.startPrice-1)*100).toFixed(2)),status:'active',baselineClassification:current.baselineClassification};
  }else{
    s.buySignalPerformance={status:eligible?'no-active-comparable-buy':'tracking-starts-2026-11-23'};
  }
}
// Never remove past records when tickers disappear from the current universe.
history.lastProcessedDate=date;
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(path,JSON.stringify(history,null,2)+'\n');
fs.writeFileSync('data.js','window.JSE_DASHBOARD_DATA = '+JSON.stringify(data,null,2)+';\n');
console.log('Recommendation tracking: '+date+', baseline closes '+Object.keys(history.baseline).length+', total events '+history.recommendations.length);
