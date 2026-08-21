(() => {
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const $=id=>document.getElementById(id);
  const money=v=>v==null||!Number.isFinite(Number(v))?'N/A':`J$${Number(v).toFixed(2)}`;
  const num=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'N/A':Number(v).toFixed(d);
  function tracked(){
    let saved=[];
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch{}
    const set=new Set((Array.isArray(saved)?saved:[]).map(x=>String(x).toUpperCase()));
    return (window.JSE_DASHBOARD_DATA?.stocks||[]).filter(s=>set.has(s.ticker));
  }
  function tone(s){
    const t=s.bookValueTone||'';
    if(/deep-discount|discount/.test(t)) return 'positive';
    if(/high-premium|premium/.test(t)) return 'negative';
    return 'neutral';
  }
  function render(){
    const body=$('bookValueBody');
    const note=$('bookValueNote');
    if(!body||!note) return;
    const rows=tracked().sort((a,b)=>{
      const av=a.bookDiscountPct==null?-999:a.bookDiscountPct;
      const bv=b.bookDiscountPct==null?-999:b.bookDiscountPct;
      return bv-av;
    });
    body.innerHTML=rows.length?rows.map(s=>`<tr>
      <td><strong>${s.ticker}</strong><br><small>${s.company||''}</small></td>
      <td>${money(s.price)}</td>
      <td>${money(s.bookValuePerShare)}</td>
      <td>${s.pb==null?'N/A':num(s.pb,2)+'×'}</td>
      <td class="${tone(s)}">${s.bookDiscountPct==null?'N/A':s.bookDiscountPct>0?`${num(s.bookDiscountPct,1)}% below`:s.bookDiscountPct<0?`${num(Math.abs(s.bookDiscountPct),1)}% above`:'At book'}</td>
      <td><strong class="${tone(s)}">${s.bookValueStatus||'N/A'}</strong><br><small>${s.bookValueSectorClass==='book-sensitive'?'High sector relevance':s.bookValueSectorClass==='asset-heavy'?'Moderate sector relevance':'Low sector weighting'}</small></td>
      <td>${s.bookAdjustedScore==null?'N/A':num(s.bookAdjustedScore,0)}<br><small>${s.bookValueScoreAdjustment>0?'+':''}${s.bookValueScoreAdjustment||0} book adj.</small></td>
      <td><strong>${s.bookAdjustedRating||s.rating||'N/A'}</strong></td>
    </tr>`).join(''):'<tr><td colspan="8" class="neutral">Add tickers to see the book-value valuation comparison.</td></tr>';
    note.textContent='P/B is weighted most heavily for banks, insurers, investment/real-estate companies; moderately for asset-heavy businesses; lightly for capital-light companies.';
  }
  const obs=new MutationObserver(()=>render());
  window.addEventListener('load',()=>{
    render();
    const target=$('subtitleTickers');
    if(target) obs.observe(target,{childList:true,subtree:true,characterData:true});
    window.addEventListener('storage',render);
    document.body.addEventListener('click',e=>{if(e.target.closest('[data-ticker],#resetTrackedBtn')) setTimeout(render,0);});
  });
})();
