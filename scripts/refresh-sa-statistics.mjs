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
function writeData(d) {
  fs.writeFileSync(DATA_FILE, `window.JSE_DASHBOARD_DATA = ${JSON.stringify(d, null, 2)};\n`);
}
function marketConfig(s) {
  const c = CROSSLISTED[s.ticker];
  return c || { market: 'jmse', ticker: s.ticker, currency: 'JMD' };
}
function parseScaled(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s || /^(?:n\/?a|--|-|—)$/i.test(s)) return null;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()\s]/g, '')
    .replace(/^(?:JMD|TTD|USD|J\$|TT\$|US\$|\$)/i, '')
    .replace(/,/g, '');
  const m = s.match(/^([+-]?[0-9]*\.?[0-9]+)([KMBT])?$/i);
  if (!m) return null;
  const scale = { K:1e3, M:1e6, B:1e9, T:1e12 }[String(m[2] || '').toUpperCase()] || 1;
  const n = Number(m[1]) * scale * (neg ? -1 : 1);
  return Number.isFinite(n) ? n : null;
}
function parsePlain(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || /^(?:n\/?a|--|-|—)$/i.test(s)) return null;
  const n = Number(s.replace(/[,$%x]/gi, '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
function parsePct(value) { return parsePlain(value); }

async function goto(page, url) {
  for (let i=0;i<3;i++) {
    try {
      await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
      await page.waitForLoadState('load', { timeout:8000 }).catch(()=>{});
      await page.keyboard.press('Escape').catch(()=>{});
      return true;
    } catch (e) {
      if (i === 2) console.warn(`goto failed ${url}: ${e.message}`);
      else await page.waitForTimeout(1000*(i+1));
    }
  }
  return false;
}

function normalizeLabel(s) {
  return String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
}
async function extractLabelValues(page) {
  const out = new Map();
  const rows = page.locator('table tr');
  const count = await rows.count().catch(()=>0);
  for (let i=0;i<count;i++) {
    const cells = await rows.nth(i).locator('th,td').allTextContents().catch(()=>[]);
    if (cells.length < 2) continue;
    const label = normalizeLabel(cells[0]);
    const value = cells.slice(1).map(x=>String(x).trim()).find(Boolean);
    if (label && value && !out.has(label)) out.set(label, value);
  }
  return out;
}
function val(map, labels) {
  for (const l of labels) {
    const v = map.get(normalizeLabel(l));
    if (v != null) return v;
  }
  return null;
}
function setNum(s, key, map, labels, parser=parsePlain) {
  const n = parser(val(map, labels));
  if (n != null) s[key] = n;
  else if (!(key in s)) s[key] = null;
}

const data = readData();
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({
  viewport:{ width:1440, height:1200 },
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'
});

for (const s of data.stocks) {
  const cfg = marketConfig(s);
  const url = `https://stockanalysis.com/quote/${cfg.market}/${cfg.ticker}/statistics/`;
  console.log(`\n=== ${s.ticker} statistics (${cfg.market.toUpperCase()}) ===`);
  const page = await context.newPage();
  try {
    if (!await goto(page, url)) {
      s.statisticsDataStatus = 'scraper-error';
      continue;
    }
    await page.waitForTimeout(500);
    const map = await extractLabelValues(page);
    if (!map.size) {
      s.statisticsDataStatus = 'not-found';
      continue;
    }

    // Valuation & share structure
    setNum(s,'marketCap',map,['Market Cap'],parseScaled);
    setNum(s,'enterpriseValue',map,['Enterprise Value'],parseScaled);
    setNum(s,'sharesOutstanding',map,['Shares Outstanding'],parseScaled);
    setNum(s,'currentShareClass',map,['Current Share Class'],parseScaled);
    setNum(s,'sharesChangeYoY',map,['Shares Change (YoY)'],parsePct);
    setNum(s,'sharesChangeQoQ',map,['Shares Change (QoQ)'],parsePct);
    setNum(s,'insiderOwnershipPct',map,['Owned by Insiders (%)'],parsePct);
    setNum(s,'institutionalOwnershipPct',map,['Owned by Institutions (%)'],parsePct);
    setNum(s,'floatShares',map,['Float'],parseScaled);

    setNum(s,'pe',map,['PE Ratio']);
    setNum(s,'forwardPe',map,['Forward PE']);
    setNum(s,'psRatio',map,['PS Ratio']);
    setNum(s,'pb',map,['PB Ratio']);
    setNum(s,'ptbvRatio',map,['P/TBV Ratio']);
    setNum(s,'pfcfRatio',map,['P/FCF Ratio']);
    setNum(s,'pocfRatio',map,['P/OCF Ratio']);
    setNum(s,'pegRatio',map,['PEG Ratio']);
    setNum(s,'evEarnings',map,['EV / Earnings']);
    setNum(s,'evSales',map,['EV / Sales']);
    setNum(s,'evEbitda',map,['EV / EBITDA']);
    setNum(s,'evEbit',map,['EV / EBIT']);
    setNum(s,'evFcf',map,['EV / FCF']);

    // Financial position & efficiency
    setNum(s,'currentRatio',map,['Current Ratio']);
    setNum(s,'quickRatio',map,['Quick Ratio']);
    setNum(s,'debtEquity',map,['Debt / Equity']);
    setNum(s,'debtEbitda',map,['Debt / EBITDA']);
    setNum(s,'debtFcf',map,['Debt / FCF']);
    setNum(s,'interestCoverage',map,['Interest Coverage']);
    setNum(s,'roe',map,['Return on Equity (ROE)'],parsePct);
    setNum(s,'roa',map,['Return on Assets (ROA)'],parsePct);
    setNum(s,'roic',map,['Return on Invested Capital (ROIC)'],parsePct);
    setNum(s,'roce',map,['Return on Capital Employed (ROCE)'],parsePct);
    setNum(s,'wacc',map,['Weighted Average Cost of Capital (WACC)'],parsePct);
    setNum(s,'revenuePerEmployee',map,['Revenue Per Employee'],parseScaled);
    setNum(s,'profitPerEmployee',map,['Profits Per Employee'],parseScaled);
    setNum(s,'employeeCount',map,['Employee Count'],parseScaled);
    setNum(s,'assetTurnover',map,['Asset Turnover']);
    setNum(s,'inventoryTurnover',map,['Inventory Turnover']);
    setNum(s,'incomeTax',map,['Income Tax'],parseScaled);
    setNum(s,'effectiveTaxRate',map,['Effective Tax Rate'],parsePct);

    // Price/risk statistics
    setNum(s,'beta5Y',map,['Beta (5Y)']);
    setNum(s,'priceChange52W',map,['52-Week Price Change'],parsePct);
    setNum(s,'movingAverage50D',map,['50-Day Moving Average']);
    setNum(s,'movingAverage200D',map,['200-Day Moving Average']);
    setNum(s,'rsi',map,['Relative Strength Index (RSI)']);
    setNum(s,'averageVolume20D',map,['Average Volume (20 Days)'],parseScaled);

    // Income statement
    setNum(s,'revenueTtm',map,['Revenue'],parseScaled);
    setNum(s,'grossProfitTtm',map,['Gross Profit'],parseScaled);
    setNum(s,'operatingIncomeTtm',map,['Operating Income'],parseScaled);
    setNum(s,'pretaxIncomeTtm',map,['Pretax Income'],parseScaled);
    setNum(s,'netIncomeTtm',map,['Net Income'],parseScaled);
    setNum(s,'ebitdaTtm',map,['EBITDA'],parseScaled);
    setNum(s,'ebitTtm',map,['EBIT'],parseScaled);
    setNum(s,'epsTtm',map,['Earnings Per Share (EPS)']);

    // Balance sheet — use direct BVPS from StockAnalysis, not price/PB back-solving.
    setNum(s,'cashAndEquivalents',map,['Cash & Cash Equivalents','Cash & Equivalents'],parseScaled);
    setNum(s,'totalDebt',map,['Total Debt'],parseScaled);
    setNum(s,'netCash',map,['Net Cash'],parseScaled);
    setNum(s,'netCashPerShare',map,['Net Cash Per Share']);
    setNum(s,'equityBookValue',map,['Equity (Book Value)'],parseScaled);
    setNum(s,'bookValuePerShare',map,['Book Value Per Share']);
    setNum(s,'workingCapital',map,['Working Capital'],parseScaled);

    // Cash flow
    setNum(s,'operatingCashFlow',map,['Operating Cash Flow'],parseScaled);
    setNum(s,'capitalExpenditures',map,['Capital Expenditures'],parseScaled);
    setNum(s,'depreciationAmortization',map,['Depreciation & Amortization'],parseScaled);
    setNum(s,'netBorrowing',map,['Net Borrowing'],parseScaled);
    setNum(s,'freeCashFlow',map,['Free Cash Flow'],parseScaled);
    setNum(s,'freeCashFlowPerShare',map,['FCF Per Share']);

    // Margins
    setNum(s,'grossMargin',map,['Gross Margin'],parsePct);
    setNum(s,'operatingMargin',map,['Operating Margin'],parsePct);
    setNum(s,'pretaxMargin',map,['Pretax Margin'],parsePct);
    setNum(s,'profitMargin',map,['Profit Margin'],parsePct);
    setNum(s,'ebitdaMargin',map,['EBITDA Margin'],parsePct);
    setNum(s,'ebitMargin',map,['EBIT Margin'],parsePct);
    setNum(s,'fcfMargin',map,['FCF Margin'],parsePct);

    // Dividend & shareholder-return metrics
    setNum(s,'statisticsDividendPerShare',map,['Dividend Per Share']);
    setNum(s,'statisticsDividendYield',map,['Dividend Yield'],parsePct);
    setNum(s,'dividendGrowth',map,['Dividend Growth (YoY)'],parsePct);
    setNum(s,'yearsDividendGrowth',map,['Years of Dividend Growth']);
    setNum(s,'payoutRatio',map,['Payout Ratio'],parsePct);
    setNum(s,'buybackYield',map,['Buyback Yield'],parsePct);
    setNum(s,'shareholderYield',map,['Shareholder Yield'],parsePct);
    setNum(s,'earningsYield',map,['Earnings Yield'],parsePct);
    setNum(s,'fcfYield',map,['FCF Yield'],parsePct);

    // Quality scores
    setNum(s,'altmanZScore',map,['Altman Z-Score']);
    setNum(s,'piotroskiFScore',map,['Piotroski F-Score']);

    // Derived consistency checks for the dashboard.
    if (s.price != null && s.bookValuePerShare != null && Number(s.bookValuePerShare) > 0) {
      s.calculatedPbFromJsePrice = Number((Number(s.price) / Number(s.bookValuePerShare)).toFixed(4));
      s.bookDiscountPct = Number(((Number(s.bookValuePerShare) - Number(s.price)) / Number(s.bookValuePerShare) * 100).toFixed(2));
    }
    if (s.freeCashFlowPerShare != null && Number(s.freeCashFlowPerShare) > 0 && s.ttmDps != null) {
      s.fcfPayoutRatio = Number((Number(s.ttmDps) / Number(s.freeCashFlowPerShare) * 100).toFixed(2));
    }

    s.statisticsCurrency = cfg.currency;
    s.statisticsMarket = cfg.market.toUpperCase();
    s.statisticsSource = 'StockAnalysis';
    s.statisticsUrl = url;
    s.statisticsUpdated = new Date().toISOString();
    s.statisticsDataStatus = 'captured';

    const found = [s.bookValuePerShare,s.payoutRatio,s.freeCashFlow,s.cashAndEquivalents,s.roe,s.pb].filter(v=>v!=null).length;
    console.log(`BVPS=${s.bookValuePerShare ?? 'N/A'} P/B=${s.pb ?? 'N/A'} payout=${s.payoutRatio ?? 'N/A'} FCF=${s.freeCashFlow ?? 'N/A'} cash=${s.cashAndEquivalents ?? 'N/A'} key=${found}/6`);
  } finally {
    await page.close();
  }
}

await browser.close();
writeData(data);
console.log(`Comprehensive Statistics refresh complete for ${data.stocks.length} stocks.`);
