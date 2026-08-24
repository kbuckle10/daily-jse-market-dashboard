(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;

  const STORAGE_KEY = 'dailyJseTrackedTickersV2';
  const HOLDINGS_KEY = 'dailyJseShareHoldingsV1';
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 2) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : Number(v).toFixed(d);
  const money = v => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `J$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const curPrefix = c => c === 'TTD' ? 'TT$' : c === 'USD' ? 'US$' : 'J$';
  const curMoney = (v, c = 'JMD', d = 0) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `${curPrefix(c)}${Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  const parseDate = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.valueOf()) ? null : d; };
  const dividendAgeMonths = s => { const d = parseDate(s.payDate); if (!d) return null; return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44); };
  const dividendRecency = s => { const m = dividendAgeMonths(s); if (m == null) return 'unknown'; if (m > 18) return 'stale'; if (m > 12) return 'aging'; return 'current'; };
  const tip = (label, text) => `<span class="metric-label">${label}<button type="button" class="metric-help" aria-label="Explain ${label}" data-tooltip="${text.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}">?</button></span>`;
  let mode = 'investment';
  let holdings = {};

  try { holdings = JSON.parse(localStorage.getItem(HOLDINGS_KEY) || '{}') || {}; } catch { holdings = {}; }

  function trackedStocks() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}
    const set = new Set((Array.isArray(saved) ? saved : []).map(x => String(x).toUpperCase()));
    return DATA.stocks.filter(s => set.has(String(s.ticker).toUpperCase()));
  }

  function ratingNote(s) {
    const recency = dividendRecency(s);
    if (recency === 'stale') return { cls: 'negative', text: `Stale dividend history • last payment ${s.payDate || 'unknown'} • historical DPS is not treated as current income` };
    if (recency === 'aging') return { cls: 'amber', text: `Dividend recency warning • last payment ${s.payDate || 'unknown'} • verify a new declaration before relying on income` };
    if (s.ratingClass === 'buy') return { cls: 'positive', text: 'Buy-class • eligible for model new money' };
    if (s.ratingClass === 'avoid') return { cls: 'negative', text: 'Avoid • income does not override investment risk' };
    return { cls: 'amber', text: `${s.rating || 'Hold'} • income may appeal, but not model new-money eligible` };
  }

  function annualDps(s) {
    return s.ttmDps != null && Number.isFinite(Number(s.ttmDps)) ? Number(s.ttmDps) : null;
  }

  function impliedDps(s) {
    const eps = Number(s.eps), payout = Number(s.payoutRatio);
    if (!Number.isFinite(eps) || !Number.isFinite(payout) || payout < 0) return null;
    return eps * payout / 100;
  }

  function ensureModeControls() {
    const panel = document.querySelector('.income-vs-savings-panel');
    const controls = panel?.querySelector('.income-controls');
    if (!panel || !controls || panel.querySelector('.income-mode-switch')) return;
    controls.insertAdjacentHTML('beforebegin', `<div class="income-mode-switch" role="group" aria-label="Dividend income calculation mode"><button type="button" class="income-mode-btn active" data-income-mode="investment">Investment amount</button><button type="button" class="income-mode-btn" data-income-mode="shares">Shares owned</button></div><p class="income-mode-note" id="incomeModeNote">Investment mode estimates whole shares at the current JSE price, then calculates income as shares × trailing annual DPS.</p>`);
    const amountControl = $('investmentAmountSlider')?.closest('.income-control');
    if (amountControl) amountControl.dataset.investmentControl = 'true';
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
    const globalSavingsIncome = investment * savingsRate / 100;
    $('savingsIncomeValue').textContent = mode === 'investment' ? money(globalSavingsIncome) : 'Per stock below';
    const amountControl = document.querySelector('[data-investment-control="true"]');
    if (amountControl) amountControl.classList.toggle('income-control-hidden', mode === 'shares');
    document.querySelectorAll('.income-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.incomeMode === mode));
    const modeNote = $('incomeModeNote');
    if (modeNote) modeNote.textContent = mode === 'investment'
      ? 'Investment mode estimates whole shares at the current JSE price, then calculates income as shares × trailing annual DPS.'
      : 'Shares-owned mode uses your entered holdings directly. Bank savings income is compared against the current market value of those shares.';

    const rows = trackedStocks()
      .filter(s => annualDps(s) != null || (s.trailingYield != null && Number.isFinite(Number(s.trailingYield))))
      .sort((a, b) => {
        const ar = dividendRecency(a) === 'current' ? 1 : 0;
        const br = dividendRecency(b) === 'current' ? 1 : 0;
        return br - ar || Number(b.trailingYield || -1) - Number(a.trailingYield || -1);
      });

    if (!rows.length) {
      list.innerHTML = '<p class="neutral income-empty">Add tracked stocks with valid dividend data to compare income.</p>';
      $('incomeLeader').textContent = 'No eligible tracked stocks yet';
      return;
    }

    let leader = null;
    let leaderIncome = -Infinity;
    for (const s of rows) {
      if (dividendRecency(s) !== 'current') continue;
      const dps = annualDps(s);
      if (dps == null) continue;
      const shares = mode === 'shares' ? Number(holdings[s.ticker] || 0) : (Number(s.price) > 0 ? Math.floor(investment / Number(s.price)) : 0);
      const income = shares * dps;
      if (income > leaderIncome) { leaderIncome = income; leader = { s, shares, income }; }
    }
    $('incomeLeader').textContent = leader
      ? `${leader.s.ticker}: ${leader.shares.toLocaleString('en-US')} shares × ${curMoney(annualDps(leader.s), leader.s.ttmDpsCurrency || 'JMD', 2)} DPS = ${curMoney(leader.income, leader.s.ttmDpsCurrency || 'JMD')}/yr`
      : 'No tracked stock has a recent dividend payment with usable DPS';

    list.innerHTML = rows.map(s => {
      const dps = annualDps(s);
      const implied = impliedDps(s);
      const dpsCurrency = s.ttmDpsCurrency || 'JMD';
      const recency = dividendRecency(s);
      const stale = recency === 'stale';
      const price = Number(s.price);
      const shares = mode === 'shares' ? Math.max(0, Math.floor(Number(holdings[s.ticker] || 0))) : (Number.isFinite(price) && price > 0 ? Math.floor(investment / price) : 0);
      const marketValue = Number.isFinite(price) && price > 0 ? shares * price : null;
      const savingsPrincipal = mode === 'shares' ? marketValue : investment;
      const savingsIncome = savingsPrincipal == null ? null : savingsPrincipal * savingsRate / 100;
      const stockIncome = stale || dps == null ? null : shares * dps;
      const y = s.trailingYield != null && Number.isFinite(Number(s.trailingYield)) ? Number(s.trailingYield) : null;
      const premium = y == null ? null : y - savingsRate;
      const multiple = savingsRate > 0 && y != null ? y / savingsRate : null;
      const note = ratingNote(s);
      const currencyComparable = dpsCurrency === 'JMD';
      const impliedChange = dps != null && implied != null && dps !== 0 ? ((implied / dps) - 1) * 100 : null;
      const sharesInput = mode === 'shares'
        ? `<div class="shares-owned-control"><label for="shares-${s.ticker}">Shares owned</label><input id="shares-${s.ticker}" class="shares-owned-input" type="number" inputmode="numeric" min="0" step="1" value="${shares || ''}" placeholder="0" data-shares-ticker="${s.ticker}"></div>`
        : `<div class="shares-owned-summary"><small>Estimated shares</small><strong>${shares.toLocaleString('en-US')}</strong><span>${marketValue == null ? '' : `${money(marketValue)} at current price`}</span></div>`;
      return `<article class="income-row ${stale ? 'income-stale' : ''}">
        <div class="income-stock">
          <div><strong>${s.ticker}</strong><small>${s.company || ''}</small></div>
          <span class="rating ${s.ratingClass || 'hold'}">${s.rating || 'N/A'}</span>
        </div>
        ${sharesInput}
        <div class="income-formula">${shares.toLocaleString('en-US')} shares × ${dps == null ? 'DPS N/A' : curMoney(dps, dpsCurrency, 2)} = <strong>${stockIncome == null ? (stale ? 'Not current' : 'N/A') : curMoney(stockIncome, dpsCurrency)}</strong> / year</div>
        <div class="income-metrics">
          <div>${tip('Trailing annual DPS', 'Actual dividends per share paid over the trailing 12-month period. Annual cash income is shares owned × this DPS.')}<strong class="${stale ? 'negative' : ''}">${dps == null ? 'N/A' : curMoney(dps, dpsCurrency, 2)}</strong></div>
          <div>${tip('Earnings-implied DPS', 'Estimated DPS if the company maintained its current payout ratio: EPS × payout ratio. This is analytical capacity, not a declared or guaranteed dividend.')}<strong>${implied == null ? 'N/A' : curMoney(implied, dpsCurrency, 2)}</strong>${impliedChange == null ? '' : `<small class="${impliedChange >= 0 ? 'positive' : 'negative'}">${impliedChange >= 0 ? '+' : ''}${fmt(impliedChange, 1)}% vs trailing</small>`}</div>
          <div>${tip('Dividend yield', 'Trailing annual DPS relative to current share price. Yield is useful for comparing income efficiency, but your actual cash dividend is determined by shares × DPS.')}<strong>${y == null ? 'N/A' : fmt(y, 2) + '%'}</strong></div>
          <div>${tip('Yield premium', 'Dividend yield minus the selected bank savings rate. pp means percentage points. This compares yield rates, not guaranteed cash returns.')}<strong class="${stale || premium == null ? 'neutral' : premium >= 0 ? 'positive' : 'negative'}">${stale ? 'Historical' : premium == null ? 'N/A' : `${premium >= 0 ? '+' : ''}${fmt(premium, 2)} pp`}</strong></div>
          <div>${tip('Stock income / yr', 'Actual calculation basis used here: number of shares × trailing annual DPS. Stale dividends are not projected as current income.')}<strong>${stockIncome == null ? (stale ? 'Not current' : 'N/A') : curMoney(stockIncome, dpsCurrency)}</strong></div>
          <div>${tip('Savings income / yr', mode === 'shares' ? 'Current market value of your entered shares × selected bank savings rate.' : 'Selected investment amount × bank savings rate.')}<strong>${savingsIncome == null ? 'N/A' : money(savingsIncome)}</strong></div>
          <div>${tip('Vs savings', 'Dividend yield divided by the selected bank savings rate. For foreign-currency dividends, the cash amounts are not directly comparable without an FX conversion.')}<strong>${stale ? 'Historical' : multiple == null ? 'N/A' : fmt(multiple, 1) + '×'}</strong></div>
          <div>${tip('Last dividend pay', 'Most recent dividend payment date in the collected data. More than 12 months triggers a warning; more than 18 months is treated as stale.')}<strong class="${stale ? 'negative' : recency === 'aging' ? 'amber' : ''}">${s.payDate || 'N/A'}</strong></div>
        </div>
        ${!currencyComparable ? `<p class="income-currency-note amber">Dividend income is in ${dpsCurrency}; bank savings is in JMD. Cash amounts are shown separately because an FX rate is required for a direct currency comparison.</p>` : ''}
        <p class="income-rating-note ${note.cls}">${note.text}</p>
      </article>`;
    }).join('');
  }

  function saveShareInput(input) {
    const ticker = input.dataset.sharesTicker;
    holdings[ticker] = Math.max(0, Math.floor(Number(input.value || 0)));
    localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
  }

  function init() {
    ensureModeControls();
    const rateSlider = $('savingsRateSlider');
    const amountSlider = $('investmentAmountSlider');
    if (!rateSlider || !amountSlider) return;
    rateSlider.addEventListener('input', render);
    amountSlider.addEventListener('input', render);
    window.addEventListener('storage', render);
    document.body.addEventListener('click', e => {
      const modeBtn = e.target.closest('[data-income-mode]');
      if (modeBtn) { mode = modeBtn.dataset.incomeMode; render(); return; }
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
    document.body.addEventListener('input', e => {
      const input = e.target.closest('.shares-owned-input');
      if (!input) return;
      // Persist each keystroke without rerendering the entire card list. Rerendering
      // here replaced the focused input node and caused the page to jump vertically.
      saveShareInput(input);
    });
    document.body.addEventListener('change', e => {
      const input = e.target.closest('.shares-owned-input');
      if (!input) return;
      saveShareInput(input);
      const scrollY = window.scrollY;
      render();
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
    });
    document.body.addEventListener('keydown', e => {
      const input = e.target.closest('.shares-owned-input');
      if (!input || e.key !== 'Enter') return;
      input.blur();
    });
    render();
  }

  window.addEventListener('load', init);
})();
