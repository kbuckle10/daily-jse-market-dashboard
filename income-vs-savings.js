(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;

  const STORAGE_KEY = 'dailyJseTrackedTickersV2';
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 2) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : Number(v).toFixed(d);
  const money = v => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `J$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  function trackedStocks() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}
    const set = new Set((Array.isArray(saved) ? saved : []).map(x => String(x).toUpperCase()));
    return DATA.stocks.filter(s => set.has(String(s.ticker).toUpperCase()));
  }

  function ratingNote(s) {
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
      .sort((a, b) => Number(b.trailingYield) - Number(a.trailingYield));

    if (!rows.length) {
      list.innerHTML = '<p class="neutral income-empty">Add tracked stocks with a valid trailing dividend yield to compare income.</p>';
      $('incomeLeader').textContent = 'No eligible tracked stocks yet';
      return;
    }

    const leader = rows[0];
    const leaderIncome = investment * Number(leader.trailingYield) / 100;
    $('incomeLeader').textContent = `${leader.ticker}: ${fmt(leader.trailingYield, 2)}% yield • ${money(leaderIncome)}/yr`;

    list.innerHTML = rows.map(s => {
      const y = Number(s.trailingYield);
      const stockIncome = investment * y / 100;
      const premium = y - savingsRate;
      const multiple = savingsRate > 0 ? y / savingsRate : null;
      const note = ratingNote(s);
      return `<article class="income-row">
        <div class="income-stock">
          <div><strong>${s.ticker}</strong><small>${s.company || ''}</small></div>
          <span class="rating ${s.ratingClass || 'hold'}">${s.rating || 'N/A'}</span>
        </div>
        <div class="income-metrics">
          <div><small>Dividend yield</small><strong>${fmt(y, 2)}%</strong></div>
          <div><small>Yield premium</small><strong class="${premium >= 0 ? 'positive' : 'negative'}">${premium >= 0 ? '+' : ''}${fmt(premium, 2)} pp</strong></div>
          <div><small>Vs savings</small><strong>${multiple == null ? '∞' : fmt(multiple, 1) + '×'}</strong></div>
          <div><small>Stock income / yr</small><strong>${money(stockIncome)}</strong></div>
          <div><small>Savings income / yr</small><strong>${money(savingsIncome)}</strong></div>
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
      if (e.target.closest('[data-ticker], #resetTrackedBtn')) setTimeout(render, 40);
    });
    render();
  }

  window.addEventListener('load', init);
})();
