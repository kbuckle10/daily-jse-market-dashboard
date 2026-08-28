import { spawnSync } from 'node:child_process';

const ticker=String(process.argv[2]||process.env.TICKER||'').trim().toUpperCase();
if(!ticker){console.error('Usage: npm run refresh:dividend-ticker -- SIL');process.exit(2);}
const steps=[
  ['JSE corporate actions','scripts/refresh-jse-corporate-actions.mjs'],
  ['StockAnalysis latest dividend','scripts/refresh-sa-latest-dividend.mjs'],
  ['Dividend FX normalization','scripts/normalize-dividend-fx.mjs']
];
for(const [label,script] of steps){
  console.log(`\n=== ${ticker}: ${label} ===`);
  const r=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,TICKER:ticker}});
  if(r.status!==0){console.error(`${ticker}: ${label} failed with exit ${r.status}`);process.exit(r.status||1);}
}
console.log(`\n${ticker}: targeted dividend refresh complete.`);
