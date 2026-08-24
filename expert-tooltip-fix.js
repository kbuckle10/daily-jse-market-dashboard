(() => {
  let popover = null;
  let activeButton = null;
  let pinned = false;

  function ensureStyles() {
    if (document.getElementById('expertTooltipFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'expertTooltipFixStyles';
    style.textContent = `
      .expert-help::after{display:none!important}
      .expert-tooltip-popover{
        position:fixed;z-index:100000;max-width:340px;padding:10px 12px;
        border:1px solid var(--border);border-radius:10px;background:var(--surface);
        color:var(--text);box-shadow:0 12px 36px rgba(0,0,0,.38);
        font:500 .72rem/1.45 Inter,system-ui,sans-serif;text-align:left;
        pointer-events:none;
      }
      .expert-help[aria-expanded="true"]{color:var(--text)!important;border-color:var(--accent)!important}
      .mobile-watchlist-filter{display:none;gap:6px;width:100%;grid-column:1/-1}
      .mobile-watchlist-filter button{flex:1;min-width:0;border:1px solid var(--border);background:var(--surface2);color:var(--muted);border-radius:10px;padding:9px 7px;font-weight:800;font-size:.68rem}
      .mobile-watchlist-filter button.active{color:var(--accent);background:var(--blue-bg);border-color:var(--accent)}
      @media(max-width:720px){
        .expert-tooltip-popover{left:14px!important;right:14px!important;bottom:16px!important;top:auto!important;max-width:none;}
        .mobile-watchlist-filter{display:flex!important}
        #watchlistStatusFilter{display:none!important}
        .ticker-search-wrap{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important}
        .ticker-search{grid-column:1/-1!important;grid-row:1!important}
        .mobile-watchlist-filter{grid-column:1/-1!important;grid-row:2!important}
        #showAllTickersBtn{grid-column:1/-1!important;grid-row:3!important;width:100%!important}
      }
    `;
    document.head.appendChild(style);
  }

  function prepareButtons(root=document) {
    root.querySelectorAll?.('.expert-help[data-tooltip]').forEach(button => {
      if (!button.hasAttribute('title')) button.setAttribute('title', button.getAttribute('data-tooltip'));
      if (!button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded','false');
    });
  }

  function closePopover(force=false) {
    if (pinned && !force) return;
    if (activeButton) activeButton.setAttribute('aria-expanded','false');
    popover?.remove();
    popover = null;
    activeButton = null;
    pinned = false;
  }

  function positionPopover(button) {
    if (!popover || window.innerWidth <= 720) return;
    const r = button.getBoundingClientRect();
    const pr = popover.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - pr.width - 12));
    let top = r.top - pr.height - 10;
    if (top < 12) top = Math.min(window.innerHeight - pr.height - 12, r.bottom + 10);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function openPopover(button, shouldPin=false) {
    const text = button?.getAttribute('data-tooltip');
    if (!text) return;
    if (activeButton && activeButton !== button) closePopover(true);
    if (!popover) {
      popover = document.createElement('div');
      popover.className = 'expert-tooltip-popover';
      popover.setAttribute('role','tooltip');
      document.body.appendChild(popover);
    }
    activeButton = button;
    pinned = shouldPin;
    button.setAttribute('aria-expanded','true');
    popover.textContent = text;
    positionPopover(button);
  }

  function onPointerOver(e) {
    const button = e.target.closest?.('.expert-help[data-tooltip]');
    if (!button || pinned) return;
    openPopover(button, false);
  }

  function onPointerOut(e) {
    const button = e.target.closest?.('.expert-help[data-tooltip]');
    if (!button || pinned) return;
    if (e.relatedTarget && button.contains(e.relatedTarget)) return;
    closePopover(true);
  }

  function onClick(e) {
    const button = e.target.closest?.('.expert-help[data-tooltip]');
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const samePinned = activeButton === button && pinned;
      if (samePinned) closePopover(true);
      else openPopover(button, true);
      return;
    }
    if (popover && !e.target.closest?.('.expert-tooltip-popover')) closePopover(true);
  }

  function onKey(e) {
    if (e.key === 'Escape') closePopover(true);
  }

  function ensureMobileWatchlistFilter() {
    const select = document.getElementById('watchlistStatusFilter');
    const wrap = document.querySelector('.ticker-search-wrap');
    if (!select || !wrap) return;
    let group = document.querySelector('.mobile-watchlist-filter');
    if (!group) {
      group = document.createElement('div');
      group.className = 'mobile-watchlist-filter';
      group.setAttribute('role','group');
      group.setAttribute('aria-label','Filter watchlist stocks');
      group.innerHTML = '<button type="button" data-mobile-watchlist="all">All</button><button type="button" data-mobile-watchlist="tracked">Tracked</button><button type="button" data-mobile-watchlist="untracked">Untracked</button>';
      wrap.insertBefore(group, document.getElementById('showAllTickersBtn'));
    }
    const sync = () => group.querySelectorAll('[data-mobile-watchlist]').forEach(b => b.classList.toggle('active', b.dataset.mobileWatchlist === select.value));
    sync();
    if (!group.dataset.bound) {
      group.dataset.bound = 'true';
      group.addEventListener('click', e => {
        const b = e.target.closest('[data-mobile-watchlist]');
        if (!b) return;
        select.value = b.dataset.mobileWatchlist;
        select.dispatchEvent(new Event('change', { bubbles:true }));
        sync();
      });
      select.addEventListener('change', sync);
    }
  }

  ensureStyles();
  prepareButtons();
  ensureMobileWatchlistFilter();
  document.addEventListener('mouseover', onPointerOver, true);
  document.addEventListener('mouseout', onPointerOut, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', () => { if (activeButton) positionPopover(activeButton); ensureMobileWatchlistFilter(); });
  window.addEventListener('scroll', () => { if (!pinned) closePopover(true); }, true);

  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) if (node.nodeType === 1) prepareButtons(node);
    }
    ensureMobileWatchlistFilter();
  }).observe(document.documentElement, {childList:true, subtree:true});
})();
