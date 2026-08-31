(()=>{
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const byTicker=new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const fmt=(v,d=1)=>num(v)==null?'N/A':Number(v).toFixed(d);
  function narrative(s){
    const y=num(s.currentDividendYield)??num(s.trailingYield),pe=num(s.pe),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),epsg=num(s.epsGrowth),revg=num(s.revenueGrowth),roe=num(s.roe),book=num(s.bookDiscountPct),payout=num(s.payoutRatio),fcf=num(s.fcfPayoutRatio),m1=num(s.m1),y1=num(s.y1);
    const positives=[],risks=[];
    if(y!=null&&y>=5)positives.push(`${fmt(y,2)}% current yield`);else if(y!=null&&y>=3)positives.push(`${fmt(y,2)}% income yield`);
    if(pe!=null&&pe>0&&pe<=12)positives.push(`P/E ${fmt(pe,1)}×`);
    if(pb!=null&&pb<=1)positives.push(`below-book valuation (P/B ${fmt(pb,2)}×)`);else if(book!=null&&book>=15)positives.push(`${fmt(book,0)}% below book`);
    if(roe!=null&&roe>=15)positives.push(`ROE ${fmt(roe,1)}%`);
    if(epsg!=null&&epsg>=10)positives.push(`EPS growth ${fmt(epsg,1)}%`);else if(revg!=null&&revg>=10)positives.push(`revenue growth ${fmt(revg,1)}%`);
    if(s.zoneStatus==='below')positives.push('below target buy zone');else if(s.zoneStatus==='in')positives.push('inside target buy zone');
    if(payout!=null&&payout>100)risks.push(`payout ${fmt(payout,0)}% exceeds earnings`);else if(payout!=null&&payout>80)risks.push(`high payout ${fmt(payout,0)}%`);
    if(fcf!=null&&fcf>100)risks.push('dividend exceeds free-cash-flow coverage');
    if(epsg!=null&&epsg<0)risks.push(`EPS growth ${fmt(epsg,1)}%`);
    if(revg!=null&&revg<0)risks.push(`revenue growth ${fmt(revg,1)}%`);
    if(s.zoneStatus==='above')risks.push('price above target buy zone');
    if(y1!=null&&y1<=-15)risks.push(`1Y price trend ${fmt(y1,1)}%`);else if(m1!=null&&m1<=-10)risks.push(`1M price trend ${fmt(m1,1)}%`);
    const p=positives.slice(0,3),r=risks.slice(0,2);
    const rating=s.rating||'N/A';
    if(p.length&&r.length)return `${rating}: ${p.join(' • ')} support the case, but ${r.join(' and ')} warrant caution.`;
    if(p.length)return `${rating}: ${p.join(' • ')} are the strongest current positives.`;
    if(r.length)return `${rating}: ${r.join(' and ')} are the main current risks.`;
    return `${rating}: valuation, earnings, dividend and price-trend signals are mixed; use the detailed metrics above for the decision.`;
  }
  function apply(){
    document.querySelectorAll('#cardView .stock-card').forEach(card=>{
      const t=card.querySelector('h3')?.textContent?.trim().toUpperCase(),s=byTicker.get(t),p=card.querySelector('.rank-reason');if(s&&p)p.textContent=narrative(s);
      card.querySelectorAll('.metric-row').forEach(row=>{const label=row.querySelector('span');if(label&&/trailing yield/i.test(label.textContent||''))label.textContent='Current yield';});
    });
  }
  apply();
  const rerun=()=>setTimeout(apply,40);
  document.addEventListener('click',e=>{if(e.target.closest?.('.filter-tile,#tableViewBtn,#cardViewBtn,[data-ticker],#resetTrackedBtn,#showAllTickersBtn'))rerun();});
  document.addEventListener('change',e=>{if(e.target.matches?.('#sortSelect,#watchlistStatusFilter'))rerun();});
  window.addEventListener('storage',rerun);
  window.JSE_PERFORMANCE_NARRATIVE={apply,narrative};
})();
