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
    // On a normal load/refresh, always begin at the dashboard header. Explicit section hashes remain respected.
    if(!location.hash)requestAnimationFrame(()=>window.scrollTo(0,0));
  }
  window.addEventListener('pageshow',()=>{if(!location.hash)requestAnimationFrame(()=>window.scrollTo(0,0));});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();