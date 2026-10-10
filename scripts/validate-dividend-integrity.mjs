import fs from 'node:fs';
import vm from 'node:vm';

const raw=fs.readFileSync('data.js','utf8');
const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!m)throw new Error('Unable to parse data.js');
const d=vm.runInNewContext(`(${m[1]})`);
const n=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
const errors=[],warnings=[];
const pctDiff=(a,b)=>Math.abs(a-b);
for(const s of d.stocks||[]){
  const t=String(s.ticker||'').toUpperCase(),price=n(s.price),ttm=n(s.ttmDps),y=n(s.trailingYield);
  const tc=String(s.ttmDpsCurrency||'JMD').toUpperCase(),lc=String(s.latestDividendCurrency||'JMD').toUpperCase();
  if(price>0&&ttm!=null&&ttm>=0&&y!=null&&tc==='JMD'){
    const calc=ttm/price*100;
    if(pctDiff(calc,y)>0.35)errors.push(`${t}: trailingYield ${y}% disagrees with JMD TTM DPS/price ${calc.toFixed(2)}%`);
  }
  if(n(s.latestDividend)!=null&&!['JMD','USD','TTD','BBD'].includes(lc))warnings.push(`${t}: unsupported/latest dividend currency ${lc}`);
  if(lc!=='JMD'&&n(s.latestDividend)!=null&&!Number.isFinite(n(s.latestDividendJmd)))errors.push(`${t}: foreign latest dividend lacks JMD equivalent`);
  if(lc!=='JMD'&&n(s.latestDividend)!=null){
    if(!(n(s.currentFxRate)>0))errors.push(`${t}: foreign dividend lacks current-close FX rate`);
    if(!s.currentFxDate)errors.push(`${t}: foreign dividend lacks current-close FX date`);
    if(!s.currentFxSource)errors.push(`${t}: foreign dividend lacks current-close FX source`);
  }
  if(String(s.yieldBasis||'')==='indicated-first-public-dividend'){
    if(!(n(s.indicatedYield)>0))errors.push(`${t}: indicated-first-public-dividend missing indicatedYield`);
    if(Math.abs((n(s.indicatedYield)??0)-(y??0))>0.05)errors.push(`${t}: indicatedYield and trailingYield disagree`);
  }
  if(y!=null&&y>100)errors.push(`${t}: implausible trailing yield ${y}% (possible currency/double-FX error)`);
}
const sil=(d.stocks||[]).find(s=>s.ticker==='SIL');
if(sil){
  const sy=n(sil.trailingYield);
  if(String(sil.ttmDpsCurrency||'').toUpperCase()!=='JMD')errors.push('SIL: annual DPS must be normalized to JMD');
  if(!(sy>3&&sy<7))errors.push(`SIL: normalized trailing yield expected in 3-7% range, got ${sy}`);
}
const ghl=(d.stocks||[]).find(s=>s.ticker==='GHL');
if(ghl){
  const gy=n(ghl.trailingYield),py=n(ghl.primaryListingDividendYield);
  if(!(gy>6&&gy<9))errors.push(`GHL: JMSE canonical yield expected in 6-9% range, got ${gy}`);
  // Primary-listing yield is market-driven: validate against the TTSE source metric, not a fixed band.
  const referenceYield=n(ghl.statisticsDividendYield);
  if(py==null||py<0||py>100)errors.push(`GHL: invalid TTSE reference yield ${py}`);
  if(referenceYield!=null&&py!=null&&pctDiff(referenceYield,py)>0.35)errors.push(`GHL: TTSE reference yield ${py}% disagrees with StockAnalysis TTSE statistics ${referenceYield}%`);
  if(gy!=null&&py!=null&&Math.abs(gy-py)<0.25)warnings.push('GHL: JMSE and TTSE yields are unexpectedly near-identical; verify cross-listing price basis');
}
const q=(d.stocks||[]).find(s=>s.ticker==='QAINC');
if(q&&!(q.latestDividendCurrency==='USD'&&Math.abs(n(q.latestDividend)-0.0073)<1e-9&&n(q.trailingYield)>1))errors.push('QAINC: official USD declaration/normalized yield integrity failed');
const sci=(d.stocks||[]).find(s=>s.ticker==='SCIJMD');
if(sci){
  if(sci.latestDividendCurrency!=='USD')errors.push(`SCIJMD: latest declaration currency must be USD, got ${sci.latestDividendCurrency}`);
  if(!(n(sci.latestDividend)>0.004&&n(sci.latestDividend)<0.005))errors.push(`SCIJMD: latest USD dividend amount unexpected: ${sci.latestDividend}`);
  if(!(n(sci.trailingYield)>5))errors.push(`SCIJMD: normalized yield implausibly low: ${sci.trailingYield}`);
}
if(warnings.length)console.warn('Dividend integrity warnings:\n- '+warnings.join('\n- '));
if(errors.length)throw new Error('Dividend integrity failed:\n- '+errors.join('\n- '));
console.log(`Dividend integrity passed for ${d.stocks.length} stocks${warnings.length?` with ${warnings.length} warning(s)`:''}.`);
