(() => {
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const DATA=window.JSE_DASHBOARD_DATA;
  if(!DATA?.stocks)return;

  const trackedTickers=()=>{let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}return new Set((Array.isArray(saved)?saved:[]).map(x=>String(x).toUpperCase()));};
  const trackedStocks=()=>{const set=trackedTickers();return DATA.stocks.filter(s=>set.has(String(s.ticker).toUpperCase()));};

  function ensureStyles(){
    if(document.getElementById('focusTypeaheadStyles'))return;
    const style=document.createElement('style');
    style.id='focusTypeaheadStyles';
    style.textContent=`
      .ticker-focus-control select#tickerFocusFilter{display:none!important}
      .focus-typeahead{position:relative;display:flex;align-items:center;gap:6px;min-width:220px}
      .focus-typeahead-input{width:220px;max-width:34vw;border:1px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text);padding:8px 34px 8px 10px;font:inherit;font-weight:700;outline:none}
      .focus-typeahead-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}
      .focus-clear{position:absolute;right:7px;border:0;background:transparent;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:4px 6px}
      .focus-clear:hover{color:var(--text)}
      .focus-typeahead-menu{position:absolute;z-index:5000;top:calc(100% + 6px);left:0;right:0;max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);box-shadow:0 12px 30px rgba(0,0,0,.32);padding:5px}
      .focus-typeahead-menu[hidden]{display:none}
      .focus-option{width:100%;display:flex;gap:8px;align-items:center;border:0;background:transparent;color:var(--text);padding:8px 9px;border-radius:8px;text-align:left;cursor:pointer;font:inherit}
      .focus-option:hover,.focus-option.active{background:var(--surface2)}
      .focus-option strong{min-width:58px}.focus-option span{color:var(--muted);font-size:.68rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .focus-all span{color:var(--muted)}
      @media(max-width:720px){.focus-typeahead{flex:1;min-width:0}.focus-typeahead-input{width:100%;max-width:none}.ticker-focus-control{align-items:center}.ticker-focus-control>strong{flex:0 0 auto}}
    `;
    document.head.appendChild(style);
  }

  function init(){
    ensureStyles();
    const select=document.getElementById('tickerFocusFilter');
    const control=select?.closest('.ticker-focus-control');
    if(!select||!control||control.querySelector('.focus-typeahead'))return;

    const wrap=document.createElement('div');
    wrap.className='focus-typeahead';
    wrap.innerHTML='<input class="focus-typeahead-input" type="text" autocomplete="off" spellcheck="false" aria-label="Focus ticker or company" placeholder="All tracked / type ticker…"><button type="button" class="focus-clear" aria-label="Clear focus" title="Show all tracked">×</button><div class="focus-typeahead-menu" role="listbox" hidden></div>';
    select.insertAdjacentElement('afterend',wrap);
    const input=wrap.querySelector('.focus-typeahead-input');
    const clear=wrap.querySelector('.focus-clear');
    const menu=wrap.querySelector('.focus-typeahead-menu');

    const selectedStock=()=>DATA.stocks.find(s=>String(s.ticker).toUpperCase()===String(select.value||'').toUpperCase());
    const syncInput=()=>{const s=selectedStock();input.value=select.value&&select.value!=='all'&&s?`${s.ticker} — ${s.company||''}`:'';input.placeholder='All tracked / type ticker…';clear.style.visibility=select.value&&select.value!=='all'?'visible':'hidden';};
    const choose=value=>{select.value=value||'all';select.dispatchEvent(new Event('change',{bubbles:true}));menu.hidden=true;syncInput();};

    const renderMenu=()=>{
      const q=input.value.trim().toLowerCase();
      const rows=trackedStocks().filter(s=>!q||String(s.ticker).toLowerCase().includes(q)||String(s.company||'').toLowerCase().includes(q)).sort((a,b)=>String(a.ticker).localeCompare(String(b.ticker)));
      const allRow='<button type="button" class="focus-option focus-all" data-focus-value="all"><strong>ALL</strong><span>All tracked stocks</span></button>';
      const matches=rows.slice(0,12).map(s=>`<button type="button" class="focus-option" data-focus-value="${String(s.ticker).toUpperCase()}"><strong>${s.ticker}</strong><span>${s.company||''}</span></button>`).join('');
      menu.innerHTML=allRow+(matches||'<div class="focus-option"><span>No tracked ticker matches</span></div>');
      menu.hidden=false;
    };

    input.addEventListener('focus',()=>{input.select();renderMenu();});
    input.addEventListener('input',renderMenu);
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){menu.hidden=true;syncInput();input.blur();return;}
      if(e.key==='Enter'){
        const q=input.value.trim().toUpperCase();
        const exact=trackedStocks().find(s=>String(s.ticker).toUpperCase()===q||`${s.ticker} — ${s.company||''}`.toUpperCase()===q);
        if(exact){e.preventDefault();choose(String(exact.ticker).toUpperCase());return;}
        const first=menu.querySelector('.focus-option[data-focus-value]:not(.focus-all)');
        if(first){e.preventDefault();choose(first.dataset.focusValue);}
      }
    });
    menu.addEventListener('mousedown',e=>{const btn=e.target.closest('[data-focus-value]');if(!btn)return;e.preventDefault();choose(btn.dataset.focusValue);});
    clear.addEventListener('click',()=>choose('all'));
    select.addEventListener('change',syncInput);
    document.addEventListener('click',e=>{if(!wrap.contains(e.target)){menu.hidden=true;syncInput();}});
    window.addEventListener('storage',()=>{if(select.value!=='all'&&!trackedTickers().has(String(select.value).toUpperCase()))choose('all');});
    syncInput();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
