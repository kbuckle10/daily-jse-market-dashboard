/* Five-stock production UI pilot. Historical values from validated StockAnalysis preview, captured Oct 7, 2026. Does not modify dashboard data, rankings or collectors. */
(()=>{'use strict';
const history={"SEP":["JMD",[[2021,2676,-1655,1021],[2022,-119.44,-2151,-2271],[2023,7690,-2684,5006],[2024,6066,-3368,2698],[2025,9321,-3650,5671],["TTM",11932,-2398,9534]]],"NCBFG":["JMD",[[2021,-35590,-3441,-39031],[2022,-18864,-3093,-21957],[2023,35853,-3153,32700],[2024,67953,-3037,64916],[2025,43440,-2232,41209],["TTM",13998,-2464,11534]]],"TJH":["USD",[[2021,13.99,-0.19,13.8],[2022,7.25,-0.07,7.18],[2023,41.67,-0.46,41.22],[2024,43.87,-1.34,42.53],[2025,52.47,-2.26,50.21],["TTM",65.69,-0.83,64.87]]],"GK":["JMD",[[2021,17067,-1722,15346],[2022,-51.25,-1930,-1981],[2023,17427,-2265,15162],[2024,18090,-2755,15335],[2025,15255,-2640,12615],["TTM",18330,-2497,15833]]],"GHL":["TTD",[[2021,-342.59,-57.77,-400.35],[2022,281.12,-63.7,217.41],[2023,-458.91,-48.39,-507.3],[2024,1121,-31.78,1089],[2025,-542.63,-40.54,-583.17],["TTM",1090,-36.93,1054]]]};
const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function show(ticker){
 const item=history[ticker];if(!item)return;
 document.getElementById('cashflowHistoryOverlay')?.remove();
 const [currency,rows]=item;
 const overlay=document.createElement('div');overlay.id='cashflowPilotOverlay';overlay.setAttribute('role','presentation');
 overlay.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:12px';
 const dialog=document.createElement('section');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',ticker+' historical cash flow');
 dialog.style.cssText='background:#121b2b;color:#f3f5f9;border:1px solid #536078;border-radius:14px;width:min(760px,100%);max-height:88vh;overflow:auto;padding:18px;font:inherit;box-shadow:0 20px 65px #0008';
 const head=document.createElement('div');head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px';
 const title=document.createElement('h2');title.textContent=ticker+' • Cash Flow Trend';title.style.margin='0';
 const close=document.createElement('button');close.type='button';close.textContent='✕ Close';close.style.cssText='padding:9px 12px;border-radius:8px;border:1px solid #71809b;background:#233149;color:white;cursor:pointer';close.onclick=()=>overlay.remove();
 head.append(title,close);
 const note=document.createElement('p');note.textContent='Reporting currency: '+currency+' • Amounts in millions • FY2021–FY2025 and TTM • StockAnalysis snapshot (Oct 2026)';note.style.cssText='font-size:13px;color:#b8c4d7;line-height:1.5';
 const wrap=document.createElement('div');wrap.style.overflowX='auto';
 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;min-width:470px;font-variant-numeric:tabular-nums';
 const tr=document.createElement('tr');['Period','Operating CF','CapEx','Free CF'].forEach(label=>{const th=document.createElement('th');th.textContent=label;th.style.cssText='padding:10px 8px;text-align:right;border-bottom:1px solid #56647a';tr.append(th)});tr.firstChild.style.textAlign='left';
 const thead=document.createElement('thead');thead.append(tr);const tbody=document.createElement('tbody');
 rows.forEach(([period,ocf,capex,fcf])=>{const row=document.createElement('tr');[period,money(ocf),money(capex),money(fcf)].forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;td.style.cssText='padding:9px 8px;text-align:'+(i?'right':'left')+';border-bottom:1px solid #303c51';row.append(td)});tbody.append(row)});
 table.append(thead,tbody);wrap.append(table);
 const foot=document.createElement('p');foot.textContent='Pilot only. Historical cash flow does not affect ratings or scores. Banks and insurers require sector-specific interpretation.';foot.style.cssText='font-size:12px;color:#b8c4d7;line-height:1.5';
 dialog.append(head,note,wrap,foot);overlay.append(dialog);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.append(overlay);close.focus();
}

// Native dialog hosts the already verified standalone history page. Links remain functional as fallback.
window.openCashFlowHistory=function(ticker){
 const url='./cashflow-history.html?v=20261008single6#'+encodeURIComponent(ticker);
 let overlay=document.getElementById('cashflowHistoryOverlay');
 if(!overlay){
  overlay=document.createElement('div');overlay.id='cashflowHistoryOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Historical cash flow');
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(1,7,18,.82);display:flex;align-items:center;justify-content:center;padding:12px';
  const panel=document.createElement('div');panel.style.cssText='width:min(960px,100%);height:min(760px,calc(100dvh - 24px));background:#101c2f;border:1px solid #425b80;border-radius:16px;overflow:hidden;box-shadow:0 30px 90px #000b;display:flex;flex-direction:column';
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#14253d;border-bottom:1px solid #30445f;color:#e9f1ff';
  const heading=document.createElement('strong');heading.id='cashflowHistoryHeading';
  const close=document.createElement('button');close.type='button';close.textContent='✕ Close';close.style.cssText='background:#263e5e;color:white;border:1px solid #526e94;border-radius:9px;padding:8px 12px;cursor:pointer';close.onclick=()=>overlay.remove();
  bar.append(heading,close);
  const frame=document.createElement('iframe');frame.id='cashflowHistoryFrame';frame.title='Historical cash flow details';frame.style.cssText='width:100%;flex:1;border:0;background:#081221';
  panel.append(bar,frame);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  document.body.append(overlay);
 }
 overlay.querySelector('#cashflowHistoryHeading').textContent=ticker+' • Cash Flow History';
 overlay.querySelector('#cashflowHistoryFrame').src=url;
}

// Handle Cash Flow Trend links in Fresh Capital only.
window.addEventListener('click',event=>{
 const link=event.target?.closest?.('[data-cashflow-pilot]');
 if(!link||!link.closest('#freshCapitalSection'))return;
 const ticker=link.getAttribute('data-cashflow-pilot');
 if(!history[ticker]&&!availableHistory.has(ticker))return;
 event.preventDefault();
 event.stopImmediatePropagation();
 try{window.openCashFlowHistory(ticker)}
 catch(error){console.error('Cash flow modal failed',error);window.location.assign(link.href)}
},true);

const availableHistory=new Set(Object.keys(history));
const WATCHLIST_KEY='dailyJseTrackedTickersV2';
function watched(){try{const list=JSON.parse(localStorage.getItem(WATCHLIST_KEY)||'[]');return new Set(Array.isArray(list)?list.map(x=>String(x).toUpperCase()):[])}catch{return new Set()}}
function watchedHistory(){const tracked=watched();return [...availableHistory].filter(t=>tracked.has(t)).sort()}

fetch('./research/cashflow-history.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('History unavailable');return r.json()}).then(store=>{for(const [ticker,item] of Object.entries(store.stocks||{})){if(item?.history?.annual?.length>=5&&item.history.ttm)availableHistory.add(ticker)}decorate()}).catch(e=>console.warn('Cash flow history index fallback:',e));
function ensureHistoryDirectory(){
 const section=document.getElementById('freshCapitalSection');
 if(!section)return;
 let button=document.getElementById('cashflowAllStocksButton');
 if(button){const label='Cash Flow Trend — '+watchedHistory().length+' watchlist stocks';if(button.textContent!==label)button.textContent=label;return;}
 button=document.createElement('button');button.id='cashflowAllStocksButton';button.type='button';
 button.textContent='Cash Flow Trend — '+watchedHistory().length+' watchlist stocks';
 button.style.cssText='display:inline-block;margin:12px 0;padding:9px 14px;border:1px solid #62779a;border-radius:8px;background:#233149;color:#e7f0ff;font-size:13px;cursor:pointer';
 button.onclick=()=>{
  document.getElementById('cashflowStockPicker')?.remove();
  const overlay=document.createElement('div');overlay.id='cashflowStockPicker';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#010712d9;display:flex;align-items:center;justify-content:center;padding:16px';
  const panel=document.createElement('div');panel.style.cssText='background:#14253d;color:#e9f1ff;border:1px solid #425b80;border-radius:14px;padding:20px;width:min(520px,100%);max-height:80vh;overflow:auto';
  const heading=document.createElement('h2');heading.textContent='Cash Flow Trend — available stocks';
  const list=document.createElement('div');list.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px';
  for(const ticker of watchedHistory()){
   const item=document.createElement('button');item.type='button';item.textContent=ticker;item.style.cssText='padding:10px;border:1px solid #526e94;border-radius:8px;background:#263e5e;color:white;cursor:pointer';
   item.onclick=()=>{overlay.remove();window.openCashFlowHistory(ticker)};list.append(item);
  }
  if(!watchedHistory().length){const empty=document.createElement('p');empty.textContent='No selected watchlist stocks have cash-flow history yet.';list.append(empty)}
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.style.cssText='margin-top:16px;padding:8px 12px;background:#263e5e;color:white;border:1px solid #526e94;border-radius:8px';close.onclick=()=>overlay.remove();
  panel.append(heading,list,close);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.append(overlay);
 };
 const anchor=section.querySelector('.fresh-objective-card');
 if(anchor)anchor.before(button);else section.prepend(button);
}
function decorate(){
 ensureHistoryDirectory();
 // Hide links for tickers removed from the selected watchlist.
 document.querySelectorAll('#freshCapitalSection [data-cashflow-pilot]').forEach(el=>{if(!watched().has(el.dataset.cashflowPilot))el.remove()});
 // Remove earlier pilot controls outside Fresh Capital without touching original stock markup.
 document.querySelectorAll('[data-cashflow-pilot]').forEach(el=>{
  if(!el.closest('#freshCapitalSection'))el.remove();
 });
 document.querySelectorAll('#freshCapitalSection .fresh-objective-card .fresh-title strong').forEach(el=>{
  const ticker=el.textContent.trim().toUpperCase();
  if(!availableHistory.has(ticker)||!watched().has(ticker))return;
  const title=el.closest('.fresh-title');
  if(!title||title.querySelector('[data-cashflow-pilot="'+ticker+'"]'))return;
  const link=document.createElement('a');
  link.dataset.cashflowPilot=ticker;
  link.href='./cashflow-history.html#'+encodeURIComponent(ticker);
  link.textContent='Cash Flow Trend';
  link.style.cssText='display:inline-block;margin-top:7px;padding:6px 10px;border:1px solid #62779a;border-radius:7px;background:#233149;color:#e7f0ff;font-size:11px;cursor:pointer;text-decoration:none;width:max-content';
  el.parentElement.appendChild(link);
 });
}

document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('cashflowHistoryOverlay')?.remove()});
let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})});
function init(){decorate();observer.observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
