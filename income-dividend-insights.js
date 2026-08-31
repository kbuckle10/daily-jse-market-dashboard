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

  function performanceNarrative(s){
    const y=num(s.currentDividendYield)??num(s.trailingYield),pe=num(s.pe),pb=num(s.calculatedPbFromJsePrice)??num(s.pb),epsg=num(s.epsGrowth),revg=num(s.revenueGrowth),roe=num(s.roe),book=num(s.bookDiscountPct),payout=num(s.payoutRatio),fcf=num(s.fcfPayoutRatio),m1=num(s.m1),y1=num(s.y1);
    const positives=[],risks=[];
    if(y!=null&&y>=5)positives.push(`${fmt(y,2)}% current yield`);else if(y!=null&&y>=3)positives.push(`${fmt(y,2)}% income yield`);
    if(pe!=null&&pe>0&&pe<=12)positives.push(`P/E ${fmt(pe,1)}×`);
    if(pb!=null&&pb<=1)positives.push(`below-book valuation (P/B ${fmt(pb,2)}×)`);else if(book!=null&&book>=15)positives.push(`${fmt(book,0)}% below book`);
    if(roe!=null&&roe>=15)positives.push(`ROE ${fmt(roe,1)}%`);
    if(epsg!=null&&epsg>=10)positives.push(`EPS growth ${fmt(epsg,1)}%`);else if(revg!=null&&revg>=10)positives.push(`revenue growth ${fmt(revg,1)}%`);
    if(s.zoneStatus==='below')positives.push('below target buy zone');else if(s.zoneStatus==='in')positives.push('inside target buy zone');
    if(payout!=null&&payout>100)risks.push(`payout ${fmt(payout,0)}% exceeds earnings`);else if(payout!=null&&payout>80)risks.push(`high payout ${fmt(payout,0)}%`);
    if(fcf!=null&&fcf>100)risks.push('dividend exceeds free-cash-flow coverage');
    if(epsg!=null&&epsg<0)risks.push(`EPS growth ${fmt(epsg,1)}%`);
    if(revg!=null&&revg<0)risks.push(`revenue growth ${fmt(revg,1)}%`);
    if(s.zoneStatus==='above')risks.push('price above target buy zone');
    if(y1!=null&&y1<=-15)risks.push(`1Y price trend ${fmt(y1,1)}%`);else if(m1!=null&&m1<=-10)risks.push(`1M price trend ${fmt(m1,1)}%`);
    const p=positives.slice(0,3),r=risks.slice(0,2),rating=s.rating||'N/A';
    if(p.length&&r.length)return `${rating}: ${p.join(' • ')} support the case, but ${r.join(' and ')} warrant caution.`;
    if(p.length)return `${rating}: ${p.join(' • ')} are the strongest current positives.`;
    if(r.length)return `${rating}: ${r.join(' and ')} are the main current risks.`;
    return `${rating}: valuation, earnings, dividend and price-trend signals are mixed; use the detailed metrics above for the decision.`;
  }
  function decoratePerformanceCards(){
    document.querySelectorAll('#cardView .stock-card').forEach(card=>{const s=stockForElement(card,'card'),p=card.querySelector('.rank-reason');if(s&&p)p.textContent=performanceNarrative(s);card.querySelectorAll('.metric-row').forEach(row=>{const label=row.querySelector('span');if(label&&/trailing yield/i.test(label.textContent||''))label.textContent='Current yield';});});
  }

  let timer;function refresh(delay=280){clearTimeout(timer);timer=setTimeout(()=>{ensureSortOptions();decorateIncomeCards();decorateAllocation();applyCustomSort();decoratePerformanceCards();},delay);}
  ensureStyles();ensureSortOptions();refresh(320);
  document.addEventListener('change',e=>{if(e.target?.id==='sortSelect'||e.target?.id==='watchlistStatusFilter')refresh(40);});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-fresh-objective],[data-ticker],#resetTrackedBtn,.filter-tile,#tableViewBtn,#cardViewBtn,#showAllTickersBtn'))refresh(300);});
  window.addEventListener('storage',e=>{if(e.key===MODEKEY||e.key==='dailyJseTrackedTickersV2')refresh(300);});
})();
