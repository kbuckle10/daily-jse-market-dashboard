import fs from 'node:fs';
import vm from 'node:vm';

const DATA_FILE='data.js';
const index=Number(process.env.SHARD_INDEX);
const count=Number(process.env.SHARD_COUNT||5);
if(!Number.isInteger(index)||index<0||!Number.isInteger(count)||count<1||index>=count) throw new Error(`Invalid shard ${index}/${count}`);
const raw=fs.readFileSync(DATA_FILE,'utf8');
const m=raw.match(/window\.JSE_DASHBOARD_DATA\s*=\s*([\s\S]*);\s*$/);
if(!m) throw new Error('Unable to parse data.js');
const data=vm.runInNewContext(`(${m[1]})`);
if(!Array.isArray(data.stocks)||!data.stocks.length) throw new Error('No stocks to shard');
// Deterministic modulo assignment. The universe size is dynamic: a newly listed
// ticker from sync:main-market is automatically assigned to one shard.
const all=[...data.stocks];
data.stocks=all.filter((_,i)=>i%count===index);
data.shard={index,count,universeSize:all.length,tickers:data.stocks.map(s=>s.ticker)};
fs.writeFileSync(DATA_FILE,`window.JSE_DASHBOARD_DATA = ${JSON.stringify(data,null,2)};\n`);
console.log(`Shard ${index+1}/${count}: ${data.stocks.length}/${all.length} tickers: ${data.stocks.map(s=>s.ticker).join(', ')}`);
