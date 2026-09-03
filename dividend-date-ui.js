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
  const tableHtml=(label,v)=>`<span class="${cls(v)}"><b>${label}:</b> ${fmt(v)}</span>`;
  function styles(){if(document.getElementById('dividendDateUiStyles'))return;const s=document.createElement('style');s.id='dividendDateUiStyles';s.textContent=`
    .dividend-date-stack{display:flex;flex-direction:column;gap:4px;align-items:flex-start;white-space:nowrap}
    .div-date{display:inline-flex;align-items:center;gap:3px;border-radius:6px;padding:2px 5px;font-size:.67rem;font-weight:650;line-height:1.35;border:1px solid transparent}
    .div-date b{font-weight:800}.div-date.upcoming{color:#86efac;background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.24)}
    .div-date.today{color:#fde68a;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.28)}
    .div-date.passed{color:var(--muted);background:rgba(148,163,184,.07);border-color:rgba(148,163,184,.14)}
    .div-date.unknown{color:var(--muted)}
    .stock-card .dividend-ex-date-row strong.div-date-value{display:flex;justify-content:flex-end;padding:0;border:0;background:transparent;font-size:inherit;font-weight:800}
    .stock-card .dividend-ex-date-row strong.div-date-value.upcoming{color:#86efac!important}
    .stock-card .dividend-ex-date-row strong.div-date-value.today{color:#fde68a!important}
    .stock-card .dividend-ex-date-row strong.div-date-value.passed{color:var(--muted)!important}
    .stock-card .dividend-ex-date-row strong.div-date-value.unknown{color:var(--muted)!important}
    @media(max-width:520px){.div-date{font-size:.64rem}.stock-card .dividend-ex-date-row strong.div-date-value{justify-content:flex-end;font-size:inherit}}
  `;document.head.appendChild(s);}
  function tickerFromRow(row){return row.querySelector('.ticker')?.textContent?.trim().toUpperCase()||'';}
  function table(){document.querySelectorAll('#stockTableBody tr').forEach(row=>{const s=byTicker.get(tickerFromRow(row));if(!s)return;const cells=row.children;if(cells.length<14)return;const e=event(s);const dateCell=cells[cells.length-3];if(!dateCell)return;dateCell.innerHTML=`<div class="dividend-date-stack">${tableHtml('Ex',e.exDate)}${tableHtml('Rec',e.recordDate)}${tableHtml('Pay',e.payDate)}</div>`;});}
  function cards(){document.querySelectorAll('#cardView .stock-card').forEach(card=>{const ticker=card.querySelector('h3')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;const e=event(s);let row=card.querySelector('.dividend-ex-date-row');if(!row){const latest=[...card.querySelectorAll('.metric-row')].find(r=>r.textContent.includes('Latest dividend'));if(!latest)return;latest.insertAdjacentHTML('afterend','<div class="metric-row dividend-ex-date-row"><span>Ex-dividend date</span><strong></strong></div>');row=latest.nextElementSibling;}const strong=row.querySelector('strong');if(strong){strong.className=`div-date-value ${state(e.exDate)}`;strong.textContent=fmt(e.exDate);}});}
  function apply(){table();cards();}
  styles();apply();
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}).observe(document.querySelector('#tableView')?.parentElement||document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(apply,30));
})();