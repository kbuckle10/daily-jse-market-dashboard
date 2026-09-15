(()=>{
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const HOLDINGS_KEY='dailyJseShareHoldingsV1';
  const byTicker=()=>new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const annualDps=s=>num(s.currentAnnualDps)??num(s.ttmDps);
  const currentYield=s=>num(s.currentDividendYield)??num(s.trailingYield);
  const mode=()=>document.querySelector('.income-mode-btn.active')?.dataset?.incomeMode||'investment';
  const investment=()=>num(document.getElementById('investmentAmountSlider')?.value)??0;
  const holdings=()=>{try{return JSON.parse(localStorage.getItem(HOLDINGS_KEY)||'{}')||{}}catch{return{}}};
  const sharesFor=(s,m,h)=>m==='shares'?Math.max(0,Math.floor(num(h[s.ticker])??0)):(num(s.price)>0?Math.floor(investment()/num(s.price)):0);
  const annualIncome=(s,m,h)=>{const dps=annualDps(s),sh=sharesFor(s,m,h);return dps==null?null:sh*dps};
  function tickerFromRow(row){return String(row.querySelector('.income-stock strong')?.textContent||'').trim().toUpperCase();}
  function rerank(){
    const list=document.getElementById('incomeComparisonList');if(!list)return;
    const rows=[...list.querySelectorAll('.income-row')];if(rows.length<2)return;
    const map=byTicker(),m=mode(),h=holdings();
    rows.sort((a,b)=>{
      const sa=map.get(tickerFromRow(a)),sb=map.get(tickerFromRow(b));if(!sa||!sb)return 0;
      if(m==='investment'){
        const ia=annualIncome(sa,m,h),ib=annualIncome(sb,m,h);
        if(ia!=null||ib!=null){if(ia==null)return 1;if(ib==null)return-1;if(ib!==ia)return ib-ia;}
        return (currentYield(sb)??-Infinity)-(currentYield(sa)??-Infinity);
      }
      const ia=annualIncome(sa,m,h),ib=annualIncome(sb,m,h);
      if(ia==null&&ib==null)return (currentYield(sb)??-Infinity)-(currentYield(sa)??-Infinity);
      if(ia==null)return 1;if(ib==null)return-1;if(ib!==ia)return ib-ia;
      return (currentYield(sb)??-Infinity)-(currentYield(sa)??-Infinity);
    });
    rows.forEach(r=>list.appendChild(r));
    list.dataset.incomeRank='annual-income-desc';
    const leader=document.getElementById('incomeLeader');
    const top=rows[0],s=map.get(tickerFromRow(top));
    if(leader&&s){const inc=annualIncome(s,m,h),sh=sharesFor(s,m,h),dps=annualDps(s),cur=String(s.currentAnnualDpsCurrency||s.ttmDpsCurrency||'JMD').toUpperCase(),p=cur==='USD'?'US$':cur==='TTD'?'TT$':'J$';if(inc!=null&&dps!=null)leader.textContent=`${s.ticker}: ${sh.toLocaleString('en-US')} shares × ${p}${dps.toFixed(2)} current annual DPS = ${p}${Math.round(inc).toLocaleString('en-US')}/yr`;}
  }
  let t;const schedule=(d=80)=>{clearTimeout(t);t=setTimeout(rerank,d)};
  schedule(250);setTimeout(rerank,700);
  document.addEventListener('click',e=>{if(e.target.closest?.('.income-mode-btn'))schedule(120)});
  document.addEventListener('input',e=>{if(e.target?.id==='investmentAmountSlider'||e.target?.matches?.('[data-shares-ticker]'))schedule(120)});
  window.addEventListener('storage',e=>{if(e.key===HOLDINGS_KEY)schedule(120)});
  const list=document.getElementById('incomeComparisonList');if(list)new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&n.matches?.('.income-row'))))schedule(80)}).observe(list,{childList:true});
})();
