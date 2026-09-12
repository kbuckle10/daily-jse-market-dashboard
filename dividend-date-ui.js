(() => {
  const D=window.JSE_DASHBOARD_DATA;
  if(!D?.stocks)return;
  const byTicker=new Map(D.stocks.map(s=>[String(s.ticker||'').toUpperCase(),s]));
  const valid=v=>v!=null&&String(v).trim()&&!/^N\/?A$/i.test(String(v).trim());
  const parse=v=>{if(!valid(v))return null;const t=String(v).trim();const iso=t.match(/^(\d{4})-(\d{2})-(\d{2})/);const d=iso?new Date(+iso[1],+iso[2]-1,+iso[3]):new Date(t);return Number.isNaN(d.valueOf())?null:d;};
  const eventValue=e=>Math.max(...['exDate','recordDate','payDate'].map(k=>parse(e?.[k])?.valueOf()||0));
  const event=s=>{const base={exDate:s.exDate,recordDate:s.recordDate,payDate:s.payDate};const sa=s.saLatestDividend;const crossListed=s.primaryListing?.market&&String(s.primaryListing.market).toUpperCase()!=='JMSE';return !crossListed&&sa&&eventValue(sa)>eventValue(base)?sa:base;};
  const fmt=v=>{const d=parse(v);return d?d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'N/A';};
  const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
  const state=v=>{const d=parse(v);if(!d)return'unknown';d.setHours(0,0,0,0);const t=today();return d>t?'upcoming':d<t?'passed':'today';};
  const cls=v=>`div-date ${state(v)}`;
  const payLabel=v=>state(v)==='today'?'PAY TODAY':state(v)==='passed'?'Paid':'Pay';
  const tableHtml=(label,v,type='normal')=>`<span class="${cls(v)}${type==='pay'?' pay-status':''}"><b>${type==='pay'?payLabel(v):label}:</b> ${fmt(v)}</span>`;
  function styles(){if(document.getElementById('dividendDateUiStyles'))return;const s=document.createElement('style');s.id='dividendDateUiStyles';s.textContent=`
    .dividend-date-stack{display:flex;flex-direction:column;gap:4px;align-items:flex-start;white-space:nowrap}
    .div-date{display:inline-flex;align-items:center;gap:3px;border-radius:6px;padding:2px 5px;font-size:.67rem;font-weight:650;line-height:1.35;border:1px solid transparent}
    .div-date b{font-weight:800}.div-date.upcoming{color:#86efac;background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.24)}
    .div-date.today{color:#fde68a;background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.55);box-shadow:0 0 0 1px rgba(245,158,11,.08),0 0 12px rgba(245,158,11,.12)}
    .div-date.today.pay-status{font-weight:850}
    .div-date.passed{color:var(--muted);background:rgba(148,163,184,.07);border-color:rgba(148,163,184,.14);opacity:.82}
    .div-date.unknown{color:var(--muted)}
    .stock-card .dividend-ex-date-row strong.div-date-value,.stock-card .dividend-pay-date-row strong.div-date-value{display:flex;justify-content:flex-end;padding:2px 5px;border:1px solid transparent;border-radius:6px;background:transparent;font-size:inherit;font-weight:800}
    .stock-card .dividend-ex-date-row strong.div-date-value.upcoming,.stock-card .dividend-pay-date-row strong.div-date-value.upcoming{color:#86efac!important;background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.24)}
    .stock-card .dividend-ex-date-row strong.div-date-value.today,.stock-card .dividend-pay-date-row strong.div-date-value.today{color:#fde68a!important;background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.55);box-shadow:0 0 10px rgba(245,158,11,.12)}
    .stock-card .dividend-ex-date-row strong.div-date-value.passed,.stock-card .dividend-pay-date-row strong.div-date-value.passed{color:var(--muted)!important;background:rgba(148,163,184,.07);border-color:rgba(148,163,184,.14);opacity:.82}
    .stock-card .dividend-ex-date-row strong.div-date-value.unknown,.stock-card .dividend-pay-date-row strong.div-date-value.unknown{color:var(--muted)!important}
    .stock-card .dividend-pay-date-row.pay-today>span{color:#fde68a;font-weight:850}
    .stock-card .dividend-pay-date-row.pay-passed>span{color:var(--muted)}
    #marketWatchSection .market-watch-dividend.pay-status,#freshCapitalSection .fresh-pay-status{display:inline-flex;align-items:center;gap:4px;border-radius:7px;padding:3px 7px;border:1px solid transparent;font-weight:800}
    #marketWatchSection .market-watch-dividend.upcoming,#freshCapitalSection .fresh-pay-status.upcoming{color:#86efac!important;background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.24)}
    #marketWatchSection .market-watch-dividend.today,#freshCapitalSection .fresh-pay-status.today{color:#fde68a!important;background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.55);box-shadow:0 0 10px rgba(245,158,11,.12)}
    #marketWatchSection .market-watch-dividend.passed,#freshCapitalSection .fresh-pay-status.passed{color:var(--muted)!important;background:rgba(148,163,184,.07);border-color:rgba(148,163,184,.14);opacity:.82}
    #freshCapitalSection .fresh-pay-status{margin-left:7px;font-size:.55rem;vertical-align:middle}
    @media(max-width:520px){.div-date{font-size:.64rem}.stock-card .dividend-ex-date-row strong.div-date-value,.stock-card .dividend-pay-date-row strong.div-date-value{justify-content:flex-end;font-size:inherit}#freshCapitalSection .fresh-pay-status{display:flex;margin:5px 0 0;width:max-content}}
  `;document.head.appendChild(s);}
  function tickerFromRow(row){return row.querySelector('.ticker')?.textContent?.trim().toUpperCase()||'';}
  function table(){document.querySelectorAll('#stockTableBody tr').forEach(row=>{const s=byTicker.get(tickerFromRow(row));if(!s)return;const cells=row.children;if(cells.length<14)return;const e=event(s);const dateCell=cells[cells.length-3];if(!dateCell)return;dateCell.innerHTML=`<div class="dividend-date-stack">${tableHtml('Ex',e.exDate)}${tableHtml('Rec',e.recordDate)}${tableHtml('Pay',e.payDate,'pay')}</div>`;});}
  function cards(){document.querySelectorAll('#cardView .stock-card').forEach(card=>{const ticker=card.querySelector('h3')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;const e=event(s);let exRow=card.querySelector('.dividend-ex-date-row');if(!exRow){const latest=[...card.querySelectorAll('.metric-row')].find(r=>r.textContent.includes('Latest dividend'));if(!latest)return;latest.insertAdjacentHTML('afterend','<div class="metric-row dividend-ex-date-row"><span>Ex-dividend date</span><strong></strong></div>');exRow=latest.nextElementSibling;}const exStrong=exRow.querySelector('strong');if(exStrong){exStrong.className=`div-date-value ${state(e.exDate)}`;exStrong.textContent=fmt(e.exDate);}let payRow=card.querySelector('.dividend-pay-date-row');if(!payRow){exRow.insertAdjacentHTML('afterend','<div class="metric-row dividend-pay-date-row"><span>Payment date</span><strong></strong></div>');payRow=exRow.nextElementSibling;}const ps=state(e.payDate),payStrong=payRow.querySelector('strong'),payText=payRow.querySelector('span');payRow.classList.toggle('pay-today',ps==='today');payRow.classList.toggle('pay-passed',ps==='passed');if(payText)payText.textContent=ps==='today'?'PAY TODAY':ps==='passed'?'Paid':'Payment date';if(payStrong){payStrong.className=`div-date-value ${ps}`;payStrong.textContent=fmt(e.payDate);}});}
  function marketWatch(){document.querySelectorAll('#marketWatchSection .market-watch-card').forEach(card=>{const ticker=card.querySelector('.market-watch-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;const e=event(s),ps=state(e.payDate),div=card.querySelector('.market-watch-dividend');if(!div)return;const isPayment=/payment/i.test(div.textContent||'');if(!isPayment)return;div.className=`market-watch-dividend pay-status ${ps}`;div.textContent=`${payLabel(e.payDate)}: ${fmt(e.payDate)}`;});}
  function freshCapital(){document.querySelectorAll('#rankingList .fresh-objective-card').forEach(card=>{const ticker=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;const e=event(s);if(!valid(e.payDate))return;const ps=state(e.payDate),host=card.querySelector('.fresh-secondary')||card.querySelector('.fresh-footer');if(!host)return;let badge=card.querySelector('.fresh-pay-status');if(!badge){badge=document.createElement('span');badge.className='fresh-pay-status';host.appendChild(badge);}badge.className=`fresh-pay-status ${ps}`;badge.textContent=`${payLabel(e.payDate)} ${fmt(e.payDate)}`;});}
  function apply(){table();cards();marketWatch();freshCapital();}
  styles();apply();
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}).observe(document.querySelector('#tableView')?.parentElement||document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(apply,30));
})();