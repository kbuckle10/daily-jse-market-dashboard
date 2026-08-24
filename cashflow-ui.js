(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;
  const byTicker = new Map(DATA.stocks.map(s => [s.ticker, s]));

  const HELP = {
    payout: 'Dividend payout ratio = dividends ÷ earnings. It shows how much of profit is being distributed. Lower can mean more room for reinvestment; very high ratios can reduce dividend safety, although company policy matters.',
    fcf: 'Free cash flow (FCF) is cash generated after operating needs and capital spending. Positive recurring FCF gives a company more flexibility for dividends, debt reduction, acquisitions and expansion. Conventional FCF is less useful for banks and some financial institutions.',
    fcfPayout: 'FCF payout ratio compares annual dividend per share with free cash flow per share. Lower generally means the dividend is better covered by cash generation; above 100% means the dividend exceeds current FCF per share.',
    cash: 'Cash & equivalents is liquid cash available on the balance sheet. A strong cash position can support resilience, investment, acquisitions and dividends, but excess idle cash can also reduce returns if management does not deploy it well.'
  };

  function currencyPrefix(code) {
    return code === 'TTD' ? 'TT$' : code === 'USD' ? 'US$' : 'J$';
  }
  function compactMoney(v, currency = 'JMD') {
    if (v == null || !Number.isFinite(Number(v))) return 'N/A';
    const n = Number(v), a = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    let value = a, suffix = '';
    if (a >= 1e12) { value = a / 1e12; suffix = 'T'; }
    else if (a >= 1e9) { value = a / 1e9; suffix = 'B'; }
    else if (a >= 1e6) { value = a / 1e6; suffix = 'M'; }
    else if (a >= 1e3) { value = a / 1e3; suffix = 'K'; }
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${sign}${currencyPrefix(currency)}${value.toFixed(digits)}${suffix}`;
  }
  function pct(v) { return v == null || !Number.isFinite(Number(v)) ? 'N/A' : `${Number(v).toFixed(1)}%`; }
  function isFinancial(s) { return /bank|financial|insurance|investment|securit/i.test(String(s.sector || '')); }
  function toneForPayout(v) {
    if (v == null) return '';
    if (v > 100) return 'negative';
    if (v > 75) return 'amber';
    return 'positive';
  }
  function toneForFcf(v) { return v == null ? '' : Number(v) > 0 ? 'positive' : Number(v) < 0 ? 'negative' : ''; }
  function toneForFcfPayout(v) {
    if (v == null) return '';
    if (v > 100) return 'negative';
    if (v > 75) return 'amber';
    return 'positive';
  }
  function help(label, key) {
    return `<span class="cash-metric-label">${label}<button type="button" class="expert-help" aria-label="Explain ${label}" data-tooltip="${HELP[key]}">?</button></span>`;
  }
  function stripHtml(s) {
    const financial = isFinancial(s);
    const items = [];
    if (s.payoutRatio != null) {
      items.push(`<div class="cash-health-item">${help('Payout','payout')}<strong class="${toneForPayout(Number(s.payoutRatio))}">${pct(s.payoutRatio)}</strong></div>`);
    }
    if (!financial && s.freeCashFlow != null) {
      items.push(`<div class="cash-health-item">${help('Free cash flow','fcf')}<strong class="${toneForFcf(Number(s.freeCashFlow))}">${compactMoney(s.freeCashFlow, s.cashFlowCurrency)}</strong></div>`);
    }
    if (!financial && s.fcfPayoutRatio != null) {
      items.push(`<div class="cash-health-item">${help('FCF payout','fcfPayout')}<strong class="${toneForFcfPayout(Number(s.fcfPayoutRatio))}">${pct(s.fcfPayoutRatio)}</strong></div>`);
    }
    if (s.cashAndEquivalents != null) {
      items.push(`<div class="cash-health-item">${help('Cash','cash')}<strong>${compactMoney(s.cashAndEquivalents, s.cashFlowCurrency)}</strong></div>`);
    }
    if (!items.length) return '';
    const note = financial ? '<small class="cash-sector-note">FCF not emphasized for financial institutions</small>' : '';
    return `<div class="cash-health-strip">${items.join('')}${note}</div>`;
  }

  function decorateStockCards() {
    document.querySelectorAll('.stock-card').forEach(card => {
      const ticker = card.querySelector('h3')?.textContent?.trim();
      const s = byTicker.get(ticker);
      if (!s) return;
      card.querySelector('.cash-health-strip')?.remove();
      const html = stripHtml(s);
      if (!html) return;
      const badges = card.querySelector('.investor-badges');
      if (badges) badges.insertAdjacentHTML('afterend', html);
      else card.querySelector('.company')?.insertAdjacentHTML('afterend', html);
    });
  }
  function decorateFreshCapital() {
    document.querySelectorAll('.fresh-card').forEach(card => {
      const ticker = card.querySelector('.fresh-title strong')?.textContent?.trim();
      const s = byTicker.get(ticker);
      if (!s) return;
      card.querySelector('.cash-health-strip')?.remove();
      const html = stripHtml(s);
      if (!html) return;
      const badges = card.querySelector('.investor-badges');
      if (badges) badges.insertAdjacentHTML('afterend', html);
    });
  }
  function enhanceFramework() {
    document.querySelectorAll('.score-driver').forEach(driver => {
      const title = driver.querySelector('.score-driver-head strong')?.textContent?.trim();
      const metrics = driver.querySelector('.score-driver-metrics');
      if (!metrics) return;
      if (title === 'Financial strength') {
        if (![...metrics.children].some(x => x.textContent === 'Free cash flow')) metrics.insertAdjacentHTML('beforeend','<span>Free cash flow</span><span>Cash & equivalents</span>');
      }
      if (title === 'Dividend') {
        if (![...metrics.children].some(x => x.textContent === 'FCF payout')) metrics.insertAdjacentHTML('beforeend','<span>FCF payout</span>');
      }
    });
  }
  function ensureStyles() {
    if (document.getElementById('cashflowUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'cashflowUiStyles';
    style.textContent = `
      .cash-health-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:7px;margin:10px 0 2px;padding:9px;border:1px solid var(--border);background:var(--surface2);border-radius:12px}
      .cash-health-item{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border:1px solid var(--border);background:var(--surface);border-radius:9px}
      .cash-health-item strong{font-size:.68rem;white-space:nowrap}
      .cash-metric-label{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:.57rem;font-weight:700;min-width:0}
      .cash-metric-label .expert-help{width:14px;height:14px;min-width:14px;font-size:.48rem}
      .cash-sector-note{grid-column:1/-1;color:var(--muted);font-size:.56rem;line-height:1.3;padding:1px 2px}
      .cash-health-strip .positive{color:var(--green)}.cash-health-strip .amber{color:var(--yellow)}.cash-health-strip .negative{color:var(--red)}
      @media(max-width:720px){.cash-health-strip{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}.cash-health-item{padding:6px}.cash-health-item strong{font-size:.65rem}.cash-metric-label{font-size:.54rem}}
      @media(max-width:410px){.cash-health-strip{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;
  function apply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateStockCards();
      decorateFreshCapital();
      enhanceFramework();
    });
  }

  ensureStyles();
  apply();
  window.addEventListener('load', apply);
  window.addEventListener('storage', apply);
  new MutationObserver(muts => {
    if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) apply();
  }).observe(document.querySelector('main') || document.body, { childList:true, subtree:true });
})();
