(()=>{
  const D=window.JSE_DASHBOARD_DATA;
  if(!D?.stocks)return;
  const canonical=v=>{const k=String(v||'').trim().toLowerCase().replace(/\s+/g,' ');if(k==='strong buy')return'STRONG BUY';if(k==='buy'||k==='buy/accumulate'||k==='buy / accumulate')return'BUY / ACCUMULATE';if(k==='hold'||k==='hold/wait'||k==='hold / wait')return'HOLD / WAIT';if(k==='watch'||k==='watch/wait'||k==='watch / wait')return'WATCH';if(k==='avoid'||k==='sell'||k==='avoid/sell'||k==='avoid / sell')return'AVOID';return String(v||'').trim().toUpperCase();};
  D.stocks.forEach(s=>{s.rating=canonical(s.rating);});
  function styles(){if(document.getElementById('uiConsistencyFixStyles'))return;const st=document.createElement('style');st.id='uiConsistencyFixStyles';st.textContent=`
    .rating{white-space:nowrap!important;text-transform:uppercase!important;line-height:1!important}
    .card-top,.fresh-title,.movement-head{align-items:flex-start!important}
    .card-top .rating,.fresh-title .rating,.movement-head .rating{flex:0 0 auto!important;max-width:max-content!important}
    .investor-badges{display:grid!important;grid-template-columns:repeat(3,max-content)!important;gap:5px!important;align-items:center!important;justify-content:start!important;overflow:visible!important}
    .investor-badges .sector-badge{grid-column:1/-1!important;justify-self:start!important;white-space:normal!important;max-width:100%!important}
    .investor-badges .style-badge{white-space:nowrap!important;margin:0!important}
    @media(max-width:720px){
      .rating{font-size:.58rem!important;padding:6px 9px!important}
      .card-top{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important}
      .card-top>div{min-width:0!important}
      .card-top h3{margin:0!important}
      .card-top .company{margin-top:3px!important}
      .investor-badges{grid-template-columns:repeat(3,max-content)!important;max-width:100%!important}
      .investor-badges .style-badge{font-size:.58rem!important;padding:4px 7px!important}
    }
  `;document.head.appendChild(st);}
  function normalize(){document.querySelectorAll('.rating').forEach(el=>{el.textContent=canonical(el.textContent)});}
  function fixBadges(){document.querySelectorAll('.investor-badges').forEach(w=>{const sector=w.querySelector('.sector-badge');if(sector&&w.firstElementChild!==sector)w.prepend(sector);});}
  function apply(){styles();normalize();fixBadges();}
  apply();setTimeout(apply,120);setTimeout(apply,360);
  document.addEventListener('click',e=>{if(e.target.closest('[data-fresh-objective],[data-ticker],.filter-tile,#showAllTickersBtn,#tableViewBtn,#cardViewBtn,#resetTrackedBtn'))setTimeout(apply,280);});
  document.addEventListener('change',e=>{if(e.target.matches('#sortSelect,#watchlistStatusFilter'))setTimeout(apply,120);});
  window.addEventListener('storage',()=>setTimeout(apply,120));
})();