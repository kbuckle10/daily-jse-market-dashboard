(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;

  const STORAGE_KEY = 'dailyJseTrackedTickersV2';
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 2) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : Number(v).toFixed(d);
  const money = v => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `J$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const parseDate = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.valueOf()) ? null : d; };
  const dividendAgeMonths = s => { const d = parseDate(s.payDate); if (!d) return null; return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44); };
  const dividendRecency = s => { const m = dividendAgeMonths(s); if (m == null) return 'unknown'; if (m > 18) return 'stale'; if (m > 12) return 'aging'; return 'current'; };
  const tip = (label, text) => `<span class="metric-label">${label}<button type="button" class="metric-help" aria-label="Explain ${label}" data-tooltip="${text.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}">?</button></span>`;

  function trackedStocks() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}
    const set = new Set((Array.isArray(saved) ? saved : []).map(x => String(x).toUpperCase()));
    return DATA.stocks.filter(s => set.has(String(s.ticker).toUpperCase()));
  }

  function ratingNote(s) {
    const recency = dividendRecency(s);
    if (recency === 'stale') return { cls: 'negative', text: `Stale dividend history • last payment ${s.payDate || 'unknown'} • do not treat trailing yield as current income` };
    if (recency === 'aging') return { cls: 'amber', text: `Dividend recency warning • last payment ${s.payDate || 'unknown'} • verify a new declaration before relying on income` };
    if (s.ratingClass === 'buy') return { cls: 'positive', text: 'Buy-class • eligible for model new money' };
    if (s.ratingClass === 'avoid') return { cls: 'negative', text: 'Avoid • income does not override investment risk' };
    return { cls: 'amber', text: `${s.rating || 'Hold'} • income may appeal, but not model new-money eligible` };
  }

  function render() {
    const rateSlider = $('savingsRateSlider');
    const amountSlider = $('investmentAmountSlider');
    const list = $('incomeComparisonList');
    if (!rateSlider || !amountSlider || !list) return;

    const savingsRate = Number(rateSlider.value);
    const investment = Number(amountSlider.value);
    $('savingsRateValue').textContent = `${fmt(savingsRate, 2)}%`;
    $('investmentAmountValue').textContent = money(investment);

    const savingsIncome = investment * savingsRate / 100;
    $('savingsIncomeValue').textContent = money(savingsIncome);

    const rows = trackedStocks()
      .filter(s => s.trailingYield != null && Number.isFinite(Number(s.trailingYield)))
      .sort((a, b) => {
        const ar = dividendRecency(a) === 'current' ? 1 : 0;
        const br = dividendRecency(b) === 'current' ? 1 : 0;
        return br - ar || Number(b.trailingYield) - Number(a.trailingYield);
      });

    if (!rows.length) {
      list.innerHTML = '<p class="neutral income-empty">Add tracked stocks with a valid trailing dividend yield to compare income.</p>';
      $('incomeLeader').textContent = 'No eligible tracked stocks yet';
      return;
    }

    const leader = rows.find(s => dividendRecency(s) === 'current');
    if (leader) {
      const leaderIncome = investment * Number(leader.trailingYield) / 100;
      $('incomeLeader').textContent = `${leader.ticker}: ${fmt(leader.trailingYield, 2)}% current yield • ${money(leaderIncome)}/yr`;
    } else {
      $('incomeLeader').textContent = 'No tracked stock has a recent dividend payment';
    }

    list.innerHTML = rows.map(s => {
      const y = Number(s.trailingYield);
      const recency = dividendRecency(s);
      const stale = recency === 'stale';
      const stockIncome = stale ? null : investment * y / 100;
      const premium = y - savingsRate;
      const multiple = savingsRate > 0 ? y / savingsRate : null;
      const note = ratingNote(s);
      const yieldLabel = stale ? 'Historical trailing yield' : 'Dividend yield';
      return `<article class="income-row ${stale ? 'income-stale' : ''}">
        <div class="income-stock">
          <div><strong>${s.ticker}</strong><small>${s.company || ''}</small></div>
          <span class="rating ${s.ratingClass || 'hold'}">${s.rating || 'N/A'}</span>
        </div>
        <div class="income-metrics">
          <div>${tip(yieldLabel, stale ? 'Historical annual dividends divided by the current share price. The last payment is stale, so do not treat this as expected current income.' : 'Trailing annual dividends per share divided by the current share price. It is a cash-income yield, not a guaranteed interest rate.')}<strong class="${stale ? 'negative' : ''}">${fmt(y, 2)}%</strong></div>
          <div>${tip('Yield premium', 'Dividend yield minus the bank savings rate selected above. pp means percentage points. Example: 13.46% dividend yield − 0.25% savings = +13.21 pp.')}<strong class="${stale ? 'neutral' : premium >= 0 ? 'positive' : 'negative'}">${stale ? 'Historical' : `${premium >= 0 ? '+' : ''}${fmt(premium, 2)} pp`}</strong></div>
          <div>${tip('Vs savings', 'Dividend yield divided by the selected bank savings rate. Example: 5.00% ÷ 0.25% = 20× the gross income yield.')}<strong>${stale ? 'Historical' : (multiple == null ? '∞' : fmt(multiple, 1) + '×')}</strong></div>
          <div>${tip('Stock income / yr', 'Selected investment amount multiplied by the stock dividend yield. This is an estimate based on trailing dividends and is not guaranteed.')}<strong>${stale ? 'Not current' : money(stockIncome)}</strong></div>
          <div>${tip('Last dividend pay', 'Most recent dividend payment date in the collected data. More than 12 months triggers a warning; more than 18 months is treated as stale for income projections.')}<strong class="${stale ? 'negative' : recency === 'aging' ? 'amber' : ''}">${s.payDate || 'N/A'}</strong></div>
          <div>${tip('Savings income / yr', 'Selected investment amount multiplied by the bank savings rate selected above. This is a gross comparison before applicable taxes or fees.')}<strong>${money(savingsIncome)}</strong></div>
        </div>
        <p class="income-rating-note ${note.cls}">${note.text}</p>
      </article>`;
    }).join('');
  }

  function init() {
    const rateSlider = $('savingsRateSlider');
    const amountSlider = $('investmentAmountSlider');
    if (!rateSlider || !amountSlider) return;
    rateSlider.addEventListener('input', render);
    amountSlider.addEventListener('input', render);
    window.addEventListener('storage', render);
    document.body.addEventListener('click', e => {
      const help = e.target.closest('.metric-help');
      if (help) {
        e.preventDefault();
        const wasOpen = help.classList.contains('open');
        document.querySelectorAll('.metric-help.open').forEach(x => x.classList.remove('open'));
        if (!wasOpen) help.classList.add('open');
        return;
      }
      if (!e.target.closest('.metric-help')) document.querySelectorAll('.metric-help.open').forEach(x => x.classList.remove('open'));
      if (e.target.closest('[data-ticker], #resetTrackedBtn')) setTimeout(render, 40);
    });
    render();
  }

  window.addEventListener('load', init);
})();
