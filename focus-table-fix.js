(() => {
  const select=()=>document.getElementById('tickerFocusFilter');
  const selectedTickers=()=>{
    const s=select();
    if(!s)return [];
    const list=String(s.dataset.focusTickers||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
    if(list.length)return list;
    return s.value&&s.value!=='all'?[String(s.value).toUpperCase()]:[];
  };
  const mainStyleFilterActive=()=>Boolean(document.querySelector('[data-style-filter-kind="main"] .style-filter-chip.active'));

  function syncTable(){
    const wanted=new Set(selectedTickers());
    const rows=[...document.querySelectorAll('#stockTableBody tr')];
    if(!rows.length)return;
    const styleActive=mainStyleFilterActive();

    rows.forEach(row=>{
      const ticker=row.querySelector('.ticker')?.textContent?.trim().toUpperCase()||'';
      row.classList.remove('focus-table-visible');
      if(!wanted.size){
        row.classList.remove('ticker-focus-hidden');
        return;
      }
      if(ticker&&wanted.has(ticker)){
        row.classList.remove('ticker-focus-hidden');
        // When no investment-style chip is active, Focus alone is authoritative.
        // This prevents stale style/filter classes from leaving the table header with no rows.
        if(!styleActive){
          row.classList.remove('style-category-hidden');
          row.classList.add('focus-table-visible');
        } else if(!row.classList.contains('style-category-hidden')) {
          row.classList.add('focus-table-visible');
        }
      } else {
        row.classList.add('ticker-focus-hidden');
      }
    });
  }

  function ensureCss(){
    if(document.getElementById('focusTableFixStyles'))return;
    const st=document.createElement('style');
    st.id='focusTableFixStyles';
    st.textContent='#stockTableBody tr.focus-table-visible{display:table-row!important}';
    document.head.appendChild(st);
  }

  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncTable();});};
  ensureCss();
  queue();
  window.addEventListener('jse-focus-change',queue);
  window.addEventListener('jse:ticker-focus',queue);
  window.addEventListener('storage',queue);
  document.addEventListener('change',e=>{if(e.target?.id==='tickerFocusFilter')queue();});
  document.addEventListener('click',e=>{if(e.target.closest?.('.focus-chip,.focus-clear,.style-filter-chip,[data-style-mode]'))setTimeout(queue,0);});
  new MutationObserver(queue).observe(document.getElementById('stockTableBody')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();