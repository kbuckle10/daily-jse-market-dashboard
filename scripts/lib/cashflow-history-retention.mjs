// Pure merge guard for historical statements. Never mutates existing dashboard objects.
export function mergeHistoricalCashFlow(previous, incoming, {expectedCurrency, now=new Date().toISOString()}={}){
 const old=previous?.cashFlowHistory;
 const fail=reason=>({cashFlowHistory:old??null,cashFlowHistoryStatus:old?'retained-last-good':'unavailable',reason});
 if(incoming?.status!=='captured')return fail('Source access or parsing failed');
 if(!expectedCurrency||incoming.currency!==expectedCurrency)return fail('Reporting currency mismatch');
 if(!Array.isArray(incoming.annual)||incoming.annual.length<5)return fail('Fewer than five fiscal years');
 const years=new Set();
 for(const p of incoming.annual){
  if(!/^20\d{2}$/.test(String(p.period))||years.has(String(p.period)))return fail('Invalid or duplicate fiscal year');
  years.add(String(p.period));
  for(const field of ['operatingCashFlow','capitalExpenditures','freeCashFlow']){
   if(!Number.isFinite(p[field]))return fail('Missing/nonfinite '+field);
  }
  const delta=Math.abs(p.freeCashFlow-(p.operatingCashFlow+p.capitalExpenditures));
  const tolerance=Math.max(0.01,Math.abs(p.operatingCashFlow)*0.02,Math.abs(p.freeCashFlow)*0.02);
  if(delta>tolerance)return fail('FCF reconciliation failed');
 }
 if(!incoming.ttm||!['operatingCashFlow','capitalExpenditures','freeCashFlow'].every(k=>Number.isFinite(incoming.ttm[k])))return fail('TTM incomplete');
 const ttmDelta=Math.abs(incoming.ttm.freeCashFlow-(incoming.ttm.operatingCashFlow+incoming.ttm.capitalExpenditures));
 const ttmTolerance=Math.max(0.01,Math.abs(incoming.ttm.operatingCashFlow)*0.02,Math.abs(incoming.ttm.freeCashFlow)*0.02);
 if(ttmDelta>ttmTolerance)return fail('TTM FCF reconciliation failed');
 const sorted=[...incoming.annual].sort((a,b)=>Number(a.period)-Number(b.period));
 if(old?.annual?.length&&Number(old.annual.at(-1).period)>Number(sorted.at(-1).period))return fail('Source older than last good history');
 return {cashFlowHistory:{source:'StockAnalysis',currency:incoming.currency,units:incoming.units??null,annual:sorted,ttm:{...incoming.ttm},updatedAt:now},cashFlowHistoryStatus:'captured',reason:null};
}
