(() => {
  const DATA=window.JSE_DASHBOARD_DATA;if(!DATA?.stocks)return;
  const byTicker=new Map(DATA.stocks.map(s=>[String(s.ticker).toUpperCase(),s]));
  const prefix=c=>c==='USD'?'US$':c==='TTD'?'TT$':'J$';
  const amount=(v,d=2)=>v==null||!Number.isFinite(Number(v))?'N/A':Number(v).toFixed(d);
  const dv=v=>{const d=new Date(v);return Number.isNaN(d.valueOf())?0:d.valueOf();};
  const eventDate=e=>Math.max(dv(e?.exDate),dv(e?.recordDate),dv(e?.payDate));
  function selectedEvent(s){
    const sa=s.saLatestDividend,base={amount:s.latestDividend,currency:s.latestDividendCurrency||'JMD',exDate:s.exDate,recordDate:s.recordDate,payDate:s.payDate,status:s.dividendStatus||'',url:s.dividendUrl};
    if(sa&&eventDate(sa)>eventDate(base)){
      const hint=String(s.jseDividendCurrencyHint||s.ttmDpsCurrency||s.latestDividendOriginalCurrency||s.latestDividendCurrency||'JMD').toUpperCase();
      return {amount:sa.amount,currency:'JMD',exDate:sa.exDate,recordDate:sa.recordDate,payDate:sa.payDate,status:hint==='JMD'?'StockAnalysis newer declared dividend • JSE corporate action pending':`StockAnalysis newer declared dividend • JMD equivalent; historical JSE declaration currency ${hint}; official amount pending`,url:sa.url,saNewer:true,originalCurrencyHint:hint};
    }
    return {...base,originalAmount:s.latestDividendOriginalAmount,originalCurrency:s.latestDividendOriginalCurrency,jmd:s.latestDividendJmd,fxRate:s.latestDividendFxRate,fxDate:s.latestDividendFxDate};
  }
  function display(s){
    const e=selectedEvent(s);
    if(e.amount==null)return null;
    if(e.saNewer){
      const main=`J$${amount(e.amount,Math.abs(Number(e.amount))<1?4:2)}`;
      const sub=e.originalCurrencyHint&&e.originalCurrencyHint!=='JMD'?`JMD equivalent • original declaration currency historically ${e.originalCurrencyHint} • official amount pending`:'Newest declared dividend • JSE corporate action pending';
      return {main,sub,event:e};
    }
    const orig=e.originalAmount??e.amount,curr=e.originalCurrency||e.currency||'JMD';
    if(orig==null)return null;
    if(curr==='JMD')return {main:`J$${amount(orig,Math.abs(orig)<.01?4:2)}`,sub:'',event:e};
    const tiny=Math.abs(Number(orig))<.01,jmd=e.jmd;
    if(tiny&&jmd!=null)return {main:`J$${amount(jmd,Math.abs(jmd)<1?4:2)}`,sub:`Declared ${prefix(curr)}${amount(orig,6)} • FX ${amount(e.fxRate,3)} on ${e.fxDate||'N/A'}`,event:e};
    if(jmd!=null)return {main:`${prefix(curr)}${amount(orig,2)}`,sub:`≈ J$${amount(jmd,2)} • originally ${curr}`,event:e};
    return {main:`${prefix(curr)}${amount(orig,tiny?6:2)}`,sub:`Originally declared in ${curr}`,event:e};
  }
  function ttmDisplay(s){
    const v=Number(s.ttmDps);if(!Number.isFinite(v))return null;
    const curr=s.ttmDpsCurrency||s.latestDividendOriginalCurrency||s.latestDividendCurrency||'JMD';
    if(curr==='JMD')return `J$${amount(v,Math.abs(v)<.01?4:2)}`;
    const tiny=Math.abs(v)<.01;
    if(tiny){
      const rate=Number(s.ttmDpsFxRate??s.latestDividendFxRate);
      if(Number.isFinite(rate)&&rate>0)return `J$${amount(v*rate,Math.abs(v*rate)<1?4:2)}<br><small>${prefix(curr)}${amount(v,6)} TTM</small>`;
      return `${prefix(curr)}${amount(v,6)}`;
    }
    return `${prefix(curr)}${amount(v,2)}`;
  }
  const setHtml=(el,html)=>{if(el&&el.innerHTML!==html)el.innerHTML=html;};
  const columnIndex=label=>{const head=document.querySelector('#tableView thead tr');return head?[...head.children].findIndex(th=>th.textContent.trim()===label):-1;};
  function apply(){
    document.querySelectorAll('.stock-card').forEach(card=>{const s=byTicker.get(card.querySelector('h3')?.textContent?.trim().toUpperCase());if(!s)return;const rows=[...card.querySelectorAll('.metric-row')];const row=rows.find(r=>/Latest dividend/i.test(r.textContent));const strong=row?.querySelector('strong');const d=display(s);if(strong&&d)setHtml(strong,`<span class="dividend-display-main">${d.main}</span>${d.sub?`<small class="dividend-display-sub">${d.sub}</small>`:''}`);});
    const ttmIdx=columnIndex('TTM DPS'),latestIdx=columnIndex('Latest Div.');
    document.querySelectorAll('#stockTableBody tr').forEach(row=>{const ticker=row.querySelector('.ticker')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker),d=s&&display(s);if(!d)return;const cells=row.querySelectorAll('td');const ttm=ttmDisplay(s);if(ttmIdx>=0&&cells[ttmIdx]&&ttm)setHtml(cells[ttmIdx],ttm);if(latestIdx>=0&&cells[latestIdx])setHtml(cells[latestIdx],`<strong>${d.main}</strong>${d.sub?`<br><small>${d.sub}</small>`:''}<br><small>${d.event?.status||s.dividendStatus||''}</small>`);});
  }
  const style=document.createElement('style');style.textContent='.dividend-display-main{display:block}.dividend-display-sub{display:block;color:var(--muted);font-size:.58rem;line-height:1.3;margin-top:2px}';document.head.appendChild(style);
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});};
  apply();window.addEventListener('load',schedule);new MutationObserver(schedule).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
})();
