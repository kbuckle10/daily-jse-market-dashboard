(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker || '').toUpperCase(), s]));
  const PROPERTY = new Set(['SML','KPREIT','CPFV','138SL','SRFJMD','FIRSTROCKJMD','XFUND']);
  const num = v => v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const fmtPct = v => num(v) == null ? 'N/A' : `${Number(v).toFixed(1)}%`;
  const fmtX = v => num(v) == null ? 'N/A' : `${Number(v).toFixed(1)}×`;
  const sym = c => c==='TTD'?'TT$':c==='USD'?'US$':c==='BBD'?'BDS$':'J$';
  const fmtPerShare = (v,c='JMD') => num(v)==null?'N/A':`${sym(c)}${Number(v).toFixed(2)}`;
  const fmtCash = (v,c='JMD',absolute=false) => {
    v=num(v); if(v==null)return 'N/A';
    const raw=absolute?Math.abs(v):v,a=Math.abs(raw),p=sym(c);
    const body=a>=1e9?`${(a/1e9).toFixed(2)}B`:a>=1e6?`${(a/1e6).toFixed(1)}M`:a>=1e3?`${(a/1e3).toFixed(1)}K`:a.toFixed(0);
    return `${!absolute&&raw<0?'-':''}${p}${body}`;
  };
  const isProperty=s=>PROPERTY.has(String(s.ticker||'').toUpperCase())||/property|real estate|reit/i.test(String(s.sector||''));
  const annualDps=s=>num(s.currentAnnualDps)??num(s.ttmDps);
  function ffoPerShareInfo(s){
    const direct=num(s.ffoPerShare);if(direct!=null)return{value:direct,derived:s.ffoPerShareMethod==='derived-from-annual-dps-and-ffo-payout'};
    const dps=annualDps(s),p=num(s.ffoPayoutRatio);
    if(dps!=null&&dps>0&&p!=null&&p>0)return{value:dps/(p/100),derived:true};
    return{value:null,derived:false};
  }

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
      .fresh-derived{font-size:.48rem;color:var(--muted);font-weight:700}
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
      const propertyGrowth=num(s.affoGrowth)??num(s.ffoGrowth)??num(s.rentalRevenueGrowth)??num(s.noiGrowth)??num(s.propertyIncomeGrowth)??num(s.revenueGrowth);
      const propertyGrowthLabel=num(s.affoGrowth)!=null?'AFFO Growth':num(s.ffoGrowth)!=null?'FFO Growth':num(s.rentalRevenueGrowth)!=null?'Rental Growth':num(s.noiGrowth)!=null?'NOI Growth':num(s.propertyIncomeGrowth)!=null?'Property Income Growth':'Revenue Growth';
      const propertyCoverage=num(s.affoPayoutRatio)??num(s.ffoPayoutRatio)??num(s.fcfPayoutRatio)??num(s.payoutRatio);
      const propertyCoverageLabel=num(s.affoPayoutRatio)!=null?'AFFO Payout':num(s.ffoPayoutRatio)!=null?'FFO Payout':num(s.fcfPayoutRatio)!=null?'FCF Payout':'Payout Ratio';
      const growthLabel=property?propertyGrowthLabel:'EPS Growth';
      const growthValue=property?propertyGrowth:eps;
      const payoutLabel=property?propertyCoverageLabel:'Payout Ratio';
      const payoutValue=property?propertyCoverage:payout;
      extra.innerHTML=`
        <span><small>ROE</small><strong class="${clsRoe(roe)}">${fmtPct(roe)}</strong></span>
        <span><small>${growthLabel}</small><strong class="${clsGrowth(growthValue)}">${fmtPct(growthValue)}</strong></span>
        <span><small>${payoutLabel}</small><strong class="${clsPayout(payoutValue)}">${fmtPct(payoutValue)}</strong></span>
        <span><small>Revenue Growth</small><strong class="${clsGrowth(rev)}">${fmtPct(rev)}</strong></span>`;

      let heavy=card.querySelector('.fresh-heavy-metrics');
      if(!heavy){heavy=document.createElement('div');heavy.className='fresh-heavy-metrics';extra.insertAdjacentElement('afterend',heavy);}
      const currency=s.ffoCurrency||s.cashFlowCurrency||s.statisticsCurrency||'JMD';
      if(property){
        const debt=num(s.netCash),cover=num(s.interestCoverage),ffops=ffoPerShareInfo(s);
        const ffoShare=ffops.value!=null?`<span title="${ffops.derived?'Derived as annual DPS ÷ FFO payout ratio':'Reported/collected FFO per share'}">FFO/share${ffops.derived?' <em class="fresh-derived">derived</em>':''} <b>${fmtPerShare(ffops.value,currency)}</b></span>`:'';
        const fcfShare=num(s.freeCashFlowPerShare)!=null?`<span>FCF/share <b>${fmtPerShare(s.freeCashFlowPerShare,s.cashFlowCurrency||currency)}</b></span>`:'';
        const debtHtml=debt!=null?`<span>${debt<0?'Net debt':'Net cash'} <b class="${clsDebt(debt)}">${fmtCash(debt,s.statisticsCurrency||'JMD',debt<0)}</b></span>`:'';
        const coverHtml=cover!=null?`<span>Interest cover <b class="${clsCover(cover)}">${fmtX(cover)}</b></span>`:'';
        heavy.innerHTML=`<span class="fresh-heavy-label">Property cash & leverage</span>${ffoShare}${fcfShare}${debtHtml}${coverHtml}`;
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
  document.addEventListener('jse:framework-updated',run);
  run();
})();
