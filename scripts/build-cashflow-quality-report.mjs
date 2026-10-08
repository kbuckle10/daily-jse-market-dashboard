// Read-only staging report: never updates data.js or investment recommendations.
import fs from 'node:fs';
import {cashFlowQuality} from './lib/cashflow-quality-research.mjs';
const input='artifacts/cashflow-feasibility.json';
const raw=JSON.parse(fs.readFileSync(input,'utf8'));
const sectors={SEP:'Energy',TJH:'Infrastructure / Transportation',NCBFG:'Banking',GK:'Conglomerate',GHL:'Insurance'};
const expected={SEP:'JMD',TJH:'USD',NCBFG:'JMD',GK:'JMD',GHL:'TTD'};
const results=raw.results.map(r=>{
 const h=r.history;
 const valid=r.status==='parsed'&&h?.status==='captured'&&h.currency===expected[r.ticker]&&h.annual.length>=5&&
 h.annual.every(y=>Number.isFinite(y.operatingCashFlow)&&Number.isFinite(y.capitalExpenditures)&&Number.isFinite(y.freeCashFlow))&&
 h.reconciliation.every(x=>Math.abs(x.discrepancy)<=2e7);
 return {ticker:r.ticker,source:r.url,valid,currency:h?.currency??null,years:h?.annual.length??0,updatedAt:raw.generatedAt,
  quality:valid?cashFlowQuality(h,{sector:sectors[r.ticker]}):{status:'not-evaluated',score:null},
  warnings:[...(valid?[]:['Incomplete/invalid history, currency or reconciliation']),...((/bank|insurance/i.test(sectors[r.ticker]))?['Sector-specific metrics required; generic FCF scoring disabled']:[])]};
});
const complete=results.length===5&&results.every(x=>x.valid);
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/cashflow-quality-report.json',JSON.stringify({generatedAt:raw.generatedAt,readOnly:true,ratingsChanged:false,complete,results},null,2)+'\n');
for(const r of results)console.log(r.ticker,r.valid?'VALID':'INVALID',r.currency,r.years,'years',r.quality.status,r.quality.score??'N/A');
console.log('Five-stock quality gate:',complete?'PASS':'FAIL','(no production data written)');
if(!complete)process.exitCode=1;
