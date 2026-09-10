import fs from 'node:fs';
import vm from 'node:vm';

const DATA_FILE='data.js';
function readData(){const raw=fs.readFileSync(DATA_FILE,'utf8');const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);if(!m)throw new Error('Unable to parse data.js');return vm.runInNewContext(`(${m[1]})`);}
function writeData(d){fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(d,null,2)};\n`);}

// Verified published FFO values. These supplement the generic SA scraper where the
// page DOM is not reliably exposed to Playwright. Do not derive FFO from FCF.
const VERIFIED={
  SML:{
    ffo:456000000,ffoPrior:401000000,ffoGrowth:13.72,ffoPayoutRatio:60.91,
    ffoCurrency:'JMD',ffoPeriod:'TTM ended 2026-03-31',
    ffoSource:'StockAnalysis / S&P Global Market Intelligence',
    ffoUrl:'https://stockanalysis.com/quote/jmse/SML/financials/',
    ffoSourceChecked:'2026-09-10',ffoDataStatus:'captured-verified',
    // SA reports TTM AFFO as unavailable; preserve the latest reported annual AFFO separately.
    affoLatestAnnual:401000000,affoLatestAnnualPeriod:'FY 2025',affoCurrency:'JMD'
  },
  KPREIT:{
    ffo:1790000,ffoPrior:765987,ffoGrowth:133.5,
    ffoCurrency:'USD',ffoPeriod:'FY 2025',
    ffoSource:'Kingston Properties Limited Annual Report 2025',
    ffoUrl:'https://www.kpreit.com/wp-content/uploads/2026/05/Kingston-Properties-Annual-Report-2025.pdf',
    ffoSourceChecked:'2026-09-10',ffoDataStatus:'captured-verified'
  },
  CPFV:{
    ffo:4000000,ffoPrior:4400000,ffoGrowth:-10.0,
    ffoCurrency:'BBD',ffoPeriod:'FY 2025 ended 2025-09-30',
    ffoSource:'Eppley Caribbean Property Fund Limited SCC Annual Report 2025',
    ffoUrl:'https://bse.com.bb/wp-content/uploads/2025/12/Eppley-Caribbean-Property-Fund-Annual-Report-2025.pdf',
    ffoSourceChecked:'2026-09-10',ffoDataStatus:'captured-verified'
  }
};

const data=readData();
for(const s of data.stocks||[]){const v=VERIFIED[String(s.ticker||'').toUpperCase()];if(!v)continue;Object.assign(s,v);s.ffoUpdated=new Date().toISOString();console.log(`${s.ticker}: verified FFO=${s.ffo} ${s.ffoCurrency} (${s.ffoPeriod}) growth=${s.ffoGrowth}% source=${s.ffoSource}`);}
writeData(data);
console.log(`Verified property FFO merge complete (${Object.keys(VERIFIED).length} securities).`);
