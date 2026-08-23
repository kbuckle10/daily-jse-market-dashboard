(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker).toUpperCase(), s]));
  const parseDate = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.valueOf()) ? null : d; };
  const ageMonths = s => { const d = parseDate(s.payDate); if (!d) return null; return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44); };
  const recency = s => { const m = ageMonths(s); if (m == null) return 'unknown'; if (m > 18) return 'stale'; if (m > 12) return 'aging'; return 'current'; };
  const label = s => {
    const r = recency(s);
    if (r === 'stale') return { cls: 'div-recency stale', text: `Dividend inactive / stale • last pay ${s.payDate || 'N/A'}` };
    if (r === 'aging') return { cls: 'div-recency aging', text: `Dividend recency warning • last pay ${s.payDate || 'N/A'}` };
    if (r === 'current') return { cls: 'div-recency current', text: `Last dividend pay ${s.payDate || 'N/A'}` };
    return { cls: 'div-recency unknown', text: 'Last dividend pay N/A' };
  };

  function addCardRecency() {
    document.querySelectorAll('.stock-card').forEach(card => {
      const ticker = card.querySelector('h3')?.textContent?.trim().toUpperCase();
      const s = byTicker.get(ticker);
      if (!s || card.querySelector('.dividend-recency-row')) return;
      const latestRow = [...card.querySelectorAll('.metric-row')].find(r => r.textContent.includes('Latest dividend'));
      const target = latestRow || card.querySelector('.metric-row');
      if (!target) return;
      const l = label(s);
      target.insertAdjacentHTML('afterend', `<div class="metric-row dividend-recency-row"><span>Last dividend pay</span><strong class="${l.cls}">${s.payDate || 'N/A'}${recency(s)==='stale'?' • STALE':''}</strong></div>`);
      if (recency(s) === 'stale') {
        target.insertAdjacentHTML('afterend', `<div class="dividend-stale-note">Historical yield may overstate current income: no recent dividend payment detected.</div>`);
      }
    });
  }

  function addFreshCapitalRecency() {
    document.querySelectorAll('.fresh-card').forEach(card => {
      const ticker = card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase();
      const s = byTicker.get(ticker);
      if (!s || card.querySelector('.fresh-dividend-recency')) return;
      const l = label(s);
      const footer = card.querySelector('.fresh-secondary') || card.querySelector('.fresh-footer');
      if (!footer) return;
      footer.insertAdjacentHTML('beforebegin', `<div class="fresh-dividend-recency ${l.cls}">${l.text}${recency(s)==='stale'?' • income thesis weakened':''}</div>`);
    });
  }

  function apply() { addCardRecency(); addFreshCapitalRecency(); }
  window.addEventListener('load', apply);
  window.addEventListener('storage', apply);
  document.addEventListener('click', () => setTimeout(apply, 40));
  const root = document.querySelector('main') || document.body;
  new MutationObserver(() => apply()).observe(root, { childList: true, subtree: true });
})();
