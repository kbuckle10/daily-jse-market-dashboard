const { stocks, updated, priceLabel } = window.JSE_DASHBOARD_DATA;

const state = { filter: 'all', sort: 'rank', view: 'table' };
const tableBody = document.getElementById('stockTableBody');
const cardView = document.getElementById('cardView');
const tableView = document.getElementById('tableView');
const movementList = document.getElementById('movementList');
const rankingList = document.getElementById('rankingList');
const allocationBar = document.getElementById('allocationBar');
const allocationLegend = document.getElementById('allocationLegend');

const fmt = (v, digits = 2) => v == null ? 'N/A' : Number(v).toFixed(digits);
const pct = v => v == null ? '<span class="neutral">N/A</span>' : `<span class="${v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral'}">${v > 0 ? '+' : ''}${fmt(v,1)}%</span>`;
const money = v => v == null ? 'N/A' : `J$${fmt(v,2)}`;
const day = s => s.dayPct == null ? '<span class="neutral">N/A</span>' : `<span class="${s.dayPct > 0 ? 'positive' : s.dayPct < 0 ? 'negative' : 'neutral'}">${s.dayJmd > 0 ? '+' : ''}${money(s.dayJmd)} / ${s.dayPct > 0 ? '+' : ''}${fmt(s.dayPct,2)}%</span>`;
const isBigMover = s => Math.abs(s.dayPct || 0) >= 5 || Math.abs(s.m1 || 0) >= 5 || Math.abs(s.ytd || 0) >= 10 || Math.abs(s.m3 || 0) >= 10 || Math.abs(s.m6 || 0) >= 10 || Math.abs(s.y1 || 0) >= 20;
const latestDividendLink = s => {
  const value = money(s.latestDividend);
  const href = s.dividendUrl || `https://www.jamstockex.com/?tag=${encodeURIComponent(s.ticker)}`;
  if (s.latestDividend == null) return value;
  return `<a class="dividend-link" href="${href}" target="_blank" rel="noreferrer" title="Open ${s.ticker} dividend declaration on JSE">${value} ↗</a>`;
};

function filteredStocks() {
  let result = [...stocks];
  if (state.filter === 'buy') result = result.filter(s => s.ratingClass === 'buy');
  if (state.filter === 'zone') result = result.filter(s => s.zoneStatus === 'in');
  if (state.filter === 'income') result = result.filter(s => (s.trailingYield || 0) >= 3);
  if (state.filter === 'movement') result = result.filter(isBigMover);
  if (state.filter === 'dividend') result = result.filter(s => !/No new declaration/i.test(s.dividendStatus));

  const sorts = {
    rank: (a,b) => a.rank - b.rank,
    'yield-desc': (a,b) => (b.trailingYield || -1) - (a.trailingYield || -1),
    'price-asc': (a,b) => a.price - b.price,
    'month-desc': (a,b) => (b.m1 || -999) - (a.m1 || -999),
    'ytd-desc': (a,b) => (b.ytd || -999) - (a.ytd || -999),
    ticker: (a,b) => a.ticker.localeCompare(b.ticker)
  };
  return result.sort(sorts[state.sort]);
}

function buyZoneText(s) {
  if (s.buyLow == null || s.buyHigh == null) return '<span class="neutral">N/A</span>';
  const yields = s.buyYieldLow != null && s.buyYieldHigh != null ? `<br><small>${fmt(s.buyYieldLow,1)}–${fmt(s.buyYieldHigh,1)}% implied</small>` : '';
  const label = s.zoneStatus === 'in' ? 'IN ZONE' : s.zoneStatus === 'below' ? 'BELOW ZONE' : 'ABOVE ZONE';
  return `<strong>J$${fmt(s.buyLow,2)}–${fmt(s.buyHigh,2)}</strong>${yields}<br><span class="zone-status ${s.zoneStatus}">${label}</span>`;
}

function stockRow(s) {
  return `<tr>
    <td><div class="ticker-wrap"><a class="source-dot" href="${s.sa}" target="_blank" rel="noreferrer">SA</a><div><div class="ticker">${s.ticker}</div><div class="company" title="${s.company}">${s.company}</div></div></div></td>
    <td><strong class="num">J$${fmt(s.price,2)}</strong><br><small>${s.priceDate}</small></td>
    <td>${day(s)}</td><td>${pct(s.w1)}</td><td>${pct(s.m1)}</td><td>${pct(s.ytd)}</td><td>${pct(s.m3)}</td><td>${pct(s.m6)}</td><td>${pct(s.y1)}</td>
    <td class="num">${money(s.ttmDps)}</td><td>${pct(s.trailingYield)}</td><td><strong>${latestDividendLink(s)}</strong><br><small>${s.dividendStatus}</small></td>
    <td><small>Ex: ${s.exDate}<br>Rec: ${s.recordDate}<br>Pay: ${s.payDate}</small></td>
    <td><span class="rating ${s.ratingClass}">${s.rating}</span><br><small title="${s.reason}">${s.reason}</small></td>
    <td>${buyZoneText(s)}</td>
  </tr>`;
}

function stockCard(s) {
  return `<article class="stock-card">
    <div class="card-top"><div><h3>${s.ticker}</h3><div class="company">${s.company}</div></div><span class="rating ${s.ratingClass}">${s.rating}</span></div>
    <div class="price">J$${fmt(s.price,2)}</div><div>${day(s)} <span class="neutral">• ${s.priceDate}</span></div>
    <div class="metric-row"><span>1 Week</span><strong>${pct(s.w1)}</strong></div>
    <div class="metric-row"><span>1 Month</span><strong>${pct(s.m1)}</strong></div>
    <div class="metric-row"><span>YTD</span><strong>${pct(s.ytd)}</strong></div>
    <div class="metric-row"><span>3 Months</span><strong>${pct(s.m3)}</strong></div>
    <div class="metric-row"><span>6 Months</span><strong>${pct(s.m6)}</strong></div>
    <div class="metric-row"><span>12 Months</span><strong>${pct(s.y1)}</strong></div>
    <div class="metric-row"><span>Trailing yield</span><strong>${fmt(s.trailingYield,2)}%</strong></div>
    <div class="metric-row"><span>Latest dividend</span><strong>${latestDividendLink(s)}</strong></div>
    <div class="metric-row"><span>Target buy zone</span><div>${buyZoneText(s)}</div></div>
    <div class="metric-row"><span>Dividend dates</span><small>Ex ${s.exDate} • Pay ${s.payDate}</small></div>
    <p class="rank-reason">${s.reason}</p>
    <div class="card-links"><a href="${s.jse}" target="_blank" rel="noreferrer">JSE ↗</a><a href="${s.sa}" target="_blank" rel="noreferrer">StockAnalysis ↗</a></div>
  </article>`;
}

function render() {
  const data = filteredStocks();
  tableBody.innerHTML = data.map(stockRow).join('');
  cardView.innerHTML = data.map(stockCard).join('') || '<div class="panel">No stocks match this filter.</div>';
  document.querySelectorAll('.filter-tile').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
}

function renderSummary() {
  document.getElementById('updatedPill').textContent = `${priceLabel} • ${updated}`;
  document.getElementById('trackedCount').textContent = stocks.length;
  document.getElementById('buyCount').textContent = stocks.filter(s => s.ratingClass === 'buy').length;
  document.getElementById('zoneCount').textContent = stocks.filter(s => s.zoneStatus === 'in').length;
  document.getElementById('incomeCount').textContent = stocks.filter(s => (s.trailingYield || 0) >= 3).length;
  document.getElementById('moveCount').textContent = stocks.filter(isBigMover).length;
  document.getElementById('dividendCount').textContent = stocks.filter(s => !/No new declaration/i.test(s.dividendStatus)).length;
}

function renderAnalysis() {
  const movers = stocks.filter(isBigMover);
  movementList.innerHTML = movers.length ? movers.map(s => {
    const moveText = Math.abs(s.dayPct || 0) >= 5 ? `${pct(s.dayPct)} on the latest day` : Math.abs(s.m1 || 0) >= 5 ? `${pct(s.m1)} over 1M` : `${pct(s.ytd)} YTD`;
    return `<div class="movement-item"><strong>${s.ticker} ${moveText}</strong><p>${s.reason} ${s.zoneStatus === 'above' ? `Current price is above the J$${fmt(s.buyLow)}–${fmt(s.buyHigh)} dividend buy zone.` : s.zoneStatus === 'in' ? `Current price is inside the target buy zone.` : `Current price is below the target buy zone.`}</p></div>`;
  }).join('') : '<p class="neutral">No tracked stock currently exceeds the movement thresholds with available data.</p>';

  rankingList.innerHTML = [...stocks].sort((a,b)=>a.rank-b.rank).map(s => `<div class="rank-row"><div class="rank-left"><span class="rank-number">${s.rank}</span><div><strong>${s.ticker}</strong><div class="rank-reason">${s.reason}</div></div></div><span class="rating ${s.ratingClass}">${s.rating}</span></div>`).join('');

  const colors = ['var(--viz1,#5b8cff)','var(--viz2,#48d7a0)','var(--viz3,#ffd166)','var(--viz4,#9f7aea)','var(--viz5,#38bdf8)','var(--viz6,#fb7185)'];
  allocationBar.innerHTML = [...stocks].sort((a,b)=>b.allocation-a.allocation).map((s,i)=>`<div class="allocation-segment" title="${s.ticker} ${s.allocation}%" style="width:${s.allocation}%;background:${colors[i % colors.length]}"></div>`).join('');
  allocationLegend.innerHTML = [...stocks].sort((a,b)=>b.allocation-a.allocation).map((s,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><strong>${s.ticker}</strong> ${s.allocation}%</div>`).join('');
}

document.querySelectorAll('.filter-tile').forEach(btn => btn.addEventListener('click', () => { state.filter = btn.dataset.filter; render(); }));
document.getElementById('sortSelect').addEventListener('change', e => { state.sort = e.target.value; render(); });
document.getElementById('tableViewBtn').addEventListener('click', () => { tableView.classList.remove('hidden'); cardView.classList.add('hidden'); document.getElementById('tableViewBtn').classList.add('active'); document.getElementById('cardViewBtn').classList.remove('active'); });
document.getElementById('cardViewBtn').addEventListener('click', () => { tableView.classList.add('hidden'); cardView.classList.remove('hidden'); document.getElementById('cardViewBtn').classList.add('active'); document.getElementById('tableViewBtn').classList.remove('active'); });

document.getElementById('themeToggle').addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  document.getElementById('themeToggle').textContent = next === 'dark' ? '☀' : '☾';
});

renderSummary(); renderAnalysis(); render();