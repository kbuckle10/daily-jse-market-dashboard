(()=>{
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const fmt=(v,d=1)=>num(v)==null?'N/A':Number(v).toFixed(d);
  const date=v=>{if(!v)return null;const s=String(v).trim(),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/),d=m?new Date(+m[1],+m[2]-1,+m[3]):new Date(s);return Number.isNaN(d.valueOf())?null:d;};
  const dateFmt=v=>{const d=date(v);return d?d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'N/A';};
  const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
  const daysUntil=v=>{const d=date(v);if(!d)return null;d.setHours(0,0,0,0);return Math.ceil((d-today())/86400000);};
  const eventValue=e=>Math.max(...['exDate','recordDate','payDate'].map(k=>date(e?.[k])?.valueOf()||0));
  const dividendEvent=s=>{const base={exDate:s.exDate,recordDate:s.recordDate,payDate:s.payDate};const sa=s.saLatestDividend;const cross=s.primaryListing?.market&&String(s.primaryListing.market).toUpperCase()!=='JMSE';return !cross&&sa&&eventValue(sa)>eventValue(base)?sa:base;};
  const ratingText=s=>String(s.rating||'').trim();
  const tracked=()=>{let a=[];try{a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}const set=new Set((Array.isArray(a)?a:[]).map(x=>String(x).toUpperCase()));return D.stocks.filter(s=>set.has(String(s.ticker).toUpperCase()));};
  const moves=s=>[
    ['Day',num(s.dayPct),5],['1M',num(s.m1),5],['YTD',num(s.ytd),10],['3M',num(s.m3),10],['6M',num(s.m6),10],['1Y',num(s.y1),20]
  ].filter(([,v,t])=>v!=null&&Math.abs(v)>=t).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  const primaryMove=s=>moves(s)[0]||null;
  const impact=s=>primaryMove(s)?.[1]??0;
  const upcomingDividend=s=>{const e=dividendEvent(s),ex=daysUntil(e.exDate),pay=daysUntil(e.payDate);if(ex!=null&&ex>=0&&ex<=45)return{type:'Ex-dividend',date:e.exDate,days:ex};if(pay!=null&&pay>=0&&pay<=45)return{type:'Payment',date:e.payDate,days:pay};return null;};
  function signal(s){
    const mv=impact(s),div=upcomingDividend(s),y=num(s.currentDividendYield)??num(s.trailingYield),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),pe=num(s.pe),payout=num(s.payoutRatio),fcf=num(s.fcfPayoutRatio),r=ratingText(s).toLowerCase();
    const buyClass=r.includes('strong buy')||r.includes('buy');
    if(div&&y!=null&&y>=3)return{key:'income',label:'Income Catalyst'};
    if(s.zoneStatus==='above'||mv<=-10||(payout!=null&&payout>100)||(fcf!=null&&fcf>100))return{key:'caution',label:'Caution'};
    if((s.zoneStatus==='in'||s.zoneStatus==='below')&&buyClass&&(pb==null||pb<=1.5)&&(pe==null||pe<=15))return{key:'opportunity',label:'Opportunity'};
    return{key:'momentum',label:'Momentum'};
  }
  function context(s){const out=[];const y=num(s.currentDividendYield)??num(s.trailingYield),pe=num(s.pe),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),roe=num(s.roe);if(y!=null)out.push(`${fmt(y,2)}% yield`);if(pe!=null&&pe>0)out.push(`P/E ${fmt(pe,1)}×`);if(pb!=null&&pb>0)out.push(`P/B ${fmt(pb,2)}×`);if(roe!=null)out.push(`ROE ${fmt(roe,1)}%`);return out.slice(0,3);}
  function implication(s){
    const mv=impact(s),div=upcomingDividend(s),y=num(s.currentDividendYield)??num(s.trailingYield),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),pe=num(s.pe),bits=[];
    if(s.zoneStatus==='below')bits.push('Price is below the target buy zone');
    else if(s.zoneStatus==='in')bits.push('Price remains inside the target buy zone');
    else if(s.zoneStatus==='above')bits.push('Price is above the target buy zone');
    if(pb!=null&&pb<1)bits.push('below-book valuation remains supportive');
    else if(pe!=null&&pe>0&&pe<=10)bits.push('earnings valuation remains relatively low');
    if(mv<0&&y!=null&&y>=3)bits.push('the price decline has improved the income entry yield');
    else if(mv>0&&s.zoneStatus==='above')bits.push('recent strength has reduced entry-price appeal');
    if(div)bits.push(`${div.type} ${dateFmt(div.date)} is an upcoming catalyst`);
    return bits.slice(0,2).join('; ')||'The move is significant enough to warrant a fresh review of valuation, trend and dividend context.';
  }
  function styles(){if(document.getElementById('marketWatchInsightStyles'))return;const st=document.createElement('style');st.id='marketWatchInsightStyles';st.textContent=`
    #marketWatchSection .market-watch-subtitle{margin:5px 0 0;color:var(--muted);font-size:.62rem;line-height:1.4}
    #movementList.market-watch-enriched{display:grid;gap:9px}
    .market-watch-card{padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)}
    .market-watch-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.market-watch-title{min-width:0}.market-watch-title strong{font-size:.82rem}.market-watch-title small{display:block;color:var(--muted);font-size:.58rem;margin-top:2px}
    .market-watch-signal{flex:0 0 auto;border-radius:999px;padding:4px 8px;font-size:.55rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase;border:1px solid transparent}
    .market-watch-signal.opportunity{color:#86efac;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.25)}.market-watch-signal.income{color:#6ee7b7;background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.25)}.market-watch-signal.caution{color:#fcd34d;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.25)}.market-watch-signal.momentum{color:#93c5fd;background:rgba(59,130,246,.11);border-color:rgba(59,130,246,.24)}
    .market-watch-move{display:flex;align-items:baseline;gap:7px;margin-top:9px}.market-watch-move strong{font-size:.98rem}.market-watch-move span{font-size:.62rem;color:var(--muted)}
    .market-watch-context{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.market-watch-chip{font-size:.55rem;color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:3px 6px;background:var(--surface)}
    .market-watch-why{margin:8px 0 0;color:var(--text);font-size:.64rem;line-height:1.45}.market-watch-dividend{margin-top:7px;color:#86efac;font-size:.57rem;font-weight:750}
    @media(max-width:520px){.market-watch-card{padding:10px}.market-watch-head{gap:7px}.market-watch-signal{font-size:.51rem;padding:4px 6px}}
  `;document.head.appendChild(st);}
  function render(){
    const section=document.getElementById('marketWatchSection'),list=document.getElementById('movementList');if(!section||!list)return;
    const h=section.querySelector('h2');if(h)h.textContent='Market Watch Signals';
    let sub=section.querySelector('.market-watch-subtitle');if(!sub){sub=document.createElement('p');sub.className='market-watch-subtitle';h?.insertAdjacentElement('afterend',sub);}if(sub)sub.textContent='Tracked stocks only • significant movement enriched with valuation, entry-zone and dividend context.';
    const rows=tracked().filter(s=>moves(s).length).sort((a,b)=>Math.abs(impact(b))-Math.abs(impact(a)));
    list.classList.add('market-watch-enriched');
    if(!rows.length){list.innerHTML='<div class="neutral">No tracked stock currently meets the significant-movement thresholds.</div>';return;}
    list.innerHTML=rows.map(s=>{const mv=primaryMove(s),sig=signal(s),ctx=context(s),div=upcomingDividend(s),v=mv[1],tone=v>0?'positive':v<0?'negative':'neutral';return `<article class="market-watch-card"><div class="market-watch-head"><div class="market-watch-title"><strong>${s.ticker}</strong><small>${s.company||''}</small></div><span class="market-watch-signal ${sig.key}">${sig.label}</span></div><div class="market-watch-move"><strong class="${tone}">${v>0?'+':''}${fmt(v,1)}%</strong><span>${mv[0]} move</span></div><div class="market-watch-context">${ctx.map(x=>`<span class="market-watch-chip">${x}</span>`).join('')}</div><p class="market-watch-why">${implication(s)}</p>${div?`<div class="market-watch-dividend">${div.type}: ${dateFmt(div.date)}</div>`:''}</article>`;}).join('');
  }
  styles();render();
  let timer;const refresh=()=>{clearTimeout(timer);timer=setTimeout(render,80);};
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-ticker],#resetTrackedBtn,.filter-tile,#showAllTickersBtn'))refresh();});
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)refresh();});
  const target=document.getElementById('marketWatchSection');if(target)new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('market-watch-card'))))refresh();}).observe(target,{childList:true,subtree:true});
})();