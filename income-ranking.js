(()=>{
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const byTicker=()=>new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const currentYield=s=>num(s.currentDividendYield)??num(s.trailingYield);
  function tickerFromRow(row){return String(row.querySelector('.income-stock strong')?.textContent||'').trim().toUpperCase();}
  function rerank(){
    const list=document.getElementById('incomeComparisonList');if(!list)return;
    const rows=[...list.querySelectorAll('.income-row')];if(rows.length<2)return;
    const map=byTicker();
    rows.sort((a,b)=>{const sa=map.get(tickerFromRow(a)),sb=map.get(tickerFromRow(b));if(!sa||!sb)return 0;const ay=currentYield(sa),by=currentYield(sb);if(ay==null&&by==null)return String(sa.ticker).localeCompare(String(sb.ticker));if(ay==null)return 1;if(by==null)return-1;return by-ay||String(sa.ticker).localeCompare(String(sb.ticker));});
    // Only move rows whose position actually changed. Never reorder while an
    // Income input has focus: moving its row detaches the input and interrupts typing.
    if(!document.activeElement?.closest?.('#incomeComparisonList input'))rows.forEach((r,i)=>{if(list.children[i]!==r)list.appendChild(r)});
    list.dataset.incomeRank='current-yield-desc';
    const leader=document.getElementById('incomeLeader'),s=map.get(tickerFromRow(rows[0]));if(leader&&s){const y=currentYield(s);leader.textContent=y==null?'No current yield available':`${s.ticker}: ${y.toFixed(2)}% current yield`;}
  }
  let t;const schedule=(d=80)=>{clearTimeout(t);t=setTimeout(rerank,d)};
  schedule(250);setTimeout(rerank,700);
  document.addEventListener('click',e=>{if(e.target.closest?.('.income-mode-btn'))schedule(120)});
  // Ranking is based only on Current Yield, so share/buy-price typing must not rerank.
  window.addEventListener('jse-focus-change',()=>schedule(100));
  const list=document.getElementById('incomeComparisonList');if(list)new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&n.matches?.('.income-row'))))schedule(80)}).observe(list,{childList:true});
})();
