(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;

  const OVERRIDE_KEY = 'dailyJseLatestDividendOverridesV1';
  const TOGGLE_KEY = 'dailyJseLatestDividendEstimatorTogglesV1';
  const HOLDINGS_KEY = 'dailyJseShareHoldingsV1';
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker || '').toUpperCase(), s]));

  let overrides = {};
  let toggles = {};
  try { overrides = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}') || {}; } catch { overrides = {}; }
  try { toggles = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '{}') || {}; } catch { toggles = {}; }

  const currencyPrefix = c => String(c || 'JMD').toUpperCase() === 'TTD' ? 'TT$' : String(c || 'JMD').toUpperCase() === 'USD' ? 'US$' : 'J$';
  const money = (v, c = 'JMD', d = 2) => Number.isFinite(Number(v)) ? `${currencyPrefix(c)}${Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}` : 'N/A';
  const latestDividend = s => Number.isFinite(Number(s?.latestDividend)) ? Number(s.latestDividend) : null;
  const currency = s => String(s?.latestDividendCurrency || s?.currentAnnualDpsCurrency || s?.ttmDpsCurrency || 'JMD').toUpperCase();

  function storedShares(ticker) {
    try {
      const h = JSON.parse(localStorage.getItem(HOLDINGS_KEY) || '{}') || {};
      return Math.max(0, Math.floor(Number(h[ticker] || 0)));
    } catch { return 0; }
  }

  function currentShares(row, ticker) {
    const input = row?.querySelector(`[data-shares-ticker="${ticker}"]`);
    const live = Number(input?.value);
    return Number.isFinite(live) && live >= 0 ? Math.floor(live) : storedShares(ticker);
  }

  function estimatorValue(s) {
    const ticker = String(s?.ticker || '').toUpperCase();
    const custom = Number(overrides[ticker]);
    if (overrides[ticker] !== '' && overrides[ticker] != null && Number.isFinite(custom) && custom >= 0) return custom;
    return latestDividend(s);
  }

  function save() {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    localStorage.setItem(TOGGLE_KEY, JSON.stringify(toggles));
  }

  function ensureStyles() {
    if (document.getElementById('latestDividendEstimatorStyles')) return;
    const st = document.createElement('style');
    st.id = 'latestDividendEstimatorStyles';
    st.textContent = `
      .latest-dividend-estimator{margin-top:10px;padding:10px 11px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)}
      .latest-dividend-estimator-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .latest-dividend-estimator-title{display:flex;flex-direction:column;gap:2px;min-width:0}
      .latest-dividend-estimator-title strong{font-size:.72rem}.latest-dividend-estimator-title small{font-size:.58rem;color:var(--muted);line-height:1.35}
      .dividend-estimator-switch{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;width:42px;height:24px}
      .dividend-estimator-switch input{position:absolute;opacity:0;pointer-events:none}
      .dividend-estimator-slider{position:absolute;inset:0;border-radius:999px;background:var(--border);transition:.2s;cursor:pointer}
      .dividend-estimator-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:var(--text);transition:.2s}
      .dividend-estimator-switch input:checked + .dividend-estimator-slider{background:var(--accent)}
      .dividend-estimator-switch input:checked + .dividend-estimator-slider:before{transform:translateX(18px)}
      .latest-dividend-estimator-body{display:none;margin-top:10px;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:end}
      .latest-dividend-estimator.is-on .latest-dividend-estimator-body{display:grid}
      .latest-dividend-input-wrap{display:flex;flex-direction:column;gap:5px}.latest-dividend-input-wrap label{font-size:.58rem;color:var(--muted);font-weight:700}
      .latest-dividend-input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);padding:9px 10px;font-size:.72rem}
      .latest-dividend-payout{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border-radius:9px;background:var(--surface)}
      .latest-dividend-payout small{font-size:.56rem;color:var(--muted)}.latest-dividend-payout strong{font-size:.82rem}
      .latest-dividend-estimator-meta{grid-column:1/-1;display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.56rem;color:var(--muted)}
      .latest-dividend-use-latest{border:0;background:none;color:var(--accent);font:inherit;font-weight:800;padding:0;cursor:pointer}
      @media(max-width:520px){.latest-dividend-estimator-body{grid-template-columns:1fr}.latest-dividend-estimator-meta{grid-column:1}.latest-dividend-estimator-head{align-items:flex-start}}
    `;
    document.head.appendChild(st);
  }

  function tickerFromRow(row) {
    return row.querySelector('.income-stock strong')?.textContent?.trim().toUpperCase() || '';
  }

  function buildBox(row, s) {
    const ticker = String(s.ticker).toUpperCase();
    const cur = currency(s);
    const box = document.createElement('div');
    box.className = 'latest-dividend-estimator';
    box.dataset.estimatorTicker = ticker;
    box.innerHTML = `
      <div class="latest-dividend-estimator-head">
        <div class="latest-dividend-estimator-title"><strong>Estimate latest-dividend payout</strong><small>One-payment estimate using shares owned × latest declared dividend.</small></div>
        <label class="dividend-estimator-switch" title="Show latest-dividend payout estimate"><input type="checkbox" data-dividend-estimator-toggle="${ticker}"><span class="dividend-estimator-slider"></span></label>
      </div>
      <div class="latest-dividend-estimator-body">
        <div class="latest-dividend-input-wrap"><label for="latest-dividend-${ticker}">Dividend per share (${cur})</label><input id="latest-dividend-${ticker}" class="latest-dividend-input" type="number" min="0" step="0.0001" inputmode="decimal" data-latest-dividend-input="${ticker}"></div>
        <div class="latest-dividend-payout"><small>Estimated payout</small><strong data-estimated-payout>N/A</strong><small data-estimator-formula></small></div>
        <div class="latest-dividend-estimator-meta"><span data-estimator-meta></span><button type="button" class="latest-dividend-use-latest" data-use-latest-dividend="${ticker}" hidden>Use latest</button></div>
      </div>`;
    const anchor = row.querySelector('.holding-input-grid') || row.querySelector('.income-stock');
    anchor?.insertAdjacentElement('afterend', box);
    return box;
  }

  function refreshBox(box, row, s, preserveInput = false) {
    const ticker = String(s.ticker).toUpperCase();
    const auto = latestDividend(s);
    const cur = currency(s);
    const shares = currentShares(row, ticker);
    const on = !!toggles[ticker];
    const input = box.querySelector('.latest-dividend-input');
    const toggle = box.querySelector('[data-dividend-estimator-toggle]');
    const latestBtn = box.querySelector('[data-use-latest-dividend]');
    const meta = box.querySelector('[data-estimator-meta]');

    box.classList.toggle('is-on', on);
    if (toggle) toggle.checked = on;

    const value = preserveInput && input && input.value !== '' ? Number(input.value) : estimatorValue(s);
    if (input && !preserveInput) {
      input.value = value == null ? '' : value;
      input.placeholder = auto == null ? 'Enter dividend' : String(auto);
    }

    const effective = input && input.value !== '' ? Number(input.value) : value;
    const payout = Number.isFinite(effective) && shares > 0 ? shares * effective : null;
    const payoutEl = box.querySelector('[data-estimated-payout]');
    const formula = box.querySelector('[data-estimator-formula]');
    if (payoutEl) payoutEl.textContent = payout == null ? 'N/A' : money(payout, cur, 2);
    if (formula) formula.textContent = `${shares.toLocaleString('en-US')} shares × ${Number.isFinite(effective) ? money(effective, cur, 4) : 'dividend N/A'}`;

    const hasOverride = overrides[ticker] != null;
    if (meta) meta.textContent = hasOverride ? 'Custom dividend estimate' : auto != null ? `Auto-filled from latest declared dividend: ${money(auto, cur, 4)}` : 'No latest dividend in dashboard data — enter an estimate manually.';
    if (latestBtn) latestBtn.hidden = !(hasOverride && auto != null);
  }

  function decorate() {
    const sharesMode = document.querySelector('.income-mode-btn[data-income-mode="shares"]')?.classList.contains('active');
    document.querySelectorAll('#incomeComparisonList .income-row').forEach(row => {
      const ticker = tickerFromRow(row);
      const s = byTicker.get(ticker);
      if (!s) return;
      const shares = currentShares(row, ticker);
      let box = row.querySelector('.latest-dividend-estimator');

      if (!sharesMode || shares <= 0) {
        if (box) box.remove();
        return;
      }

      if (!box) box = buildBox(row, s);
      refreshBox(box, row, s, false);
    });
  }

  function schedule(delay = 80) {
    clearTimeout(schedule.timer);
    schedule.timer = setTimeout(decorate, delay);
  }

  document.addEventListener('change', e => {
    const toggle = e.target.closest?.('[data-dividend-estimator-toggle]');
    if (toggle) {
      const ticker = toggle.dataset.dividendEstimatorToggle;
      toggles[ticker] = !!toggle.checked;
      save();
      const box = toggle.closest('.latest-dividend-estimator');
      box?.classList.toggle('is-on', !!toggle.checked);
      return;
    }

    const input = e.target.closest?.('[data-latest-dividend-input]');
    if (input) {
      const ticker = input.dataset.latestDividendInput;
      if (input.value === '') delete overrides[ticker];
      else {
        const v = Number(input.value);
        if (Number.isFinite(v) && v >= 0) overrides[ticker] = v;
      }
      save();
      const s = byTicker.get(ticker);
      const box = input.closest('.latest-dividend-estimator');
      const row = input.closest('.income-row');
      if (s && box && row) refreshBox(box, row, s, true);
      return;
    }

    if (e.target.closest?.('[data-shares-ticker]')) schedule(260);
  });

  document.addEventListener('input', e => {
    const input = e.target.closest?.('[data-latest-dividend-input]');
    if (input) {
      const ticker = input.dataset.latestDividendInput;
      if (input.value === '') delete overrides[ticker];
      else {
        const v = Number(input.value);
        if (Number.isFinite(v) && v >= 0) overrides[ticker] = v;
      }
      save();
      const s = byTicker.get(ticker);
      const box = input.closest('.latest-dividend-estimator');
      const row = input.closest('.income-row');
      if (s && box && row) refreshBox(box, row, s, true);
      return;
    }

    if (e.target.closest?.('[data-shares-ticker]')) schedule(260);
  });

  document.addEventListener('click', e => {
    const latest = e.target.closest?.('[data-use-latest-dividend]');
    if (latest) {
      e.preventDefault();
      const ticker = latest.dataset.useLatestDividend;
      delete overrides[ticker];
      save();
      const s = byTicker.get(ticker);
      const box = latest.closest('.latest-dividend-estimator');
      const row = latest.closest('.income-row');
      if (s && box && row) refreshBox(box, row, s, false);
      return;
    }

    if (e.target.closest?.('.income-mode-btn,[data-income-mode],#clearIncomeInputsBtn')) schedule(260);
  });

  window.addEventListener('storage', e => {
    if ([OVERRIDE_KEY, TOGGLE_KEY, HOLDINGS_KEY].includes(e.key)) {
      try { overrides = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}') || {}; } catch { overrides = {}; }
      try { toggles = JSON.parse(localStorage.getItem(TOGGLE_KEY) || '{}') || {}; } catch { toggles = {}; }
      schedule(0);
    }
  });

  function observeIncomeRows() {
    const list = document.getElementById('incomeComparisonList');
    if (!list || list.dataset.latestDividendObserver === 'true') return;
    list.dataset.latestDividendObserver = 'true';
    const observer = new MutationObserver(mutations => {
      const rowsChanged = mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1 && (n.matches?.('.income-row') || n.querySelector?.('.income-row'))));
      if (rowsChanged) schedule(40);
    });
    observer.observe(list, { childList: true, subtree: false });
  }

  ensureStyles();
  observeIncomeRows();
  schedule(300);
})();