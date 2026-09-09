(() => {
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const PROPERTY=new Set(['SML','KPREIT','CPFV','138SL','SRFJMD','FIRSTROCKJMD','XFUND']);
  const n=v=>v==null||!Number.isFinite(Number(v))?null:Number(v),clamp=v=>Math.max(0,Math.min(100,v));
  const isProperty=s=>PROPERTY.has(String(s.ticker||'').toUpperCase())||/property|real estate|reit/i.test(String(s.sector||''));
  const isFinanceProperty=s=>String(s.ticker||'').toUpperCase()==='SRFJMD'||/real estate finance/i.test(String(s.sector||''));
  const avg=a=>{a=a.filter(v=>n(v)!=null);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
  const band=(v,rules,neutral=50)=>{v=n(v);if(v==null)return null;for(const [f,s] of rules)if(f(v))return s;return neutral};
  const higher=(v,a,b,c)=>band(v,[[x=>x>=a,90],[x=>x>=b,75],[x=>x>=c,60],[x=>x>=0,45],[x=>x<0,25]]);
  const payout=v=>band(v,[[x=>x>=20&&x<=70,90],[x=>x>=0&&x<=80,75],[x=>x<=100,55],[x=>x>100,20]]);
  const debtStrength=s=>{const cover=n(s.interestCoverage),de=n(s.debtEquity),net=n(s.netCash),parts=[];if(cover!=null)parts.push(band(cover,[[x=>x>=4,90],[x=>x>=3,80],[x=>x>=2,62],[x=>x<2,30]]));if(de!=null)parts.push(band(de,[[x=>x<=.5,90],[x=>x<=1,78],[x=>x<=1.5,62],[x=>x>1.5,38]]));if(net!=null)parts.push(net>=0?90:55);return avg(parts)};
  function lenses(s){
    const pb=n(s.calculatedPbFromJsePrice)??n(s.pb),pe=n(s.pe),disc=n(s.bookDiscountPct),roe=n(s.roe),roa=n(s.roa);
    const affog=n(s.affoGrowth),ffog=n(s.ffoGrowth),rental=n(s.rentalRevenueGrowth)??n(s.noiGrowth)??n(s.propertyIncomeGrowth),rev=n(s.revenueGrowth),eps=n(s.epsGrowth);
    const cov=n(s.affoPayoutRatio)??n(s.ffoPayoutRatio)??n(s.fcfPayoutRatio)??n(s.payoutRatio),y=n(s.currentDividendYield)??n(s.trailingYield),dg=n(s.dividendGrowth);
    const valuation=avg([pb==null?null:band(pb,[[x=>x<=.7,95],[x=>x<=1,88],[x=>x<=1.3,72],[x=>x<=1.8,55],[x=>x>1.8,35]]),disc==null?null:band(disc,[[x=>x>=30,95],[x=>x>=15,85],[x=>x>=0,70],[x=>x>=-15,50],[x=>x<-15,30]]),isFinanceProperty(s)&&pe!=null?band(pe,[[x=>x>0&&x<=10,85],[x=>x<=15,70],[x=>x>15,45]]):null]);
    const quality=avg([higher(roe,18,12,7),higher(roa,8,5,2),n(s.occupancy)!=null?higher(s.occupancy,95,90,80):null]);
    const recurringGrowth=affog??ffog??rental??rev??eps;
    const growth=avg([higher(recurringGrowth,12,5,0),rental!=null&&rental!==recurringGrowth?higher(rental,10,4,0):null,rev!=null&&rev!==recurringGrowth?higher(rev,10,4,0):null]);
    const financial=debtStrength(s);
    const dividend=avg([y==null?null:band(y,[[x=>x>=6,92],[x=>x>=4,82],[x=>x>=3,70],[x=>x>0,52]]),payout(cov),dg==null?null:higher(dg,8,3,0)]);
    const momentum=avg([n(s.m1),n(s.m3),n(s.m6),n(s.y1)].map(v=>v==null?null:band(v,[[x=>x>=15,90],[x=>x>=5,78],[x=>x>=0,65],[x=>x>=-10,45],[x=>x<-10,25]])));
    return {valuation,quality,growth,financial,dividend,momentum,recurringGrowth,coverage:cov};
  }
  function apply(s){if(!isProperty(s))return;const L=lenses(s),vals=[L.valuation,L.quality,L.growth,L.financial,L.dividend,L.momentum].filter(v=>v!=null);if(!vals.length)return;const score=clamp(vals.reduce((a,b)=>a+b,0)/vals.length);s.frameworkLenses={valuation:L.valuation,quality:L.quality,growth:L.growth,financialStrength:L.financial,dividend:L.dividend,momentum:L.momentum};s.frameworkType=isFinanceProperty(s)?'Real Estate Finance':'Property / Real Estate';s.frameworkGrowthMetric=n(s.affoGrowth)!=null?'AFFO growth':n(s.ffoGrowth)!=null?'FFO growth':n(s.rentalRevenueGrowth)!=null?'Rental revenue growth':n(s.noiGrowth)!=null?'NOI growth':n(s.propertyIncomeGrowth)!=null?'Property income growth':n(s.revenueGrowth)!=null?'Revenue growth':'EPS growth fallback';s.frameworkCoverageMetric=n(s.affoPayoutRatio)!=null?'AFFO payout':n(s.ffoPayoutRatio)!=null?'FFO payout':n(s.fcfPayoutRatio)!=null?'FCF payout':n(s.payoutRatio)!=null?'EPS payout fallback':'Coverage unavailable';s.score=Number(score.toFixed(1));s.frameworkAdaptive=true;
    const rating=score>=78?'Strong Buy':score>=65?'Buy / Accumulate':score>=52?'Hold / Wait':score>=40?'Watch':'Avoid';s.rating=rating;s.ratingClass=score>=65?'buy':score<40?'avoid':'hold';
  }
  D.stocks.forEach(apply);
  function explainFramework(){const sec=document.getElementById('scoreFrameworkSection');if(!sec)return;const intro=sec.querySelector('.score-framework-intro');if(intro)intro.textContent='Adaptive six-lens framework: normal companies use conventional earnings/cash metrics; property companies automatically prioritize NAV/P-B, recurring property income, leverage/interest coverage and sustainable distribution coverage. Missing FFO/AFFO is not penalized and is replaced by the strongest available recurring-cash metric.';
    const cards=[...sec.querySelectorAll('.score-driver')];const find=t=>cards.find(c=>c.querySelector('strong')?.textContent?.trim()===t);
    const set=(t,metrics,text)=>{const c=find(t);if(!c)return;const m=c.querySelector('.score-driver-metrics');if(m)m.innerHTML=metrics.map(x=>`<span>${x}</span>`).join('');const p=c.querySelector('p');if(p)p.textContent=text;};
    set('Valuation',['P/E','P/B / NAV','Fair value upside','Buy-zone position'],'Property companies prioritize NAV/book discount or premium; P/E becomes secondary where property accounting makes earnings less comparable.');
    set('Quality',['ROE','ROA','Occupancy when available'],'Property quality uses sustainable returns and operating/occupancy evidence when available; missing property-specific fields are ignored, not scored as zero.');
    set('Growth',['AFFO/FFO if available','Rental / NOI / property income','Revenue growth','EPS fallback'],'Adaptive hierarchy: AFFO/FFO growth → rental/NOI/property-income growth → revenue growth → EPS only as a fallback. This reduces the effect of revaluation-driven earnings.');
    set('Financial strength',['Net debt / net cash','Interest coverage','Debt / Equity','LTV when available'],'Property leverage is judged through debt burden and interest coverage, with LTV/debt-to-assets used when available. Conventional liquidity ratios are secondary.');
    set('Dividend',['Current yield','AFFO/FFO payout if available','FCF/OCF coverage fallback','Dividend growth'],'Coverage hierarchy: AFFO payout → FFO payout → FCF payout → conventional payout. Missing FFO/AFFO does not reduce the score by itself.');
    const note=sec.querySelector('.score-framework-note');if(note)note.innerHTML='<strong>Adaptive property rule:</strong> FFO/AFFO are supplemental metrics, not mandatory inputs. The Overall Score and Primary Rating use the best available metric within each lens; property companies are not penalized simply because FFO/AFFO are unavailable.';
  }
  function rerender(){explainFramework();const active=document.querySelector('[data-fresh-objective].active');if(active)active.click();document.dispatchEvent(new CustomEvent('jse:framework-updated'));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(rerender,120));else setTimeout(rerender,120);
  window.JSE_ADAPTIVE_FRAMEWORK={apply,lenses,isProperty};
})();