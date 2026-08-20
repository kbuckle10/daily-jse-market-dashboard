import fs from 'node:fs';
import vm from 'node:vm';

const DATA_FILE = 'data.js';
const MASTER_URL = 'https://raw.githubusercontent.com/kbuckle10/jse-main-market-dashboard/main/data.json';

function readDashboard() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const m = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}

function writeDashboard(data) {
  fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(data, null, 2)};\n`);
}

function parseRange(value) {
  if (!value) return [null, null];
  const nums = String(value).match(/[0-9]+(?:\.[0-9]+)?/g)?.map(Number) || [];
  return nums.length >= 2 ? [nums[0], nums[1]] : [null, null];
}

function ratingClass(rating='') {
  const r = rating.toUpperCase();
  if (r.includes('BUY')) return 'buy';
  if (r.includes('AVOID') || r.includes('SELL')) return 'avoid';
  return 'hold';
}

function zoneStatus(price, low, high) {
  if (![price, low, high].every(v => Number.isFinite(Number(v)))) return 'unknown';
  return price < low ? 'below' : price > high ? 'above' : 'in';
}

const current = readDashboard();
const existing = new Map(current.stocks.map(s => [s.ticker, s]));

const res = await fetch(MASTER_URL, { headers: { 'user-agent': 'daily-jse-market-dashboard-sync' } });
if (!res.ok) throw new Error(`Master universe fetch failed: HTTP ${res.status}`);
const master = await res.json();
if (!Array.isArray(master.stocks) || !master.stocks.length) throw new Error('Master universe is empty');

const merged = master.stocks.map((m, i) => {
  const ticker = String(m.ticker || '').toUpperCase();
  const prior = existing.get(ticker) || {};
  const [buyLow, buyHigh] = parseRange(m.buyZone);
  const dps = prior.ttmDps ?? m.dps ?? null;
  const price = m.price ?? prior.price ?? null;
  const trailingYield = dps != null && price ? Number((dps / price * 100).toFixed(2)) : (prior.trailingYield ?? m.divYield ?? null);
  const score = Number(m.score ?? prior.score ?? 0);
  return {
    ...prior,
    rank: i + 1,
    ticker,
    company: m.company || prior.company || ticker,
    sector: m.sector || prior.sector || 'Other',
    price,
    priceDate: m.priceDate ? `${m.priceDate} • ${m.priceSource || m.source || 'master'}` : (prior.priceDate || 'Weekly master universe'),
    dayJmd: m.dayJmd ?? prior.dayJmd ?? null,
    dayPct: m.dayPct ?? prior.dayPct ?? null,
    w1: m.w1 ?? prior.w1 ?? null,
    m1: m.m1 ?? prior.m1 ?? null,
    ytd: m.ytd ?? prior.ytd ?? null,
    m3: m.m3 ?? prior.m3 ?? null,
    m6: m.m6 ?? prior.m6 ?? null,
    y1: m.y1 ?? prior.y1 ?? null,
    ttmDps: dps,
    trailingYield,
    latestDividend: prior.latestDividend ?? null,
    exDate: prior.exDate ?? 'N/A',
    recordDate: prior.recordDate ?? 'N/A',
    payDate: prior.payDate ?? 'N/A',
    dividendStatus: prior.dividendStatus ?? 'Dividend review pending',
    rating: prior.rating || (m.rating === 'BUY' ? 'Buy/Accumulate' : m.rating || 'Watch/Wait'),
    ratingClass: prior.ratingClass || ratingClass(m.rating),
    reason: prior.reason || `${m.ratingBasis || 'Main Market'} • score ${score || 'N/A'}. Weekly master-universe research baseline; daily price/history refresh follows.`,
    buyLow: prior.buyLow ?? buyLow,
    buyHigh: prior.buyHigh ?? buyHigh,
    buyYieldLow: prior.buyYieldLow ?? (dps && buyHigh ? Number((dps / buyHigh * 100).toFixed(2)) : null),
    buyYieldHigh: prior.buyYieldHigh ?? (dps && buyLow ? Number((dps / buyLow * 100).toFixed(2)) : null),
    zoneStatus: prior.buyLow != null && prior.buyHigh != null ? zoneStatus(price, prior.buyLow, prior.buyHigh) : zoneStatus(price, buyLow, buyHigh),
    allocation: prior.allocation ?? Math.max(score, 1),
    jse: m.jseUrl || prior.jse || `https://www.jamstockex.com/?s=${encodeURIComponent(ticker)}`,
    dividendUrl: prior.dividendUrl || `https://www.jamstockex.com/?tag=${encodeURIComponent(ticker)}`,
    sa: prior.sa || `https://stockanalysis.com/quote/jmse/${encodeURIComponent(ticker)}/`,
    source: m.source || m.priceSource || prior.source || 'MASTER',
    performanceSource: m.performanceSource || prior.performanceSource || 'SA',
    score
  };
}).filter(s => s.ticker);

current.stocks = merged;
current.updated = master.asOf || current.updated;
current.priceLabel = 'JSE official close where available / StockAnalysis delayed fallback';
writeDashboard(current);
console.log(`Synced ${merged.length} Main Market tickers from master universe.`);
