(() => {
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const PROPERTY=new Set(['SML','KPREIT','CPFV','138SL','SRFJMD','FIRSTROCKJMD','XFUND']);
  const byTicker=new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const n=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const isProperty=s=>PROPERTY.has(String(s?.ticker||'').toUpperCase())||/property|real estate|reit/i.test(String(s?.sector||''));
  const sym=c=>c==='TTD'?'TT$':c==='USD'?'US$':c==='BBD'?'BDS$':'J$';
  const fmt=(v,c='JMD',d=2)=>n(v)==null?'N/A':`${sym(c)}${Math.abs(Number(v)).toFixed(d)}`;
  const fmtCompact=(v,c='JMD')=>{v=n(v);if(v==null)return'N/A';const a=Math.abs(v),p=sym(c),x=a>=1e9?`${(a/1e9).toFixed(2)}B`:a>=1e6?`${(a/1e6).toFixed(2)}M`:a>=1e3?`${(a/1e3).toFixed(2)}K`:a.toFixed(2);return `${p}${x}`;};
  const shares=s=>n(s.ffoSharesUsed)??n(s.weightedAverageShares)??n(s.basicSharesOutstanding)??n(s.sharesOutstanding);
  const annualDps=s=>n(s.currentAnnualDps)??n(s.ttmDps)??n(s.annualDps);

  function ensureStyles(){if(document.getElementById('freshCashExplainerStyles'))return;const st=document.createElement('style');st.id='freshCashExplainerStyles';st.textContent=`
    .cash-explain-trigger{position:relative;cursor:pointer;user-select:none;display:flex!important;align-items:center;gap:5px;outline:none}
    .cash-explain-trigger::after{content:'ⓘ';font-size:.6rem;color:var(--accent)}
    .cash-explain-trigger:hover,.cash-explain-trigger:focus{color:var(--text)}
    .cash-explain-trigger:hover::before,.cash-explain-trigger:focus::before{content:attr(data-tip);position:absolute;left:0;top:calc(100% + 5px);z-index:20;width:min(340px,78vw);padding:8px 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);font-size:.58rem;font-weight:600;letter-spacing:0;text-transform:none;line-height:1.4;box-shadow:0 10px 28px rgba(0,0,0,.28)}
    .fresh-cash-explainer{width:100%;margin-top:3px;padding:9px 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);font-size:.58rem;line-height:1.45}
    .fresh-cash-explainer[hidden]{display:none}.fresh-cash-explainer strong{font-size:.62rem}.fresh-cash-explainer-grid{display:grid;grid-template-columns:1fr;gap:6px;margin-top:6px}.fresh-cash-explainer-row{padding-top:6px;border-top:1px solid var(--border)}.fresh-cash-explainer-row:first-child{padding-top:0;border-top:0}.fresh-cash-formula{color:var(--muted)}.fresh-cash-actual{margin-top:2px;font-weight:700}.fresh-cash-source{margin-top:7px;color:var(--muted);font-size:.53rem}
    @media(max-width:720px){.cash-explain-trigger:hover::before,.cash-explain-trigger:focus::before{display:none}.fresh-cash-explainer{font-size:.6rem}}
  `;document.head.appendChild(st);}

  function ffoRow(s){
    const c=s.ffoCurrency||s.cashFlowCurrency||'JMD',ffo=n(s.ffo),sh=shares(s),ps=n(s.ffoPerShare);
    let actual='Current value unavailable.';
    if(ffo!=null&&sh!=null&&sh>0)actual=`${fmtCompact(ffo,c)} ÷ ${(sh/1e6).toFixed(1)}M shares = ${fmt(ffo/sh,c,2)}/share`;
    else if(ps!=null)actual=`Current stored value = ${fmt(ps,c,2)}/share${s.ffoPerShareMethod?` (${String(s.ffoPerShareMethod).replaceAll('-',' ')})`:''}`;
    return `<div class="fresh-cash-explainer-row"><strong>FFO/share</strong><div class="fresh-cash-formula">FFO ÷ shares outstanding</div><div class="fresh-cash-actual">${actual}</div></div>`;
  }
  function fcfShareRow(s){
    const c=s.cashFlowCurrency||s.statisticsCurrency||'JMD',fcf=n(s.freeCashFlow),sh=n(s.weightedAverageShares)??n(s.basicSharesOutstanding)??n(s.sharesOutstanding),ps=n(s.freeCashFlowPerShare);
    let actual='Current value unavailable.';
    if(fcf!=null&&sh!=null&&sh>0)actual=`${fmtCompact(fcf,c)} ÷ ${(sh/1e6).toFixed(1)}M shares = ${fmt(fcf/sh,c,2)}/share`;
    else if(ps!=null)actual=`Current stored value = ${fmt(ps,c,2)}/share`;
    return `<div class="fresh-cash-explainer-row"><strong>FCF/share</strong><div class="fresh-cash-formula">Free cash flow ÷ shares outstanding</div><div class="fresh-cash-actual">${actual}</div></div>`;
  }
  function fcfPayoutRow(s){
    const c=s.cashFlowCurrency||s.dividendCurrency||s.statisticsCurrency||'JMD',dps=annualDps(s),ps=n(s.freeCashFlowPerShare),p=n(s.fcfPayoutRatio);
    let actual='Current value unavailable.';
    if(dps!=null&&ps!=null&&ps>0)actual=`${fmt(dps,c,2)} annual DPS ÷ ${fmt(ps,c,2)} FCF/share × 100 = ${(dps/ps*100).toFixed(1)}%`;
    else if(p!=null)actual=`Current stored value = ${p.toFixed(1)}%`;
    return `<div class="fresh-cash-explainer-row"><strong>FCF payout</strong><div class="fresh-cash-formula">Annual DPS ÷ FCF/share × 100</div><div class="fresh-cash-actual">${actual}</div></div>`;
  }
  function netCashRow(s){
    const c=s.statisticsCurrency||s.cashFlowCurrency||'JMD',cash=n(s.cashAndEquivalents)??n(s.cash),debt=n(s.totalDebt),net=n(s.netCash);
    const label=net!=null&&net<0?'Net debt':'Net cash';
    let actual='Current value unavailable.';
    if(cash!=null&&debt!=null){const calc=cash-debt;actual=`${fmtCompact(cash,c)} cash − ${fmtCompact(debt,c)} debt = ${calc<0?'Net debt':'Net cash'} ${fmtCompact(calc,c)}`;}
    else if(net!=null)actual=`Current stored result = ${label} ${fmtCompact(net,c)}`;
    return `<div class="fresh-cash-explainer-row"><strong>${label}</strong><div class="fresh-cash-formula">Cash & equivalents − total debt</div><div class="fresh-cash-actual">${actual}</div></div>`;
  }
  function coverRow(s){
    const ebit=n(s.ebit),interest=n(s.interestExpense),cover=n(s.interestCoverage);
    let actual='Current value unavailable.';
    if(ebit!=null&&interest!=null&&Math.abs(interest)>0)actual=`EBIT ÷ interest expense = ${(ebit/Math.abs(interest)).toFixed(1)}×`;
    else if(cover!=null)actual=`Current stored value = ${cover.toFixed(1)}×`;
    return `<div class="fresh-cash-explainer-row"><strong>Interest cover</strong><div class="fresh-cash-formula">EBIT ÷ interest expense</div><div class="fresh-cash-actual">${actual}</div></div>`;
  }
  function detailHtml(s,property){
    const rows=[property?ffoRow(s):'',fcfShareRow(s),property?'':fcfPayoutRow(s),netCashRow(s),coverRow(s)].join('');
    const src=property&&s.ffoSource?`FFO source: ${s.ffoSource}${s.ffoPeriod?` • ${s.ffoPeriod}`:''}`:s.cashFlowSource?`Cash-flow source: ${s.cashFlowSource}`:'';
    return `<strong>${s.ticker} calculation details</strong><div class="fresh-cash-explainer-grid">${rows}</div>${src?`<div class="fresh-cash-source">${src}</div>`:''}`;
  }
  function decorate(){
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card=>{
      const ticker=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker),heavy=card.querySelector('.fresh-heavy-metrics'),label=heavy?.querySelector('.fresh-heavy-label');
      if(!s||!heavy||!label)return;
      const property=isProperty(s),id=`cashExplain-${ticker}`;
      label.classList.add('cash-explain-trigger');label.setAttribute('role','button');label.setAttribute('tabindex','0');label.setAttribute('aria-expanded','false');label.setAttribute('aria-controls',id);label.dataset.tip=property?'FFO/share = FFO ÷ shares; FCF/share = FCF ÷ shares; Net cash/debt = cash − debt; Interest cover = EBIT ÷ interest. Click for this stock’s calculation.':'FCF/share = FCF ÷ shares; FCF payout = annual DPS ÷ FCF/share; Net cash/debt = cash − debt; Interest cover = EBIT ÷ interest. Click for this stock’s calculation.';
      let panel=heavy.querySelector(`#${id}`);if(!panel){panel=document.createElement('div');panel.id=id;panel.className='fresh-cash-explainer';panel.hidden=true;heavy.appendChild(panel);}panel.innerHTML=detailHtml(s,property);
      if(!label.dataset.bound){const toggle=()=>{panel.hidden=!panel.hidden;label.setAttribute('aria-expanded',String(!panel.hidden));};label.addEventListener('click',e=>{e.stopPropagation();toggle();});label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});label.dataset.bound='1';}
    });
  }
  ensureStyles();let timer;const run=()=>{clearTimeout(timer);timer=setTimeout(decorate,130)};const rank=document.getElementById('rankingList');if(rank)new MutationObserver(run).observe(rank,{childList:true,subtree:true});document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective]'))run();});document.addEventListener('jse:framework-updated',run);run();
})();
