(() => {
  let popover = null;
  let activeButton = null;

  function ensureStyles() {
    if (document.getElementById('expertTooltipFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'expertTooltipFixStyles';
    style.textContent = `
      .expert-tooltip-popover{
        position:fixed;z-index:10000;max-width:320px;padding:10px 12px;
        border:1px solid var(--border);border-radius:10px;background:var(--surface);
        color:var(--text);box-shadow:0 12px 36px rgba(0,0,0,.35);
        font:500 .72rem/1.45 Inter,system-ui,sans-serif;text-align:left;
      }
      .expert-help[aria-expanded="true"]{color:var(--text);border-color:var(--accent);}
      @media(max-width:720px){
        .expert-tooltip-popover{left:14px!important;right:14px!important;bottom:16px!important;top:auto!important;max-width:none;}
      }
    `;
    document.head.appendChild(style);
  }

  function closePopover() {
    if (activeButton) activeButton.setAttribute('aria-expanded','false');
    popover?.remove();
    popover = null;
    activeButton = null;
  }

  function openPopover(button) {
    const text = button.getAttribute('data-tooltip');
    if (!text) return;
    const same = activeButton === button && popover;
    closePopover();
    if (same) return;

    activeButton = button;
    button.setAttribute('aria-expanded','true');
    popover = document.createElement('div');
    popover.className = 'expert-tooltip-popover';
    popover.setAttribute('role','tooltip');
    popover.textContent = text;
    document.body.appendChild(popover);

    if (window.innerWidth <= 720) return;
    const r = button.getBoundingClientRect();
    const pr = popover.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - pr.width - 12));
    let top = r.top - pr.height - 10;
    if (top < 12) top = Math.min(window.innerHeight - pr.height - 12, r.bottom + 10);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function handleClick(e) {
    const button = e.target.closest('.expert-help');
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openPopover(button);
      return;
    }
    if (!e.target.closest('.expert-tooltip-popover')) closePopover();
  }

  function handleKey(e) {
    if (e.key === 'Escape') closePopover();
  }

  ensureStyles();
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKey, true);
  window.addEventListener('resize', closePopover);
  window.addEventListener('scroll', closePopover, true);
})();
