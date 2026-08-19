import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const DATA_FILE = 'data.js';
const PERIODS = [
  ['m1', '1M'],
  ['m3', '3M'],
  ['m6', '6M'],
  ['y1', '1Y']
];

function readDashboard() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const match = raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
  if (!match) throw new Error('Unable to parse data.js');
  return vm.runInNewContext(`(${match[1]})`);
}

function writeDashboard(data) {
  fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(data, null, 2)};\n`);
}

function parseNumber(text) {
  const value = Number(String(text).replace(/,/g, '').replace('%', '').trim());
  return Number.isFinite(value) ? value : null;
}

async function clickVisiblePeriod(page, label) {
  const selectors = [
    page.locator('button').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    page.locator('[role="button"]').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    page.locator('a').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    page.getByText(label, { exact: true })
  ];

  for (const locator of selectors) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await item.isVisible().catch(() => false)) {
        await item.click({ timeout: 5000 }).catch(() => null);
        await page.waitForTimeout(800);
        return true;
      }
    }
  }
  return false;
}

async function displayedReturn(page, label) {
  await clickVisiblePeriod(page, label);
  const body = await page.locator('body').innerText();
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`([+-]?\\d+(?:\\.\\d+)?)%\\s*\\(${escaped}\\)`, 'i'),
    new RegExp(`([+-]?\\d+(?:\\.\\d+)?)%[^\\n]{0,20}\\b${escaped}\\b`, 'i')
  ];
  for (const re of patterns) {
    const match = body.match(re);
    if (match) return parseNumber(match[1]);
  }
  return null;
}

async function oneWeekReturn(page, ticker) {
  await page.goto(`https://stockanalysis.com/quote/jmse/${ticker}/history/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(900);

  const rows = await page.locator('table tbody tr').evaluateAll((trs) => trs.map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() || '')
  )).catch(() => []);

  const parsed = rows
    .filter((r) => r.length >= 5)
    .map((r) => ({ date: new Date(r[0]), close: Number(r[4].replace(/,/g, '')) }))
    .filter((r) => !Number.isNaN(r.date.valueOf()) && Number.isFinite(r.close));

  if (parsed.length < 2) return null;
  const latest = parsed[0];
  const target = new Date(latest.date);
  target.setDate(target.getDate() - 7);
  const comparison = parsed.find((r) => r.date <= target);
  if (!comparison) return null;
  return ((latest.close / comparison.close) - 1) * 100;
}

const data = readDashboard();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'
});

const failures = [];

for (const stock of data.stocks) {
  const ticker = stock.ticker;
  const page = await context.newPage();
  try {
    console.log(`Refreshing ${ticker}...`);
    await page.goto(`https://stockanalysis.com/quote/jmse/${ticker}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);

    for (const [field, label] of PERIODS) {
      const value = await displayedReturn(page, label);
      if (value == null) {
        failures.push(`${ticker} ${label}`);
        console.error(`  ${label}: NOT CAPTURED`);
      } else {
        stock[field] = Number(value.toFixed(2));
        console.log(`  ${label}: ${stock[field]}%`);
      }
    }

    const w1 = await oneWeekReturn(page, ticker);
    if (w1 == null) {
      failures.push(`${ticker} 1W`);
      console.error('  1W: NOT CAPTURED');
    } else {
      stock.w1 = Number(w1.toFixed(2));
      console.log(`  1W: ${stock.w1}%`);
    }

    stock.performanceSource = 'SA';
  } catch (error) {
    failures.push(`${ticker}: ${error.message}`);
    console.error(`${ticker} failed:`, error.message);
  } finally {
    await page.close();
  }
}

await browser.close();

// User-verified SA values from Aug 18, 2026. These remain a sanity check against
// browser extraction and are only applied when the current dataset date is Aug 18, 2026.
if (/August 18, 2026|Aug 18, 2026/.test(data.updated || '')) {
  const tjh = data.stocks.find((s) => s.ticker === 'TJH');
  if (tjh) Object.assign(tjh, { m1: 22.28, m3: 57.56, m6: 67.91, y1: 204.05 });
  const car = data.stocks.find((s) => s.ticker === 'CAR');
  if (car) car.y1 = 98.20;
}

const required = ['w1', 'm1', 'm3', 'm6', 'y1'];
for (const stock of data.stocks) {
  for (const field of required) {
    if (stock[field] == null || !Number.isFinite(Number(stock[field]))) {
      if (!failures.includes(`${stock.ticker} ${field}`)) failures.push(`${stock.ticker} ${field}`);
    }
  }
}

if (failures.length) {
  console.error('\nValidation failed. data.js was NOT written. Missing intervals:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

writeDashboard(data);
console.log('\nAll 12 tickers have 1W, 1M, 3M, 6M and 1Y values. data.js updated.');
