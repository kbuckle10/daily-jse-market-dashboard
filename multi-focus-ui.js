(() => {
  const selected=()=>String(document.getElementById('tickerFocusFilter')?.dataset.focusTickers||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
  const wanted=t=>{const s=selected();return !s.length||s.includes(String(t||'').trim().toUpperCase());};
  const tickerFrom=(el,selectors)=>{for(const q of selectors){const n=el.querySelector(q);if(n?.textContent?.trim())return n.textContent.trim().split(/\s|—/)[0].toUpperCase()}return ''};
  function apply(){
    const picks=selected();
    document.body.classList.toggle('compare-focus-mode',picks.length>1);
    document.querySelectorAll('#stockTableBody tr').forEach(el=>el.classList.toggle('ticker-focus-hidden',!wanted(tickerFrom(el,['td:first-child strong','td:first-child']))));
    document.querySelectorAll('#cardView .stock-card').forEach(el=>el.classList.toggle('ticker-focus-hidden',!wanted(tickerFrom(el,['h3']))));
    document.querySelectorAll('#bookValueBody tr').forEach(el=>el.classList.toggle('ticker-focus-hidden',!wanted(tickerFrom(el,['td:first-child strong','td:first-child']))));
    document.querySelectorAll('#bookValueCards > *').forEach(el=>el.classList.toggle('ticker-focus-hidden',!wanted(tickerFrom(el,['strong','h3']))));
    document.querySelectorAll('#movementList .movement-item').forEach(el=>el.classList.toggle('ticker-focus-hidden',!wanted(tickerFrom(el,['.movement-head strong']))));
    document.querySelectorAll('#rankingList .fresh-card').forEach(el=>el.classList.toggle('ticker-focus-hidden',!wanted(tickerFrom(el,['.fresh-title strong']))));
    document.querySelectorAll('#incomeComparisonList .income-comparison-card,#incomeComparisonList > *').forEach(el=>{const t=tickerFrom(el,['.income-stock strong','.income-card-title strong','strong']);if(t)el.classList.toggle('ticker-focus-hidden',!wanted(t))});
    document.querySelectorAll('#allocationLegend > *').forEach(el=>{const t=(el.textContent||'').trim().split(/\s|—/)[0].toUpperCase();if(t)el.classList.toggle('ticker-focus-hidden',!wanted(t))});
  }
  window.addEventListener('jse-focus-change',()=>setTimeout(apply,0));
  document.addEventListener('change',e=>{if(e.target?.id==='tickerFocusFilter')setTimeout(apply,0)});
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,50));else setTimeout(apply,50);
})();