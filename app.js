const { stocks, updated, priceLabel } = window.JSE_DASHBOARD_DATA;

const STORAGE_KEY = 'dailyJseTrackedTickersV2';
const WATCHLIST_API = '/api/watchlist';
const WATCHLIST_FILE = '/watchlist.json';
const UNIVERSE_URL = 'https://raw.githubusercontent.com/kbuckle10/jse-main-market-dashboard/main/data.json';

const state = { filter: 'all', sort: 'rank', view: 'table', tracked: new Set(), universe: [], persistence: 'loading' };
const tableBody = document.getElementById('stockTableBody');
const cardView = document.getElementById('cardView');
const tableView = document.getElementById('tableView');
const movementList = document.getElementById('movementList');
const rankingList = document.getElementById('rankingList');
const allocationBar = document.getElementById('allocationBar');
const allocationLegend = document.getElementById('allocationLegend');
const tickerSearch = document.getElementById('tickerSearch');
const tickerSearchResults = document.getElementById('tickerSearchResults');

const fmt = (v, digits = 2) => v == null || Number.isNaN(Number(v)) ? 'N/A' : Number(v).toFixed(digits);
const pct = v => v == null ? '<span class="neutral">N/A</span>' : `<span class="${v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral'}">${v > 0 ? '+' : ''}${fmt(v,1)}%</span>`;
const money = v => v == null ? 'N/A' : `J$${fmt(v,2)}`;
const day = s => s.dayPct == null ? '<span class="neutral">N/A</span>' : `<span class="${s.dayPct > 0 ? 'positive' : s.dayPct < 0 ? 'negative' : 'neutral'}">${s.dayJmd > 0 ? '+' : ''}${money(s.dayJmd)} / ${s.dayPct > 0 ? '+' : ''}${fmt(s.dayPct,2)}%</span>`;
const isBigMover = s => Math.abs(s.dayPct || 0) >= 5 || Math.abs(s.m1 || 0) >= 5 || Math.abs(s.ytd || 0) >= 10 || Math.abs(s.m3 || 0) >= 10 || Math.abs(s.m6 || 0) >= 10 || Math.abs(s.y1 || 0) >= 20;
const detailedMap = () => new Map(stocks.map(s => [s.ticker, s]));

function latestDividendLink(s) {
  const value = money(s.latestDividend);
  const href = s.dividendUrl || `https://www.jamstockex.com/?tag=${encodeURIComponent(s.ticker)}`;
  if (s.latestDividend == null) return value;
  return `<a class="dividend-link" href="${href}" target="_blank" rel="noreferrer">${value} ↗</a>`;
}

function trackedStocks() { return stocks.filter(s => state.tracked.has(s.ticker)); }
function pendingTickers() { const map = detailedMap(); return [...state.tracked].filter(t => !map.has(t)); }

async function loadPersistentWatchlist() {
  const local = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } })();
  for (const url of [WATCHLIST_API, WATCHLIST_FILE]) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const doc = await res.json();
      if (Array.isArray(doc.tickers) && doc.tickers.length) {
        state.tracked = new Set(doc.tickers.map(t => String(t).toUpperCase()));
        state.persistence = url === WATCHLIST_API ? 'server' : 'file';
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.tracked]));
        return;
      }
    } catch {}
  }
  const fallback = Array.isArray(local) && local.length ? local : stocks.map(s => s.ticker);
  state.tracked = new Set(fallback);
  state.persistence = 'local';
}

async function loadUniverse() {
  try {
    const res = await fetch(UNIVERSE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const doc = await res.json();
    state.universe = (doc.stocks || []).map(s => ({
      ticker: String(s.ticker || '').toUpperCase(), company: s.company || s.ticker, sector: s.sector || 'Other',
      price: s.price ?? null, rating: s.rating || 'N/A', trailingYield: s.divYield ?? null,
      sa: `https://stockanalysis.com/quote/jmse/${encodeURIComponent(s.ticker)}/`,
      jse: s.jseUrl || `https://www.jamstockex.com/?s=${encodeURIComponent(s.ticker)}`
    })).filter(s => s.ticker);
  } catch {
    state.universe = stocks.map(s => ({ ...s }));
  }
}

async function saveWatchlist() {
  const tickers = [...state.tracked];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  try {
    const res = await fetch(WATCHLIST_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tickers }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    state.persistence = 'server';
    return { ok: true };
  } catch (error) {
    state.persistence = 'local';
    return { ok: false, error: error.message };
  }
}

function filteredStocks() {
  let result = trackedStocks();
  if (state.filter === 'buy') result = result.filter(s => s.ratingClass === 'buy');
  if (state.filter === 'zone') result = result.filter(s => s.zoneStatus === 'in');
  if (state.filter === 'income') result = result.filter(s => (s.trailingYield || 0) >= 3);
  if (state.filter === 'movement') result = result.filter(isBigMover);
  if (state.filter === 'dividend') result = result.filter(s => !/No new declaration/i.test(s.dividendStatus));
  const sorts = { rank:(a,b)=>a.rank-b.rank, 'yield-desc':(a,b)=>(b.trailingYield||-1)-(a.trailingYield||-1), 'price-asc':(a,b)=>(a.price||Infinity)-(b.price||Infinity), 'month-desc':(a,b)=>(b.m1||-999)-(a.m1||-999), 'ytd-desc':(a,b)=>(b.ytd||-999)-(a.ytd||-999), ticker:(a,b)=>a.ticker.localeCompare(b.ticker) };
  return result.sort(sorts[state.sort]);
}

function buyZoneText(s) {
  if (s.buyLow == null || s.buyHigh == null) return '<span class="neutral">N/A</span>';
  const yields = s.buyYieldLow != null && s.buyYieldHigh != null ? `<br><small>${fmt(s.buyYieldLow,1)}–${fmt(s.buyYieldHigh,1)}% implied</small>` : '';
  const label = s.zoneStatus === 'in' ? 'IN ZONE' : s.zoneStatus === 'below' ? 'BELOW ZONE' : 'ABOVE ZONE';
  return `<strong>J$${fmt(s.buyLow,2)}–${fmt(s.buyHigh,2)}</strong>${yields}<br><span class="zone-status ${s.zoneStatus}">${label}</span>`;
}

function stockRow(s) {
  return `<tr><td><div class="ticker-wrap"><div style="display:flex;gap:4px"><a class="source-dot" href="${s.jse}" target="_blank" rel="noreferrer">JSE</a><a class="source-dot" href="${s.sa}" target="_blank" rel="noreferrer">SA</a></div><div><div class="ticker">${s.ticker}</div><div class="company" title="${s.company}">${s.company}</div></div></div></td><td><strong class="num">${money(s.price)}</strong><br><small>${s.priceDate}</small></td><td>${day(s)}</td><td>${pct(s.w1)}</td><td>${pct(s.m1)}</td><td>${pct(s.ytd)}</td><td>${pct(s.m3)}</td><td>${pct(s.m6)}</td><td>${pct(s.y1)}</td><td class="num">${money(s.ttmDps)}</td><td>${pct(s.trailingYield)}</td><td><strong>${latestDividendLink(s)}</strong><br><small>${s.dividendStatus}</small></td><td><small>Ex: ${s.exDate}<br>Rec: ${s.recordDate}<br>Pay: ${s.payDate}</small></td><td><span class="rating ${s.ratingClass}">${s.rating}</span><br><small title="${s.reason}">${s.reason}</small></td><td>${buyZoneText(s)}</td></tr>`;
}

function stockCard(s) {
  return `<article class="stock-card"><div class="card-top"><div><h3>${s.ticker}</h3><div class="company">${s.company}</div></div><span class="rating ${s.ratingClass}">${s.rating}</span></div><div class="price">${money(s.price)}</div><div>${day(s)} <span class="neutral">• ${s.priceDate}</span></div>${[['1 Week',s.w1],['1 Month',s.m1],['YTD',s.ytd],['3 Months',s.m3],['6 Months',s.m6],['12 Months',s.y1]].map(([l,v])=>`<div class="metric-row"><span>${l}</span><strong>${pct(v)}</strong></div>`).join('')}<div class="metric-row"><span>Trailing yield</span><strong>${fmt(s.trailingYield,2)}%</strong></div><div class="metric-row"><span>Latest dividend</span><strong>${latestDividendLink(s)}</strong></div><div class="metric-row"><span>Target buy zone</span><div>${buyZoneText(s)}</div></div><p class="rank-reason">${s.reason}</p><div class="card-links"><a href="${s.jse}" target="_blank" rel="noreferrer">JSE ↗</a><a href="${s.sa}" target="_blank" rel="noreferrer">StockAnalysis ↗</a></div></article>`;
}

function render() {
  const data = filteredStocks();
  tableBody.innerHTML = data.map(stockRow).join('') || '<tr><td colspan="15" class="neutral">No fully-refreshed tracked stocks match this filter.</td></tr>';
  cardView.innerHTML = data.map(stockCard).join('') || '<div class="panel">No fully-refreshed tracked stocks match this filter.</div>';
  document.querySelectorAll('.filter-tile').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
}

function renderSummary() {
  const tracked = trackedStocks(); const pending = pendingTickers();
  document.getElementById('updatedPill').textContent = `${priceLabel} • ${updated}`;
  document.getElementById('trackedCount').textContent = state.tracked.size;
  document.getElementById('managerTrackedCount').textContent = state.tracked.size;
  document.getElementById('buyCount').textContent = tracked.filter(s=>s.ratingClass==='buy').length;
  document.getElementById('zoneCount').textContent = tracked.filter(s=>s.zoneStatus==='in').length;
  document.getElementById('incomeCount').textContent = tracked.filter(s=>(s.trailingYield||0)>=3).length;
  document.getElementById('moveCount').textContent = tracked.filter(isBigMover).length;
  document.getElementById('dividendCount').textContent = tracked.filter(s=>!/No new declaration/i.test(s.dividendStatus)).length;
  document.getElementById('subtitleTickers').textContent = [...state.tracked].join(' • ') + (pending.length ? ` • ${pending.length} syncing` : '');
}

function normalizedAllocations(data) { const total=data.reduce((sum,s)=>sum+Math.max(Number(s.allocation)||0,0),0); if(!total)return data.map(s=>({...s,normalizedAllocation:100/Math.max(data.length,1)})); return data.map(s=>({...s,normalizedAllocation:((Number(s.allocation)||0)/total)*100})); }

function renderAnalysis() {
  const tracked=trackedStocks(); const movers=tracked.filter(isBigMover);
  movementList.innerHTML=movers.length?movers.map(s=>{const moveText=Math.abs(s.dayPct||0)>=5?`${pct(s.dayPct)} latest day`:Math.abs(s.m1||0)>=5?`${pct(s.m1)} over 1M`:Math.abs(s.m3||0)>=10?`${pct(s.m3)} over 3M`:Math.abs(s.m6||0)>=10?`${pct(s.m6)} over 6M`:Math.abs(s.y1||0)>=20?`${pct(s.y1)} over 12M`:`${pct(s.ytd)} YTD`;return `<div class="movement-item"><strong>${s.ticker} ${moveText}</strong><p>${s.reason}</p></div>`;}).join(''):'<p class="neutral">No tracked stock currently exceeds the movement thresholds with available data.</p>';
  rankingList.innerHTML=[...tracked].sort((a,b)=>a.rank-b.rank).map((s,i)=>`<div class="rank-row"><div class="rank-left"><span class="rank-number">${i+1}</span><div><strong>${s.ticker}</strong><div class="rank-reason">${s.reason}</div></div></div><span class="rating ${s.ratingClass}">${s.rating}</span></div>`).join('')||'<p class="neutral">Waiting for tracked ticker data.</p>';
  const allocData=normalizedAllocations([...tracked].sort((a,b)=>(b.allocation||0)-(a.allocation||0))); const colors=['var(--viz1,#5b8cff)','var(--viz2,#48d7a0)','var(--viz3,#ffd166)','var(--viz4,#9f7aea)','var(--viz5,#38bdf8)','var(--viz6,#fb7185)']; allocationBar.innerHTML=allocData.map((s,i)=>`<div class="allocation-segment" title="${s.ticker} ${fmt(s.normalizedAllocation,1)}%" style="width:${s.normalizedAllocation}%;background:${colors[i%colors.length]}"></div>`).join(''); allocationLegend.innerHTML=allocData.map((s,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span><strong>${s.ticker}</strong> ${fmt(s.normalizedAllocation,1)}%</div>`).join('')||'<span class="neutral">No refreshed tracked tickers.</span>';
}

function searchableUniverse(){const merged=new Map();for(const u of state.universe)merged.set(u.ticker,u);for(const s of stocks)merged.set(s.ticker,{...merged.get(s.ticker),...s});return [...merged.values()];}

function renderTickerSearch(forceAll=false,message='') {
  const q=tickerSearch.value.trim().toLowerCase(); const matches=searchableUniverse().filter(s=>forceAll||q).filter(s=>forceAll||s.ticker.toLowerCase().includes(q)||String(s.company||'').toLowerCase().includes(q)).sort((a,b)=>a.ticker.localeCompare(b.ticker));
  if(message){tickerSearchResults.innerHTML=`<p class="ticker-search-hint">${message}</p>`;return;}
  if(!q&&!forceAll){tickerSearchResults.innerHTML='<p class="ticker-search-hint">Search the full JSE Main Market universe. Adding a new ticker persists the watchlist and triggers the daily dataset sync.</p>';return;}
  if(!matches.length){tickerSearchResults.innerHTML='<div class="ticker-result empty"><div><strong>No Main Market match.</strong></div></div>';return;}
  tickerSearchResults.innerHTML=matches.map(s=>{const active=state.tracked.has(s.ticker),detailed=detailedMap().has(s.ticker);return `<div class="ticker-result"><div class="ticker-result-main"><strong>${s.ticker}</strong><span>${s.company||''}</span><small>${money(s.price)} • ${s.rating||'Analysis pending'}${s.trailingYield!=null?` • ${fmt(s.trailingYield,2)}% yield`:''}${active&&!detailed?' • syncing daily analysis':''}</small></div><div class="ticker-result-actions"><a href="${s.sa||`https://stockanalysis.com/quote/jmse/${s.ticker}/`}" target="_blank" rel="noreferrer">Analyze ↗</a><button type="button" class="track-toggle ${active?'remove':'add'}" data-ticker="${s.ticker}">${active?'Remove':'+ Add'}</button></div></div>`;}).join('');
}

function refreshAll(){renderSummary();renderAnalysis();render();renderTickerSearch();}

async function toggleTracked(ticker){if(state.tracked.has(ticker)){if(state.tracked.size===1)return;state.tracked.delete(ticker);}else state.tracked.add(ticker);refreshAll();renderTickerSearch(false,'Saving watchlist…');const result=await saveWatchlist();refreshAll();if(!result.ok)renderTickerSearch(false,`Saved only in this browser. Server persistence needs Netlify GITHUB_WATCHLIST_TOKEN. ${result.error||''}`);}

document.querySelectorAll('.filter-tile').forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;render();}));
document.getElementById('sortSelect').addEventListener('change',e=>{state.sort=e.target.value;render();});
document.getElementById('tableViewBtn').addEventListener('click',()=>{tableView.classList.remove('hidden');cardView.classList.add('hidden');document.getElementById('tableViewBtn').classList.add('active');document.getElementById('cardViewBtn').classList.remove('active');});
document.getElementById('cardViewBtn').addEventListener('click',()=>{tableView.classList.add('hidden');cardView.classList.remove('hidden');document.getElementById('cardViewBtn').classList.add('active');document.getElementById('tableViewBtn').classList.remove('active');});
tickerSearch.addEventListener('input',()=>renderTickerSearch());
document.getElementById('showAllTickersBtn').addEventListener('click',()=>renderTickerSearch(true));
tickerSearchResults.addEventListener('click',e=>{const btn=e.target.closest('[data-ticker]');if(btn)toggleTracked(btn.dataset.ticker);});
document.getElementById('resetTrackedBtn').addEventListener('click',async()=>{state.tracked=new Set(stocks.map(s=>s.ticker));refreshAll();await saveWatchlist();refreshAll();});
document.getElementById('themeToggle').addEventListener('click',()=>{const root=document.documentElement;const next=root.dataset.theme==='dark'?'light':'dark';root.dataset.theme=next;document.getElementById('themeToggle').textContent=next==='dark'?'☀':'☾';});

await Promise.all([loadPersistentWatchlist(),loadUniverse()]);
refreshAll();
