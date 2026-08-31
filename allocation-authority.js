(()=>{
  let timer=null,busy=false;
  const legacyPresent=()=>{
    const bar=document.getElementById('allocationBar');
    const note=document.querySelector('#allocationSection .allocation-note');
    return Boolean(bar?.querySelector('[data-score-allocation]'))||/^Buy-rated stocks only\./.test(note?.textContent||'');
  };
  const renderObjective=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      const api=window.JSE_FRESH_CAPITAL_V2;
      if(!api||busy)return;
      busy=true;
      try{api.render();}finally{setTimeout(()=>{busy=false;},0);}
    },0);
  };
  const section=document.getElementById('allocationSection');
  if(section){
    const observer=new MutationObserver(()=>{
      if(!busy&&legacyPresent())renderObjective();
    });
    observer.observe(section,{childList:true,subtree:true,characterData:true});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-fresh-objective],[data-ticker],#resetTrackedBtn'))setTimeout(renderObjective,20);
  });
  window.addEventListener('storage',e=>{
    if(e.key==='dailyJseFreshCapitalObjectiveV1'||e.key==='dailyJseTrackedTickersV2')renderObjective();
  });
  window.addEventListener('load',renderObjective);
  setTimeout(renderObjective,80);
})();
