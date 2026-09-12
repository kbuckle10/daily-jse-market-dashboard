(() => {
  const D=window.JSE_DASHBOARD_DATA;
  const MODEKEY='dailyJseFreshCapitalObjectiveV1';
  const byTicker=new Map((D?.stocks||[]).map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const frequency=s=>String(s?.dividendFrequency||'').trim();
  const mode=()=>localStorage.getItem(MODEKEY)||window.JSE_FRESH_CAPITAL_V2?.getMode?.()||'balanced';

  function applyStyles() {
    if (document.getElementById('freshCapitalIncomeLayoutStyles')) return;
    const st = document.createElement('style');
    st.id = 'freshCapitalIncomeLayoutStyles';
    st.textContent = `
      #freshCapitalSection .income-payout-strip{
        display:grid !important;
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        grid-auto-rows:1fr !important;
        gap:8px !important;
        width:100% !important;
        margin:8px 0 4px !important;
        align-items:stretch !important;
      }
      #freshCapitalSection .income-payout-chip{
        box-sizing:border-box !important;
        width:100% !important;
        min-width:0 !important;
        height:100% !important;
        min-height:78px !important;
        padding:10px 12px !important;
        margin:0 !important;
        display:grid !important;
        grid-template-rows:minmax(2.7em,auto) auto !important;
        align-content:center !important;
        gap:5px !important;
        border-radius:12px !important;
      }
      #freshCapitalSection .income-payout-chip small{
        display:flex !important;
        align-items:flex-start !important;
        min-width:0 !important;
        min-height:2.7em !important;
        margin:0 !important;
        line-height:1.35 !important;
        white-space:normal !important;
        overflow:visible !important;
        text-overflow:clip !important;
      }
      #freshCapitalSection .income-payout-chip strong{
        display:block !important;
        align-self:end !important;
        margin:0 !important;
        line-height:1.2 !important;
      }
      .dividend-frequency-badge{
        display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;
        margin:6px 0 2px;padding:5px 8px;border:1px solid var(--border);border-radius:999px;
        background:var(--surface2);color:var(--muted);font-size:.58rem;font-weight:700;
      }
      .dividend-frequency-badge strong{color:var(--text);font-size:.62rem}
      #incomeComparisonList .dividend-frequency-badge{margin:4px 0 8px}
      @media(max-width:520px){
        #freshCapitalSection .income-payout-strip{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          gap:8px !important;
        }
        #freshCapitalSection .income-payout-chip{
          min-height:82px !important;
          padding:9px 10px !important;
          grid-template-rows:minmax(2.8em,auto) auto !important;
        }
        #freshCapitalSection .income-payout-chip small{
          min-height:2.8em !important;
          font-size:.57rem !important;
        }
        #freshCapitalSection .income-payout-chip strong{
          font-size:.76rem !important;
        }
        .dividend-frequency-badge{font-size:.55rem;padding:5px 7px}
      }
    `;
    document.head.appendChild(st);
  }

  function decorateFreshCapital(){
    document.querySelectorAll('#rankingList .fresh-objective-card .fresh-frequency-ui').forEach(x=>x.remove());
    if(mode()!=='income')return;
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card=>{
      const t=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase();
      const s=byTicker.get(t),f=frequency(s);if(!f)return;
      const badge=document.createElement('div');badge.className='dividend-frequency-badge fresh-frequency-ui';
      badge.title=`Source: ${s.dividendFrequencySource||'dividend history'}`;
      badge.innerHTML=`<span>Payout frequency</span><strong>${f}</strong>`;
      const host=card.querySelector('.income-payout-strip')||card.querySelector('.fresh-metrics');
      host?.insertAdjacentElement('afterend',badge);
    });
  }

  function decorateIncome(){
    document.querySelectorAll('#incomeComparisonList .income-row').forEach(row=>{
      const t=row.querySelector('.income-stock strong')?.textContent?.trim().toUpperCase();
      const s=byTicker.get(t),f=frequency(s);let badge=row.querySelector('.income-frequency-ui');
      if(!f){badge?.remove();return;}
      if(!badge){badge=document.createElement('div');badge.className='dividend-frequency-badge income-frequency-ui';const host=row.querySelector('.income-formula')||row.querySelector('.income-stock');host?.insertAdjacentElement('afterend',badge);}
      badge.title=`Source: ${s.dividendFrequencySource||'dividend history'}`;
      badge.innerHTML=`<span>Payout frequency</span><strong>${f}</strong>`;
    });
  }

  let timer;
  function refresh(delay=50){clearTimeout(timer);timer=setTimeout(()=>{decorateFreshCapital();decorateIncome();},delay);}
  applyStyles();refresh(120);
  const root=document.body;
  if(root){new MutationObserver(()=>refresh(80)).observe(root,{childList:true,subtree:true});}
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective],[data-income-mode]'))refresh(120);});
  document.addEventListener('change',e=>{if(e.target?.matches?.('#watchlistStatusFilter,#sortSelect'))refresh(120);});
})();