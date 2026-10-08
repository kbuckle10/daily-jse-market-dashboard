import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>{
 const s=fs.readFileSync(p,'utf8'),m=s.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
 assert.ok(m,'Invalid dashboard data: '+p);
 return vm.runInNewContext('('+m[1]+')');
};
const baseline=read('data.js');
const preview=read('artifacts/dashboard-preview/data.js');
assert.equal(preview.stocks.length,baseline.stocks.length,'Stock count changed');
assert.equal(preview.updated,baseline.updated,'Dashboard refresh timestamp changed');
const before=new Map(baseline.stocks.map(s=>[s.ticker,s]));
const allowed=new Set(['cashFlowHistory','cashFlowHistoryStatus']);
const expected=['SEP','TJH','NCBFG','GK','GHL'];
for(const s of preview.stocks){
 const old=before.get(s.ticker);assert.ok(old,'Unexpected ticker '+s.ticker);
 const normalize=o=>JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k])=>!allowed.has(k))));
 assert.equal(normalize(s),normalize(old),'Existing fields modified: '+s.ticker);
 if(expected.includes(s.ticker)){
  assert.equal(s.cashFlowHistoryStatus,'captured',s.ticker+' not captured');
  const h=s.cashFlowHistory;
  assert.ok(h.annual.length>=5&&h.ttm&&h.currency,s.ticker+' history incomplete');
 }else{
  assert.equal(s.cashFlowHistory,old.cashFlowHistory,'Non-test stock history changed: '+s.ticker);
 }
}
assert.equal(preview.stocks.find(s=>s.ticker==='TJH').cashFlowHistory.currency,'USD');
assert.equal(preview.stocks.find(s=>s.ticker==='GHL').cashFlowHistory.currency,'TTD');
console.log('Preview integration checks passed: existing prices, dividends, ratings, scores, timestamps and watchlist universe unchanged.');
