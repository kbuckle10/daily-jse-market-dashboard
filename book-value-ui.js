(() => {
  const STORAGE_KEY='dailyJseTrackedTickersV2'; const $=id=>document.getElementById(id);
  const money=v=>v==null||!Number.isFinite(Number(v))?'N/A':`J$${Number(v).toFixed(2)}`; const num=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'N/A':Number(v).toFixed(d);
  const n=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);

  function tracked(){let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch{}const set=new Set((Array.isArray(saved)?saved:[]).map(x=>String(x).toUpperCase()));return (window.JSE_DASHBOARD_DATA?.stocks||[]).filter(s=>set.has(s.ticker));}
  function comparison(s){return s.bookDiscountPct==null?'N/A':s.bookDiscountPct>0?`${num(s.bookDiscountPct,1)}% below book`:s.bookDiscountPct<0?`${num(Math.abs(s.bookDiscountPct),1)}% above book`:'At book';}

  function profile(s){
    const sector=String(s.sector||'').toLowerCase(), ticker=String(s.ticker||'').toUpperCase();
    const roe=n(s.roe), roic=n(s.roic), fcf=n(s.freeCashFlow), fcfPayout=n(s.fcfPayoutRatio), epsg=n(s.epsGrowth), yieldPct=n(s.trailingYield);
    const strongEconomics=(roe!=null&&roe>=20)||(roic!=null&&roic>=15);
    const cashSupported=fcf!=null&&fcf>0&&(fcfPayout==null||fcfPayout<=85);
    const incomeSupported=yieldPct!=null&&yieldPct>=3&&cashSupported;

    if(/bank|insurance|investment|securities|real estate|property|fund/.test(sector)) return {weight:'High P/B relevance',key:'high',type:'Asset/book-sensitive'};
    if(ticker==='TJH'||(/infrastructure|transportation/.test(sector)&&strongEconomics&&cashSupported)) return {weight:'Low P/B relevance',key:'low',type:'Cash-generative infrastructure'};
    if(ticker==='CAR'||(strongEconomics&&cashSupported&&incomeSupported)) return {weight:'Low P/B relevance',key:'low',type:'Cash-generative income business'};
    if(/manufactur|construction|materials|utility|energy/.test(sector)) return {weight:'Moderate P/B relevance',key:'medium',type:'Asset-influenced business'};
    return {weight:'Low P/B relevance',key:'low',type:'Earnings/cash-flow led business'};
  }

  function context(s){
    const p=profile(s), discount=n(s.bookDiscountPct), roe=n(s.roe), roic=n(s.roic), fcf=n(s.freeCashFlow), fcfPayout=n(s.fcfPayoutRatio), epsg=n(s.epsGrowth), yieldPct=n(s.trailingYield), pe=n(s.pe);
    const premium=discount!=null&&discount<0, below=discount!=null&&discount>0;
    const strongReturns=(roe!=null&&roe>=15)||(roic!=null&&roic>=12);
    const strongCash=fcf!=null&&fcf>0&&(fcfPayout==null||fcfPayout<=85);
    const earningsOkay=epsg==null||epsg>=0;
    let signal='Near Book', tone='neutral';

    if(below){signal=discount>=35?'Deep Value Discount':'Below Book';tone='positive';}
    else if(premium&&p.key==='low'&&strongReturns&&strongCash){signal='Quality Premium';tone='amber';}
    else if(premium&&(!strongReturns||!strongCash)){signal='Speculative Premium';tone='negative';}
    else if(premium){signal='Premium';tone=p.key==='high'?'negative':'amber';}

    const supports=[]; const watches=[];
    if(roe!=null&&roe>=20)supports.push(`ROE ${num(roe,0)}%`);
    else if(roic!=null&&roic>=15)supports.push(`ROIC ${num(roic,0)}%`);
    if(strongCash)supports.push('FCF supported');
    if(yieldPct!=null&&yieldPct>=5)supports.push(`${num(yieldPct,1)}% trailing yield`);
    if(epsg!=null&&epsg>=8)supports.push('earnings growth');
    if(pe!=null&&pe>20)watches.push('earnings multiple');
    if(epsg!=null&&epsg<0)watches.push('earnings trend');
    if(s.zoneStatus==='above')watches.push('entry price');
    if(fcfPayout!=null&&fcfPayout>100)watches.push('dividend cash coverage');

    let narrative;
    if(premium&&p.key==='low'&&strongReturns&&strongCash){
      narrative=`Trading above book is not automatically negative here. ${s.ticker} is better judged on earnings power, returns on capital, free cash flow, dividend safety and entry price than on accounting book value alone.`;
    }else if(premium&&p.key==='high'){
      narrative=`Book value is important for this business type, so the premium deserves meaningful valuation weight. The primary Buy / Hold / Avoid view should still consider profitability, cash flow, dividends and growth before reaching a conclusion.`;
    }else if(below){
      narrative=`The discount to book can support the value case, but below-book pricing is not automatically a Buy. Profitability, cash generation, balance-sheet quality, dividend sustainability and momentum must confirm that the discount is attractive rather than a warning.`;
    }else{
      narrative=`P/B is one valuation input, not a standalone recommendation. The dashboard weighs it alongside earnings, returns, free cash flow, dividend sustainability and current entry price.`;
    }
    return {profile:p,signal,tone,narrative,supports:[...new Set(supports)].slice(0,3),watches:[...new Set(watches)].slice(0,3)};
  }

  function ensureStyles(){if(document.getElementById('bookContextStyles'))return;const style=document.createElement('style');style.id='bookContextStyles';style.textContent=`
    .book-context{margin-top:8px;padding-top:8px;border-top:1px solid var(--border);white-space:normal;max-width:440px;color:var(--muted);font-size:.67rem;line-height:1.4}
    .book-context-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.book-context-tags span{display:inline-flex;padding:3px 6px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:.58rem;color:var(--muted)}
    .book-context-tags .support{color:var(--green)}.book-context-tags .watch{color:var(--amber)}
    .book-signal.amber{color:var(--amber)}
    .book-mobile-context{margin:10px 0 0;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--muted);font-size:.67rem;line-height:1.42}
  `;document.head.appendChild(style);}

  function updateHeaders(){
    const panel=document.querySelector('.book-value-panel');if(!panel)return;
    const h2=panel.querySelector('.panel-heading h2');if(h2)h2.textContent='Price-to-Book Context';
    const badge=panel.querySelector('.panel-badge');if(badge)badge.textContent='Sector + business-model aware';
    const ths=panel.querySelectorAll('thead th');
    if(ths.length>=8){ths[5].textContent='Valuation Context';ths[6].textContent='P/B Relevance';ths[7].textContent='Primary Rating';}
  }

  function render(){
    const body=$('bookValueBody'),note=$('bookValueNote'),cards=$('bookValueCards');if(!body||!note)return;ensureStyles();updateHeaders();
    const rows=tracked().sort((a,b)=>(b.bookDiscountPct??-999)-(a.bookDiscountPct??-999));
    body.innerHTML=rows.length?rows.map(s=>{const c=context(s);const tags=[...c.supports.map(x=>`<span class="support">Supports: ${x}</span>`),...c.watches.map(x=>`<span class="watch">Watch: ${x}</span>`)].join('');return `<tr><td><strong>${s.ticker}</strong><br><small>${s.company||''}</small></td><td>${money(s.price)}</td><td>${money(s.bookValuePerShare)}</td><td>${s.calculatedPbFromJsePrice==null?(s.pb==null?'N/A':num(s.pb,2)+'×'):num(s.calculatedPbFromJsePrice,2)+'×'}</td><td>${comparison(s)}</td><td><strong class="book-signal ${c.tone}">${c.signal}</strong><br><small>${c.profile.type}</small><div class="book-context">${c.narrative}${tags?`<div class="book-context-tags">${tags}</div>`:''}</div></td><td><strong>${c.profile.weight}</strong><br><small>P/B does not override the primary rating</small></td><td><strong>${s.rating||s.bookAdjustedRating||'N/A'}</strong></td></tr>`;}).join(''):'<tr><td colspan="8" class="neutral">Add tickers to see the price-to-book context.</td></tr>';

    if(cards)cards.innerHTML=rows.length?rows.map(s=>{const c=context(s);const tags=[...c.supports.map(x=>`<span class="support">Supports: ${x}</span>`),...c.watches.map(x=>`<span class="watch">Watch: ${x}</span>`)].join('');return `<article class="book-mobile-card"><div class="book-mobile-head"><div><strong>${s.ticker}</strong><small>${s.company||''}</small></div><strong class="book-signal ${c.tone}">${c.signal}</strong></div><div class="book-mobile-grid"><div><span>Price</span><strong>${money(s.price)}</strong></div><div><span>Book value/share</span><strong>${money(s.bookValuePerShare)}</strong></div><div><span>P/B</span><strong>${s.calculatedPbFromJsePrice==null?(s.pb==null?'N/A':num(s.pb,2)+'×'):num(s.calculatedPbFromJsePrice,2)+'×'}</strong></div><div><span>Price vs book</span><strong>${comparison(s)}</strong></div><div><span>P/B relevance</span><strong>${c.profile.weight.replace(' P/B relevance','')}</strong></div><div><span>Primary rating</span><strong>${s.rating||s.bookAdjustedRating||'N/A'}</strong></div></div><div class="book-mobile-context">${c.narrative}${tags?`<div class="book-context-tags">${tags}</div>`:''}</div></article>`;}).join(''):'<p class="neutral">Add tickers to see the price-to-book context.</p>';

    note.textContent='P/B is a context signal, not an automatic Buy / Hold / Avoid rule. It receives high weight for book-sensitive businesses such as banks, insurers, investment and real-estate companies; lower weight for businesses whose value is driven more by earnings power and cash generation. A high-P/B stock can still be attractive when profitability, free cash flow, dividend safety and entry price justify the premium.';
  }

  const obs=new MutationObserver(()=>render());window.addEventListener('load',()=>{render();const target=$('subtitleTickers');if(target)obs.observe(target,{childList:true,subtree:true,characterData:true});window.addEventListener('storage',render);document.body.addEventListener('click',e=>{if(e.target.closest('[data-ticker],#resetTrackedBtn'))setTimeout(render,0);});});
})();
