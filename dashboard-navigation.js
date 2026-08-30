(() => {
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  const sections=[
    ['Market','tableView'],
    ['Book Value','bookValueSection'],
    ['Market Watch','marketWatchSection'],
    ['Fresh Capital','freshCapitalSection'],
    ['Scorecard','scoreFrameworkSection'],
    ['Income','incomeOpportunitySection'],
    ['Allocation','allocationSection']
  ];

  function initClearInputsModal(){
    const clearBtn=document.getElementById('clearIncomeInputsBtn');
    if(!clearBtn||document.getElementById('clearIncomeInputsDialog'))return;

    const style=document.createElement('style');
    style.textContent=`
      .clear-inputs-dialog{width:min(460px,calc(100vw - 32px));border:1px solid var(--border);border-radius:16px;padding:0;background:var(--surface);color:var(--text);box-shadow:0 24px 80px rgba(0,0,0,.5)}
      .clear-inputs-dialog::backdrop{background:rgba(2,8,18,.72);backdrop-filter:blur(3px)}
      .clear-inputs-dialog-inner{padding:20px}
      .clear-inputs-dialog .dialog-eyebrow{margin:0 0 6px;color:var(--accent);font-size:.66rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .clear-inputs-dialog h3{margin:0;font-size:1.02rem}
      .clear-inputs-dialog p{margin:10px 0 0;color:var(--muted);font-size:.76rem;line-height:1.55}
      .clear-inputs-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      .clear-inputs-dialog-actions button{border-radius:10px;padding:9px 13px;font-size:.72rem;font-weight:800;cursor:pointer}
      .clear-inputs-cancel{border:1px solid var(--border);background:var(--surface2);color:var(--text)}
      .clear-inputs-confirm{border:1px solid color-mix(in srgb,#ef4444 65%,var(--border));background:color-mix(in srgb,#ef4444 18%,var(--surface2));color:#fecaca}
      .clear-inputs-confirm:hover{background:color-mix(in srgb,#ef4444 27%,var(--surface2))}
      @media(max-width:520px){.clear-inputs-dialog-inner{padding:16px}.clear-inputs-dialog-actions{display:grid;grid-template-columns:1fr 1fr}.clear-inputs-dialog-actions button{width:100%}}
    `;
    document.head.appendChild(style);

    const dialog=document.createElement('dialog');
    dialog.id='clearIncomeInputsDialog';
    dialog.className='clear-inputs-dialog';
    dialog.setAttribute('aria-labelledby','clearIncomeInputsTitle');
    dialog.innerHTML=`<div class="clear-inputs-dialog-inner"><p class="dialog-eyebrow">Income inputs</p><h3 id="clearIncomeInputsTitle">Clear saved portfolio inputs?</h3><p>This will remove all <strong>Shares Owned</strong> and <strong>Avg. Buy Price</strong> values. Your watchlist and market data will stay unchanged.</p><div class="clear-inputs-dialog-actions"><button type="button" class="clear-inputs-cancel">Cancel</button><button type="button" class="clear-inputs-confirm">Clear inputs</button></div></div>`;
    document.body.appendChild(dialog);

    clearBtn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      dialog.showModal();
    },true);
    dialog.querySelector('.clear-inputs-cancel').addEventListener('click',()=>dialog.close());
    dialog.querySelector('.clear-inputs-confirm').addEventListener('click',()=>{
      localStorage.removeItem('dailyJseShareHoldingsV1');
      localStorage.removeItem('dailyJseAverageBuyPricesV1');
      dialog.close();
      location.reload();
    });
    dialog.addEventListener('click',e=>{
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
    });
  }

  function init(){
    const map={
      bookValueSection:document.querySelector('.book-value-panel'),
      marketWatchSection:document.querySelector('.analysis-grid article:first-child'),
      freshCapitalSection:document.querySelector('.fresh-capital-panel'),
      scoreFrameworkSection:document.querySelector('.score-framework-panel'),
      incomeOpportunitySection:document.querySelector('.income-vs-savings-panel'),
      allocationSection:document.querySelector('.allocation-panel')
    };
    Object.entries(map).forEach(([id,el])=>{if(el&&!el.id)el.id=id});
    const anchor=document.querySelector('.filter-grid');
    if(anchor&&!document.querySelector('.dashboard-jump-nav')){
      const nav=document.createElement('nav');nav.className='dashboard-jump-nav';nav.setAttribute('aria-label','Dashboard sections');
      nav.innerHTML='<span class="jump-label">Jump to</span><div class="jump-links">'+sections.map(([label,id])=>`<a href="#${id}">${label}</a>`).join('')+'</div>';
      anchor.insertAdjacentElement('beforebegin',nav);
    }
    if(!document.getElementById('backToTop')){
      const b=document.createElement('button');b.id='backToTop';b.className='back-to-top';b.type='button';b.setAttribute('aria-label','Back to top');b.title='Back to top';b.innerHTML='↑<span>Top</span>';document.body.appendChild(b);
      b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
      const update=()=>b.classList.toggle('show',window.scrollY>500);window.addEventListener('scroll',update,{passive:true});update();
    }
    document.querySelectorAll('.dashboard-jump-nav a').forEach(a=>a.addEventListener('click',e=>{const target=document.querySelector(a.getAttribute('href'));if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',a.getAttribute('href'));}}));
    initClearInputsModal();
    // On a normal load/refresh, always begin at the dashboard header. Explicit section hashes remain respected.
    if(!location.hash)requestAnimationFrame(()=>window.scrollTo(0,0));
  }
  window.addEventListener('pageshow',()=>{if(!location.hash)requestAnimationFrame(()=>window.scrollTo(0,0));});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();