import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE = 'data.js';
const CROSSLISTED = { GHL: { market: 'ttse', ticker: 'GHL', currency: 'TTD' } };

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const m = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!m) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${m[1]})`);
}
function writeData(d) { fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(d, null, 2)};\n`); }
function parseScaled(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s || /^(?:n\/?a|--|-|—)$/i.test(s)) return null;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,\s]/g, '').replace(/^(?:JMD|TTD|USD|J\$|TT\$|US\$)/i, '');
  const m = s.match(/^([+-]?[0-9]*\.?[0-9]+)([KMBT])?$/i);
  if (!m) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[String(m[2] || '').toUpperCase()] || 1;
  const n = Number(m[1]) * scale * (neg ? -1 : 1);
  return Number.isFinite(n) ? n : null;
}
function parsePlain(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/[,$%x]/gi, '').trim());
  return Number.isFinite(n) ? n : null;
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
function marketConfig(s) {
  const c = CROSSLISTED[s.ticker];
  if (c) return c;
  return { market: 'jmse', ticker: s.ticker, currency: 'JMD' };
}
async function tableMetric(page, labelRegex) {
  const tables = page.locator('table');
  for (let i = 0; i < await tables.count(); i++) {
    const rows = tables.nth(i).locator('tbody tr');
    for (let r = 0; r < await rows.count(); r++) {
      const cells = await rows.nth(r).locator('th,td').allTextContents().catch(() => []);
      if (!cells.length || !labelRegex.test(cells[0].trim())) continue;
      for (let j = 1; j < cells.length; j++) {
        const n = parseScaled(cells[j]);
        if (n != null) return n;
      }
    }
  }
  return null;
}
async function firstPeriodLabel(page) {
  const headers = await page.locator('table thead tr').first().locator('th').allTextContents().catch(() => []);
  return headers.slice(1).map(x => x.trim()).find(Boolean) || null;
}
function textMetric(text, patterns, parser = parsePlain) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parser(m[1]);
      if (n != null) return n;
    }
  }
  return null;
}

const data = readData();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36' });

for (const s of data.stocks) {
  const cfg = marketConfig(s);
  const base = `https://stockanalysis.com/quote/${cfg.market}/${cfg.ticker}/`;
  console.log(`\n=== ${s.ticker} cash flow (${cfg.market.toUpperCase()}) ===`);
  let ok = false;
  let period = null;
  let operatingCashFlow = null;
  let freeCashFlow = null;
  let capitalExpenditures = null;
  let cashAndEquivalents = null;
  let freeCashFlowPerShare = null;

  const cashPage = await context.newPage();
  try {
    if (await goto(cashPage, `${base}financials/cash-flow-statement/`)) {
      ok = true;
      period = await firstPeriodLabel(cashPage);
      operatingCashFlow = await tableMetric(cashPage, /^(?:operating cash flow|cash from operating activities|net cash provided by operating activities)$/i);
      freeCashFlow = await tableMetric(cashPage, /^free cash flow$/i);
      capitalExpenditures = await tableMetric(cashPage, /^(?:capital expenditures|capital expenditure|capex)$/i);
    }
  } finally { await cashPage.close(); }

  const balancePage = await context.newPage();
  try {
    if (await goto(balancePage, `${base}financials/balance-sheet/`)) {
      ok = true;
      cashAndEquivalents = await tableMetric(balancePage, /^(?:cash & equivalents|cash and equivalents|cash & short-term investments|cash and short-term investments|cash, cash equivalents & short-term investments)$/i);
    }
  } finally { await balancePage.close(); }

  const statsPage = await context.newPage();
  try {
    if (await goto(statsPage, `${base}statistics/`)) {
      ok = true;
      const text = await statsPage.locator('body').innerText().catch(() => '');
      freeCashFlowPerShare = textMetric(text, [
        /Free Cash Flow Per Share\s*(?:J\$|TT\$|US\$|\$)?\s*([+-]?[0-9.,]+)/i,
        /FCF Per Share\s*(?:J\$|TT\$|US\$|\$)?\s*([+-]?[0-9.,]+)/i
      ]);
    }
  } finally { await statsPage.close(); }

  if (!ok) {
    s.cashFlowDataStatus = 'scraper-error';
    console.warn(`${s.ticker}: cash-flow pages unavailable`);
    continue;
  }

  s.operatingCashFlow = operatingCashFlow ?? s.operatingCashFlow ?? null;
  s.freeCashFlow = freeCashFlow ?? s.freeCashFlow ?? null;
  s.capitalExpenditures = capitalExpenditures ?? s.capitalExpenditures ?? null;
  s.cashAndEquivalents = cashAndEquivalents ?? s.cashAndEquivalents ?? null;
  s.freeCashFlowPerShare = freeCashFlowPerShare ?? s.freeCashFlowPerShare ?? null;
  s.cashFlowCurrency = cfg.currency;
  s.cashFlowPeriod = period ?? s.cashFlowPeriod ?? null;
  s.cashFlowSource = `StockAnalysis ${cfg.market.toUpperCase()}`;
  s.cashFlowUrl = `${base}financials/cash-flow-statement/`;
  s.cashFlowUpdated = new Date().toISOString();

  const dps = parsePlain(s.ttmDps);
  if (freeCashFlowPerShare != null && freeCashFlowPerShare > 0 && dps != null && dps >= 0) {
    s.fcfPayoutRatio = Number((dps / freeCashFlowPerShare * 100).toFixed(2));
  } else if (freeCashFlowPerShare != null && freeCashFlowPerShare <= 0) {
    s.fcfPayoutRatio = null;
  }

  const found = [operatingCashFlow, freeCashFlow, capitalExpenditures, cashAndEquivalents, freeCashFlowPerShare].some(v => v != null);
  s.cashFlowDataStatus = found ? 'captured' : 'not-found';
  console.log(`OCF=${s.operatingCashFlow ?? 'N/A'} FCF=${s.freeCashFlow ?? 'N/A'} FCF/share=${s.freeCashFlowPerShare ?? 'N/A'} cash=${s.cashAndEquivalents ?? 'N/A'} FCF payout=${s.fcfPayoutRatio ?? 'N/A'}`);
}

await browser.close();
writeData(data);
console.log(`Cash-flow refresh complete for ${data.stocks.length} stocks.`);
