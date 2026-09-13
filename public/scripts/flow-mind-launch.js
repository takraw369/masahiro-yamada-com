(() => {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const view = params.get('view');

  const click = (selector) => {
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement) node.click();
  };

  const context = document.querySelector('.ko-context');
  const topbar = document.querySelector('.ko-topbar');
  let contextTrigger = null;
  let contextBackdrop = null;
  let previousOverflow = '';

  if (context instanceof HTMLElement && topbar instanceof HTMLElement) {
    context.id = 'knowledge-context';
    context.setAttribute('aria-hidden', 'true');
    Object.assign(context.style, {
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      width: 'min(360px, calc(100vw - 24px))',
      zIndex: '61',
      overflow: 'hidden',
      background: '#fbfaf8',
      borderLeft: '1px solid #d8d4cd',
      boxShadow: '-18px 0 48px rgba(35,29,22,.12)',
      transform: 'translateX(102%)',
      transition: 'transform .2s ease',
    });

    const contextBody = context.querySelector('.ko-context-body');
    if (contextBody instanceof HTMLElement) {
      Object.assign(contextBody.style, { flex: '1', overflowY: 'auto' });
    }

    const contextHead = context.querySelector('.ko-context-head');
    if (contextHead instanceof HTMLElement) {
      Object.assign(contextHead.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      });
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Contextを閉じる');
      Object.assign(close.style, {
        width: '36px',
        height: '36px',
        border: '1px solid #d8d4cd',
        background: '#fff',
        color: '#626b75',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '1rem',
      });
      contextHead.appendChild(close);
      close.addEventListener('click', () => closeContext());
    }

    contextBackdrop = document.createElement('button');
    contextBackdrop.type = 'button';
    contextBackdrop.setAttribute('aria-label', 'Contextを閉じる');
    Object.assign(contextBackdrop.style, {
      display: 'none',
      position: 'fixed',
      inset: '0',
      zIndex: '60',
      border: '0',
      padding: '0',
      background: 'rgba(23,25,28,.28)',
      cursor: 'default',
    });
    document.body.appendChild(contextBackdrop);
    contextBackdrop.addEventListener('click', () => closeContext());

    contextTrigger = document.createElement('button');
    contextTrigger.type = 'button';
    contextTrigger.className = 'ko-iconbtn';
    contextTrigger.textContent = 'Context';
    contextTrigger.setAttribute('aria-controls', context.id);
    contextTrigger.setAttribute('aria-expanded', 'false');
    contextTrigger.setAttribute('aria-label', 'Contextを開く');
    Object.assign(contextTrigger.style, {
      width: 'auto',
      minWidth: '68px',
      padding: '0 10px',
      fontSize: '.68rem',
      fontWeight: '700',
    });
    const dashboardLink = topbar.querySelector('a.ko-iconbtn');
    topbar.insertBefore(contextTrigger, dashboardLink || null);
    contextTrigger.addEventListener('click', () => openContext());
  }

  function openContext() {
    if (!(context instanceof HTMLElement) || !(contextTrigger instanceof HTMLElement)) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    context.style.transform = 'translateX(0)';
    context.setAttribute('aria-hidden', 'false');
    contextTrigger.setAttribute('aria-expanded', 'true');
    if (contextBackdrop instanceof HTMLElement) contextBackdrop.style.display = 'block';
  }

  function closeContext() {
    if (!(context instanceof HTMLElement) || !(contextTrigger instanceof HTMLElement)) return;
    context.style.transform = 'translateX(102%)';
    context.setAttribute('aria-hidden', 'true');
    contextTrigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    if (contextBackdrop instanceof HTMLElement) contextBackdrop.style.display = 'none';
    contextTrigger.focus();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && context instanceof HTMLElement && context.getAttribute('aria-hidden') === 'false') {
      event.preventDefault();
      closeContext();
    }
  });

  window.requestAnimationFrame(() => {
    if (action === 'capture') click('[data-open-capture]');
    if (view && /^[a-z-]+$/i.test(view)) click(`[data-view="${view}"]`);

    if ((action || view) && window.history?.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  });
})();
