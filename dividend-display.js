(() => {
  const DATA=window.JSE_DASHBOARD_DATA;if(!DATA?.stocks)return;
  const byTicker=new Map(DATA.stocks.map(s=>[String(s.ticker).toUpperCase(),s]));
  const prefix=c=>c==='USD'?'US$':c==='TTD'?'TT$':'J$';
  const amount=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'N/A':Number(v).toFixed(d);
  function display(s){
    const orig=s.latestDividendOriginalAmount??s.latestDividend,curr=s.latestDividendOriginalCurrency||s.latestDividendCurrency||'JMD';
    if(orig==null)return null;
    if(curr==='JMD')return {main:`J$${amount(orig,Math.abs(orig)<.01?4:2)}`,sub:''};
    const tiny=Math.abs(Number(orig))<.01,jmd=s.latestDividendJmd;
    if(tiny&&jmd!=null)return {main:`J$${amount(jmd,Math.abs(jmd)<1?4:2)}`,sub:`Declared ${prefix(curr)}${amount(orig,6)} • FX ${amount(s.latestDividendFxRate,3)} on ${s.latestDividendFxDate||'N/A'}`};
    if(jmd!=null)return {main:`${prefix(curr)}${amount(orig,2)}`,sub:`≈ J$${amount(jmd,2)} • originally ${curr}`};
    return {main:`${prefix(curr)}${amount(orig,tiny?6:2)}`,sub:`Originally declared in ${curr}`};
  }
  function apply(){
    document.querySelectorAll('.stock-card').forEach(card=>{const s=byTicker.get(card.querySelector('h3')?.textContent?.trim().toUpperCase());if(!s)return;const rows=[...card.querySelectorAll('.metric-row')];const row=rows.find(r=>/Latest dividend/i.test(r.textContent));const strong=row?.querySelector('strong');const d=display(s);if(strong&&d){strong.innerHTML=`<span class="dividend-display-main">${d.main}</span>${d.sub?`<small class="dividend-display-sub">${d.sub}</small>`:''}`;}});
    document.querySelectorAll('#stockTableBody tr').forEach(row=>{const ticker=row.querySelector('.ticker')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker),d=s&&display(s);if(!d)return;const cells=row.querySelectorAll('td');const cell=cells[11];if(cell)cell.innerHTML=`<strong>${d.main}</strong>${d.sub?`<br><small>${d.sub}</small>`:''}<br><small>${s.dividendStatus||''}</small>`;});
  }
  const style=document.createElement('style');style.textContent='.dividend-display-main{display:block}.dividend-display-sub{display:block;color:var(--muted);font-size:.58rem;line-height:1.3;margin-top:2px}';document.head.appendChild(style);
  apply();window.addEventListener('load',apply);new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
})();
