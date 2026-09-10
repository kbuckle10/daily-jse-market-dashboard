(() => {
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const PROPERTY=new Set(['SML','KPREIT','CPFV','138SL','SRFJMD','FIRSTROCKJMD','XFUND']);
  const byTicker=new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const n=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const isProperty=s=>PROPERTY.has(String(s?.ticker||'').toUpperCase())||/property|real estate|reit/i.test(String(s?.sector||''));
  const fmt=(v,d=1)=>n(v)==null?'N/A':Number(v).toFixed(d);
  function coverage(s){
    if(n(s.affoPayoutRatio)!=null)return{label:'AFFO payout',value:n(s.affoPayoutRatio)};
    if(n(s.ffoPayoutRatio)!=null)return{label:'FFO payout',value:n(s.ffoPayoutRatio)};
    if(n(s.fcfPayoutRatio)!=null)return{label:'FCF payout',value:n(s.fcfPayoutRatio)};
    if(n(s.payoutRatio)!=null)return{label:'Payout ratio',value:n(s.payoutRatio)};
    return null;
  }
  function growth(s){
    if(n(s.affoGrowth)!=null)return{label:'AFFO growth',value:n(s.affoGrowth)};
    if(n(s.ffoGrowth)!=null)return{label:'FFO growth',value:n(s.ffoGrowth)};
    if(n(s.rentalRevenueGrowth)!=null)return{label:'Rental growth',value:n(s.rentalRevenueGrowth)};
    if(n(s.noiGrowth)!=null)return{label:'NOI growth',value:n(s.noiGrowth)};
    if(n(s.propertyIncomeGrowth)!=null)return{label:'Property income growth',value:n(s.propertyIncomeGrowth)};
    if(n(s.revenueGrowth)!=null)return{label:'Revenue growth',value:n(s.revenueGrowth)};
    if(n(s.epsGrowth)!=null)return{label:'EPS growth fallback',value:n(s.epsGrowth)};
    return null;
  }
  function fix(){
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card=>{
      const ticker=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);
      if(!s||!isProperty(s))return;
      const p=card.querySelector('.fresh-footer p');if(!p)return;
      let t=p.textContent||'',c=coverage(s),g=growth(s);
      // Objective v2 historically labels its FCF fallback as FFO payout. Make labels source-truthful.
      if(c&&n(s.affoPayoutRatio)==null&&n(s.ffoPayoutRatio)==null)t=t.replace(/FFO payout\s+[+-]?[0-9.]+%/ig,`${c.label} ${fmt(c.value,0)}%`);
      if(g){
        if(n(s.ffoGrowth)==null&&n(s.affoGrowth)!=null)t=t.replace(/FFO growth\s+[+-]?[0-9.]+%/ig,`${g.label} ${fmt(g.value,1)}%`);
        t=t.replace(/FFO\s+N\/A/ig,`${g.label.replace(/ growth$/i,'')} ${fmt(g.value,1)}%`);
        if(g.value<0&&n(s.ffoGrowth)==null)t=t.replace(/FFO is contracting/ig,`${g.label.replace(/ growth$/i,'')} is contracting`);
      }
      p.textContent=t;
    });
  }
  let timer;const run=()=>{clearTimeout(timer);timer=setTimeout(fix,120)};
  const rank=document.getElementById('rankingList');if(rank)new MutationObserver(run).observe(rank,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective]'))run();});
  document.addEventListener('jse:framework-updated',run);run();
  window.JSE_PROPERTY_NARRATIVE_INTEGRITY={fix,coverage,growth};
})();
