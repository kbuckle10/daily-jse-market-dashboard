(() => {
  const DATA=window.JSE_DASHBOARD_DATA;if(!DATA?.stocks)return;
  const STORAGE_KEY='dailyJseTrackedTickersV2';
  const byTicker=new Map(DATA.stocks.map(s=>[String(s.ticker).toUpperCase(),s]));
  const prefix=c=>c==='USD'?'US$':c==='TTD'?'TT$':'J$';
  const amount=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'N/A':Number(v).toFixed(d);
  const dv=v=>{const d=new Date(v);return Number.isNaN(d.valueOf())?0:d.valueOf();};
  const eventDate=e=>Math.max(dv(e?.exDate),dv(e?.recordDate),dv(e?.payDate));
  function selectedEvent(s){
    const primary=s.primaryListing;
    const isCrossListed=primary?.market&&String(primary.market).toUpperCase()!=='JMSE';
    const base={amount:s.latestDividend,currency:s.latestDividendCurrency||'JMD',exDate:s.exDate,recordDate:s.recordDate,payDate:s.payDate,status:s.dividendStatus||'',url:s.dividendUrl};
    if(isCrossListed)return {...base,primaryListing:true,originalAmount:s.latestDividendOriginalAmount??s.latestDividend,originalCurrency:s.latestDividendOriginalCurrency||s.latestDividendCurrency||primary.currency};
    const sa=s.saLatestDividend;
    if(sa&&eventDate(sa)>eventDate(base)){
      const hint=String(s.jseDividendCurrencyHint||s.ttmDpsCurrency||s.latestDividendOriginalCurrency||s.latestDividendCurrency||'JMD').toUpperCase();
      const officialPending=String(s.latestDividendDeclaredAmountStatus||'').includes('pending-official')||String(s.latestDividendDataStatus||'').includes('sa-newer');
      const status=hint==='JMD'?(officialPending?'StockAnalysis newer declared dividend • official JSE confirmation pending':'StockAnalysis latest dividend'):`StockAnalysis newer declared dividend • JMD equivalent; historical JSE declaration currency ${hint}${officialPending?'; official amount pending':''}`;
      return {amount:sa.amount,currency:'JMD',exDate:sa.exDate,recordDate:sa.recordDate,payDate:sa.payDate,status,url:sa.url,saNewer:true,officialPending,originalCurrencyHint:hint};
    }
    return {...base,originalAmount:s.latestDividendOriginalAmount,originalCurrency:s.latestDividendOriginalCurrency,jmd:s.latestDividendJmd,fxRate:s.latestDividendFxRate,fxDate:s.latestDividendFxDate};
  }
  function display(s){
    const e=selectedEvent(s);if(e.amount==null)return null;
    if(e.saNewer){const main=`J$${amount(e.amount,Math.abs(Number(e.amount))<1?4:2)}`;let sub='';if(e.originalCurrencyHint&&e.originalCurrencyHint!=='JMD')sub=`JMD equivalent • original declaration currency historically ${e.originalCurrencyHint}${e.officialPending?' • official amount pending':''}`;else if(e.officialPending)sub='Newest declared dividend • official JSE confirmation pending';return {main,sub,event:e};}
    const orig=e.originalAmount??e.amount,curr=e.originalCurrency||e.currency||'JMD';if(orig==null)return null;
    if(curr==='JMD')return {main:`J$${amount(orig,Math.abs(orig)<.01?4:2)}`,sub:'',event:e};
    const tiny=Math.abs(Number(orig))<.01,jmd=e.jmd;
    if(e.primaryListing)return {main:`${prefix(curr)}${amount(orig,tiny?6:2)}`,sub:'Primary-listing dividend',event:e};
    if(tiny&&jmd!=null)return {main:`J$${amount(jmd,Math.abs(jmd)<1?4:2)}`,sub:`Declared ${prefix(curr)}${amount(orig,6)} • FX ${amount(e.fxRate,3)} on ${e.fxDate||'N/A'}`,event:e};
    if(jmd!=null)return {main:`${prefix(curr)}${amount(orig,2)}`,sub:`≈ J$${amount(jmd,2)} • originally ${curr}`,event:e};
    return {main:`${prefix(curr)}${amount(orig,tiny?6:2)}`,sub:`Originally declared in ${curr}`,event:e};
  }
  function ttmDisplay(s){const v=Number(s.ttmDps);if(!Number.isFinite(v))return null;const curr=s.primaryListing?.currency||s.ttmDpsCurrency||s.latestDividendOriginalCurrency||s.latestDividendCurrency||'JMD';if(curr==='JMD')return `J$${amount(v,Math.abs(v)<.01?4:2)}`;const nativeAnnual=Number(s.nativeAnnualDps);if(Number.isFinite(nativeAnnual)&&nativeAnnual>=0)return `${prefix(curr)}${amount(nativeAnnual,Math.abs(nativeAnnual)<.01?4:2)}`;const tiny=Math.abs(v)<.01;if(tiny){const rate=Number(s.ttmDpsFxRate??s.latestDividendFxRate);if(Number.isFinite(rate)&&rate>0)return `J$${amount(v*rate,Math.abs(v*rate)<1?4:2)}<br><small>${prefix(curr)}${amount(v,6)} TTM</small>`;return `${prefix(curr)}${amount(v,6)}`;}return `${prefix(curr)}${amount(v,2)}`;}
  const setHtml=(el,html)=>{if(el&&el.innerHTML!==html)el.innerHTML=html;};
  function ensureSchema(){const head=document.querySelector('#tableView thead tr');if(!head)return;let headers=[...head.children],coverageIndex=headers.findIndex(th=>th.textContent.trim()==='Coverage');if(coverageIndex<0){const th=document.createElement('th');th.textContent='Coverage';th.dataset.coverageHead='true';const yieldHead=headers.find(x=>x.textContent.trim()==='Yield');if(yieldHead)yieldHead.insertAdjacentElement('afterend',th);headers=[...head.children];coverageIndex=headers.findIndex(x=>x.textContent.trim()==='Coverage');}else headers[coverageIndex].dataset.coverageHead='true';document.querySelectorAll('#stockTableBody tr').forEach(row=>{if(!row.querySelector('.ticker'))return;const cells=[...row.children];if(cells.length===headers.length-1){const td=document.createElement('td');td.className='coverage-table-cell';td.dataset.coverageCell='true';row.insertBefore(td,cells[coverageIndex]||null);}if(row.children[coverageIndex]){row.children[coverageIndex].dataset.coverageCell='true';row.children[coverageIndex].classList.add('coverage-table-cell');}});}
  function semanticCell(row,label){const head=document.querySelector('#tableView thead tr');if(!head)return null;const headers=[...head.children],headerIndex=headers.findIndex(th=>th.textContent.trim()===label);if(headerIndex<0)return null;const cells=[...row.children];return cells.length===headers.length?cells[headerIndex]||null:null;}
  function tracked(){let a=[];try{a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{}const set=new Set((Array.isArray(a)?a:[]).map(x=>String(x).toUpperCase()));return DATA.stocks.filter(s=>set.has(String(s.ticker).toUpperCase()));}
  const isUpcoming=s=>dv(selectedEvent(s)?.payDate)>Date.now();
  function updateUpcomingTile(){const tile=document.querySelector('.filter-tile[data-filter="dividend"]');if(!tile)return;const label=tile.querySelector('span'),count=tile.querySelector('#dividendCount'),small=tile.querySelector('small');if(label&&label.textContent!=='Upcoming payments')label.textContent='Upcoming payments';const n=String(tracked().filter(isUpcoming).length);if(count&&count.textContent!==n)count.textContent=n;if(small&&small.textContent!=='Pay date still ahead')small.textContent='Pay date still ahead';}
  function applyUpcomingFilter(){const tile=document.querySelector('.filter-tile[data-filter="dividend"]');if(!tile?.classList.contains('active'))return;document.querySelectorAll('#stockTableBody tr').forEach(row=>{const t=row.querySelector('.ticker')?.textContent?.trim().toUpperCase();if(t&&!isUpcoming(byTicker.get(t)))row.remove();});document.querySelectorAll('#cardView .stock-card').forEach(card=>{const t=card.querySelector('h3')?.textContent?.trim().toUpperCase();if(t&&!isUpcoming(byTicker.get(t)))card.remove();});}
  function apply(){
    ensureSchema();updateUpcomingTile();
    document.querySelectorAll('.stock-card').forEach(card=>{const s=byTicker.get(card.querySelector('h3')?.textContent?.trim().toUpperCase());if(!s)return;const rows=[...card.querySelectorAll('.metric-row')];const row=rows.find(r=>/Latest dividend/i.test(r.textContent));const strong=row?.querySelector('strong');const d=display(s);if(strong&&d)setHtml(strong,`<span class="dividend-display-main">${d.main}</span>${d.sub?`<small class="dividend-display-sub">${d.sub}</small>`:''}`);});
    document.querySelectorAll('#stockTableBody tr').forEach(row=>{const ticker=row.querySelector('.ticker')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker),d=s&&display(s);if(!d)return;const ttm=ttmDisplay(s),ttmCell=semanticCell(row,'TTM DPS'),latestCell=semanticCell(row,'Latest Div.'),datesCell=semanticCell(row,'Dates');if(ttmCell&&ttm)setHtml(ttmCell,ttm);if(latestCell)setHtml(latestCell,`<strong>${d.main}</strong>${d.sub?`<br><small>${d.sub}</small>`:''}<br><small>${d.event?.status||s.dividendStatus||''}</small>`);if(datesCell)setHtml(datesCell,`<small>Ex: ${d.event?.exDate||'N/A'}<br>Rec: ${d.event?.recordDate||'N/A'}<br>Pay: ${d.event?.payDate||'N/A'}</small>`);});
    applyUpcomingFilter();
  }
  const style=document.createElement('style');style.textContent='.dividend-display-main{display:block}.dividend-display-sub{display:block;color:var(--muted);font-size:.58rem;line-height:1.3;margin-top:2px}';document.head.appendChild(style);
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});};
  apply();window.addEventListener('load',schedule);window.addEventListener('storage',schedule);document.querySelector('.filter-grid')?.addEventListener('click',()=>setTimeout(schedule,0));document.getElementById('sortSelect')?.addEventListener('change',()=>setTimeout(schedule,0));new MutationObserver(schedule).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
})();
