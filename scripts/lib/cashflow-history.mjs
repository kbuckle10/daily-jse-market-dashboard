// Annual cash-flow extraction shared by feasibility tests and the production collector.
// This module never writes dashboard data.
const metricPatterns = {
  operatingCashFlow: /^operating cash flow$/i,
  capitalExpenditures: /^capital expenditures?$/i,
  freeCashFlow: /^free cash flow$/i,
  debtIssued: /^(?:debt issued|issuance of debt|long.term debt issued|proceeds from borrowings)$/i,
  debtRepaid: /^(?:debt repaid|repayment of debt|long.term debt repaid|repayments of borrowings)$/i,
  stockBasedCompensation: /^(?:stock.based compensation|share.based compensation|share.based payments)$/i,
  shareRepurchases: /^(?:repurchase of (?:common )?stock|repurchase of shares|share repurchases|common stock repurchased|purchase of treasury stock|buyback of shares)$/i,
  shareIssuance: /^(?:issuance of (?:common )?stock|issuance of shares|proceeds from stock issuance|sale of common stock)$/i
};
const normalized = s => String(s ?? '').replace(/\s+/g, ' ').trim();
export function parseCashAmount(value, multiplier=1) {
  const raw=normalized(value);
  if (!raw || /^(?:-|--|—|n\/?a)$/i.test(raw)) return null;
  const negative=/^\(.*\)$/.test(raw);
  const clean=raw.replace(/[(),\s]/g,'').replace(/^(?:JMD|TTD|USD|J\$|TT\$|US\$|\$)/i,'');
  const match=clean.match(/^([+-]?\d*\.?\d+)([KMBT])?$/i);
  if(!match) return null;
  const scale=({K:1e3,M:1e6,B:1e9,T:1e12})[match[2]?.toUpperCase()] ?? multiplier;
  const number=Number(match[1])*scale*(negative?-1:1);
  return Number.isFinite(number)?number:null;
}
export async function extractCashFlowHistory(page) {
  const body=await page.locator('body').innerText();
  const meta=body.match(/Financials?\s+in\s+(?:(millions|billions|thousands)\s+)?(USD|JMD|TTD)/i);
  const units=meta?.[1]?.toLowerCase() ?? null;
  const currency=meta?.[2]?.toUpperCase() ?? null;
  const multiplier=({millions:1e6,billions:1e9,thousands:1e3})[units] ?? 1;
  const byPeriod=new Map();
  const tables=page.locator('table');
  for(let i=0;i<await tables.count();i++){
    const table=tables.nth(i);
    const headerRows=table.locator('thead tr');
    if(!await headerRows.count())continue;
    const headers=(await headerRows.first().locator('th,td').allTextContents()).map(normalized);
    const periods=headers.slice(1).map(h=>/^FY\s*(20\d{2})$/i.exec(h)?.[1] ?? (/^TTM$/i.test(h)?'TTM':null));
    if(!periods.some(Boolean))continue;
    const rows=table.locator('tbody tr');
    for(let j=0;j<await rows.count();j++){
      const cells=(await rows.nth(j).locator('th,td').allTextContents()).map(normalized);
      const key=Object.keys(metricPatterns).find(k=>metricPatterns[k].test(cells[0]??''));
      if(!key)continue;
      for(let k=0;k<periods.length;k++){
        const period=periods[k];if(!period)continue;
        if(!byPeriod.has(period))byPeriod.set(period,{period});
        const value=parseCashAmount(cells[k+1],multiplier);
        if(value!==null)byPeriod.get(period)[key]=value;
      }
    }
  }
  const annual=[...byPeriod.values()].filter(p=>/^20\d{2}$/.test(p.period)).sort((a,b)=>Number(a.period)-Number(b.period));
  const ttm=byPeriod.get('TTM')??null;
  const valid=Boolean(currency && annual.length && annual.some(p=>p.operatingCashFlow!=null && p.capitalExpenditures!=null && p.freeCashFlow!=null));
  const reconciliation=annual.filter(p=>p.operatingCashFlow!=null&&p.capitalExpenditures!=null&&p.freeCashFlow!=null).map(p=>({
    period:p.period,
    discrepancy:p.freeCashFlow-(p.operatingCashFlow+p.capitalExpenditures)
  }));
  return {status:valid?'captured':'incomplete',currency,units,annual,ttm,reconciliation};
}
