(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;

  const STORAGE_KEY = 'dailyJseTrackedTickersV2';
  const HOLDINGS_KEY = 'dailyJseShareHoldingsV1';
  const BUY_PRICE_KEY = 'dailyJseAverageBuyPricesV1';
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 2) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : Number(v).toFixed(d);
  const money = v => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `J$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const priceMoney = v => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `J$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const curPrefix = c => c === 'TTD' ? 'TT$' : c === 'USD' ? 'US$' : 'J$';
  const curMoney = (v, c = 'JMD', d = 0) => v == null || !Number.isFinite(Number(v)) ? 'N/A' : `${curPrefix(c)}${Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  const parseDate = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.valueOf()) ? null : d; };
  const dividendAgeMonths = s => { const d = parseDate(s.payDate); if (!d) return null; return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44); };
  const dividendRecency = s => { const m = dividendAgeMonths(s); if (m == null) return 'unknown'; if (m > 18) return 'stale'; if (m > 12) return 'aging'; return 'current'; };
  const tip = (label, text) => `<span class="metric-label">${label}<button type="button" class="metric-help" aria-label="Explain ${label}" data-tooltip="${text.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}">?</button></span>`;
  let mode = 'investment';
  let holdings = {};
  let buyPrices = {};

  try { holdings = JSON.parse(localStorage.getItem(HOLDINGS_KEY) || '{}') || {}; } catch { holdings = {}; }
  try { buyPrices = JSON.parse(localStorage.getItem(BUY_PRICE_KEY) || '{}') || {}; } catch { buyPrices = {}; }

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
    if (s.currentAnnualDps != null && Number.isFinite(Number(s.currentAnnualDps))) return Number(s.currentAnnualDps);
    return s.ttmDps != null && Number.isFinite(Number(s.ttmDps)) ? Number(s.ttmDps) : null;
  }
  function annualDpsCurrency(s) { return s.currentAnnualDpsCurrency || s.ttmDpsCurrency || 'JMD'; }
  function currentYield(s) {
    if (s.currentDividendYield != null && Number.isFinite(Number(s.currentDividendYield))) return Number(s.currentDividendYield);
    if (s.trailingYield != null && Number.isFinite(Number(s.trailingYield))) return Number(s.trailingYield);
    return null;
  }
  function holdingShares(ticker) { return Math.max(0, Math.floor(Number(holdings[ticker] || 0))); }
  function averageBuyPrice(ticker) {
    const v = Number(buyPrices[ticker]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  function yieldOnCost(s) {
    const dps = annualDps(s), buyPrice = averageBuyPrice(s.ticker);
    return dps != null && buyPrice != null && annualDpsCurrency(s) === 'JMD' ? dps / buyPrice * 100 : null;
  }

  function impliedDps(s) {
    const eps = Number(s.epsTtm ?? s.eps), payout = Number(s.payoutRatio);
    if (!Number.isFinite(eps) || !Number.isFinite(payout) || payout < 0) return null;
    return eps * payout / 100;
  }

  function ensureModeControls() {
    const panel = document.querySelector('.income-vs-savings-panel');
    const controls = panel?.querySelector('.income-controls');
    if (!panel || !controls || panel.querySelector('.income-mode-switch')) return;
    controls.insertAdjacentHTML('beforebegin', `<div class="income-mode-switch" role="group" aria-label="Dividend income calculation mode"><button type="button" class="income-mode-btn active" data-income-mode="investment">Investment amount</button><button type="button" class="income-mode-btn" data-income-mode="shares">Shares owned</button></div><p class="income-mode-note" id="incomeModeNote">Investment mode estimates whole shares at the current JSE price, then calculates income as shares × current annual DPS.</p>`);
    const amountControl = $('investmentAmountSlider')?.closest('.income-control');
    if (amountControl) amountControl.dataset.investmentControl = 'true';
  }

  function ensurePortfolioSummary() {
    const list = $('incomeComparisonList');
    if (!list || $('ownedPortfolioSummary')) return;
    list.insertAdjacentHTML('beforebegin', '<div id="ownedPortfolioSummary" class="owned-portfolio-summary income-control-hidden"></div>');
  }

  function renderPortfolioSummary(rows) {
    const box = $('ownedPortfolioSummary');
    if (!box) return;
    if (mode !== 'shares') { box.classList.add('income-control-hidden'); return; }
    box.classList.remove('income-control-hidden');

    let marketValue = 0, annualIncome = 0, originalCost = 0, costIncome = 0, costPositions = 0, ownedPositions = 0;
    for (const s of rows) {
      const shares = holdingShares(s.ticker);
      if (!shares) continue;
      ownedPositions++;
      const price = Number(s.price), dps = annualDps(s), currency = annualDpsCurrency(s);
      if (Number.isFinite(price) && price > 0) marketValue += shares * price;
      if (dividendRecency(s) !== 'stale' && dps != null && currency === 'JMD') annualIncome += shares * dps;
      const buyPrice = averageBuyPrice(s.ticker);
      if (buyPrice != null) {
        originalCost += shares * buyPrice;
        costPositions++;
        if (dividendRecency(s) !== 'stale' && dps != null && currency === 'JMD') costIncome += shares * dps;
      }
    }
    if (!ownedPositions) {
      box.innerHTML = '<small>Owned portfolio</small><strong>Enter shares owned to build your personalized income summary.</strong>';
      return;
    }
    const portfolioCurrentYield = marketValue > 0 ? annualIncome / marketValue * 100 : null;
    const portfolioYieldOnCost = originalCost > 0 ? costIncome / originalCost * 100 : null;
    box.innerHTML = `<div><small>Current portfolio value</small><strong>${money(marketValue)}</strong></div><div><small>Annual dividend income</small><strong>${money(annualIncome)}</strong></div><div><small>Portfolio current yield</small><strong>${portfolioCurrentYield == null ? 'N/A' : fmt(portfolioCurrentYield, 2) + '%'}</strong></div><div><small>Original cost${costPositions < ownedPositions ? ' (entered positions)' : ''}</small><strong>${originalCost > 0 ? money(originalCost) : 'Add avg. buy prices'}</strong></div><div class="yield-on-cost-summary"><small>Portfolio yield on cost</small><strong>${portfolioYieldOnCost == null ? 'N/A' : fmt(portfolioYieldOnCost, 2) + '%'}</strong></div>`;
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
      ? 'Investment mode estimates whole shares at the current JSE price, then calculates income as shares × current annual DPS. Declared upcoming dividends may be included once officially announced.'
      : 'Shares-owned mode uses your holdings directly. Add an optional average buy price to see your yield on cost; if blank, the normal current-market yield remains the default.';

    const rows = trackedStocks()
      .filter(s => annualDps(s) != null || currentYield(s) != null)
      .sort((a, b) => {
        const ar = dividendRecency(a) === 'current' ? 1 : 0;
        const br = dividendRecency(b) === 'current' ? 1 : 0;
        return br - ar || Number(currentYield(b) ?? -1) - Number(currentYield(a) ?? -1);
      });

    renderPortfolioSummary(rows);

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
      const shares = mode === 'shares' ? holdingShares(s.ticker) : (Number(s.price) > 0 ? Math.floor(investment / Number(s.price)) : 0);
      const income = shares * dps;
      if (income > leaderIncome) { leaderIncome = income; leader = { s, shares, income }; }
    }
    $('incomeLeader').textContent = leader
      ? `${leader.s.ticker}: ${leader.shares.toLocaleString('en-US')} shares × ${curMoney(annualDps(leader.s), annualDpsCurrency(leader.s), 2)} current annual DPS = ${curMoney(leader.income, annualDpsCurrency(leader.s))}/yr`
      : 'No tracked stock has a recent/declared dividend with usable annual DPS';

    list.innerHTML = rows.map(s => {
      const dps = annualDps(s);
      const paidTtm = s.ttmDps != null && Number.isFinite(Number(s.ttmDps)) ? Number(s.ttmDps) : null;
      const implied = impliedDps(s);
      const dpsCurrency = annualDpsCurrency(s);
      const recency = dividendRecency(s);
      const stale = recency === 'stale';
      const price = Number(s.price);
      const shares = mode === 'shares' ? holdingShares(s.ticker) : (Number.isFinite(price) && price > 0 ? Math.floor(investment / price) : 0);
      const buyPrice = mode === 'shares' ? averageBuyPrice(s.ticker) : null;
      const marketValue = Number.isFinite(price) && price > 0 ? shares * price : null;
      const originalCost = buyPrice != null ? shares * buyPrice : null;
      const savingsPrincipal = mode === 'shares' ? (originalCost ?? marketValue) : investment;
      const savingsIncome = savingsPrincipal == null ? null : savingsPrincipal * savingsRate / 100;
      const stockIncome = stale || dps == null ? null : shares * dps;
      const y = currentYield(s);
      const yoc = mode === 'shares' ? yieldOnCost(s) : null;
      const comparisonYield = yoc ?? y;
      const premium = comparisonYield == null ? null : comparisonYield - savingsRate;
      const multiple = savingsRate > 0 && comparisonYield != null ? comparisonYield / savingsRate : null;
      const note = ratingNote(s);
      const currencyComparable = dpsCurrency === 'JMD';
      const impliedChange = dps != null && implied != null && dps !== 0 ? ((implied / dps) - 1) * 100 : null;
      const dpsBasis = s.currentAnnualDps != null ? 'Current annual' : 'Paid TTM fallback';
      const sharesInput = mode === 'shares'
        ? `<div class="holding-input-grid"><div class="shares-owned-control"><label for="shares-${s.ticker}">Shares owned</label><input id="shares-${s.ticker}" class="shares-owned-input" type="number" inputmode="numeric" min="0" step="1" value="${shares || ''}" placeholder="0" data-shares-ticker="${s.ticker}"></div><div class="shares-owned-control buy-price-control"><label for="buyprice-${s.ticker}">Avg. buy price <small>optional</small></label><input id="buyprice-${s.ticker}" class="shares-owned-input buy-price-input" type="number" inputmode="decimal" min="0" step="0.01" value="${buyPrice ?? ''}" placeholder="J$0.00" data-buy-price-ticker="${s.ticker}"></div></div>`
        : `<div class="shares-owned-summary"><small>Estimated shares</small><strong>${shares.toLocaleString('en-US')}</strong><span>${marketValue == null ? '' : `${money(marketValue)} at current price`}</span></div>`;
      return `<article class="income-row ${stale ? 'income-stale' : ''}">
        <div class="income-stock">
          <div><strong>${s.ticker}</strong><small>${s.company || ''}</small></div>
          <span class="rating ${s.ratingClass || 'hold'}">${s.rating || 'N/A'}</span>
        </div>
        ${sharesInput}
        <div class="income-formula">${shares.toLocaleString('en-US')} shares × ${dps == null ? 'DPS N/A' : curMoney(dps, dpsCurrency, 2)} = <strong>${stockIncome == null ? (stale ? 'Not current' : 'N/A') : curMoney(stockIncome, dpsCurrency)}</strong> / year <small>(${dpsBasis})</small></div>
        <div class="income-metrics">
          <div>${tip('Current annual DPS', 'Current annual dividend per share used for income planning. It may include an officially declared upcoming dividend once announced.')}<strong class="${stale ? 'negative' : ''}">${dps == null ? 'N/A' : curMoney(dps, dpsCurrency, 2)}</strong></div>
          <div>${tip('Paid TTM DPS', 'Historical dividends per share actually paid during the trailing 12 months, based on JSE corporate-action payment dates.')}<strong>${paidTtm == null ? 'N/A' : curMoney(paidTtm, s.ttmDpsCurrency || dpsCurrency, 2)}</strong></div>
          <div>${tip('Earnings-implied DPS', 'Estimated DPS if the company maintained its current payout ratio: EPS × payout ratio. This is analytical capacity, not a declared or guaranteed dividend.')}<strong>${implied == null ? 'N/A' : curMoney(implied, dpsCurrency, 2)}</strong>${impliedChange == null ? '' : `<small class="${impliedChange >= 0 ? 'positive' : 'negative'}">${impliedChange >= 0 ? '+' : ''}${fmt(impliedChange, 1)}% vs current annual</small>`}</div>
          <div>${tip('Current dividend yield', 'Current annual DPS divided by the current share price. This is the yield a new investor sees at the current market price.')}<strong>${y == null ? 'N/A' : fmt(y, 2) + '%'}</strong></div>
          ${mode === 'shares' ? `<div class="yield-on-cost-metric">${tip('Your yield on cost', 'Current annual DPS divided by your average purchase price. It shows the dividend return on the price you actually paid and does not replace current market yield.')}<strong>${yoc == null ? 'Add buy price' : fmt(yoc, 2) + '%'}</strong>${buyPrice == null ? '<small>Current yield used by default</small>' : `<small>${priceMoney(buyPrice)} avg. cost</small>`}</div><div>${tip('Original cost', 'Shares owned multiplied by your average buy price. For purchases in multiple batches, enter the weighted average purchase price.')}<strong>${originalCost == null ? 'Add buy price' : money(originalCost)}</strong></div>` : ''}
          <div>${tip('Yield premium', yoc != null ? 'Your yield on cost minus the selected bank savings rate. When no buy price is entered, current dividend yield is used.' : 'Current dividend yield minus the selected bank savings rate.')}<strong class="${stale || premium == null ? 'neutral' : premium >= 0 ? 'positive' : 'negative'}">${stale ? 'Historical' : premium == null ? 'N/A' : `${premium >= 0 ? '+' : ''}${fmt(premium, 2)} pp`}</strong></div>
          <div>${tip('Stock income / yr', 'Number of shares × current annual DPS. Purchase price changes yield on cost, not the dividend cash amount.')}<strong>${stockIncome == null ? (stale ? 'Not current' : 'N/A') : curMoney(stockIncome, dpsCurrency)}</strong></div>
          <div>${tip('Savings income / yr', mode === 'shares' ? (originalCost != null ? 'Your original stock cost × selected bank savings rate, for a like-for-like return-on-cost comparison.' : 'No buy price entered, so current market value × selected bank savings rate is used.') : 'Selected investment amount × bank savings rate.')}<strong>${savingsIncome == null ? 'N/A' : money(savingsIncome)}</strong></div>
          <div>${tip('Vs savings', yoc != null ? 'Your yield on cost divided by the selected bank savings rate.' : 'Current dividend yield divided by the selected bank savings rate.')}<strong>${stale ? 'Historical' : multiple == null ? 'N/A' : fmt(multiple, 1) + '×'}</strong></div>
          <div>${tip('Latest declared pay', 'Payment date for the latest official dividend declaration in the collected data.')}<strong class="${stale ? 'negative' : recency === 'aging' ? 'amber' : ''}">${s.payDate || 'N/A'}</strong></div>
        </div>
        ${!currencyComparable ? `<p class="income-currency-note amber">Dividend income is in ${dpsCurrency}; yield on cost is only calculated automatically when DPS and purchase price are both JMD-comparable.</p>` : ''}
        <p class="income-rating-note ${note.cls}">${note.text}</p>
      </article>`;
    }).join('');
  }

  function saveHoldingInput(input) {
    const sharesTicker = input.dataset.sharesTicker;
    const buyPriceTicker = input.dataset.buyPriceTicker;
    if (sharesTicker) holdings[sharesTicker] = Math.max(0, Math.floor(Number(input.value || 0)));
    if (buyPriceTicker) {
      const value = Number(input.value);
      if (Number.isFinite(value) && value > 0) buyPrices[buyPriceTicker] = value;
      else delete buyPrices[buyPriceTicker];
    }
    localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
    localStorage.setItem(BUY_PRICE_KEY, JSON.stringify(buyPrices));
  }

  function init() {
    ensureModeControls();
    ensurePortfolioSummary();
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
      saveHoldingInput(input);
    });
    document.body.addEventListener('change', e => {
      const input = e.target.closest('.shares-owned-input');
      if (!input) return;
      saveHoldingInput(input);
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