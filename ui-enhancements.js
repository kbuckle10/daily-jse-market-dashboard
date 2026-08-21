(() => {
  const DATA=window.JSE_DASHBOARD_DATA;
  if(!DATA?.stocks)return;
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const byTicker=new Map(DATA.stocks.map(s=>[s.ticker,s]));
  const fmt=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'N/A':Number(v).toFixed(d);
  const curPrefix=c=>c==='TTD'?'TT$':c==='USD'?'US$':'J$';
  const dpsMoney=s=>s.ttmDps==null?'N/A':`${curPrefix(s.ttmDpsCurrency||'JMD')}${fmt(s.ttmDps,2)}`;
  const tracked=()=>{let a=[];try{a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}const set=new Set(Array.isArray(a)?a:[]);return DATA.stocks.filter(s=>set.has(s.ticker));};
  function styleTags(s){
    const tags=[];
    const value=(s.pb!=null&&s.pb<0.8)||(s.pe!=null&&s.pe>0&&s.pe<10)||(s.bookDiscountPct!=null&&s.bookDiscountPct>=20);
    const income=(s.trailingYield||0)>=3;
    const growth=(s.epsGrowth||0)>=12||(s.revenueGrowth||0)>=10||(s.y1||0)>=20;
    if(value)tags.push('Value'); if(income)tags.push('Income'); if(growth)tags.push('Growth');
    if(!tags.length)tags.push('Core');
    return tags.slice(0,3);
  }
  function valuationSignal(s){
    const status=String(s.bookValueStatus||'').toUpperCase();
    if(!status)return 'N/A';
    if(status.includes('DEEP'))return 'Deep Value';
    if(status.includes('SIGNIFICANT DISCOUNT')||status.includes('BELOW BOOK')||status.includes('DISCOUNT'))return 'Undervalued';
    if(status.includes('NEAR BOOK')||status.includes('AT BOOK')||status.includes('FAIR'))return 'Fair Value';
    if(status.includes('HIGH PREMIUM')||status.includes('EXTREME PREMIUM'))return 'Expensive';
    if(status.includes('PREMIUM'))return 'Premium';
    return s.bookValueStatus.replace(/\b\w/g,c=>c.toUpperCase()).replace(/\B\w/g,c=>c.toLowerCase());
  }
  const styleHtml=s=>`<div class="investor-badges"><span class="sector-badge">${s.sector||'Other'}</span>${styleTags(s).map(x=>`<span class="style-badge ${x.toLowerCase()}">${x}</span>`).join('')}</div>`;
  function decorateCards(){
    document.querySelectorAll('.stock-card').forEach(card=>{
      const ticker=card.querySelector('h3')?.textContent?.trim(); const s=byTicker.get(ticker); if(!s)return;
      const company=card.querySelector('.company');
      if(company&&!card.querySelector('.investor-badges'))company.insertAdjacentHTML('afterend',styleHtml(s));
    });
  }
  function fixTtmCurrency(){
    document.querySelectorAll('#stockTableBody tr').forEach(tr=>{
      const ticker=tr.querySelector('.ticker')?.textContent?.trim(); const s=byTicker.get(ticker); if(!s)return;
      const cells=tr.querySelectorAll('td'); if(cells[9])cells[9].textContent=dpsMoney(s);
    });
  }
  function renderFreshCapital(){
    const el=document.getElementById('rankingList'); if(!el)return;
    const rows=[...tracked()].sort((a,b)=>(a.rank??999)-(b.rank??999));
    if(!rows.length){el.innerHTML='<p class="neutral">Add tickers to build your Fresh Capital ranking.</p>';return;}
    el.innerHTML=rows.map((s,i)=>{
      const discount=s.bookDiscountPct==null?'Book N/A':s.bookDiscountPct>=0?`${fmt(s.bookDiscountPct,0)}% below book`:`${fmt(Math.abs(s.bookDiscountPct),0)}% above book`;
      const zone=s.zoneStatus==='in'?'IN ZONE':s.zoneStatus==='below'?'BELOW ZONE':'ABOVE ZONE';
      return `<article class="fresh-card"><div class="fresh-rank">#${i+1}</div><div class="fresh-main"><div class="fresh-title"><div><strong>${s.ticker}</strong><span>${s.company||''}</span></div><span class="rating ${s.ratingClass||'hold'}">${s.rating||'N/A'}</span></div>${styleHtml(s)}<div class="fresh-metrics"><span><small>Price</small><strong>J$${fmt(s.price,2)}</strong></span><span><small>Yield</small><strong>${fmt(s.trailingYield,2)}%</strong></span><span><small>P/B</small><strong>${s.pb==null?'N/A':fmt(s.pb,2)+'×'}</strong></span><span><small>Book</small><strong>${discount}</strong></span></div><div class="fresh-footer"><p>${s.reason||''}</p><span class="zone-status ${s.zoneStatus||'above'}">${zone}</span></div><div class="fresh-secondary">Valuation signal: <strong>${valuationSignal(s)}</strong> <span>• sector-aware</span></div></div></article>`;
    }).join('');
  }
  let scheduled=false;
  function apply(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorateCards();fixTtmCurrency();renderFreshCapital();});}
  window.addEventListener('load',apply);
  window.addEventListener('storage',apply);
  document.addEventListener('click',()=>setTimeout(apply,30));
  const target=document.querySelector('main')||document.body;
  new MutationObserver(muts=>{if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('fresh-card'))))apply();}).observe(target,{childList:true,subtree:true});
})();
