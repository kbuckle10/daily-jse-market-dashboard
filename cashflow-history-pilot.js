/* Five-stock production UI pilot. Historical values from validated StockAnalysis preview, captured Oct 7, 2026. Does not modify dashboard data, rankings or collectors. */
(()=>{'use strict';
const history={"SEP":["JMD",[[2021,2676,-1655,1021],[2022,-119.44,-2151,-2271],[2023,7690,-2684,5006],[2024,6066,-3368,2698],[2025,9321,-3650,5671],["TTM",11932,-2398,9534]]],"NCBFG":["JMD",[[2021,-35590,-3441,-39031],[2022,-18864,-3093,-21957],[2023,35853,-3153,32700],[2024,67953,-3037,64916],[2025,43440,-2232,41209],["TTM",13998,-2464,11534]]],"TJH":["USD",[[2021,13.99,-0.19,13.8],[2022,7.25,-0.07,7.18],[2023,41.67,-0.46,41.22],[2024,43.87,-1.34,42.53],[2025,52.47,-2.26,50.21],["TTM",65.69,-0.83,64.87]]],"GK":["JMD",[[2021,17067,-1722,15346],[2022,-51.25,-1930,-1981],[2023,17427,-2265,15162],[2024,18090,-2755,15335],[2025,15255,-2640,12615],["TTM",18330,-2497,15833]]],"GHL":["TTD",[[2021,-342.59,-57.77,-400.35],[2022,281.12,-63.7,217.41],[2023,-458.91,-48.39,-507.3],[2024,1121,-31.78,1089],[2025,-542.63,-40.54,-583.17],["TTM",1090,-36.93,1054]]]};
const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function show(ticker){
 const item=history[ticker];if(!item)return;
 document.getElementById('cashflowPilotOverlay')?.remove();
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
function decorate(){
 document.querySelectorAll('#stockTableBody .ticker, #cardView .stock-card h3, #freshCapitalSection .fresh-objective-card .fresh-title strong').forEach(el=>{
  const ticker=el.textContent.trim().toUpperCase();if(!history[ticker]||el.parentElement.querySelector('[data-cashflow-pilot="'+ticker+'"]'))return;
  const b=document.createElement('a');b.dataset.cashflowPilot=ticker;b.href='./cashflow-history.html#'+encodeURIComponent(ticker);b.textContent='Cash Flow Trend';b.style.cssText='display:inline-block;margin:5px 0;padding:5px 8px;border:1px solid #62779a;border-radius:7px;background:#233149;color:#e7f0ff;font-size:11px;cursor:pointer;text-decoration:none';
  el.insertAdjacentElement('afterend',b);
 });
}

document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('cashflowPilotOverlay')?.remove()});
let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})});
function init(){decorate();observer.observe(document.querySelector('#stockTableBody')||document.body,{subtree:true,childList:true});const cards=document.querySelector('#cardView');if(cards)observer.observe(cards,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
