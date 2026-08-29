(() => {
  const DATA = window.JSE_DASHBOARD_DATA;
  if (!DATA?.stocks) return;
  const byTicker = new Map(DATA.stocks.map(s => [String(s.ticker).toUpperCase(), s]));
  const valid=v=>v && String(v).trim() && !/^N\/?A$/i.test(String(v).trim());
  const dv=v=>{const d=new Date(v);return Number.isNaN(d.valueOf())?0:d.valueOf();};
  const eventDate=e=>Math.max(dv(e?.exDate),dv(e?.recordDate),dv(e?.payDate));
  const newestEvent=s=>{const base={exDate:s.exDate,recordDate:s.recordDate,payDate:s.payDate};const sa=s.saLatestDividend;return sa&&eventDate(sa)>eventDate(base)?sa:base;};
  const rawPayDate=s=>{const e=newestEvent(s);return valid(e?.payDate)?e.payDate:null;};
  const isoDate=v=>{if(!valid(v))return null;const text=String(v).trim();const m=text.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;const d=new Date(text);if(Number.isNaN(d.valueOf()))return text;return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const payDate=s=>isoDate(rawPayDate(s));
  const parseDate=v=>{if(!valid(v))return null;const d=new Date(`${isoDate(v)}T23:59:59`);return Number.isNaN(d.valueOf())?null:d;};
  const isFuturePay=s=>{const d=parseDate(payDate(s));return d?d.getTime()>Date.now():false;};
  const ageMonths=s=>{const d=parseDate(payDate(s));if(!d||isFuturePay(s))return null;return(Date.now()-d.getTime())/(1000*60*60*24*30.44);};
  const recency=s=>{if(isFuturePay(s))return'next';const m=ageMonths(s);if(m==null)return'unknown';if(m>18)return'stale';if(m>12)return'aging';return'current';};
  const label=s=>{const r=recency(s),p=payDate(s)||'N/A';if(r==='next')return{cls:'div-recency current',title:'Next dividend pay',text:`Next dividend pay ${p}`};if(r==='stale')return{cls:'div-recency stale',title:'Last dividend paid',text:`Dividend inactive / stale • last paid ${p}`};if(r==='aging')return{cls:'div-recency aging',title:'Last dividend paid',text:`Dividend recency warning • last paid ${p}`};if(r==='current')return{cls:'div-recency current',title:'Last dividend paid',text:`Last dividend paid ${p}`};return{cls:'div-recency unknown',title:'Dividend pay date',text:'Dividend pay date N/A'};};
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
  const setClass=(el,cls)=>{if(el&&el.className!==cls)el.className=cls;};
  function addCardRecency(){document.querySelectorAll('.stock-card').forEach(card=>{const ticker=card.querySelector('h3')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;let row=card.querySelector('.dividend-recency-row');const latestRow=[...card.querySelectorAll('.metric-row')].find(r=>r.textContent.includes('Latest dividend'));if(!latestRow)return;const l=label(s),p=payDate(s)||'N/A';if(!row){latestRow.insertAdjacentHTML('afterend','<div class="metric-row dividend-recency-row"><span></span><strong></strong></div>');row=latestRow.nextElementSibling;}setText(row.querySelector('span'),l.title);const strong=row.querySelector('strong');setClass(strong,l.cls);setText(strong,`${p}${recency(s)==='stale'?' • STALE':''}`);if(recency(s)==='stale'&&!card.querySelector('.dividend-stale-note'))latestRow.insertAdjacentHTML('afterend','<div class="dividend-stale-note">Historical yield may overstate current income: no recent dividend payment detected.</div>');});}
  function addFreshCapitalRecency(){document.querySelectorAll('.fresh-card').forEach(card=>{const ticker=card.querySelector('.fresh-title strong')?.textContent?.trim().toUpperCase(),s=byTicker.get(ticker);if(!s)return;const l=label(s),footer=card.querySelector('.fresh-secondary')||card.querySelector('.fresh-footer');if(!footer)return;let el=card.querySelector('.fresh-dividend-recency');if(!el){footer.insertAdjacentHTML('beforebegin','<div class="fresh-dividend-recency"></div>');el=footer.previousElementSibling;}setClass(el,`fresh-dividend-recency ${l.cls}`);setText(el,`${l.text}${recency(s)==='stale'?' • income thesis weakened':''}`);});}
  function apply(){addCardRecency();addFreshCapitalRecency();}
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});};
  apply();window.addEventListener('load',schedule);window.addEventListener('storage',schedule);document.addEventListener('click',()=>setTimeout(schedule,40));new MutationObserver(schedule).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
})();