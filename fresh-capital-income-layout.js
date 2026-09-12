(() => {
  const D=window.JSE_DASHBOARD_DATA;
  const MODEKEY='dailyJseFreshCapitalObjectiveV1';
  const byTicker=new Map((D?.stocks||[]).map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const frequency=s=>String(s?.dividendFrequency||'').trim();
  const mode=()=>localStorage.getItem(MODEKEY)||window.JSE_FRESH_CAPITAL_V2?.getMode?.()||'balanced';

  function applyStyles(){
    if(document.getElementById('freshCapitalIncomeLayoutStyles'))return;
    const st=document.createElement('style');
    st.id='freshCapitalIncomeLayoutStyles';
    st.textContent=`
      #freshCapitalSection .income-payout-strip{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:1fr!important;gap:8px!important;width:100%!important;margin:8px 0 4px!important;align-items:stretch!important}
      #freshCapitalSection .income-payout-chip{box-sizing:border-box!important;width:100%!important;min-width:0!important;height:100%!important;min-height:78px!important;padding:10px 12px!important;margin:0!important;display:grid!important;grid-template-rows:minmax(2.7em,auto) auto!important;align-content:center!important;gap:5px!important;border-radius:12px!important}
      #freshCapitalSection .income-payout-chip small{display:flex!important;align-items:flex-start!important;min-width:0!important;min-height:2.7em!important;margin:0!important;line-height:1.35!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
      #freshCapitalSection .income-payout-chip strong{display:block!important;align-self:end!important;margin:0!important;line-height:1.2!important}
      .dividend-frequency-badge{display:inline-flex!important;align-items:center!important;gap:6px!important;width:max-content!important;max-width:100%!important;margin:6px 0 2px!important;padding:5px 8px!important;border:1px solid var(--border)!important;border-radius:999px!important;background:var(--surface2)!important;color:var(--muted)!important;font-size:.58rem!important;font-weight:700!important;visibility:visible!important;opacity:1!important}
      .dividend-frequency-badge strong{color:var(--text)!important;font-size:.62rem!important}
      #incomeComparisonList .dividend-frequency-badge{margin:4px 0 8px!important}
      @media(max-width:520px){#freshCapitalSection .income-payout-strip{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}#freshCapitalSection .income-payout-chip{min-height:82px!important;padding:9px 10px!important;grid-template-rows:minmax(2.8em,auto) auto!important}#freshCapitalSection .income-payout-chip small{min-height:2.8em!important;font-size:.57rem!important}#freshCapitalSection .income-payout-chip strong{font-size:.76rem!important}.dividend-frequency-badge{font-size:.55rem!important;padding:5px 7px!important}}
    `;
    document.head.appendChild(st);
  }

  function setBadge(host,s,cls){
    if(!host)return;
    const f=frequency(s);
    let badge=host.parentElement?.querySelector(`:scope > .${cls}`);
    if(!f){badge?.remove();return;}
    const html=`<span>Payout frequency</span><strong>${f}</strong>`;
    if(!badge){
      badge=document.createElement('div');
      badge.className=`dividend-frequency-badge ${cls}`;
      host.insertAdjacentElement('afterend',badge);
    }
    if(badge.innerHTML!==html)badge.innerHTML=html;
    const title=`Source: ${s.dividendFrequencySource||'dividend history'}`;
    if(badge.title!==title)badge.title=title;
  }

  function decorateFreshCapital(){
    const incomeMode=mode()==='income';
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card=>{
      const t=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase();
      const s=byTicker.get(t);
      const existing=card.querySelector('.fresh-frequency-ui');
      if(!incomeMode||!s){existing?.remove();return;}
      const host=card.querySelector('.income-payout-strip')||card.querySelector('.fresh-metrics');
      setBadge(host,s,'fresh-frequency-ui');
    });
  }

  function decorateIncome(){
    document.querySelectorAll('#incomeComparisonList .income-row').forEach(row=>{
      const t=row.querySelector('.income-stock strong')?.textContent?.trim().toUpperCase();
      const s=byTicker.get(t);if(!s)return;
      const host=row.querySelector('.income-formula')||row.querySelector('.income-stock');
      setBadge(host,s,'income-frequency-ui');
    });
  }

  let timer;
  function refresh(delay=0){clearTimeout(timer);timer=setTimeout(()=>{decorateFreshCapital();decorateIncome();},delay);}
  applyStyles();
  refresh(0);setTimeout(()=>refresh(0),250);setTimeout(()=>refresh(0),800);setTimeout(()=>refresh(0),1600);
  const target=document.querySelector('main')||document.body;
  if(target){new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('dividend-frequency-badge'))))refresh(30);}).observe(target,{childList:true,subtree:true});}
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective],[data-income-mode],[data-ticker],#showAllTickersBtn,#resetTrackedBtn'))refresh(80);});
  document.addEventListener('change',e=>{if(e.target?.matches?.('#watchlistStatusFilter,#sortSelect'))refresh(80);});
  window.addEventListener('storage',e=>{if(e.key===MODEKEY||e.key==='dailyJseTrackedTickersV2')refresh(80);});
})();