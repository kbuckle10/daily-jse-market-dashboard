(()=>{
  const canonicalRating=v=>{
    const s=String(v||'').trim();
    const k=s.toLowerCase().replace(/\s+/g,' ');
    if(k==='hold')return 'Hold';
    if(k==='watch')return 'Watch';
    if(k==='strong buy')return 'Strong Buy';
    if(k==='buy/accumulate'||k==='buy / accumulate')return 'Buy/Accumulate';
    if(k==='hold / wait'||k==='hold/wait')return 'Hold / Wait';
    if(k==='avoid')return 'Avoid';
    if(k==='sell')return 'Sell';
    return s;
  };

  function ensureStyles(){
    if(document.getElementById('freshCapitalMobilePolishStyles'))return;
    const st=document.createElement('style');
    st.id='freshCapitalMobilePolishStyles';
    st.textContent=`
      @media (max-width:720px){
        #freshCapitalSection .panel-heading{align-items:flex-start;gap:10px;}
        #freshCapitalSection .panel-heading .panel-badge{
          width:100%;max-width:100%;box-sizing:border-box;align-self:stretch;
          white-space:normal;overflow-wrap:anywhere;text-align:left;
        }
        #freshCapitalObjective.fresh-objective-bar{display:block;padding:10px;}
        #freshCapitalObjective .fresh-objective-label{display:block;margin-bottom:8px;}
        #freshCapitalObjective .fresh-objective-buttons{
          display:flex;flex-wrap:nowrap;gap:6px;width:100%;min-width:0;
        }
        #freshCapitalObjective .fresh-objective-btn{
          flex:1 1 0;min-width:0;padding:7px 4px;font-size:.58rem;text-align:center;
        }
        #freshCapitalObjective .fresh-objective-note{display:block;margin-top:9px;}
      }
    `;
    document.head.appendChild(st);
  }

  function restructureControls(){
    const ctl=document.getElementById('freshCapitalObjective');
    if(!ctl||ctl.querySelector('.fresh-objective-buttons'))return;
    const buttons=[...ctl.querySelectorAll('.fresh-objective-btn')];
    if(!buttons.length)return;
    const wrap=document.createElement('div');
    wrap.className='fresh-objective-buttons';
    buttons[0].before(wrap);
    buttons.forEach(b=>wrap.appendChild(b));
  }

  function normalizeRatings(){
    document.querySelectorAll('#freshCapitalSection .rating').forEach(el=>{
      el.textContent=canonicalRating(el.textContent);
    });
    document.querySelectorAll('#allocationLegend .legend-item small').forEach(el=>{
      const txt=el.textContent||'';
      const parts=txt.split('•').map(x=>x.trim());
      if(parts.length<2)return;
      parts[parts.length-1]=canonicalRating(parts[parts.length-1]);
      el.textContent='• '+parts.join(' • ');
    });
  }

  function polish(delay=0){
    setTimeout(()=>{ensureStyles();restructureControls();normalizeRatings();},delay);
  }

  ensureStyles();
  polish(60);polish(280);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-fresh-objective],[data-ticker],#resetTrackedBtn,.filter-tile,#tableViewBtn,#cardViewBtn,#showAllTickersBtn')){
      polish(120);polish(320);
    }
  });
  window.addEventListener('storage',e=>{
    if(e.key==='dailyJseFreshCapitalObjectiveV1'||e.key==='dailyJseTrackedTickersV2')polish(280);
  });
})();
