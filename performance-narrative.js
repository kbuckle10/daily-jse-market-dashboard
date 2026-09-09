(()=>{
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const PROPERTY=new Set(['SML','KPREIT','CPFV','138SL','SRFJMD','FIRSTROCKJMD','XFUND']);
  const byTicker=new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const fmt=(v,d=1)=>num(v)==null?'N/A':Number(v).toFixed(d);
  const isProperty=s=>PROPERTY.has(String(s.ticker||'').toUpperCase())||/property|real estate|reit/i.test(String(s.sector||''));
  function narrative(s){
    const y=num(s.currentDividendYield)??num(s.trailingYield),pe=num(s.pe),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),epsg=num(s.epsGrowth),revg=num(s.revenueGrowth),roe=num(s.roe),book=num(s.bookDiscountPct),payout=num(s.payoutRatio),fcf=num(s.fcfPayoutRatio),fcfps=num(s.freeCashFlowPerShare),m1=num(s.m1),y1=num(s.y1),net=num(s.netCash),cover=num(s.interestCoverage),ffog=num(s.ffoGrowth)??num(s.affoGrowth),ffop=num(s.affoPayoutRatio)??num(s.ffoPayoutRatio);
    const property=isProperty(s),positives=[],risks=[];
    if(y!=null&&y>=5)positives.push(`${fmt(y,2)}% current yield`);else if(y!=null&&y>=3)positives.push(`${fmt(y,2)}% income yield`);
    if(pb!=null&&pb<=1)positives.push(`below-book valuation (P/B ${fmt(pb,2)}×)`);else if(book!=null&&book>=15)positives.push(`${fmt(book,0)}% below book`);
    if(!property&&pe!=null&&pe>0&&pe<=12)positives.push(`P/E ${fmt(pe,1)}×`);
    if(roe!=null&&roe>=15)positives.push(`ROE ${fmt(roe,1)}%`);
    if(property&&ffog!=null&&ffog>=5)positives.push(`${num(s.ffoGrowth)!=null?'FFO':'AFFO'} growth ${fmt(ffog,1)}%`);
    else if(!property&&epsg!=null&&epsg>=10)positives.push(`EPS growth ${fmt(epsg,1)}%`);
    else if(revg!=null&&revg>=10)positives.push(`revenue growth ${fmt(revg,1)}%`);
    if(property&&ffop!=null&&ffop<=75)positives.push(`${num(s.affoPayoutRatio)!=null?'AFFO':'FFO'} payout ${fmt(ffop,0)}%`);
    else if(!property&&fcf!=null&&fcf>0&&fcf<=75)positives.push(`FCF payout ${fmt(fcf,0)}%`);
    else if(!property&&fcfps!=null&&fcfps>0)positives.push('positive free cash flow');
    if(s.zoneStatus==='below')positives.push('below target buy zone');else if(s.zoneStatus==='in')positives.push('inside target buy zone');

    if(property&&ffop!=null&&ffop>100)risks.push(`${num(s.affoPayoutRatio)!=null?'AFFO':'FFO'} payout ${fmt(ffop,0)}%`);
    else if(!property&&payout!=null&&payout>100)risks.push(`payout ${fmt(payout,0)}% exceeds earnings`);else if(!property&&payout!=null&&payout>80)risks.push(`high payout ${fmt(payout,0)}%`);
    if(!property&&fcf!=null&&fcf>100)risks.push('dividend exceeds free-cash-flow coverage');
    if(property&&ffog!=null&&ffog<0)risks.push(`${num(s.ffoGrowth)!=null?'FFO':'AFFO'} growth ${fmt(ffog,1)}%`);else if(!property&&epsg!=null&&epsg<0)risks.push(`EPS growth ${fmt(epsg,1)}%`);
    if(revg!=null&&revg<0)risks.push(`revenue growth ${fmt(revg,1)}%`);
    if(net!=null&&net<0&&cover!=null&&cover<2)risks.push(`net debt with weak ${fmt(cover,1)}× interest cover`);else if(property&&net!=null&&net<0&&cover!=null&&cover<3)risks.push(`net debt; interest cover ${fmt(cover,1)}×`);
    if(s.zoneStatus==='above')risks.push('price above target buy zone');
    if(y1!=null&&y1<=-15)risks.push(`1Y price trend ${fmt(y1,1)}%`);else if(m1!=null&&m1<=-10)risks.push(`1M price trend ${fmt(m1,1)}%`);
    const p=positives.slice(0,4),r=risks.slice(0,2),rating=s.rating||'N/A';
    if(p.length&&r.length)return `${rating}: ${p.join(' • ')} support the case, but ${r.join(' and ')} warrant caution.`;
    if(p.length)return `${rating}: ${p.join(' • ')} are the strongest current positives.`;
    if(r.length)return `${rating}: ${r.join(' and ')} are the main current risks.`;
    return `${rating}: valuation, operating performance, cash coverage and price-trend signals are mixed; use the detailed metrics above for the decision.`;
  }
  function apply(){
    document.querySelectorAll('#cardView .stock-card').forEach(card=>{
      const t=card.querySelector('h3')?.textContent?.trim().toUpperCase(),s=byTicker.get(t),p=card.querySelector('.rank-reason');if(s&&p)p.textContent=narrative(s);
      card.querySelectorAll('.metric-row').forEach(row=>{const label=row.querySelector('span');if(label&&/trailing yield/i.test(label.textContent||''))label.textContent='Current yield';});
    });
    document.querySelectorAll('#stockTableBody tr').forEach(row=>{
      const t=row.querySelector('.ticker')?.textContent?.trim().toUpperCase(),s=byTicker.get(t),p=row.querySelector('td:nth-child(15) small');
      if(s&&p)p.textContent=narrative(s);
    });
  }
  apply();
  const rerun=()=>setTimeout(apply,40);
  document.addEventListener('click',e=>{if(e.target.closest?.('.filter-tile,#tableViewBtn,#cardViewBtn,[data-ticker],#resetTrackedBtn,#showAllTickersBtn'))rerun();});
  document.addEventListener('change',e=>{if(e.target.matches?.('#sortSelect,#watchlistStatusFilter'))rerun();});
  window.addEventListener('storage',rerun);
  window.JSE_PERFORMANCE_NARRATIVE={apply,narrative};
})();