(() => {
  const DATA=window.JSE_DASHBOARD_DATA;
  if(!DATA?.stocks)return;
  const byTicker=new Map(DATA.stocks.map(s=>[String(s.ticker).toUpperCase(),s]));
  const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
  const fmt=v=>v==null?'N/A':`${v.toFixed(2)}×`;
  const nfmt=v=>v==null?'N/A':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
  function coverage(s){
    const eps=num(s.epsTtm),dps=num(s.ttmDps),fcfPayout=num(s.fcfPayoutRatio);
    const earnings=eps!=null&&eps>0&&dps!=null&&dps>0?eps/dps:null;
    const fcf=fcfPayout!=null&&fcfPayout>0?100/fcfPayout:null;
    return{eps,dps,fcfPayout,earnings,fcf};
  }
  function label(v){return v==null?'N/A':v>=2?'Strong':v>=1.5?'Healthy':v>=1.2?'Moderate':v>=1?'Tight':'Weak';}
  function tone(v){return v==null?'neutral':v>=1.5?'positive':v>=1?'amber':'negative';}
  function detail(c){const e=c.earnings==null?'Earnings coverage unavailable':`EPS TTM ${nfmt(c.eps)} ÷ TTM DPS ${nfmt(c.dps)} = ${fmt(c.earnings)}`;const f=c.fcf==null?'FCF coverage unavailable':`FCF payout ${nfmt(c.fcfPayout)}% → 100 ÷ ${nfmt(c.fcfPayout)} = ${fmt(c.fcf)}`;return `${e} • ${f}`;}
  function ensureStyles(){if(document.getElementById('dividendCoverageStyles'))return;const st=document.createElement('style');st.id='dividendCoverageStyles';st.textContent=`
    .coverage-block{margin-top:7px}.coverage-summary{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 8px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);cursor:help}.coverage-summary>span:first-child{font-size:.58rem;color:var(--muted);font-weight:700}.coverage-chip{font-size:.66rem;font-weight:800;padding:3px 6px;border-radius:7px;background:var(--surface)}.coverage-detail{display:none;margin:5px 2px 0;font-size:.55rem!important;color:var(--muted);line-height:1.4}.coverage-block.open .coverage-detail{display:block}.coverage-table-cell{white-space:nowrap;cursor:help}.coverage-table-cell strong{font-size:.76rem}.coverage-table-cell small{display:block;font-size:.52rem;color:var(--muted)}
  `;document.head.appendChild(st);}
  function tickerFromCard(card){return card.querySelector('h3')?.textContent?.trim().toUpperCase()||'';}
  function block(s){const c=coverage(s);return `<div class="coverage-block" data-dividend-coverage><div class="coverage-summary" role="button" tabindex="0" aria-expanded="false" title="${detail(c)}"><span>Dividend coverage</span><span class="coverage-chip ${tone(c.earnings)}">Earnings ${fmt(c.earnings)}</span><span class="coverage-chip ${tone(c.fcf)}">FCF ${fmt(c.fcf)}</span></div><p class="coverage-detail">${detail(c)}</p></div>`;}
  function decorateCards(){document.querySelectorAll('.stock-card').forEach(card=>{const s=byTicker.get(tickerFromCard(card));if(!s)return;card.querySelector('[data-dividend-coverage]')?.remove();const target=[...card.querySelectorAll('.metric-row')].find(x=>/trailing yield/i.test(x.textContent));if(target)target.insertAdjacentHTML('afterend',block(s));});}
  function decorateTable(){const table=document.querySelector('#tableView table'),head=table?.querySelector('thead tr');if(!head)return;let th=head.querySelector('[data-coverage-head]');if(!th){th=document.createElement('th');th.dataset.coverageHead='true';th.textContent='Coverage';const yieldHead=[...head.children].find(x=>/^yield$/i.test(x.textContent.trim()));yieldHead?.insertAdjacentElement('afterend',th);}document.querySelectorAll('#stockTableBody tr').forEach(row=>{const ticker=row.querySelector('.ticker')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;row.querySelector('[data-coverage-cell]')?.remove();const c=coverage(s),cell=document.createElement('td');cell.dataset.coverageCell='true';cell.className='coverage-table-cell';cell.title=detail(c);cell.innerHTML=`<strong class="${tone(c.earnings)}">${fmt(c.earnings)}</strong><small>${label(c.earnings)} • FCF ${fmt(c.fcf)}</small>`;const yieldIndex=[...head.children].findIndex(x=>/^yield$/i.test(x.textContent.trim()));if(yieldIndex>=0&&row.children[yieldIndex])row.children[yieldIndex].insertAdjacentElement('afterend',cell);});}
  function decorateFramework(){const driver=[...document.querySelectorAll('.score-driver')].find(x=>x.querySelector('strong')?.textContent.trim()==='Dividend');if(!driver)return;const metrics=driver.querySelector('.score-driver-metrics');if(metrics&&!metrics.querySelector('[data-coverage-metric]'))metrics.insertAdjacentHTML('beforeend','<span data-coverage-metric>Dividend coverage</span>');const p=driver.querySelector('p');if(p)p.textContent='Yield is checked against dividend safety. Coverage is derived from existing EPS TTM, TTM DPS and FCF payout data; open the coverage detail to see the inputs and formula without adding more permanent dashboard columns.';}
  function toggle(e){const summary=e.target.closest?.('.coverage-summary');if(!summary)return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(e.type==='keydown')e.preventDefault();const block=summary.closest('.coverage-block'),open=!block.classList.contains('open');block.classList.toggle('open',open);summary.setAttribute('aria-expanded',String(open));}
  document.addEventListener('click',toggle);document.addEventListener('keydown',toggle);
  let pending=false;function apply(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;decorateCards();decorateTable();decorateFramework();});}
  ensureStyles();apply();window.addEventListener('load',apply);new MutationObserver(apply).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
  window.JSE_DIVIDEND_COVERAGE={coverage,label};
})();