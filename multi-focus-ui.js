(() => {
  const selected=()=>String(document.getElementById('tickerFocusFilter')?.dataset.focusTickers||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
  const wanted=t=>{const s=selected();return !s.length||s.includes(String(t||'').trim().toUpperCase());};
  const norm=t=>String(t||'').trim().toUpperCase();
  const known=new Set((window.JSE_DASHBOARD_DATA?.stocks||[]).map(s=>norm(s.ticker)));
  function tickerFrom(el,selectors=[]){
    const direct=norm(el?.dataset?.ticker||el?.dataset?.stockTicker||el?.getAttribute?.('data-symbol'));
    if(direct&&known.has(direct))return direct;
    for(const q of selectors){const n=el.querySelector?.(q),txt=norm(n?.textContent);if(!txt)continue;for(const token of txt.split(/[^A-Z0-9.-]+/)){if(known.has(token))return token}}
    const text=norm(el?.textContent);for(const token of text.split(/[^A-Z0-9.-]+/)){if(known.has(token))return token}
    return '';
  }
  function filter(selector,selectors){document.querySelectorAll(selector).forEach(el=>{const t=tickerFrom(el,selectors);if(t)el.classList.toggle('ticker-focus-hidden',!wanted(t));});}
  function clearFreshHidden(){document.querySelectorAll('#rankingList .ticker-focus-hidden').forEach(el=>el.classList.remove('ticker-focus-hidden'));}
  function apply(){
    const picks=selected();document.body.classList.toggle('compare-focus-mode',picks.length>1);
    filter('#stockTableBody tr',['.ticker','td:first-child strong','td:first-child']);
    filter('#cardView .stock-card',['h3','.ticker']);
    filter('#bookValueBody tr',['td:first-child strong','td:first-child']);
    filter('#bookValueCards > *',['strong','h3']);
    filter('#movementList .movement-item,#movementList > *',['.movement-head strong','strong','h3']);
    clearFreshHidden();
    filter('#rankingList .fresh-card',['.fresh-title strong','strong','h3']);
    filter('#incomeComparisonList .income-row,#incomeComparisonList .income-comparison-card,#incomeComparisonList > *',['.income-stock strong','.income-card-title strong','strong']);
    filter('#allocationLegend > *',['strong']);
    filter('#allocationBar > *',['strong']);
    filter('.market-watch-card,.market-watch-item,[data-market-watch-ticker]',['.market-watch-title strong','.ticker','strong','h3']);
    filter('.performance-card,[data-performance-ticker]',['.ticker','strong','h3']);
    filter('.analysis-framework-card,.scorecard-stock,[data-framework-ticker]',['.ticker','strong','h3']);
  }
  let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});}
  window.addEventListener('jse-focus-change',schedule);
  window.addEventListener('jse:ticker-focus',schedule);
  document.addEventListener('change',e=>{if(e.target?.id==='tickerFocusFilter')schedule();});
  new MutationObserver(schedule).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,50));else setTimeout(apply,50);
})();