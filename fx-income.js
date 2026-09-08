(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;

  // Indicative FX-to-JMD rates. Original dividend currency is always preserved.
  // Update rates/date/source during the daily collector refresh when automated FX is added.
  const FX = DATA.fxRates || {
    base: 'JMD',
    asOf: '2026-09-07',
    source: 'Indicative market FX',
    rates: { JMD: 1, TTD: 23.42, BBD: 79.28, USD: 158.50 }
  };
  const rates = FX.rates || FX;
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker || '').toUpperCase(), s]));
  const prefix = c => ({JMD:'J$',TTD:'TT$',BBD:'Bds$',USD:'US$'}[String(c||'JMD').toUpperCase()] || `${c} `);
  const money = (v,c='JMD',d=2) => Number.isFinite(Number(v)) ? `${prefix(c)}${Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}` : 'N/A';
  const rate = c => Number(rates[String(c||'JMD').toUpperCase()]);
  const toJmd = (v,c) => Number.isFinite(Number(v)) && Number.isFinite(rate(c)) ? Number(v)*rate(c) : null;
  const currency = s => String(s?.latestDividendCurrency || s?.currentAnnualDpsCurrency || s?.ttmDpsCurrency || 'JMD').toUpperCase();

  function styles(){
    if(document.getElementById('fxIncomeStyles')) return;
    const st=document.createElement('style'); st.id='fxIncomeStyles';
    st.textContent=`.fx-jmd-equivalent{display:block;margin-top:3px;font-size:.58rem;color:var(--muted)}.fx-jmd-equivalent strong{color:var(--text);font-size:.64rem}.fx-income-note{margin-top:8px;padding:7px 9px;border:1px solid var(--border);border-radius:9px;color:var(--muted);font-size:.57rem;line-height:1.4}`;
    document.head.appendChild(st);
  }

  function ticker(row){return row.querySelector('.income-stock strong')?.textContent?.trim().toUpperCase()||'';}

  function decorateRows(){
    document.querySelectorAll('#incomeComparisonList .income-row').forEach(row=>{
      const s=byTicker.get(ticker(row)); if(!s) return;
      const cur=currency(s), r=rate(cur);
      if(cur==='JMD'||!Number.isFinite(r)) return;
      const dps=Number(s.currentAnnualDps ?? s.ttmDps);
      const shares=Number(row.querySelector('[data-shares-ticker]')?.value||0);
      const formula=row.querySelector('.income-formula');
      if(formula && !formula.querySelector('.fx-jmd-equivalent') && Number.isFinite(dps)){
        const jdps=toJmd(dps,cur), jincome=shares>0?shares*jdps:null;
        formula.insertAdjacentHTML('beforeend',`<span class="fx-jmd-equivalent">JMD equivalent: <strong>${money(jdps,'JMD',2)}/share${jincome!=null?` • ${money(jincome,'JMD',0)}/yr`:''}</strong> • 1 ${cur} = ${money(r,'JMD',2)}</span>`);
      }
      const estimator=row.querySelector('.latest-dividend-estimator');
      if(estimator){
        const input=estimator.querySelector('[data-latest-dividend-input]');
        const v=Number(input?.value);
        const sharesNow=Number(row.querySelector('[data-shares-ticker]')?.value||0);
        const payout=Number.isFinite(v)&&sharesNow>0?toJmd(v*sharesNow,cur):null;
        let fx=estimator.querySelector('.fx-jmd-equivalent');
        if(!fx){fx=document.createElement('span');fx.className='fx-jmd-equivalent';estimator.querySelector('.latest-dividend-payout')?.appendChild(fx);}
        if(fx) fx.innerHTML=payout==null?'':`JMD equivalent: <strong>${money(payout,'JMD',2)}</strong>`;
      }
    });
    const panel=document.querySelector('.income-vs-savings-panel');
    if(panel && !panel.querySelector('.fx-income-note')) panel.insertAdjacentHTML('beforeend',`<div class="fx-income-note">Cross-currency dividends keep their declared currency. JMD equivalents are for comparison only • FX ${FX.asOf||'current'} • ${FX.source||'FX source'}.</div>`);
  }

  styles();
  const run=()=>setTimeout(decorateRows,80);
  document.addEventListener('input',e=>{if(e.target.closest?.('[data-shares-ticker],[data-latest-dividend-input]'))run();});
  document.addEventListener('change',e=>{if(e.target.closest?.('[data-shares-ticker],[data-latest-dividend-input],.income-mode-btn'))run();});
  const list=document.getElementById('incomeComparisonList'); if(list)new MutationObserver(run).observe(list,{childList:true});
  window.JSE_FX={rates,toJmd,asOf:FX.asOf,source:FX.source};
  run();
})();