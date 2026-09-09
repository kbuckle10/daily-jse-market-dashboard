(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker || '').toUpperCase(), s]));
  const num = v => v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const fmtPct = v => num(v) == null ? 'N/A' : `${Number(v).toFixed(1)}%`;

  function ensureStyles() {
    if (document.getElementById('freshCapitalExtraMetricsStyles')) return;
    const st = document.createElement('style');
    st.id = 'freshCapitalExtraMetricsStyles';
    st.textContent = `
      .fresh-extra-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:6px}
      .fresh-extra-metrics span{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);min-width:0}
      .fresh-extra-metrics small{font-size:.55rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .fresh-extra-metrics strong{font-size:.68rem}
      .fresh-extra-metrics .positive{color:#86efac}.fresh-extra-metrics .negative{color:#fca5a5}.fresh-extra-metrics .amber{color:#fcd34d}
      @media(max-width:720px){.fresh-extra-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(st);
  }

  function clsGrowth(v) {
    v = num(v); if (v == null) return '';
    if (v >= 10) return 'positive';
    if (v < 0) return 'negative';
    return '';
  }
  function clsPayout(v) {
    v = num(v); if (v == null) return '';
    if (v > 100) return 'negative';
    if (v > 80) return 'amber';
    if (v >= 20 && v <= 70) return 'positive';
    return '';
  }
  function clsRoe(v) {
    v = num(v); if (v == null) return '';
    if (v >= 15) return 'positive';
    if (v < 5) return 'negative';
    return '';
  }

  function decorate() {
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card => {
      const ticker = card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase();
      const s = byTicker.get(ticker);
      if (!s) return;
      let extra = card.querySelector('.fresh-extra-metrics');
      if (!extra) {
        extra = document.createElement('div');
        extra.className = 'fresh-extra-metrics';
        const firstMetrics = card.querySelector('.fresh-metrics');
        firstMetrics?.insertAdjacentElement('afterend', extra);
      }
      const roe = num(s.roe), eps = num(s.epsGrowth), payout = num(s.payoutRatio), rev = num(s.revenueGrowth);
      extra.innerHTML = `
        <span><small>ROE</small><strong class="${clsRoe(roe)}">${fmtPct(roe)}</strong></span>
        <span><small>EPS Growth</small><strong class="${clsGrowth(eps)}">${fmtPct(eps)}</strong></span>
        <span><small>Payout Ratio</small><strong class="${clsPayout(payout)}">${fmtPct(payout)}</strong></span>
        <span><small>Revenue Growth</small><strong class="${clsGrowth(rev)}">${fmtPct(rev)}</strong></span>`;
    });
  }

  ensureStyles();
  let timer;
  const run = () => { clearTimeout(timer); timer = setTimeout(decorate, 80); };
  const rank = document.getElementById('rankingList');
  if (rank) new MutationObserver(run).observe(rank, { childList: true });
  document.addEventListener('click', e => { if (e.target.closest?.('[data-fresh-objective]')) run(); });
  run();
})();