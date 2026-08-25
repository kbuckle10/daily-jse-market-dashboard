(() => {
  let popover = null;
  let activeButton = null;
  let pinned = false;
  const DATA = window.JSE_DASHBOARD_DATA;
  const byTicker = new Map((DATA?.stocks || []).map(s => [String(s.ticker).toUpperCase(), s]));

  function ensureStyles() {
    if (document.getElementById('expertTooltipFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'expertTooltipFixStyles';
    style.textContent = `
      .expert-help::after{display:none!important}
      .expert-tooltip-popover{position:fixed;z-index:100000;max-width:340px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);box-shadow:0 12px 36px rgba(0,0,0,.38);font:500 .72rem/1.45 Inter,system-ui,sans-serif;text-align:left;pointer-events:none}
      .expert-help[aria-expanded="true"]{color:var(--text)!important;border-color:var(--accent)!important}
      .investor-badges .sector-badge{order:0}.investor-badges::after{content:"";flex-basis:100%;width:0;height:0;order:1}.investor-badges .style-badge{order:2}
      .mobile-watchlist-filter{display:none;gap:6px;width:100%;grid-column:1/-1}.mobile-watchlist-filter button{flex:1;min-width:0;border:1px solid var(--border);background:var(--surface2);color:var(--muted);border-radius:10px;padding:9px 7px;font-weight:800;font-size:.68rem}.mobile-watchlist-filter button.active{color:var(--accent);background:var(--blue-bg);border-color:var(--accent)}
      @media(max-width:720px){.expert-tooltip-popover{left:14px!important;right:14px!important;bottom:16px!important;top:auto!important;max-width:none}.mobile-watchlist-filter{display:flex!important}#watchlistStatusFilter{display:none!important}.ticker-search-wrap{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important}.ticker-search{grid-column:1/-1!important;grid-row:1!important}.mobile-watchlist-filter{grid-column:1/-1!important;grid-row:2!important}#showAllTickersBtn{grid-column:1/-1!important;grid-row:3!important;width:100%!important}}
    `;
    document.head.appendChild(style);
  }
  function prepareButtons(root=document){root.querySelectorAll?.('.expert-help[data-tooltip]').forEach(button=>{if(!button.hasAttribute('title'))button.setAttribute('title',button.getAttribute('data-tooltip'));if(!button.hasAttribute('aria-expanded'))button.setAttribute('aria-expanded','false');});}
  function closePopover(force=false){if(pinned&&!force)return;if(activeButton)activeButton.setAttribute('aria-expanded','false');popover?.remove();popover=null;activeButton=null;pinned=false;}
  function positionPopover(button){if(!popover||window.innerWidth<=720)return;const r=button.getBoundingClientRect(),pr=popover.getBoundingClientRect();let left=r.left+r.width/2-pr.width/2;left=Math.max(12,Math.min(left,window.innerWidth-pr.width-12));let top=r.top-pr.height-10;if(top<12)top=Math.min(window.innerHeight-pr.height-12,r.bottom+10);popover.style.left=`${left}px`;popover.style.top=`${top}px`;}
  function openPopover(button,shouldPin=false){const text=button?.getAttribute('data-tooltip');if(!text)return;if(activeButton&&activeButton!==button)closePopover(true);if(!popover){popover=document.createElement('div');popover.className='expert-tooltip-popover';popover.setAttribute('role','tooltip');document.body.appendChild(popover);}activeButton=button;pinned=shouldPin;button.setAttribute('aria-expanded','true');popover.textContent=text;positionPopover(button);}
  function onPointerOver(e){const button=e.target.closest?.('.expert-help[data-tooltip]');if(!button||pinned)return;openPopover(button,false);}
  function onPointerOut(e){const button=e.target.closest?.('.expert-help[data-tooltip]');if(!button||pinned)return;if(e.relatedTarget&&button.contains(e.relatedTarget))return;closePopover(true);}
  function onClick(e){const button=e.target.closest?.('.expert-help[data-tooltip]');if(button){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const samePinned=activeButton===button&&pinned;if(samePinned)closePopover(true);else openPopover(button,true);return;}if(popover&&!e.target.closest?.('.expert-tooltip-popover'))closePopover(true);}
  function onKey(e){if(e.key==='Escape')closePopover(true);}

  function ensureMobileWatchlistFilter(){const select=document.getElementById('watchlistStatusFilter'),wrap=document.querySelector('.ticker-search-wrap');if(!select||!wrap)return;let group=document.querySelector('.mobile-watchlist-filter');if(!group){group=document.createElement('div');group.className='mobile-watchlist-filter';group.setAttribute('role','group');group.setAttribute('aria-label','Filter watchlist stocks');group.innerHTML='<button type="button" data-mobile-watchlist="all">All</button><button type="button" data-mobile-watchlist="tracked">Tracked</button><button type="button" data-mobile-watchlist="untracked">Untracked</button>';wrap.insertBefore(group,document.getElementById('showAllTickersBtn'));}const sync=()=>group.querySelectorAll('[data-mobile-watchlist]').forEach(b=>b.classList.toggle('active',b.dataset.mobileWatchlist===select.value));sync();if(!group.dataset.bound){group.dataset.bound='true';group.addEventListener('click',e=>{const b=e.target.closest('[data-mobile-watchlist]');if(!b)return;select.value=b.dataset.mobileWatchlist;select.dispatchEvent(new Event('change',{bubbles:true}));sync();});select.addEventListener('change',sync);}}
  function ensureCashflowUi(){if(document.querySelector('script[data-cashflow-ui]'))return;const script=document.createElement('script');script.dataset.cashflowUi='true';script.src=`cashflow-ui.js?v=${Date.now()}`;document.head.appendChild(script);}

  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  function analystNarrative(s){
    const pe=num(s.pe), pb=num(s.calculatedPbFromJsePrice)??num(s.pb), epsg=num(s.epsGrowth), yieldPct=num(s.trailingYield), payout=num(s.payoutRatio), roe=num(s.roe), book=num(s.bookDiscountPct);
    const positives=[]; const cautions=[];
    if((pe!=null&&pe>0&&pe<12)||(pb!=null&&pb<1)) positives.push('attractive valuation');
    if(yieldPct!=null&&yieldPct>=4) positives.push('dividend income');
    if(roe!=null&&roe>=15) positives.push('strong profitability');
    if(epsg!=null&&epsg>=8) positives.push('earnings growth');
    if(epsg!=null&&epsg<0) cautions.push('earnings are under pressure');
    if(payout!=null&&payout>85) cautions.push('the payout ratio is high');
    if(s.zoneStatus==='above') cautions.push('the current price is above the preferred buy zone');
    if(num(s.y1)!=null&&num(s.y1)<-15) cautions.push('longer-term price momentum is weak');
    if(book!=null&&book>=15) positives.push(`${book.toFixed(0)}% discount to book value`);
    else if(book!=null&&book<=-50) cautions.push(`the shares trade ${Math.abs(book).toFixed(0)}% above book value`);
    const pos=[...new Set(positives)].slice(0,3), risk=[...new Set(cautions)].slice(0,2);
    if(pos.length&&risk.length)return `${pos.map((x,i)=>i?x:x[0].toUpperCase()+x.slice(1)).join(' + ')} support the investment case, but ${risk.join(' and ')}.`;
    if(pos.length)return `${pos.map((x,i)=>i?x:x[0].toUpperCase()+x.slice(1)).join(' + ')} support the current investment case.`;
    if(risk.length)return `Caution is warranted because ${risk.join(' and ')}.`;
    return s.reason||'The available valuation, quality, growth, income and momentum metrics present a balanced investment profile.';
  }
  function updateAnalystNarratives(){
    document.querySelectorAll('.stock-card').forEach(card=>{const t=card.querySelector('h3')?.textContent?.trim().toUpperCase(),s=byTicker.get(t);const p=card.querySelector('.rank-reason');if(s&&p)p.textContent=analystNarrative(s);});
    document.querySelectorAll('.movement-item').forEach(card=>{const t=card.querySelector('.movement-head strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(t);const p=card.querySelector('p');if(s&&p)p.textContent=analystNarrative(s);});
    document.querySelectorAll('.fresh-card').forEach(card=>{const t=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(t);const p=card.querySelector('.fresh-footer p');if(s&&p)p.textContent=analystNarrative(s);});
  }
  function refreshStatus(){
    const pill=document.getElementById('updatedPill'); if(!pill||!DATA)return;
    const raw=DATA.refreshedAt; const d=raw?new Date(raw):null;
    if(!d||Number.isNaN(d.valueOf())){pill.textContent=`Data refreshed • ${DATA.updated||'latest dataset'}`;return;}
    const mins=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
    const relative=mins<1?'just now':mins<60?`${mins} min${mins===1?'':'s'} ago`:mins<1440?`${Math.floor(mins/60)} hr${Math.floor(mins/60)===1?'':'s'} ago`:`${Math.floor(mins/1440)} day${Math.floor(mins/1440)===1?'':'s'} ago`;
    const time=new Intl.DateTimeFormat('en-JM',{timeZone:'America/Jamaica',hour:'numeric',minute:'2-digit'}).format(d);
    pill.textContent=`Data refreshed ${relative} • ${time} Jamaica`;
    pill.title=`Last completed dashboard refresh: ${new Intl.DateTimeFormat('en-JM',{timeZone:'America/Jamaica',dateStyle:'medium',timeStyle:'short'}).format(d)}`;
  }

  ensureStyles();prepareButtons();ensureMobileWatchlistFilter();ensureCashflowUi();refreshStatus();updateAnalystNarratives();
  setInterval(refreshStatus,60000);
  document.addEventListener('mouseover',onPointerOver,true);document.addEventListener('mouseout',onPointerOut,true);document.addEventListener('click',onClick,true);document.addEventListener('keydown',onKey,true);
  window.addEventListener('resize',()=>{if(activeButton)positionPopover(activeButton);ensureMobileWatchlistFilter();});window.addEventListener('scroll',()=>{if(!pinned)closePopover(true);},true);
  let queued=false;new MutationObserver(mutations=>{for(const mutation of mutations)for(const node of mutation.addedNodes)if(node.nodeType===1)prepareButtons(node);ensureMobileWatchlistFilter();if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;updateAnalystNarratives();refreshStatus();});}}).observe(document.documentElement,{childList:true,subtree:true});
})();
