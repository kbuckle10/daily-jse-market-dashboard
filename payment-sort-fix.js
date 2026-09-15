(()=>{
  const DATA=window.JSE_DASHBOARD_DATA;
  if(!DATA?.stocks)return;
  const stockMap=new Map(DATA.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const dateMs=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.valueOf())?null:d.valueOf();};
  const todayMs=()=>{const d=new Date();d.setHours(0,0,0,0);return d.valueOf();};
  const eventDate=e=>Math.max(dateMs(e?.exDate)||0,dateMs(e?.recordDate)||0,dateMs(e?.payDate)||0);
  const currentEvent=s=>{const base={exDate:s?.exDate,recordDate:s?.recordDate,payDate:s?.payDate};const sa=s?.saLatestDividend;const crossListed=s?.primaryListing?.market&&String(s.primaryListing.market).toUpperCase()!=='JMSE';return !crossListed&&sa&&eventDate(sa)>eventDate(base)?sa:base;};
  const upcomingPay=s=>{const t=dateMs(currentEvent(s)?.payDate);return t!=null&&t>=todayMs()?t:null;};
  const tickerOf=el=>{
    const direct=el?.dataset?.ticker||el?.dataset?.stockTicker||el?.dataset?.symbol;
    if(direct)return String(direct).toUpperCase();
    const node=el?.querySelector?.('.ticker,h3');
    if(node){const t=String(node.textContent||'').trim().toUpperCase();if(stockMap.has(t))return t;}
    const text=String(el?.textContent||'').toUpperCase();
    return [...stockMap.keys()].find(t=>new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|$)`).test(text))||null;
  };
  const compare=(a,b)=>{
    const at=upcomingPay(a),bt=upcomingPay(b);
    if(at!=null&&bt!=null)return at-bt||String(a.ticker).localeCompare(String(b.ticker));
    if(at!=null)return -1;
    if(bt!=null)return 1;
    return String(a.ticker).localeCompare(String(b.ticker));
  };
  function reorder(container,selector){
    if(!container)return;
    const nodes=[...container.querySelectorAll(selector)].filter(n=>tickerOf(n));
    nodes.sort((x,y)=>compare(stockMap.get(tickerOf(x)),stockMap.get(tickerOf(y))));
    nodes.forEach(n=>container.appendChild(n));
  }
  let scheduled=false;
  function apply(){
    scheduled=false;
    const sort=document.getElementById('sortSelect');
    if(!sort||sort.value!=='payment-soon')return;
    reorder(document.getElementById('stockTableBody'),'tr');
    reorder(document.getElementById('cardView'),'.stock-card');
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}
  document.addEventListener('change',e=>{if(e.target?.id==='sortSelect')schedule();});
  window.addEventListener('jse-focus-change',schedule);
  const root=document.querySelector('main')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  schedule();
})();