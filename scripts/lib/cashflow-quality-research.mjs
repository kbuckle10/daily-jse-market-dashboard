// Research-only cash-flow quality diagnostics. Never changes investment ratings.
export function cashFlowQuality(history,{sector='Other'}={}){
 const annual=(history?.annual||[]).filter(x=>Number.isFinite(x.freeCashFlow)).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 if(/bank|financial|insurance/i.test(sector))return {status:'sector-specific',score:null,reason:'Conventional FCF scoring is not comparable for banks and insurers'};
 if(annual.length<3)return {status:'insufficient-history',score:null,reason:'At least three fiscal years required'};
 const fcf=annual.map(x=>x.freeCashFlow);
 const positive=fcf.filter(x=>x>0).length;
 const growth=fcf.at(-1)>fcf[0]&&fcf[0]>0;
 const latest=history.ttm?.freeCashFlow;
 const improving=Number.isFinite(latest)&&latest>fcf.at(-1);
 const score=Math.round(60*positive/fcf.length+25*Number(growth)+15*Number(improving));
 return {status:'research-only',score,positiveYears:positive,years:fcf.length,trend:growth?'up':'mixed',ttmImproving:improving,reason:'Exploratory FCF consistency and direction only; excludes dividends, debt, one-offs and sector adjustments'};
}
