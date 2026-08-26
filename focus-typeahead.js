(() => {
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const DATA=window.JSE_DASHBOARD_DATA;
  if(!DATA?.stocks)return;
  const MAX_FOCUS=4;
  let selected=[];

  const trackedTickers=()=>{let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}return new Set((Array.isArray(saved)?saved:[]).map(x=>String(x).toUpperCase()));};
  const trackedStocks=()=>{const set=trackedTickers();return DATA.stocks.filter(s=>set.has(String(s.ticker).toUpperCase()));};

  function ensureStyles(){
    if(document.getElementById('focusTypeaheadStyles'))return;
    const style=document.createElement('style');style.id='focusTypeaheadStyles';style.textContent=`
      .ticker-focus-control select#tickerFocusFilter{display:none!important}.focus-typeahead{position:relative;display:flex;align-items:center;gap:6px;min-width:260px}.focus-shell{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-height:36px;min-width:260px;max-width:46vw;border:1px solid var(--border);border-radius:10px;background:var(--surface2);padding:4px 34px 4px 6px;position:relative}.focus-shell:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}.focus-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);padding:4px 6px;font-size:.66rem;font-weight:800;white-space:nowrap}.focus-chip button{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:0;font-size:13px;line-height:1}.focus-typeahead-input{flex:1;min-width:105px;border:0;background:transparent;color:var(--text);padding:4px;font:inherit;font-weight:700;outline:none}.focus-clear{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--muted);font-size:16px;cursor:pointer;padding:4px}.focus-typeahead-menu{position:absolute;z-index:5000;top:calc(100% + 6px);left:0;right:0;max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);box-shadow:0 12px 30px rgba(0,0,0,.32);padding:5px}.focus-typeahead-menu[hidden]{display:none}.focus-option{width:100%;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:var(--text);padding:8px 9px;border-radius:8px;text-align:left;cursor:pointer;font:inherit}.focus-option:hover{background:var(--surface2)}.focus-option strong{min-width:58px}.focus-option span{color:var(--muted);font-size:.68rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.focus-count{color:var(--muted);font-size:.58rem;font-weight:700;white-space:nowrap}@media(max-width:720px){.focus-typeahead{width:100%;min-width:0}.focus-shell{width:100%;max-width:none;min-width:0}.ticker-focus-control{width:100%;align-items:flex-start;flex-wrap:wrap}.ticker-focus-control>strong{flex:0 0 auto;margin-top:9px}.focus-chip{font-size:.62rem}}
    `;document.head.appendChild(style);
  }

  function sortSuggestedAllocation(){
    const bar=document.getElementById('allocationBar');
    const legend=document.getElementById('allocationLegend');
    if(!bar||!legend)return;

    const pctFromBar=el=>{const m=String(el.getAttribute('title')||'').match(/:\s*([0-9]+(?:\.[0-9]+)?)%/);return m?Number(m[1]):-Infinity;};
    const pctFromLegend=el=>{const m=String(el.textContent||'').match(/([0-9]+(?:\.[0-9]+)?)%/);return m?Number(m[1]):-Infinity;};
    const reorder=(parent,score)=>{
      const current=[...parent.children];
      if(current.length<2)return;
      const sorted=[...current].sort((a,b)=>score(b)-score(a));
      if(sorted.every((el,i)=>el===current[i]))return;
      const frag=document.createDocumentFragment();sorted.forEach(el=>frag.appendChild(el));parent.appendChild(frag);
    };
    reorder(bar,pctFromBar);
    reorder(legend,pctFromLegend);
  }

  function watchAllocation(){
    const panel=document.querySelector('.allocation-panel');
    if(!panel||panel.dataset.allocationSortBound)return;
    panel.dataset.allocationSortBound='true';
    let scheduled=false;
    const queue=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sortSuggestedAllocation();});};
    new MutationObserver(queue).observe(panel,{childList:true,subtree:true,characterData:true});
    window.addEventListener('jse-focus-change',queue);
    window.addEventListener('jse:ticker-focus',queue);
    window.addEventListener('storage',queue);
    queue();
  }

  function init(){
    ensureStyles();const select=document.getElementById('tickerFocusFilter'),control=select?.closest('.ticker-focus-control');if(!select||!control||control.querySelector('.focus-typeahead')){watchAllocation();return;}
    const initial=select.value&&select.value!=='all'?String(select.value).toUpperCase():null;if(initial)selected=[initial];
    const wrap=document.createElement('div');wrap.className='focus-typeahead';wrap.innerHTML='<div class="focus-shell"><div class="focus-chips"></div><input class="focus-typeahead-input" type="text" autocomplete="off" spellcheck="false" aria-label="Add ticker to focus comparison" placeholder="All tracked / type ticker…"><button type="button" class="focus-clear" aria-label="Clear focus" title="Show all tracked">×</button></div><div class="focus-typeahead-menu" role="listbox" hidden></div><span class="focus-count"></span>';
    select.insertAdjacentElement('afterend',wrap);const input=wrap.querySelector('.focus-typeahead-input'),chips=wrap.querySelector('.focus-chips'),clear=wrap.querySelector('.focus-clear'),menu=wrap.querySelector('.focus-typeahead-menu'),count=wrap.querySelector('.focus-count');

    const apply=()=>{const valid=new Set(trackedStocks().map(s=>String(s.ticker).toUpperCase()));selected=selected.filter(x=>valid.has(x)).slice(0,MAX_FOCUS);select.value=selected.length===1?selected[0]:'all';select.dataset.focusTickers=selected.join(',');select.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{focusTickers:[...selected]}}));window.dispatchEvent(new CustomEvent('jse-focus-change',{detail:{focusTickers:[...selected]}}));renderChips();setTimeout(sortSuggestedAllocation,0);};
    const renderChips=()=>{chips.innerHTML=selected.map(t=>`<span class="focus-chip">${t}<button type="button" data-remove-focus="${t}" aria-label="Remove ${t}">×</button></span>`).join('');input.placeholder=selected.length?selected.length<MAX_FOCUS?'Add ticker…':'4 selected':'All tracked / type ticker…';input.disabled=selected.length>=MAX_FOCUS;clear.style.visibility=selected.length?'visible':'hidden';count.textContent=selected.length>1?`Compare ${selected.length}/${MAX_FOCUS}`:selected.length===1?'Focus 1/4':'';};
    const add=t=>{t=String(t).toUpperCase();if(!selected.includes(t)&&selected.length<MAX_FOCUS)selected.push(t);input.value='';menu.hidden=true;apply();};
    const remove=t=>{selected=selected.filter(x=>x!==t);apply();};
    const renderMenu=()=>{const q=input.value.trim().toLowerCase(),rows=trackedStocks().filter(s=>!selected.includes(String(s.ticker).toUpperCase())).filter(s=>!q||String(s.ticker).toLowerCase().includes(q)||String(s.company||'').toLowerCase().includes(q)).sort((a,b)=>String(a.ticker).localeCompare(String(b.ticker)));menu.innerHTML=rows.slice(0,12).map(s=>`<button type="button" class="focus-option" data-focus-value="${String(s.ticker).toUpperCase()}"><strong>${s.ticker}</strong><span>${s.company||''}</span></button>`).join('')||'<div class="focus-option"><span>No additional tracked ticker matches</span></div>';menu.hidden=false;};

    input.addEventListener('focus',renderMenu);input.addEventListener('input',renderMenu);input.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;input.value='';input.blur();return}if(e.key==='Enter'){const q=input.value.trim().toUpperCase(),exact=trackedStocks().find(s=>String(s.ticker).toUpperCase()===q&&!selected.includes(q)),first=menu.querySelector('[data-focus-value]');if(exact||first){e.preventDefault();add(exact?exact.ticker:first.dataset.focusValue)}}});menu.addEventListener('mousedown',e=>{const b=e.target.closest('[data-focus-value]');if(b){e.preventDefault();add(b.dataset.focusValue)}});chips.addEventListener('click',e=>{const b=e.target.closest('[data-remove-focus]');if(b)remove(b.dataset.removeFocus)});clear.addEventListener('click',()=>{selected=[];input.value='';apply()});document.addEventListener('click',e=>{if(!wrap.contains(e.target))menu.hidden=true});window.addEventListener('storage',apply);
    renderChips();apply();watchAllocation();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();