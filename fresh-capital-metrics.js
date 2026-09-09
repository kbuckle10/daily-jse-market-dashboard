(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker || '').toUpperCase(), s]));
  const PROPERTY = new Set(['SML','KPREIT','CPFV','138SL','SRFJMD','FIRSTROCKJMD','XFUND']);
  const num = v => v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const fmtPct = v => num(v) == null ? 'N/A' : `${Number(v).toFixed(1)}%`;
  const fmtX = v => num(v) == null ? 'N/A' : `${Number(v).toFixed(1)}×`;
  const fmtPerShare = (v,c='JMD') => num(v)==null?'N/A':`${c==='TTD'?'TT$':c==='USD'?'US$':'J$'}${Number(v).toFixed(2)}`;
  const fmtCash = (v,c='JMD',absolute=false) => {
    v=num(v); if(v==null)return 'N/A';
    const raw=absolute?Math.abs(v):v,a=Math.abs(raw),p=c==='TTD'?'TT$':c==='USD'?'US$':'J$';
    const body=a>=1e9?`${(a/1e9).toFixed(2)}B`:a>=1e6?`${(a/1e6).toFixed(1)}M`:a>=1e3?`${(a/1e3).toFixed(1)}K`:a.toFixed(0);
    return `${!absolute&&raw<0?'-':''}${p}${body}`;
  };
  const isProperty=s=>PROPERTY.has(String(s.ticker||'').toUpperCase())||/property|real estate|reit/i.test(String(s.sector||''));

  function ensureStyles() {
    if (document.getElementById('freshCapitalExtraMetricsStyles')) return;
    const st = document.createElement('style');
    st.id = 'freshCapitalExtraMetricsStyles';
    st.textContent = `
      .fresh-extra-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:6px}
      .fresh-extra-metrics span{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);min-width:0}
      .fresh-extra-metrics small{font-size:.55rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .fresh-extra-metrics strong{font-size:.68rem}
      .fresh-extra-metrics .positive,.fresh-heavy-metrics .positive{color:#86efac}.fresh-extra-metrics .negative,.fresh-heavy-metrics .negative{color:#fca5a5}.fresh-extra-metrics .amber,.fresh-heavy-metrics .amber{color:#fcd34d}
      .fresh-heavy-metrics{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:7px;padding:7px 9px;border-left:2px solid var(--accent);border-radius:7px;background:color-mix(in srgb,var(--surface2) 82%,transparent);font-size:.58rem;color:var(--muted)}
      .fresh-heavy-metrics b{color:var(--text);font-weight:800}
      .fresh-heavy-label{width:100%;font-size:.52rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
      @media(max-width:720px){.fresh-extra-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.fresh-heavy-metrics{gap:5px 10px}}
    `;
    document.head.appendChild(st);
  }

  function clsGrowth(v) { v=num(v); if(v==null)return ''; return v>=10?'positive':v<0?'negative':''; }
  function clsPayout(v) { v=num(v); if(v==null)return ''; return v>100?'negative':v>80?'amber':v>=20&&v<=70?'positive':''; }
  function clsRoe(v) { v=num(v); if(v==null)return ''; return v>=15?'positive':v<5?'negative':''; }
  function clsDebt(v) { v=num(v); if(v==null)return ''; return v<0?'amber':'positive'; }
  function clsCover(v) { v=num(v); if(v==null)return ''; return v<2?'amber':v>=3?'positive':''; }

  function decorate() {
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card => {
      const ticker = card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase();
      const s = byTicker.get(ticker); if (!s) return;
      const property=isProperty(s);
      let extra = card.querySelector('.fresh-extra-metrics');
      if (!extra) { extra=document.createElement('div');extra.className='fresh-extra-metrics';card.querySelector('.fresh-metrics')?.insertAdjacentElement('afterend',extra); }
      const roe=num(s.roe),eps=num(s.epsGrowth),payout=num(s.payoutRatio),rev=num(s.revenueGrowth);
      const propertyGrowth=num(s.ffoGrowth)??num(s.affoGrowth);
      const propertyCoverage=num(s.affoPayoutRatio)??num(s.ffoPayoutRatio);
      const growthLabel=property&&propertyGrowth!=null?(num(s.ffoGrowth)!=null?'FFO Growth':'AFFO Growth'):'EPS Growth';
      const growthValue=property&&propertyGrowth!=null?propertyGrowth:eps;
      const payoutLabel=property&&propertyCoverage!=null?(num(s.affoPayoutRatio)!=null?'AFFO Payout':'FFO Payout'):'Payout Ratio';
      const payoutValue=property&&propertyCoverage!=null?propertyCoverage:payout;
      extra.innerHTML=`
        <span><small>ROE</small><strong class="${clsRoe(roe)}">${fmtPct(roe)}</strong></span>
        <span><small>${growthLabel}</small><strong class="${clsGrowth(growthValue)}">${fmtPct(growthValue)}</strong></span>
        <span><small>${payoutLabel}</small><strong class="${clsPayout(payoutValue)}">${fmtPct(payoutValue)}</strong></span>
        <span><small>Revenue Growth</small><strong class="${clsGrowth(rev)}">${fmtPct(rev)}</strong></span>`;

      let heavy=card.querySelector('.fresh-heavy-metrics');
      if(!heavy){heavy=document.createElement('div');heavy.className='fresh-heavy-metrics';extra.insertAdjacentElement('afterend',heavy);}
      const currency=s.ffoCurrency||s.cashFlowCurrency||s.statisticsCurrency||'JMD';
      if(property){
        const debt=num(s.netCash),cover=num(s.interestCoverage);
        heavy.innerHTML=`<span class="fresh-heavy-label">Property cash & leverage</span>
          <span>FFO/share <b>${fmtPerShare(s.ffoPerShare,currency)}</b></span>
          <span>FCF/share <b>${fmtPerShare(s.freeCashFlowPerShare,s.cashFlowCurrency||currency)}</b></span>
          <span>${debt!=null&&debt<0?'Net debt':'Net cash'} <b class="${clsDebt(debt)}">${fmtCash(debt,s.statisticsCurrency||'JMD',debt!=null&&debt<0)}</b></span>
          <span>Interest cover <b class="${clsCover(cover)}">${fmtX(cover)}</b></span>`;
      }else{
        const debt=num(s.netCash);
        heavy.innerHTML=`<span class="fresh-heavy-label">Cash & coverage</span>
          <span>FCF/share <b>${fmtPerShare(s.freeCashFlowPerShare,s.cashFlowCurrency||'JMD')}</b></span>
          <span>FCF payout <b class="${clsPayout(s.fcfPayoutRatio)}">${fmtPct(s.fcfPayoutRatio)}</b></span>
          <span>${debt!=null&&debt<0?'Net debt':'Net cash'} <b class="${clsDebt(debt)}">${fmtCash(debt,s.statisticsCurrency||'JMD',debt!=null&&debt<0)}</b></span>
          <span>Interest cover <b class="${clsCover(s.interestCoverage)}">${fmtX(s.interestCoverage)}</b></span>`;
      }
    });
  }

  ensureStyles();
  let timer; const run=()=>{clearTimeout(timer);timer=setTimeout(decorate,80)};
  const rank=document.getElementById('rankingList'); if(rank)new MutationObserver(run).observe(rank,{childList:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective]'))run();});
  run();
})();