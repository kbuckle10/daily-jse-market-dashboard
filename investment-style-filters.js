(() => {
  const DATA=window.JSE_DASHBOARD_DATA;
  if(!DATA?.stocks)return;
  const byTicker=new Map(DATA.stocks.map(s=>[String(s.ticker).toUpperCase(),s]));
  const state={main:new Set(),watch:new Set(),mainMode:'any',watchMode:'any'};
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const avg=a=>{const v=a.filter(x=>x!=null&&Number.isFinite(Number(x))).map(Number);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null;};
  const metric=(v,rules)=>{v=num(v);if(v==null)return null;for(const [test,score] of rules)if(test(v))return score;return 50;};
  const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
  const monthsSince=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.valueOf())?null:(Date.now()-d.getTime())/(1000*60*60*24*30.44);};
  const isBookSensitive=s=>/bank|financial|insurance|investment|real estate|reit/.test(String(s.sector||'').toLowerCase());

  function scores(s){
    const bookSensitive=isBookSensitive(s);
    const pe=metric(s.pe,[[v=>v>0&&v<8,95],[v=>v<11,85],[v=>v<15,70],[v=>v<20,55],[v=>v<25,40],[v=>v>=25,25]]);
    const pb=metric(s.pb,bookSensitive?[[v=>v<.6,95],[v=>v<.8,88],[v=>v<1,78],[v=>v<1.3,62],[v=>v<1.7,45],[v=>v>=1.7,28]]:[[v=>v<.8,85],[v=>v<1.2,75],[v=>v<2,62],[v=>v<4,48],[v=>v>=4,35]]);
    const zone=s.zoneStatus==='below'?92:s.zoneStatus==='in'?82:s.zoneStatus==='above'?42:null;
    const fair=s.fairValue!=null&&s.price!=null&&s.fairValue>0?clamp(50+((s.fairValue/s.price)-1)*120):null;
    const valuation=avg([pe,pb,zone,fair]);
    const eps=metric(s.epsGrowth,[[v=>v>=25,95],[v=>v>=15,85],[v=>v>=8,75],[v=>v>=0,60],[v=>v>=-10,42],[v=>v<-10,22]]);
    const rev=metric(s.revenueGrowth,[[v=>v>=15,90],[v=>v>=8,80],[v=>v>=3,68],[v=>v>=0,58],[v=>v>=-8,42],[v=>v<-8,25]]);
    const ni=metric(s.netIncomeGrowth,[[v=>v>=20,92],[v=>v>=10,82],[v=>v>=3,68],[v=>v>=0,58],[v=>v>=-10,42],[v=>v<-10,22]]);
    const growth=avg([eps,rev,ni]);
    const yieldPct=num(s.currentDividendYield)??num(s.trailingYield);
    const yieldScore=metric(yieldPct,[[v=>v>=7,95],[v=>v>=5,88],[v=>v>=3.5,78],[v=>v>=2,62],[v=>v>0,45],[v=>v===0,20]]);
    const payout=metric(s.payoutRatio,[[v=>v>=20&&v<=55,90],[v=>v>55&&v<=75,75],[v=>v<20&&v>=0,70],[v=>v>75&&v<=100,52],[v=>v>100,22]]);
    const divGrowth=metric(s.dividendGrowth,[[v=>v>=10,90],[v=>v>=5,80],[v=>v>0,68],[v=>v===0,55],[v=>v<0,30]]);
    const dividend=avg([yieldScore,payout,divGrowth]);
    return{valuation,growth,dividend,yieldPct};
  }

  function hasCompellingValueSignals(s){
    const pe=num(s.pe),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),discount=num(s.bookDiscountPct);
    if(isBookSensitive(s)){
      // For banks/financials/insurers, book value is economically important. Require the
      // below-book signal to be supported by a reasonable earnings multiple so that a
      // distressed balance sheet is not labelled Value solely because P/B is low.
      const meaningfulBookDiscount=(discount!=null&&discount>=10)||(pb!=null&&pb<=0.90);
      const earningsSupport=pe!=null&&pe>0&&pe<=15;
      return meaningfulBookDiscount&&earningsSupport;
    }
    // Outside book-sensitive sectors, require two independent valuation signals rather
    // than treating below-book status alone as sufficient evidence of Value.
    const lowPb=pb!=null&&pb<=1.0;
    const lowPe=pe!=null&&pe>0&&pe<=12;
    const meaningfulBookDiscount=discount!=null&&discount>=15;
    return lowPe&&(lowPb||meaningfulBookDiscount);
  }

  function categories(s){
    const sc=scores(s),cats=[];
    // Classification uses the same rounded score investors see in the UI. A second,
    // sector-aware path recognizes compelling valuation evidence, especially for banks.
    if((sc.valuation!=null&&Math.round(sc.valuation)>=65)||hasCompellingValueSignals(s))cats.push('Value');
    const age=monthsSince(s.payDate),activeDividend=(age==null?Boolean(s.payDate||s.exDate||s.currentAnnualDps):age<=18);
    if((sc.yieldPct??0)>=3&&activeDividend&&sc.dividend!=null&&Math.round(sc.dividend)>=55)cats.push('Income');
    if(sc.growth!=null&&Math.round(sc.growth)>=65)cats.push('Growth');
    return cats;
  }
  const displayCategories=s=>{const cats=categories(s);return cats.length?cats:['Neutral'];};
  window.JSE_INVESTMENT_CATEGORIES={categories,displayCategories,scores,hasCompellingValueSignals};

  function ensureStyles(){if(document.getElementById('investmentStyleFilterStyles'))return;const st=document.createElement('style');st.id='investmentStyleFilterStyles';st.textContent=`
    .style-filter-bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);margin:8px 0}.style-filter-label{font-size:.66rem;font-weight:800;color:var(--muted);margin-right:2px}.style-filter-chip,.style-match-mode{border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:6px 10px;font-size:.64rem;font-weight:800;cursor:pointer}.style-filter-chip.active{color:var(--text);border-color:var(--accent);background:var(--blue-bg)}.style-filter-chip.value.active{color:#7dd3fc}.style-filter-chip.income.active{color:#86efac}.style-filter-chip.growth.active{color:#fcd34d}.style-match-mode{margin-left:auto}.style-filter-note{font-size:.58rem;color:var(--muted)}.dynamic-style-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.dynamic-style-badges .style-badge{font-size:.55rem}.style-badge.neutral{color:var(--muted);border-color:var(--border);background:var(--surface2)}.style-category-hidden{display:none!important}@media(max-width:720px){.style-filter-bar{gap:6px}.style-match-mode{margin-left:0}.style-filter-note{flex-basis:100%}}
  `;document.head.appendChild(st);}

  function bar(kind){const wrap=document.createElement('div');wrap.className='style-filter-bar';wrap.dataset.styleFilterKind=kind;wrap.innerHTML=`<span class="style-filter-label">Investment style</span><button class="style-filter-chip value" data-style="Value">Value</button><button class="style-filter-chip income" data-style="Income">Income</button><button class="style-filter-chip growth" data-style="Growth">Growth</button><button class="style-match-mode" data-style-mode>Any</button><span class="style-filter-note">${kind==='watch'?'Filter stocks before adding':'Filter tracked stocks'}</span>`;return wrap;}
  function ensureControls(){
    const tm=document.querySelector('.ticker-manager .ticker-search-wrap');if(tm&&!document.querySelector('[data-style-filter-kind="watch"]'))tm.insertAdjacentElement('afterend',bar('watch'));
    const tb=document.querySelector('.toolbar');if(tb&&!document.querySelector('[data-style-filter-kind="main"]'))tb.insertAdjacentElement('beforebegin',bar('main'));
  }

  function matches(cats,selected,mode){if(!selected.size)return true;return mode==='all'?[...selected].every(x=>cats.includes(x)):[...selected].some(x=>cats.includes(x));}
  function tickerFrom(el,kind){if(kind==='watch')return el.querySelector('.ticker-result-main strong')?.textContent?.trim().toUpperCase()||'';return el.querySelector('.ticker')?.textContent?.trim().toUpperCase()||el.querySelector('h3')?.textContent?.trim().toUpperCase()||'';}
  function badgesHtml(s){return `<div class="dynamic-style-badges">${displayCategories(s).map(x=>`<span class="style-badge ${x.toLowerCase()}">${x}</span>`).join('')}</div>`;}

  function decorateAndFilter(){
    document.querySelectorAll('.ticker-result').forEach(el=>{const t=tickerFrom(el,'watch'),s=byTicker.get(t);if(!s)return;const cats=categories(s);let holder=el.querySelector('.dynamic-style-badges');if(!holder){el.querySelector('.ticker-result-main')?.insertAdjacentHTML('beforeend',badgesHtml(s));holder=el.querySelector('.dynamic-style-badges')}else holder.outerHTML=badgesHtml(s);el.classList.toggle('style-category-hidden',!matches(cats,state.watch,state.watchMode));});
    const mainItems=[...document.querySelectorAll('#stockTableBody tr'),...document.querySelectorAll('#cardView .stock-card')];mainItems.forEach(el=>{const t=tickerFrom(el,'main'),s=byTicker.get(t);if(!s)return;el.classList.toggle('style-category-hidden',!matches(categories(s),state.main,state.mainMode));});
    document.querySelectorAll('.stock-card,.fresh-card').forEach(el=>{const t=el.querySelector('h3')?.textContent?.trim().toUpperCase()||el.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(t);if(!s)return;const badges=el.querySelector('.investor-badges');if(!badges)return;badges.querySelectorAll('.style-badge').forEach(x=>x.remove());displayCategories(s).forEach(x=>badges.insertAdjacentHTML('beforeend',`<span class="style-badge ${x.toLowerCase()}">${x}</span>`));});
  }

  function bind(){document.addEventListener('click',e=>{const chip=e.target.closest('.style-filter-chip'),mode=e.target.closest('[data-style-mode]');if(chip){const host=chip.closest('.style-filter-bar'),kind=host.dataset.styleFilterKind,set=kind==='watch'?state.watch:state.main,val=chip.dataset.style;set.has(val)?set.delete(val):set.add(val);chip.classList.toggle('active',set.has(val));decorateAndFilter();return}if(mode){const kind=mode.closest('.style-filter-bar').dataset.styleFilterKind,key=kind==='watch'?'watchMode':'mainMode';state[key]=state[key]==='any'?'all':'any';mode.textContent=state[key]==='any'?'Any':'All';mode.title=state[key]==='any'?'Show stocks matching any selected style':'Show only stocks matching all selected styles';decorateAndFilter();}});}

  let pending=false;function apply(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;ensureControls();decorateAndFilter();});}
  ensureStyles();bind();apply();window.addEventListener('load',apply);window.addEventListener('storage',apply);window.addEventListener('jse-focus-change',apply);new MutationObserver(()=>apply()).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
})();