(()=>{
  const D=window.JSE_DASHBOARD_DATA;if(!D?.stocks)return;
  const byTicker=new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const MODEKEY='dailyJseFreshCapitalObjectiveV1';
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const fmt=(v,d=2)=>num(v)==null?'N/A':Number(v).toFixed(d);
  const currency=s=>String(s.currentAnnualDpsCurrency||s.latestDividendCurrency||s.ttmDpsCurrency||'JMD').toUpperCase();
  const money=(v,c)=>{if(num(v)==null)return'N/A';const p=c==='USD'?'US$':c==='TTD'?'TT$':'J$';return `${p}${fmt(v,2)}`;};
  const annualDps=s=>num(s.currentAnnualDps)??num(s.ttmDps);
  const latestDiv=s=>num(s.latestDividend);
  const mode=()=>localStorage.getItem(MODEKEY)||window.JSE_FRESH_CAPITAL_V2?.getMode?.()||'balanced';

  function ensureStyles(){if(document.getElementById('incomeDividendInsightStyles'))return;const st=document.createElement('style');st.id='incomeDividendInsightStyles';st.textContent='.income-payout-strip{display:flex;gap:8px;flex-wrap:wrap;margin:7px 0 3px}.income-payout-chip{display:flex;flex-direction:column;gap:1px;min-width:105px;padding:6px 8px;border:1px solid var(--border);border-radius:9px;background:var(--surface2)}.income-payout-chip small{font-size:.56rem;color:var(--muted);font-weight:700}.income-payout-chip strong{font-size:.72rem}.allocation-income-detail{display:block;margin-left:18px;margin-top:2px;font-size:.58rem;color:var(--muted)}';document.head.appendChild(st);}

  function tickerFromCard(card){return card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase()||'';}
  function decorateIncomeCards(){
    if(mode()!=='income'){document.querySelectorAll('.income-payout-strip').forEach(x=>x.remove());return;}
    document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card=>{const s=byTicker.get(tickerFromCard(card));if(!s)return;let strip=card.querySelector('.income-payout-strip');if(!strip){strip=document.createElement('div');strip.className='income-payout-strip';const metrics=card.querySelector('.fresh-metrics');metrics?.insertAdjacentElement('afterend',strip);}const ac=String(s.currentAnnualDpsCurrency||s.ttmDpsCurrency||currency(s)).toUpperCase(),lc=String(s.latestDividendCurrency||currency(s)).toUpperCase();strip.innerHTML=`<span class="income-payout-chip"><small>Current annual DPS</small><strong>${money(annualDps(s),ac)}</strong></span><span class="income-payout-chip"><small>Latest declared payout</small><strong>${money(latestDiv(s),lc)}</strong></span>`;});
  }

  function decorateAllocation(){
    document.querySelectorAll('#allocationLegend .allocation-income-detail').forEach(x=>x.remove());
    if(mode()!=='income')return;
    document.querySelectorAll('#allocationLegend .legend-item').forEach(item=>{const ticker=item.querySelector('strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;const ac=String(s.currentAnnualDpsCurrency||s.ttmDpsCurrency||currency(s)).toUpperCase(),lc=String(s.latestDividendCurrency||currency(s)).toUpperCase(),detail=document.createElement('span');detail.className='allocation-income-detail';detail.textContent=`Annual DPS ${money(annualDps(s),ac)} • Latest ${money(latestDiv(s),lc)} • Yield ${fmt(num(s.currentDividendYield)??num(s.trailingYield),2)}%`;item.appendChild(detail);});
  }

  function stockForElement(el,kind){let t='';if(kind==='row')t=el.querySelector('.ticker')?.textContent;else t=el.querySelector('h3')?.textContent;return byTicker.get(String(t||'').trim().toUpperCase());}
  function comparator(key){return(a,b)=>{const ca=currency(a),cb=currency(b);if(ca!==cb){const order={JMD:0,TTD:1,USD:2};return (order[ca]??9)-(order[cb]??9)||ca.localeCompare(cb);}const va=key==='latest-dividend-desc'?latestDiv(a):annualDps(a),vb=key==='latest-dividend-desc'?latestDiv(b):annualDps(b);return (vb??-Infinity)-(va??-Infinity)||String(a.ticker).localeCompare(String(b.ticker));};}
  function applyCustomSort(){const select=document.getElementById('sortSelect');if(!select||!['latest-dividend-desc','annual-dps-desc'].includes(select.value))return;const cmp=comparator(select.value),tbody=document.getElementById('stockTableBody'),cardView=document.getElementById('cardView');if(tbody){[...tbody.querySelectorAll('tr')].sort((x,y)=>{const a=stockForElement(x,'row'),b=stockForElement(y,'row');return a&&b?cmp(a,b):0;}).forEach(x=>tbody.appendChild(x));}if(cardView){[...cardView.querySelectorAll('.stock-card')].sort((x,y)=>{const a=stockForElement(x,'card'),b=stockForElement(y,'card');return a&&b?cmp(a,b):0;}).forEach(x=>cardView.appendChild(x));}}
  function ensureSortOptions(){const select=document.getElementById('sortSelect');if(!select)return;const add=(value,label)=>{if(select.querySelector(`option[value="${value}"]`))return;const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o);};add('latest-dividend-desc','Latest dividend payout: high to low (currency grouped)');add('annual-dps-desc','Current annual DPS: high to low (currency grouped)');select.title='Dividend payout sorts are grouped by declared currency so JMD, TTD and USD amounts are not treated as directly comparable.';}

  let timer;function refresh(delay=280){clearTimeout(timer);timer=setTimeout(()=>{ensureSortOptions();decorateIncomeCards();decorateAllocation();applyCustomSort();},delay);}
  ensureStyles();ensureSortOptions();refresh(320);
  document.addEventListener('change',e=>{if(e.target?.id==='sortSelect')refresh(40);});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective],[data-ticker],#resetTrackedBtn,.filter-tile,#tableViewBtn,#cardViewBtn'))refresh(300);});
  window.addEventListener('storage',e=>{if(e.key===MODEKEY||e.key==='dailyJseTrackedTickersV2')refresh(300);});
})();
