import fs from 'node:fs/promises';
import vm from 'node:vm';

const UNIVERSE_URL = 'https://raw.githubusercontent.com/kbuckle10/jse-main-market-dashboard/main/data.json';

async function loadDataJs() {
  const raw = await fs.readFile('data.js', 'utf8');
  const match = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${match[1]})`);
}

function parseRange(text) {
  if (!text || typeof text !== 'string') return [null, null];
  const nums = [...text.matchAll(/([0-9]+(?:\.[0-9]+)?)/g)].map(m => Number(m[1]));
  return nums.length >= 2 ? [nums[0], nums[1]] : [null, null];
}

function ratingMap(rating = '') {
  const r = String(rating).toUpperCase();
  if (r.includes('STRONG BUY')) return ['Strong Buy', 'buy'];
  if (r.includes('BUY')) return ['Buy/Accumulate', 'buy'];
  if (r.includes('AVOID') || r.includes('SELL')) return ['Avoid/Sell', 'avoid'];
  if (r.includes('WATCH')) return ['Watch/Wait', 'hold'];
  return ['Hold / Buy dips', 'hold'];
}

function baselineFromUniverse(u, index) {
  const [buyLow, buyHigh] = parseRange(u.buyZone);
  const [rating, ratingClass] = ratingMap(u.rating);
  const price = Number.isFinite(Number(u.price)) ? Number(u.price) : null;
  const ttmDps = Number.isFinite(Number(u.dps)) ? Number(u.dps) : null;
  const trailingYield = Number.isFinite(Number(u.divYield)) ? Number(u.divYield) : (price && ttmDps ? ttmDps / price * 100 : null);
  let zoneStatus = 'above';
  if (price != null && buyLow != null && buyHigh != null) zoneStatus = price < buyLow ? 'below' : price <= buyHigh ? 'in' : 'above';
  return {
    rank: index + 1,
    ticker: u.ticker,
    company: u.company || u.ticker,
    price,
    priceDate: u.priceDate ? `${u.priceDate} • ${u.priceSource || 'Universe'}` : 'Weekly universe baseline',
    dayJmd: u.dayJmd ?? null,
    dayPct: u.dayPct ?? null,
    w1: u.w1 ?? null,
    m1: u.m1 ?? null,
    ytd: u.ytd ?? null,
    m3: u.m3 ?? null,
    m6: null,
    y1: null,
    performanceSource: u.performanceSource || 'SA',
    ttmDps,
    trailingYield,
    forwardYield: null,
    latestDividend: null,
    exDate: 'N/A',
    recordDate: 'N/A',
    payDate: 'N/A',
    dividendStatus: 'Dividend details pending daily refresh',
    rating,
    ratingClass,
    reason: `${u.ratingBasis || 'Main Market'} baseline from the weekly Main Market research universe. Daily refresh will enrich price/performance; dividend fields require official JSE declaration data.`,
    buyLow,
    buyHigh,
    buyYieldLow: buyHigh && ttmDps ? ttmDps / buyHigh * 100 : null,
    buyYieldHigh: buyLow && ttmDps ? ttmDps / buyLow * 100 : null,
    zoneStatus,
    allocation: Math.max(Number(u.score) || 1, 1),
    jse: u.jseUrl || `https://www.jamstockex.com/?s=${encodeURIComponent(u.ticker)}`,
    dividendUrl: `https://www.jamstockex.com/?tag=${encodeURIComponent(u.ticker)}`,
    sa: `https://stockanalysis.com/quote/jmse/${encodeURIComponent(u.ticker)}/`,
    source: u.priceSource || 'Universe',
    volume: u.volume ?? null,
    sector: u.sector || 'Other'
  };
}

const watchlistDoc = JSON.parse(await fs.readFile('watchlist.json', 'utf8'));
const selected = [...new Set((watchlistDoc.tickers || []).map(t => String(t).toUpperCase()))];
if (!selected.length) throw new Error('watchlist.json contains no tickers');

const universeRes = await fetch(UNIVERSE_URL, { headers: { 'user-agent': 'daily-jse-market-dashboard' } });
if (!universeRes.ok) throw new Error(`Unable to fetch Main Market universe (${universeRes.status})`);
const universeDoc = await universeRes.json();
const universeMap = new Map((universeDoc.stocks || []).map(s => [String(s.ticker).toUpperCase(), s]));
const data = await loadDataJs();
const existingMap = new Map((data.stocks || []).map(s => [String(s.ticker).toUpperCase(), s]));

const missingFromUniverse = selected.filter(t => !universeMap.has(t) && !existingMap.has(t));
if (missingFromUniverse.length) throw new Error(`Unknown watchlist tickers: ${missingFromUniverse.join(', ')}`);

const nextStocks = selected.map((ticker, index) => {
  const existing = existingMap.get(ticker);
  if (existing) return { ...existing, rank: index + 1 };
  return baselineFromUniverse(universeMap.get(ticker), index);
});

data.stocks = nextStocks;
data.updated = data.updated || new Date().toISOString().slice(0, 10);
data.watchlistUpdated = watchlistDoc.updated || null;
data.universeSource = UNIVERSE_URL;

await fs.writeFile('data.js', `window.JSE_DASHBOARD_DATA = ${JSON.stringify(data, null, 2)};\n`);
console.log(`Synced ${nextStocks.length} tracked tickers from watchlist.json: ${selected.join(', ')}`);
