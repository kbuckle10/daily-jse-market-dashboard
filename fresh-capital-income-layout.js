(() => {
  const DATA=()=>window.JSE_DASHBOARD_DATA;
  const MODEKEY='dailyJseFreshCapitalObjectiveV1';
  const getStock=t=>{
    const key=String(t||'').trim().toUpperCase();
    return (DATA()?.stocks||[]).find(s=>String(s.ticker||'').toUpperCase()===key)||null;
  };
  const getFrequency=s=>String(s?.dividendFrequency||'').trim();
  const activeMode=()=>{
    const active=document.querySelector('[data-fresh-objective].active');
    if(active?.dataset?.freshObjective)return String(active.dataset.freshObjective).toLowerCase();
    const api=window.JSE_FRESH_CAPITAL_V2?.getMode?.();
    if(api)return String(api).toLowerCase();
    return String(localStorage.getItem(MODEKEY)||'balanced').toLowerCase();
  };

  function styles(){
    let st=document.getElementById('freshCapitalIncomeLayoutStyles');
    if(st)return;
    st=document.createElement('style');
    st.id='freshCapitalIncomeLayoutStyles';
    st.textContent=`
      #freshCapitalSection .income-payout-strip{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important;margin:8px 0 4px!important}
      #freshCapitalSection .income-payout-chip{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:78px!important;padding:10px 12px!important;margin:0!important;display:grid!important;align-content:center!important;gap:5px!important;border-radius:12px!important}
      .dividend-frequency-badge{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;width:100%!important;box-sizing:border-box!important;margin:8px 0!important;padding:9px 11px!important;border:1px solid var(--border,#334155)!important;border-radius:10px!important;background:var(--surface2,#111827)!important;color:var(--muted,#94a3b8)!important;font-size:.66rem!important;font-weight:700!important;line-height:1.2!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:1!important}
      .dividend-frequency-badge strong{display:block!important;color:var(--text,#f8fafc)!important;font-size:.72rem!important;white-space:nowrap!important}
      #incomeComparisonList .income-frequency-ui{margin:8px 0 10px!important}
      @media(max-width:520px){.dividend-frequency-badge{font-size:.61rem!important;padding:8px 9px!important}.dividend-frequency-badge strong{font-size:.67rem!important}}
    `;
    document.head.appendChild(st);
  }

  function makeBadge(s,cls){
    const f=getFrequency(s);if(!f)return null;
    const el=document.createElement('div');
    el.className=`dividend-frequency-badge ${cls}`;
    el.dataset.ticker=String(s.ticker||'').toUpperCase();
    el.title=`Source: ${s.dividendFrequencySource||'dividend history'}`;
    el.innerHTML=`<span>Payout frequency</span><strong>${f}</strong>`;
    return el;
  }

  function upsert(container,s,cls,afterEl){
    if(!container||!s)return;
    const f=getFrequency(s);
    let badge=container.querySelector(`.${cls}`);
    if(!f){badge?.remove();return;}
    if(!badge){badge=makeBadge(s,cls);if(!badge)return;(afterEl||container.firstElementChild)?.insertAdjacentElement?.('afterend',badge) || container.appendChild(badge);}
    badge.dataset.ticker=String(s.ticker||'').toUpperCase();
    badge.title=`Source: ${s.dividendFrequencySource||'dividend history'}`;
    const strong=badge.querySelector('strong');if(strong&&strong.textContent!==f)strong.textContent=f;
  }

  function renderFresh(){
    const income=activeMode()==='income';
    document.querySelectorAll('.fresh-objective-card').forEach(card=>{
      const existing=card.querySelector('.fresh-frequency-ui');
      if(!income){existing?.remove();return;}
      const ticker=card.querySelector('.fresh-title strong')?.textContent||card.querySelector('strong')?.textContent;
      const s=getStock(ticker);if(!s){existing?.remove();return;}
      const host=card.querySelector('.income-payout-strip')||card.querySelector('.fresh-metrics')||card.querySelector('.fresh-title');
      upsert(card,s,'fresh-frequency-ui',host);
    });
  }

  function renderIncome(){
    document.querySelectorAll('#incomeComparisonList .income-row,.income-comparison-list .income-row').forEach(row=>{
      const ticker=row.querySelector('.income-stock strong')?.textContent||row.querySelector('strong')?.textContent;
      const s=getStock(ticker);if(!s)return;
      const host=row.querySelector('.income-stock')||row.firstElementChild;
      upsert(row,s,'income-frequency-ui',host);
    });
  }

  let running=false;
  function render(){if(running)return;running=true;try{styles();renderFresh();renderIncome();}finally{running=false;}}

  render();
  [100,300,700,1500,3000].forEach(ms=>setTimeout(render,ms));
  const observer=new MutationObserver(()=>requestAnimationFrame(render));
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective],[data-income-mode],[data-ticker],#showAllTickersBtn,#resetTrackedBtn'))setTimeout(render,50);});
  document.addEventListener('change',()=>setTimeout(render,50));
  window.addEventListener('storage',()=>setTimeout(render,50));
  window.JSE_DIVIDEND_FREQUENCY_UI={render};
})();