(()=>{
  const D=window.JSE_DASHBOARD_DATA;
  if(!D?.stocks)return;
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const OBJECTIVE_KEY='dailyJseFreshCapitalObjectiveV1';
  const MODES=['balanced','income','value','growth'];
  const $=id=>document.getElementById(id);
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const clamp=v=>Math.max(0,Math.min(100,v));
  const currentYield=s=>num(s.currentDividendYield)??num(s.trailingYield)??0;
  const ratingTier=s=>{const r=String(s.rating||'').toLowerCase();if(r.includes('strong buy'))return 5;if(r.includes('buy'))return 4;if(r.includes('hold'))return 3;if(r.includes('watch'))return 2;if(r.includes('avoid')||r.includes('sell'))return 1;return 0;};
  const scoreRange=(v,rules,fallback=50)=>{v=num(v);if(v==null)return fallback;for(const [test,score] of rules)if(test(v))return score;return fallback;};
  const tracked=()=>{let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}const set=new Set(Array.isArray(saved)?saved.map(String):[]);return D.stocks.filter(s=>set.has(s.ticker));};
  function incomeScore(s){
    const y=scoreRange(currentYield(s),[[v=>v>=8,100],[v=>v>=7,95],[v=>v>=5,88],[v=>v>=4,75],[v=>v>=3,65],[v=>v>0,45]]);
    const payout=scoreRange(s.payoutRatio,[[v=>v>=20&&v<=60,95],[v=>v>60&&v<=75,82],[v=>v>=0&&v<20,70],[v=>v>75&&v<=90,62],[v=>v>90&&v<=100,48],[v=>v>100,20]]);
    const eps=scoreRange(s.epsGrowth,[[v=>v>=15,95],[v=>v>=5,82],[v=>v>=0,70],[v=>v>=-10,50],[v=>v<-10,25]]);
    const dg=scoreRange(s.dividendGrowth,[[v=>v>=5,90],[v=>v>=0,75],[v=>v>=-10,55],[v=>v<-10,30]]);
    const fcf=num(s.fcfPayoutRatio);const cover=fcf!=null?(fcf<=60?95:fcf<=80?82:fcf<=100?65:fcf<=120?45:20):(num(s.payoutRatio)!=null?70:50);
    const pe=num(s.pe),pb=num(s.calculatedPbFromJsePrice)??num(s.pb);const vals=[];if(pe!=null)vals.push(pe>0&&pe<=10?90:pe<=15?78:pe<=22?60:40);if(pb!=null)vals.push(pb<=.8?95:pb<=1.2?82:pb<=2?62:40);const val=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:55;
    return clamp(.25*y+.30*((payout+cover)/2)+.15*eps+.10*dg+.10*val+.10*(ratingTier(s)>=3?75:55));
  }
  function objectiveScore(s,mode){
    if(mode==='income')return incomeScore(s);
    if(mode==='value'){const pb=num(s.calculatedPbFromJsePrice)??num(s.pb),pe=num(s.pe),disc=num(s.bookDiscountPct);return clamp((num(s.score)??50)*.35+(pb!=null?(pb<=.8?95:pb<=1?85:pb<=1.5?65:40):50)*.25+(pe!=null?(pe>0&&pe<=10?90:pe<=15?75:pe<=22?55:35):50)*.20+(disc!=null?clamp(50+disc):50)*.20);}
    if(mode==='growth'){const vals=[num(s.epsGrowth),num(s.revenueGrowth),num(s.netIncomeGrowth)].filter(v=>v!=null);const g=vals.length?clamp(55+vals.reduce((a,b)=>a+b,0)/vals.length):50;return clamp(g*.55+(num(s.score)??50)*.30+(ratingTier(s)>=4?85:ratingTier(s)>=3?65:40)*.15);}
    return clamp((num(s.score)??50)*.60+(ratingTier(s)*18)*.25+(s.zoneStatus==='below'?95:s.zoneStatus==='in'?82:s.zoneStatus==='above'?40:55)*.15);
  }
  function eligible(s,mode){const r=String(s.rating||'').toLowerCase();if(/avoid|sell/.test(r))return false;if(mode==='balanced')return s.ratingClass==='buy';if(mode==='income')return currentYield(s)>=3&&incomeScore(s)>=55;return objectiveScore(s,mode)>=60&&ratingTier(s)>=2;}
  function incomeLabel(s){const q=incomeScore(s);return q>=80?'STRONG':q>=68?'GOOD':q>=55?'CAUTION':'WEAK';}
  function allocate(items,mode){if(!items.length)return[];const raw=items.map(s=>({s,w:Math.max(1,objectiveScore(s,mode)-45)}));const total=raw.reduce((a,x)=>a+x.w,0)||1;return raw.map(x=>({...x,p:x.w/total*100})).sort((a,b)=>b.p-a.p);}
  function ensureStyles(){if($('freshCapitalObjectiveStyles'))return;const st=document.createElement('style');st.id='freshCapitalObjectiveStyles';st.textContent='.fresh-objective-bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);margin:8px 0}.fresh-objective-label{font-size:.66rem;font-weight:800;color:var(--muted)}.fresh-objective-btn{border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:6px 10px;font-size:.64rem;font-weight:800;cursor:pointer}.fresh-objective-btn.active{color:var(--text);border-color:var(--accent);background:var(--blue-bg)}.fresh-objective-note{font-size:.58rem;color:var(--muted)}@media(max-width:720px){.fresh-objective-note{flex-basis:100%}}';document.head.appendChild(st);}
  let mode=MODES.includes(localStorage.getItem(OBJECTIVE_KEY))?localStorage.getItem(OBJECTIVE_KEY):'balanced';
  let renderTimer=null;
  function render(){
    const rank=$('rankingList'),bar=$('allocationBar'),legend=$('allocationLegend');if(!rank||!bar||!legend)return;
    const t=tracked();
    const qualifying=t.filter(s=>eligible(s,mode)).sort((a,b)=>objectiveScore(b,mode)-objectiveScore(a,mode));
    const allocation=allocate(qualifying,mode);
    rank.innerHTML=qualifying.map((s,i)=>`<div class="rank-row"><div class="rank-left"><span class="rank-number">${i+1}</span><div><strong>${s.ticker}</strong><div class="rank-reason">${mode==='income'?`Income ${incomeLabel(s)} • ${currentYield(s).toFixed(2)}% current yield • payout ${num(s.payoutRatio)!=null?Number(s.payoutRatio).toFixed(0)+'%':'N/A'}`:(s.reason||'')}</div><small>${mode[0].toUpperCase()+mode.slice(1)} score ${objectiveScore(s,mode).toFixed(0)}/100 • Primary ${s.rating||'N/A'}</small></div></div><span class="rating ${s.ratingClass||'hold'}">${s.rating||'N/A'}</span></div>`).join('')||`<p class="neutral">No tracked stocks currently qualify for the ${mode} objective.</p>`;
    const colors=['var(--viz1,#5b8cff)','var(--viz2,#48d7a0)','var(--viz3,#ffd166)','var(--viz4,#9f7aea)','var(--viz5,#38bdf8)','var(--viz6,#fb7185)'];
    bar.innerHTML=allocation.map((x,i)=>`<div class="allocation-segment" title="${x.s.ticker} ${x.p.toFixed(1)}%" style="width:${x.p.toFixed(3)}%;background:${colors[i%colors.length]}"></div>`).join('');
    legend.innerHTML=allocation.map((x,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span><strong>${x.s.ticker}</strong> ${x.p.toFixed(1)}%${mode==='income'?` • ${currentYield(x.s).toFixed(2)}% • ${incomeLabel(x.s)}`:''}</div>`).join('')||`<span class="neutral">No tracked stocks currently qualify for ${mode} new-money allocation.</span>`;
    const note=document.querySelector('#allocationSection .allocation-note');if(note)note.textContent=mode==='balanced'?'Balanced mode filters Fresh Capital to Buy-class stocks and allocates only among those qualifying names.':'Fresh Capital is filtered to stocks qualifying for the selected objective; Avoid/Sell stocks remain excluded.';
    document.querySelectorAll('[data-fresh-objective]').forEach(b=>b.classList.toggle('active',b.dataset.freshObjective===mode));
    const badge=document.querySelector('#freshCapitalSection .panel-badge');if(badge)badge.textContent=`${mode[0].toUpperCase()+mode.slice(1)} objective • ${qualifying.length}/${t.length} qualify`;
  }
  function renderLast(){clearTimeout(renderTimer);renderTimer=setTimeout(render,80);}
  function setup(){
    ensureStyles();const panel=$('freshCapitalSection');if(!panel)return;
    let ctl=$('freshCapitalObjective');if(!ctl){ctl=document.createElement('div');ctl.id='freshCapitalObjective';ctl.className='fresh-objective-bar';ctl.innerHTML='<span class="fresh-objective-label">Objective</span>'+MODES.map(x=>`<button type="button" class="fresh-objective-btn" data-fresh-objective="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')+'<span class="fresh-objective-note">Filters Fresh Capital ranking + new-money allocation</span>';panel.querySelector('.panel-heading')?.insertAdjacentElement('afterend',ctl);ctl.addEventListener('click',e=>{const b=e.target.closest('[data-fresh-objective]');if(!b)return;e.preventDefault();e.stopPropagation();mode=b.dataset.freshObjective;localStorage.setItem(OBJECTIVE_KEY,mode);document.querySelectorAll('[data-fresh-objective]').forEach(x=>x.classList.toggle('active',x===b));renderLast();});}
    renderLast();
    document.addEventListener('click',e=>{if(e.target.closest('[data-ticker],#resetTrackedBtn'))renderLast();});
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===OBJECTIVE_KEY){if(e.key===OBJECTIVE_KEY&&MODES.includes(e.newValue))mode=e.newValue;renderLast();}});
    window.JSE_FRESH_CAPITAL_V2={render:renderLast,getMode:()=>mode,setMode:m=>{if(MODES.includes(m)){mode=m;localStorage.setItem(OBJECTIVE_KEY,m);renderLast();}}};
  }
  setup();
})();
