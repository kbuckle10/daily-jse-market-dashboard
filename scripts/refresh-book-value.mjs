import fs from 'node:fs';
import vm from 'node:vm';

const DATA_FILE = 'data.js';

function readData(){
  const raw=fs.readFileSync(DATA_FILE,'utf8');
  const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if(!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}
const n=v=>v==null?null:Number(v);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function sectorClass(sector=''){
  const s=sector.toLowerCase();
  if(/bank|financial|investment|insurance|real estate|reit|property/.test(s)) return 'book-sensitive';
  if(/manufactur|industrial|infrastructure|transport|utility|energy|conglomerate/.test(s)) return 'asset-heavy';
  return 'low-weight';
}
function labelForPb(pb){
  if(pb==null||!Number.isFinite(pb)||pb<=0) return {label:'N/A',tone:'na'};
  if(pb<0.60) return {label:'DEEP DISCOUNT',tone:'deep-discount'};
  if(pb<0.80) return {label:'SIGNIFICANT DISCOUNT',tone:'discount'};
  if(pb<1.00) return {label:'BELOW BOOK',tone:'discount'};
  if(pb<=1.25) return {label:'NEAR BOOK',tone:'near-book'};
  if(pb<=2.00) return {label:'PREMIUM',tone:'premium'};
  return {label:'HIGH PREMIUM',tone:'high-premium'};
}
function adjustment(pb,cls){
  if(pb==null||!Number.isFinite(pb)||pb<=0) return 0;
  if(cls==='book-sensitive'){
    if(pb<0.60) return 12;
    if(pb<0.80) return 8;
    if(pb<1.00) return 4;
    if(pb<=1.25) return 0;
    if(pb<=1.50) return -3;
    if(pb<=2.00) return -6;
    return -10;
  }
  if(cls==='asset-heavy'){
    if(pb<0.60) return 6;
    if(pb<0.80) return 4;
    if(pb<1.00) return 2;
    if(pb<=1.50) return 0;
    if(pb<=2.50) return -2;
    return -5;
  }
  return 0;
}
function ratingFromScore(score){
  if(score>=78) return 'Strong Buy';
  if(score>=65) return 'Buy/Accumulate';
  if(score>=52) return 'Hold';
  if(score>=40) return 'Watch/Wait';
  return 'Avoid';
}

const data=readData();
for(const s of data.stocks){
  const price=n(s.price), pb=n(s.pb);
  const cls=sectorClass(s.sector);
  const sig=labelForPb(pb);
  s.bookValueSectorClass=cls;
  s.bookValueStatus=sig.label;
  s.bookValueTone=sig.tone;
  if(price!=null&&price>0&&pb!=null&&pb>0){
    s.bookValuePerShare=Number((price/pb).toFixed(2));
    s.bookDiscountPct=Number(((1-pb)*100).toFixed(1));
  } else {
    s.bookValuePerShare=null;
    s.bookDiscountPct=null;
  }
  const adj=adjustment(pb,cls);
  s.bookValueScoreAdjustment=adj;
  const baseScore=Number.isFinite(n(s.score))?n(s.score):null;
  s.bookAdjustedScore=baseScore==null?null:clamp(baseScore+adj,0,100);
  s.bookAdjustedRating=s.bookAdjustedScore==null?(s.rating||'N/A'):ratingFromScore(s.bookAdjustedScore);
  const comparison=s.bookDiscountPct==null?'book value unavailable':s.bookDiscountPct>0?`${s.bookDiscountPct}% below book`:s.bookDiscountPct<0?`${Math.abs(s.bookDiscountPct)}% above book`:'at book value';
  const weighting=cls==='book-sensitive'?'high relevance for this sector':cls==='asset-heavy'?'moderate relevance for this sector':'low weighting for this sector';
  s.bookValueAnalysis=`P/B ${pb!=null?pb.toFixed(2)+'x':'N/A'}; ${comparison}; ${sig.label}; ${weighting}.`;
  // Preserve explicit analyst ratings, but let book value influence automatic scoring/allocation.
  if(s.analysisSource==='AUTO-SA' && s.bookAdjustedScore!=null){
    s.score=s.bookAdjustedScore;
    s.rating=s.bookAdjustedRating;
    s.ratingClass=/Buy/i.test(s.rating)?'buy':s.rating==='Avoid'?'avoid':'hold';
    s.allocation=Math.max(s.score,1);
    s.reason=`${s.reason||''} Book-value lens: ${s.bookValueAnalysis}`.trim();
  }
}
writeData(data);
console.log(`Book-value valuation enrichment complete for ${data.stocks.length} stocks.`);
