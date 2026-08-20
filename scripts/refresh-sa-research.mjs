import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE = 'data.js';
const RESEARCH_PAGES = ['', 'financials/', 'statistics/'];
const DIVIDEND_PAGE = 'dividend/';

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const m = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}
function writeData(d) { fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(d, null, 2)};\n`); }
const num = s => {
  if (s == null) return null;
  const v = Number(String(s).replace(/[,$%x]/gi, '').trim());
  return Number.isFinite(v) ? v : null;
};
const pctNum = s => num(s);
function grab(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}
async function goto(page, url) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      return true;
    } catch (e) {
      if (i === 2) console.warn(`goto failed ${url}: ${e.message}`);
      else await page.waitForTimeout(1000 * (i + 1));
    }
  }
  return false;
}

function parseStats(text) {
  return {
    pe: num(grab(text, [/PE Ratio\s*([0-9.]+)/i, /P\/E Ratio\s*([0-9.]+)/i])),
    forwardPe: num(grab(text, [/Forward PE\s*([0-9.]+)/i, /Forward P\/E\s*([0-9.]+)/i])),
    pb: num(grab(text, [/PB Ratio\s*([0-9.]+)/i, /P\/B Ratio\s*([0-9.]+)/i, /Price\/Book\s*([0-9.]+)/i])),
    roe: pctNum(grab(text, [/Return on Equity \(ROE\)\s*([+-]?[0-9.]+)%/i, /ROE\s*([+-]?[0-9.]+)%/i])),
    roa: pctNum(grab(text, [/Return on Assets \(ROA\)\s*([+-]?[0-9.]+)%/i, /ROA\s*([+-]?[0-9.]+)%/i])),
    payout: pctNum(grab(text, [/Payout Ratio\s*([+-]?[0-9.]+)%/i])),
    eps: num(grab(text, [/EPS \(ttm\)\s*([+-]?[0-9.]+)/i, /EPS\s*([+-]?[0-9.]+)/i])),
    epsGrowth: pctNum(grab(text, [/EPS Growth\s*([+-]?[0-9.]+)%/i])),
    revenueGrowth: pctNum(grab(text, [/Revenue Growth\s*([+-]?[0-9.]+)%/i])),
    netIncomeGrowth: pctNum(grab(text, [/Net Income Growth\s*([+-]?[0-9.]+)%/i])),
    debtEquity: num(grab(text, [/Debt \/ Equity Ratio\s*([0-9.]+)/i, /Debt\/Equity\s*([0-9.]+)/i])),
    currentRatio: num(grab(text, [/Current Ratio\s*([0-9.]+)/i])),
    marketCap: grab(text, [/Market Cap\s*([A-Z$0-9.,]+[BMKT]?)/i])
  };
}

// IMPORTANT: dividend values are parsed ONLY from StockAnalysis /dividend/.
// Do not use a generic "Yield" pattern; that can capture earnings yield or another metric.
function parseDividendSummary(text) {
  return {
    annualDps: num(grab(text, [
      /Annual Dividend\s*(?:J\$|TT\$|US\$|\$)?\s*([0-9.]+)/i,
      /Dividend \(ttm\)\s*(?:J\$|TT\$|US\$|\$)?\s*([0-9.]+)/i
    ])),
    yield: pctNum(grab(text, [/Dividend Yield\s*([0-9.]+)%/i])),
    payout: pctNum(grab(text, [/Payout Ratio\s*([0-9.]+)%/i])),
    dividendGrowth: pctNum(grab(text, [/Dividend Growth\s*([+-]?[0-9.]+)%/i]))
  };
}

async function firstDividendRow(page) {
  try {
    const tables = page.locator('table');
    const n = await tables.count();
    for (let i = 0; i < n; i++) {
      const table = tables.nth(i);
      const headers = await table.locator('thead th').allTextContents().catch(() => []);
      const rows = await table.locator('tbody tr').count().catch(() => 0);
      if (!rows) continue;
      const h = headers.map(x => x.trim().toLowerCase());
      if (!h.some(x => /ex-dividend|ex date|dividend/.test(x))) continue;
      const cells = await table.locator('tbody tr').first().locator('td').allTextContents();
      const out = {};
      for (let j = 0; j < cells.length; j++) out[h[j] || `c${j}`] = cells[j].trim();
      const get = re => { const k = Object.keys(out).find(x => re.test(x)); return k ? out[k] : null; };
      return {
        exDate: get(/ex-dividend|ex date/),
        recordDate: get(/record/),
        payDate: get(/payment|pay date/),
        amount: num(get(/amount|dividend/))
      };
    }
    return null;
  } catch { return null; }
}

function validateDividend(price, dv) {
  const dps = num(dv.annualDps);
  const reportedYield = num(dv.yield);
  if (dps == null && reportedYield == null) return { dps: null, yield: null, status: 'missing' };
  if (price == null || price <= 0) return { dps, yield: reportedYield, status: 'price-missing' };

  let effectiveDps = dps;
  if (effectiveDps == null && reportedYield != null && reportedYield >= 0 && reportedYield <= 25) {
    effectiveDps = Number((price * reportedYield / 100).toFixed(4));
  }
  if (effectiveDps == null) return { dps: null, yield: null, status: 'missing' };

  const impliedYield = effectiveDps / price * 100;
  if (!Number.isFinite(impliedYield) || impliedYield < 0 || impliedYield > 25) {
    return { dps: null, yield: null, status: 'validation-error' };
  }
  if (effectiveDps === 0 && reportedYield != null && reportedYield > 0.05) {
    return { dps: null, yield: null, status: 'validation-error' };
  }
  if (reportedYield != null) {
    const tolerance = Math.max(0.75, reportedYield * 0.25);
    if (Math.abs(impliedYield - reportedYield) > tolerance) {
      return { dps: null, yield: null, status: 'currency-or-parser-mismatch' };
    }
  }
  return {
    dps: Number(effectiveDps.toFixed(4)),
    yield: Number(impliedYield.toFixed(2)),
    status: dps == null ? 'derived-from-dividend-yield' : 'validated'
  };
}

function sectorTargetPE(sector = '') {
  const s = sector.toLowerCase();
  if (/bank|financial|investment|insurance/.test(s)) return 11;
  if (/utility|infrastructure|transport/.test(s)) return 14;
  if (/consumer|manufactur|food|beverage/.test(s)) return 15;
  return 13;
}
function targetYield(sector = '') {
  const s = sector.toLowerCase();
  if (/bank|financial|investment/.test(s)) return 4.5;
  if (/consumer|staple|tobacco/.test(s)) return 4.25;
  if (/infrastructure|transport/.test(s)) return 3.5;
  return 4.0;
}
function autoAnalyze(s) {
  const price = num(s.price), eps = num(s.epsTtm), dps = num(s.ttmDps), pe = num(s.pe), roe = num(s.roe), growth = num(s.epsGrowth), payout = num(s.payoutRatio);
  let fair = null;
  const peFair = eps && eps > 0 ? eps * sectorTargetPE(s.sector) : null;
  const yieldFair = dps && dps > 0 ? dps / (targetYield(s.sector) / 100) : null;
  if (peFair && yieldFair) fair = peFair * 0.65 + yieldFair * 0.35;
  else fair = peFair || yieldFair;

  if (fair && fair > 0) {
    const low = fair * 0.78, high = fair * 0.9;
    if (s.buyLow == null || s.analysisSource === 'AUTO-SA') s.buyLow = Number(low.toFixed(2));
    if (s.buyHigh == null || s.analysisSource === 'AUTO-SA') s.buyHigh = Number(high.toFixed(2));
    s.fairValue = Number(fair.toFixed(2));
    if (dps) {
      s.buyYieldLow = Number((dps / s.buyHigh * 100).toFixed(2));
      s.buyYieldHigh = Number((dps / s.buyLow * 100).toFixed(2));
    }
    if (price) s.zoneStatus = price < s.buyLow ? 'below' : price > s.buyHigh ? 'above' : 'in';
  }

  let score = 50;
  if (pe && pe > 0) { if (pe < 10) score += 14; else if (pe < 14) score += 9; else if (pe > 22) score -= 10; }
  if (roe != null) { if (roe >= 18) score += 12; else if (roe >= 12) score += 7; else if (roe < 7) score -= 8; }
  if (growth != null) { if (growth >= 15) score += 12; else if (growth >= 5) score += 6; else if (growth < 0) score -= 10; }
  if (payout != null) { if (payout <= 65) score += 7; else if (payout > 100) score -= 12; }
  if (s.dividendDataStatus === 'validated' || s.dividendDataStatus === 'derived-from-dividend-yield') {
    if (s.trailingYield >= 4) score += 7; else if (s.trailingYield >= 3) score += 4;
  }
  if (price && fair) { const upside = fair / price - 1; if (upside >= .25) score += 10; else if (upside >= .1) score += 5; else if (upside < -.1) score -= 10; }
  score = Math.max(0, Math.min(100, score));
  const rating = score >= 78 ? 'Strong Buy' : score >= 65 ? 'Buy/Accumulate' : score >= 52 ? 'Hold' : score >= 40 ? 'Watch/Wait' : 'Avoid';
  if (!s.rating || /pending|n\/a/i.test(s.rating) || s.analysisSource === 'AUTO-SA') {
    s.rating = rating;
    s.ratingClass = /Buy/i.test(rating) ? 'buy' : rating === 'Avoid' ? 'avoid' : 'hold';
    s.reason = `Auto-SA fundamentals: P/E ${pe ?? 'N/A'}, ROE ${roe != null ? roe + '%' : 'N/A'}, EPS growth ${growth != null ? growth + '%' : 'N/A'}, dividend yield ${s.trailingYield != null ? s.trailingYield + '%' : 'N/A'}; score ${score}/100.`;
    s.allocation = Math.max(score, 1);
    s.score = score;
    s.analysisSource = 'AUTO-SA';
  }
}

const data = readData();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36' });

for (const s of data.stocks) {
  console.log(`\n=== ${s.ticker} research ===`);
  let researchText = '';
  let dividendText = '';
  let divRow = null;
  let researchFetchOk = false;
  let dividendFetchOk = false;

  for (const suffix of RESEARCH_PAGES) {
    const page = await context.newPage();
    try {
      const url = `https://stockanalysis.com/quote/jmse/${s.ticker}/${suffix}`;
      if (!await goto(page, url)) continue;
      await page.waitForTimeout(350);
      const text = await page.locator('body').innerText().catch(() => '');
      if (text) { researchText += '\n' + text; researchFetchOk = true; }
    } finally { await page.close(); }
  }

  const divPage = await context.newPage();
  try {
    const url = `https://stockanalysis.com/quote/jmse/${s.ticker}/${DIVIDEND_PAGE}`;
    if (await goto(divPage, url)) {
      await divPage.waitForTimeout(350);
      dividendText = await divPage.locator('body').innerText().catch(() => '');
      dividendFetchOk = Boolean(dividendText);
      divRow = await firstDividendRow(divPage);
    }
  } finally { await divPage.close(); }

  const st = parseStats(researchText);
  const dv = parseDividendSummary(dividendText);
  s.pe = st.pe ?? s.pe ?? null;
  s.forwardPe = st.forwardPe ?? s.forwardPe ?? null;
  s.pb = st.pb ?? s.pb ?? null;
  s.roe = st.roe ?? s.roe ?? null;
  s.roa = st.roa ?? s.roa ?? null;
  s.epsTtm = st.eps ?? s.epsTtm ?? null;
  s.epsGrowth = st.epsGrowth ?? s.epsGrowth ?? null;
  s.revenueGrowth = st.revenueGrowth ?? s.revenueGrowth ?? null;
  s.netIncomeGrowth = st.netIncomeGrowth ?? s.netIncomeGrowth ?? null;
  s.debtEquity = st.debtEquity ?? s.debtEquity ?? null;
  s.currentRatio = st.currentRatio ?? s.currentRatio ?? null;
  s.payoutRatio = dv.payout ?? st.payout ?? s.payoutRatio ?? null;
  s.dividendGrowth = dv.dividendGrowth ?? s.dividendGrowth ?? null;

  const validated = validateDividend(num(s.price), dv);
  s.dividendDataStatus = validated.status;
  if (validated.status === 'validated' || validated.status === 'derived-from-dividend-yield') {
    s.ttmDps = validated.dps;
    s.trailingYield = validated.yield;
  } else if (validated.status === 'missing') {
    // True N/A: the dividend page contains no annual DPS or dividend yield.
    s.ttmDps = null;
    s.trailingYield = null;
  } else if (!dividendFetchOk) {
    // True N/A: scraper could not retrieve the dividend page.
    s.ttmDps = null;
    s.trailingYield = null;
    s.dividendDataStatus = 'scraper-error';
  } else {
    // True N/A: values were present but failed consistency/currency validation.
    s.ttmDps = null;
    s.trailingYield = null;
  }

  // Never overwrite known official/JSE declaration fields with StockAnalysis.
  if (divRow) {
    const status = String(s.dividendStatus || '');
    const mayFill = !status || /pending|unknown|n\/a/i.test(status);
    if (mayFill && s.latestDividend == null) s.latestDividend = divRow.amount ?? s.latestDividend;
    if (mayFill && (!s.exDate || s.exDate === 'N/A')) s.exDate = divRow.exDate || s.exDate;
    if (mayFill && (!s.recordDate || s.recordDate === 'N/A')) s.recordDate = divRow.recordDate || s.recordDate;
    if (mayFill && (!s.payDate || s.payDate === 'N/A')) s.payDate = divRow.payDate || s.payDate;
    if (/pending/i.test(status)) s.dividendStatus = 'SA dividend history captured — verify JSE official announcement';
  }

  s.researchSource = 'StockAnalysis';
  s.researchUpdated = new Date().toISOString();
  s.researchFetchStatus = researchFetchOk ? 'ok' : 'scraper-error';
  autoAnalyze(s);
  console.log(`PE=${s.pe} PB=${s.pb} ROE=${s.roe} EPS=${s.epsTtm} DPS=${s.ttmDps} yield=${s.trailingYield} divStatus=${s.dividendDataStatus} rating=${s.rating}`);
}

await browser.close();
writeData(data);
console.log(`\nResearch refresh complete for ${data.stocks.length} stocks.`);