(()=>{'use strict';
const DATA=window.JSE_DASHBOARD_DATA;if(!DATA||!Array.isArray(DATA.stocks))return;
const byTicker=new Map(DATA.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
const number=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const pct=(v,d=1)=>number(v)==null?'N/A':Number(v).toFixed(d)+'%';
const ratio=(v,d=2)=>number(v)==null?'N/A':Number(v).toFixed(d)+'×';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isFinance=s=>/bank|insurance|financial|investment|securities/i.test(s.sector||'');
const isProperty=s=>/property|real estate|reit/i.test(s.sector||'')||['KPREIT','FIRSTROCKJMD','SML','138SL','CPFV','SRFJMD'].includes(s.ticker);
function evaluate(s){
 const rows=[];
 const add=(name,field,value,display,condition,explanation,critical=false)=>{
  let status=value==null?'unknown':condition===true?'pass':condition===false?'concern':'neutral';
  rows.push({name,field,display:value==null?'N/A':display,status,explanation,critical});
 };
 const price=number(s.price),fair=number(s.fairValue),pe=number(s.pe),pb=number(s.calculatedPbFromJsePrice)??number(s.pb);
 const roe=number(s.roe),earn=number(s.epsGrowth),rev=number(s.revenueGrowth),fcf=number(s.freeCashFlow),op=number(s.operatingCashFlow);
 const yieldV=number(s.trailingYield)??number(s.currentDividendYield),payout=number(isProperty(s)?(s.affoPayoutRatio??s.ffoPayoutRatio??s.fcfPayoutRatio??s.payoutRatio):s.payoutRatio);
 const cov=number(s.interestCoverage),fcfP=number(s.fcfPayoutRatio);
 const zone=String(s.zoneStatus||'').toLowerCase();
 add('Price vs fair value','Valuation',price!=null&&fair!=null&&fair>0?fair/price-1:null,price!=null&&fair!=null?'J$'+price.toFixed(2)+' / J$'+fair.toFixed(2):'N/A',price!=null&&fair!=null?price<=fair*.9:null,'Model fair value is an estimate, not a guaranteed realizable price.');
 add('Entry price','Timing',zone&&['in','below','above'].includes(zone)?zone:null,zone==='below'?'Below target zone':zone==='in'?'Inside buy zone':zone==='above'?'Above buy zone':'N/A',zone==='in'||zone==='below','An attractive company can still be too expensive to buy now.');
 add('P/E','Valuation',pe,ratio(pe),pe!=null&&pe>0?pe<=20:null,'Context dependent: low P/E may reflect a cyclical peak or exceptional earnings.');
 add('Price / book','Valuation',pb,ratio(pb),pb!=null&&pb>0?(isFinance(s)||isProperty(s)?pb<=1.5:pb<=3):null,'Interpret with asset quality and profitability, especially for banks and property companies.');
 add('Return on equity','Quality',roe,pct(roe),roe!=null?roe>=10:null,'Returns can be distorted by leverage or a small equity base.');
 add('Earnings growth','Growth',earn,pct(earn),earn!=null?earn>=0:null,'Check whether growth is recurring and supported by operating cash.');
 add('Revenue growth','Growth',rev,pct(rev),rev!=null?rev>=0:null,'Check margins as well as revenue direction.');
 add('Dividend yield','Income',yieldV,pct(yieldV,2),yieldV!=null?yieldV>=3:null,'High yield alone is never proof of dividend safety.');
 add(isProperty(s)?'Property payout coverage':'Earnings payout','Income',payout,pct(payout),payout!=null?payout>=0&&payout<=85:null,'Distribution may be at risk if payouts are not sustainably funded.',true);
 if(!isFinance(s)){
  add('Free cash flow','Forensics',fcf,fcf==null?'N/A':fcf.toLocaleString('en-US'),fcf!=null?fcf>0:null,'One-year FCF is not conclusive: inspect capital expenditure and the 3–5 year trend.',true);
  add('FCF dividend payout','Forensics',fcfP,pct(fcfP),fcfP!=null?fcfP>=0&&fcfP<=100:null,'FCF payout above 100% warrants investigation.',true);
  add('Operating cash flow','Forensics',op,op==null?'N/A':op.toLocaleString('en-US'),op!=null?op>0:null,'Revenue and earnings should be reconciled with cash generation.');
  add('Interest coverage','Financial strength',cov,ratio(cov),cov!=null?cov>=2:null,'Low coverage can limit dividend capacity and financial flexibility.',true);
 }else{
  add('Bank/insurer specialist review','Forensics',null,'Not independently verified',null,'Capital adequacy, asset quality, reserves and regulatory filings are required before a forensic verdict.',true);
 }
 const rating=String(s.rating||'UNRATED');
 const ratingLower=rating.toLowerCase();
 const className=/avoid|sell/.test(ratingLower)?'avoid':/watch/.test(ratingLower)?'watch':/hold/.test(ratingLower)?'hold':/buy/.test(ratingLower)?'buy':'unknown';
 const issues=rows.filter(r=>r.status==='concern');
 const unknown=rows.filter(r=>r.status==='unknown');
 const positives=rows.filter(r=>r.status==='pass');
 const reasons=[];
 if(className==='buy')reasons.push('Current dashboard model classifies this as BUY; confirm the supporting evidence and entry zone below.');
 else reasons.push('Current dashboard classification: '+rating+'. The checks below show potential impediments to a BUY, but do not reconstruct the original rating algorithm.');
 if(zone==='above')reasons.push('Price exceeds the dashboard target buy zone: a possible timing/valuation barrier.');
 if(issues.some(r=>r.name.includes('payout')||r.name==='Free cash flow'))reasons.push('Dividend funding or cash generation deserves further scrutiny.');
 if(issues.some(r=>r.name==='Earnings growth'||r.name==='Revenue growth'))reasons.push('Weak earnings or revenue trends reduce investment conviction.');
 if(issues.some(r=>r.name==='Return on equity'))reasons.push('Profitability is below the illustrative quality threshold.');
 if(isFinance(s))reasons.push('Financial-sector risk cannot be cleared using non-financial-company cash-flow rules.');
 if(!issues.length&&className!=='buy')reasons.push('No single displayed check proves why the existing model withheld BUY; examine its sector rules and valuation assumptions.');
 if(unknown.length)reasons.push(unknown.length+' of '+rows.length+' checks lack data: absence is not a passing result.');
 return{rating,className,rows,issues,unknown,positives,reasons,coverage:Math.round(100*(rows.length-unknown.length)/rows.length)};
}
const css=document.createElement('style');css.textContent=`
.jse-decision-button{margin:7px 0;padding:6px 10px;border:1px solid var(--border,#64748b);background:var(--surface2,#1e293b);color:var(--text,#fff);border-radius:9px;font:inherit;font-size:12px;cursor:pointer}
.fresh-objective-card>.jse-decision-button{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;align-self:stretch!important;grid-column:1/-1!important;flex-basis:100%!important;text-align:center!important;line-height:1.35!important;min-height:42px!important}.stock-card>.jse-decision-button{display:block;width:100%;box-sizing:border-box;min-height:40px;text-align:center;white-space:normal;word-break:normal}.jse-decision-button:hover,.jse-decision-button:focus-visible{outline:2px solid var(--accent,#22c55e);outline-offset:2px}
.jse-decision-dialog{border:1px solid var(--border,#555);border-radius:16px;color:var(--text,#fff);background:var(--surface,#17202d);width:min(850px,95vw);max-height:88vh;overflow:auto;padding:18px;box-shadow:0 20px 80px #0008}
.jse-decision-dialog::backdrop{background:#000a}.jse-d-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.jse-d-head button{cursor:pointer;border:1px solid var(--border,#666);background:transparent;color:inherit;border-radius:8px;padding:7px 12px}
.jse-d-intro{line-height:1.6;margin:10px 0}.jse-d-table{width:100%;border-collapse:collapse;font-size:12px}.jse-d-table th,.jse-d-table td{padding:9px 7px;border-bottom:1px solid var(--border,#64748b);text-align:left;vertical-align:top}.jse-d-table th{position:sticky;top:0;background:var(--surface,#17202d)}.jse-d-table td:nth-child(3){font-weight:700}
.jse-d-pill{border-radius:8px;padding:3px 7px;background:var(--surface2,#334155);display:inline-block}.jse-d-pill.pass{color:#4ade80}.jse-d-pill.concern{color:#fda4af}.jse-d-pill.unknown{color:#fbbf24}
.jse-d-summary{padding-left:22px;line-height:1.6}.jse-d-summary li{margin:8px 0}.jse-d-note{font-size:12px;color:var(--muted,#aab);margin-top:12px;line-height:1.55}
@media(max-width:600px){.jse-d-table{font-size:11px}.jse-d-table th,.jse-d-table td{padding:7px 4px}.jse-decision-dialog{padding:10px}}
`;document.head.appendChild(css);
let dialog=document.getElementById('jseDecisionMatrixDialog');
if(!dialog){dialog=document.createElement('dialog');dialog.id='jseDecisionMatrixDialog';dialog.className='jse-decision-dialog';document.body.appendChild(dialog)}
function decisionContext(s){
 const p=number(s.price),lo=number(s.buyLow),hi=number(s.buyHigh),fv=number(s.fairValue),score=number(s.score);
 const fmt=x=>'J$'+x.toFixed(2),lines=[];
 if(p!=null&&lo!=null&&hi!=null&&hi>0){
  lines.push('Current '+fmt(p)+' versus preferred buy range '+fmt(lo)+'–'+fmt(hi)+'.');
  if(p>hi)lines.push('WAIT: share price is '+((p/hi-1)*100).toFixed(1)+'% ABOVE the buy-zone ceiling. A good company can be a poor entry price.');
  else if(p>=lo)lines.push('ENTRY PRICE PASSES: within the preferred buy zone. Other risks still require review.');
  else lines.push('BELOW RANGE: investigate whether the discount reflects deterioration in the business.');
 }else lines.push('No complete buy-zone range available; entry pricing cannot be verified.');
 if(p!=null&&fv!=null&&p>0)lines.push('Model fair value '+fmt(fv)+'; estimated upside '+((fv/p-1)*100).toFixed(1)+'%, before an additional margin of safety.');
 if(score!=null)lines.push('Research score '+score.toFixed(0)+'/100 measures model attractiveness; it is NOT itself an immediate-buy trigger.');
 if(s.bookAdjustedRating&&String(s.bookAdjustedRating).toLowerCase()!==String(s.rating||'').toLowerCase())lines.push('MODEL DISAGREEMENT: book-adjusted rating '+s.bookAdjustedRating+' differs from primary '+s.rating+'.');
 if(s.reason&&/one.month rally/i.test(s.reason)&&number(s.m1)!=null)lines.push('STALE COMMENTARY CHECK: stored explanation refers to an earlier one-month rally; the collected current 1M return is '+pct(s.m1)+'.');
 if(s.primaryListing?.market&&s.primaryListing.market!=='JMSE')lines.push('CROSS-LISTED: confirm price and valuation currency basis.');
 return lines;
}
function open(ticker){const s=byTicker.get(String(ticker||'').toUpperCase());if(!s)return;const d=evaluate(s);const decisionLines=decisionContext(s);
 dialog.innerHTML=`<div class="jse-d-head"><h2>Decision matrix · ${esc(s.ticker)}</h2><button type="button" data-close-decision aria-label="Close decision matrix">Close ×</button></div>
 <p class="jse-d-intro"><b>Current rating: ${esc(d.rating)}</b> · Metric availability: ${d.coverage}% (not an independently audited confidence score)</p>
 <h3>Why BUY, HOLD, WATCH or AVOID?</h3><ul class="jse-d-summary">${decisionLines.map(t=>'<li>'+esc(t)+'</li>').join('')}</ul><details><summary>Additional metric findings</summary><ul>${d.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')}</ul></details>
 <div style="overflow-x:auto"><table class="jse-d-table"><thead><tr><th>Decision check</th><th>Metric</th><th>Assessment</th><th>Interpretation</th></tr></thead><tbody>
 ${d.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.display)}</td><td><span class="jse-d-pill ${r.status}">${r.status==='pass'?'Favourable':r.status==='concern'?'Review':r.status==='unknown'?'Not verified':'Context'}</span></td><td>${esc(r.explanation)}</td></tr>`).join('')}</tbody></table></div>
 <p class="jse-d-note">Illustrative decision thresholds, not the exact internal rating formula. This matrix explains visible supporting and opposing signals without silently changing current ratings. Data availability does not prove data accuracy. Review audited reports, official JSE actions, source dates, market liquidity and sector-specific risks before investing.</p>`;
 dialog.querySelector('[data-close-decision]').addEventListener('click',()=>dialog.close());
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function tickerFromCard(card){return card.querySelector('.fresh-title strong,.ticker,h3')?.textContent?.trim().toUpperCase()}
function mount(){
 document.querySelectorAll('#rankingList .fresh-objective-card,#cardView .stock-card').forEach(card=>{
 if(card.querySelector('[data-decision-ticker]'))return;
 const ticker=tickerFromCard(card);if(!byTicker.has(ticker))return;
 const b=document.createElement('button');b.type='button';b.className='jse-decision-button';b.dataset.decisionTicker=ticker;b.textContent='Why this rating? · Decision matrix';b.addEventListener('click',e=>{e.stopPropagation();open(ticker)});card.appendChild(b);
 });
 document.querySelectorAll('#stockTableBody tr').forEach(row=>{
 if(row.querySelector('[data-decision-ticker]'))return;
 const ticker=row.querySelector('.ticker')?.textContent?.trim().toUpperCase();if(!byTicker.has(ticker))return;
 const cell=row.querySelector('td:last-child');if(!cell)return;
 const b=document.createElement('button');b.type='button';b.className='jse-decision-button';b.dataset.decisionTicker=ticker;b.textContent='Why rating?';b.addEventListener('click',e=>{e.stopPropagation();open(ticker)});cell.appendChild(b);
 });
}
let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(mount,90)};mount();
for(const selector of ['#rankingList','#cardView','#stockTableBody']){const el=document.querySelector(selector);if(el)new MutationObserver(schedule).observe(el,{childList:true})}
document.addEventListener('jse:framework-updated',schedule);document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective],#sortSelect,[data-filter]'))schedule()});
window.JSE_DECISION_MATRIX={evaluate,open,mount};
})();