(()=>{
  const D=window.JSE_DASHBOARD_DATA;
  if(!D?.stocks)return;
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const OBJECTIVE_KEY='dailyJseFreshCapitalObjectiveV1';
  const MODES=['balanced','income','value','growth'];
  const $=id=>document.getElementById(id);
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const clamp=v=>Math.max(0,Math.min(100,v));
  const fmt=(v,d=2)=>num(v)==null?'N/A':Number(v).toFixed(d);
  const currentYield=s=>num(s.currentDividendYield)??num(s.trailingYield)??0;
  const pb=s=>num(s.calculatedPbFromJsePrice)??num(s.pb);
  const ratingTier=s=>{const r=String(s.rating||'').toLowerCase();if(r.includes('strong buy'))return 5;if(r.includes('buy'))return 4;if(r.includes('hold'))return 3;if(r.includes('watch'))return 2;if(r.includes('avoid')||r.includes('sell'))return 1;return 0;};
  const scoreRange=(v,rules,fallback=50)=>{v=num(v);if(v==null)return fallback;for(const [test,score] of rules)if(test(v))return score;return fallback;};
  const tracked=()=>{let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}const set=new Set(Array.isArray(saved)?saved.map(String):[]);return D.stocks.filter(s=>set.has(s.ticker));};

  function incomeScore(s){
    const y=scoreRange(currentYield(s),[[v=>v>=8,100],[v=>v>=7,95],[v=>v>=5,88],[v=>v>=4,75],[v=>v>=3,65],[v=>v>0,45]]);
    const payout=scoreRange(s.payoutRatio,[[v=>v>=20&&v<=60,95],[v=>v>60&&v<=75,82],[v=>v>=0&&v<20,70],[v=>v>75&&v<=90,62],[v=>v>90&&v<=100,48],[v=>v>100,20]]);
    const eps=scoreRange(s.epsGrowth,[[v=>v>=15,95],[v=>v>=5,82],[v=>v>=0,70],[v=>v>=-10,50],[v=>v<-10,25]]);
    const dg=scoreRange(s.dividendGrowth,[[v=>v>=5,90],[v=>v>=0,75],[v=>v>=-10,55],[v=>v<-10,30]]);
    const fcf=num(s.fcfPayoutRatio);const cover=fcf!=null?(fcf<=60?95:fcf<=80?82:fcf<=100?65:fcf<=120?45:20):(num(s.payoutRatio)!=null?70:50);
    const pe=num(s.pe),p=pb(s),vals=[];if(pe!=null)vals.push(pe>0&&pe<=10?90:pe<=15?78:pe<=22?60:40);if(p!=null)vals.push(p<=.8?95:p<=1.2?82:p<=2?62:40);const val=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:55;
    return clamp(.25*y+.30*((payout+cover)/2)+.15*eps+.10*dg+.10*val+.10*(ratingTier(s)>=3?75:55));
  }

  function objectiveScore(s,m){
    if(m==='income')return incomeScore(s);
    if(m==='value'){const p=pb(s),pe=num(s.pe),disc=num(s.bookDiscountPct);return clamp((num(s.score)??50)*.35+(p!=null?(p<=.8?95:p<=1?85:p<=1.5?65:40):50)*.25+(pe!=null?(pe>0&&pe<=10?90:pe<=15?75:pe<=22?55:35):50)*.20+(disc!=null?clamp(50+disc):50)*.20);}
    if(m==='growth'){const vals=[num(s.epsGrowth),num(s.revenueGrowth),num(s.netIncomeGrowth)].filter(v=>v!=null);const g=vals.length?clamp(55+vals.reduce((a,b)=>a+b,0)/vals.length):50;return clamp(g*.55+(num(s.score)??50)*.30+(ratingTier(s)>=4?85:ratingTier(s)>=3?65:40)*.15);}
    return clamp((num(s.score)??50)*.60+(ratingTier(s)*18)*.25+(s.zoneStatus==='below'?95:s.zoneStatus==='in'?82:s.zoneStatus==='above'?40:55)*.15);
  }

  function categoryMatch(s,m){
    const api=window.JSE_INVESTMENT_CATEGORIES;
    if(api?.categories){const cats=api.categories(s);if(m==='value')return cats.includes('Value');if(m==='growth')return cats.includes('Growth');if(m==='income')return cats.includes('Income');}
    if(m==='income')return currentYield(s)>=3;
    if(m==='value'){const p=pb(s),pe=num(s.pe),disc=num(s.bookDiscountPct);return (p!=null&&p<=1)||(pe!=null&&pe>0&&pe<=12)||(disc!=null&&disc>=15);}
    if(m==='growth')return (num(s.epsGrowth)??-999)>=12||(num(s.revenueGrowth)??-999)>=10||(num(s.netIncomeGrowth)??-999)>=10;
    return true;
  }

  function eligible(s,m){
    const r=String(s.rating||'').toLowerCase();if(/avoid|sell/.test(r))return false;
    if(m==='balanced')return s.ratingClass==='buy';
    if(m==='income')return categoryMatch(s,m)&&incomeScore(s)>=55;
    return categoryMatch(s,m)&&objectiveScore(s,m)>=60&&ratingTier(s)>=2;
  }

  function compareByMode(a,b,m){
    const sa=objectiveScore(a,m),sb=objectiveScore(b,m);
    if(sb!==sa)return sb-sa;
    if(m==='income'){const y=currentYield(b)-currentYield(a);if(y)return y;}
    const rt=ratingTier(b)-ratingTier(a);if(rt)return rt;
    return String(a.ticker).localeCompare(String(b.ticker));
  }

  function incomeLabel(s){const q=incomeScore(s);return q>=80?'STRONG':q>=68?'GOOD':q>=55?'CAUTION':'WEAK';}

  function allocate(items,m){
    if(!items.length)return[];
    const raw=items.map(s=>{const score=objectiveScore(s,m);const w=Math.pow(Math.max(1,score-45),2);return{s,score,w};});
    const total=raw.reduce((a,x)=>a+x.w,0)||1;
    return raw.map(x=>({...x,p:x.w/total*100})).sort((a,b)=>b.p-a.p||compareByMode(a.s,b.s,m));
  }

  function tags(s){const out=[];const p=pb(s);if((p!=null&&p<1)||(num(s.pe)!=null&&s.pe>0&&s.pe<10)||(num(s.bookDiscountPct)!=null&&s.bookDiscountPct>=20))out.push('Value');if(currentYield(s)>=3)out.push('Income');if((num(s.epsGrowth)??0)>=12||(num(s.revenueGrowth)??0)>=10||(num(s.y1)??0)>=20)out.push('Growth');if(!out.length)out.push('Core');return out;}

  function objectiveReason(s,mode){
    if(mode==='income')return `Income ${incomeLabel(s)} • ${fmt(currentYield(s),2)}% current yield • payout ${num(s.payoutRatio)!=null?fmt(s.payoutRatio,0)+'%':'N/A'}`;
    if(mode==='value')return `${pb(s)!=null?'P/B '+fmt(pb(s),2)+'× • ':''}${num(s.pe)!=null?'P/E '+fmt(s.pe,1)+'× • ':''}${num(s.bookDiscountPct)!=null?(s.bookDiscountPct>=0?fmt(s.bookDiscountPct,0)+'% below book':fmt(Math.abs(s.bookDiscountPct),0)+'% above book'):'valuation data available'}`;
    if(mode==='growth')return `EPS ${num(s.epsGrowth)!=null?fmt(s.epsGrowth,1)+'%':'N/A'} • Revenue ${num(s.revenueGrowth)!=null?fmt(s.revenueGrowth,1)+'%':'N/A'} • 1Y ${num(s.y1)!=null?fmt(s.y1,1)+'%':'N/A'}`;
    return s.reason||'Balanced quality, valuation, growth and income assessment.';
  }

  function card(s,i,mode){
    const p=pb(s),disc=num(s.bookDiscountPct),zone=s.zoneStatus==='in'?'IN ZONE':s.zoneStatus==='below'?'BELOW ZONE':s.zoneStatus==='above'?'ABOVE ZONE':'ZONE N/A',score=objectiveScore(s,mode);
    return `<article class="fresh-card fresh-objective-card" data-objective-score="${score.toFixed(4)}"><div class="fresh-rank">#${i+1}</div><div class="fresh-main"><div class="fresh-title"><div><strong>${s.ticker}</strong><span>${s.company||''}</span></div><span class="rating ${s.ratingClass||'hold'}">${s.rating||'N/A'}</span></div><div class="investor-badges"><span class="sector-badge">${s.sector||'Other'}</span>${tags(s).map(x=>`<span class="style-badge ${x.toLowerCase()}">${x}</span>`).join('')}</div><div class="fresh-metrics"><span><small>Price</small><strong>J$${fmt(s.price,2)}</strong></span><span><small>Current Yield</small><strong>${fmt(currentYield(s),2)}%</strong></span><span><small>P/B</small><strong>${p==null?'N/A':fmt(p,2)+'×'}</strong></span><span><small>P/E</small><strong>${num(s.pe)==null?'N/A':fmt(s.pe,1)+'×'}</strong></span></div><div class="fresh-objective-score"><span>${mode[0].toUpperCase()+mode.slice(1)} score</span><strong>${fmt(score,0)}/100</strong><i><b style="width:${score}%"></b></i></div><div class="fresh-footer"><p>${objectiveReason(s,mode)}</p><span class="zone-status ${s.zoneStatus||'above'}">${zone}</span></div><div class="fresh-secondary">${disc==null?'Book value N/A':disc>=0?fmt(disc,0)+'% below book':fmt(Math.abs(disc),0)+'% above book'} <span>• Primary ${s.rating||'N/A'}</span></div></div></article>`;
  }

  function ensureStyles(){if($('freshCapitalObjectiveStyles'))return;const st=document.createElement('style');st.id='freshCapitalObjectiveStyles';st.textContent='.fresh-objective-bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);margin:8px 0}.fresh-objective-label{font-size:.66rem;font-weight:800;color:var(--muted)}.fresh-objective-btn{border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:6px 10px;font-size:.64rem;font-weight:800;cursor:pointer}.fresh-objective-btn.active{color:var(--text);border-color:var(--accent);background:var(--blue-bg)}.fresh-objective-note{font-size:.58rem;color:var(--muted)}.fresh-objective-card{margin-bottom:10px}.fresh-objective-score{display:grid;grid-template-columns:auto auto;gap:4px 10px;align-items:center;margin:8px 0}.fresh-objective-score span{font-size:.62rem;color:var(--muted);font-weight:700}.fresh-objective-score strong{font-size:.72rem;text-align:right}.fresh-objective-score i{grid-column:1/-1;height:5px;border-radius:999px;background:var(--surface2);overflow:hidden}.fresh-objective-score b{display:block;height:100%;border-radius:inherit;background:var(--accent)}@media(max-width:720px){.fresh-objective-note{flex-basis:100%}.fresh-objective-card .fresh-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(st);}

  let mode=MODES.includes(localStorage.getItem(OBJECTIVE_KEY))?localStorage.getItem(OBJECTIVE_KEY):'balanced';
  let renderTimer=null;
  function render(){
    const rank=$('rankingList'),bar=$('allocationBar'),legend=$('allocationLegend');if(!rank||!bar||!legend)return;
    const t=tracked();
    const qualifying=t.filter(s=>eligible(s,mode)).sort((a,b)=>compareByMode(a,b,mode));
    const allocation=allocate(qualifying,mode);
    rank.innerHTML=qualifying.map((s,i)=>card(s,i,mode)).join('')||`<p class="neutral">No tracked stocks currently qualify for the ${mode} objective.</p>`;
    const colors=['var(--viz1,#5b8cff)','var(--viz2,#48d7a0)','var(--viz3,#ffd166)','var(--viz4,#9f7aea)','var(--viz5,#38bdf8)','var(--viz6,#fb7185)'];
    bar.innerHTML=allocation.map((x,i)=>`<div class="allocation-segment" title="${x.s.ticker} ${x.p.toFixed(1)}%" style="width:${x.p.toFixed(3)}%;background:${colors[i%colors.length]}"></div>`).join('');
    legend.innerHTML=allocation.map((x,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span><strong>${x.s.ticker}</strong> ${x.p.toFixed(1)}% <small>• ${mode} ${x.score.toFixed(0)} • ${x.s.rating||'N/A'}</small></div>`).join('')||`<span class="neutral">No tracked stocks currently qualify for ${mode} new-money allocation.</span>`;
    const note=document.querySelector('#allocationSection .allocation-note');if(note)note.textContent=mode==='balanced'?`Balanced allocation stays Buy-class only and is distributed across ${qualifying.length} qualifying tracked stock${qualifying.length===1?'':'s'}.`:`${mode[0].toUpperCase()+mode.slice(1)} allocation includes every qualifying Buy, Hold or Watch stock and is weighted by the selected objective score.`;
    const totalBadge=document.querySelector('#allocationSection .panel-heading > strong');if(totalBadge)totalBadge.textContent=`100% • ${mode[0].toUpperCase()+mode.slice(1)}`;
    document.querySelectorAll('[data-fresh-objective]').forEach(b=>b.classList.toggle('active',b.dataset.freshObjective===mode));
    const badge=document.querySelector('#freshCapitalSection .panel-badge');if(badge)badge.textContent=`${mode[0].toUpperCase()+mode.slice(1)} objective • ${qualifying.length}/${t.length} qualify • score ↓`;
  }
  function renderLast(){clearTimeout(renderTimer);renderTimer=setTimeout(render,40);}

  function setup(){
    ensureStyles();const panel=$('freshCapitalSection');if(!panel)return;
    let ctl=$('freshCapitalObjective');if(!ctl){ctl=document.createElement('div');ctl.id='freshCapitalObjective';ctl.className='fresh-objective-bar';ctl.innerHTML='<span class="fresh-objective-label">Objective</span>'+MODES.map(x=>`<button type="button" class="fresh-objective-btn" data-fresh-objective="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')+'<span class="fresh-objective-note">Filters + sorts by objective score, then reallocates new money</span>';panel.querySelector('.panel-heading')?.insertAdjacentElement('afterend',ctl);ctl.addEventListener('click',e=>{const b=e.target.closest('[data-fresh-objective]');if(!b)return;e.preventDefault();e.stopPropagation();mode=b.dataset.freshObjective;localStorage.setItem(OBJECTIVE_KEY,mode);render();});}
    render();
    document.addEventListener('click',e=>{if(e.target.closest('[data-ticker],#resetTrackedBtn'))renderLast();});
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===OBJECTIVE_KEY){if(e.key===OBJECTIVE_KEY&&MODES.includes(e.newValue))mode=e.newValue;renderLast();}});
    window.JSE_FRESH_CAPITAL_V2={render,getMode:()=>mode,setMode:m=>{if(MODES.includes(m)){mode=m;localStorage.setItem(OBJECTIVE_KEY,m);render();}},getQualifying:()=>tracked().filter(s=>eligible(s,mode)).sort((a,b)=>compareByMode(a,b,mode)),getAllocation:()=>allocate(tracked().filter(s=>eligible(s,mode)),mode),score:(s,m=mode)=>objectiveScore(s,m)};
  }
  setup();
})();
