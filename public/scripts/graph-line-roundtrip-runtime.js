(() => {
  if (window.__MASA_GRAPH_LINE_ROUNDTRIP_RUNTIME__) return;
  window.__MASA_GRAPH_LINE_ROUNDTRIP_RUNTIME__ = true;
  if (window.location.pathname !== '/dashboard/graph') return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'line' && params.get('bridge') !== 'line') return;

  const GRAPH_SELECTION = 'masa:line-graph-selection';
  const GRAPH_RESULT = 'masa:line-graph-result';
  const GRAPH_CLOSE = 'masa:line-graph-close';
  const GRAPH_CHANNEL = 'masa-line-graph-roundtrip-v1';
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(GRAPH_CHANNEL) : null;
  let pendingRequestId = '';
  let timeoutId = 0;

  const isMobile = () => {
    try { return window.matchMedia('(max-width: 760px)').matches; } catch { return window.innerWidth <= 760; }
  };
  const isEmbedded = () => {
    try { return window.parent && window.parent !== window; } catch { return false; }
  };

  const installMobileDock = () => {
    if (!isMobile()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const panel = document.getElementById('graph-line-knowledge-bridge');
      const graphApp = document.querySelector('.graph-app');
      if (!(panel instanceof HTMLElement) || !(graphApp instanceof HTMLElement)) {
        if (attempts > 100) window.clearInterval(timer);
        return;
      }

      window.clearInterval(timer);
      if (!document.getElementById('glk-mobile-runtime-style')) {
        const style = document.createElement('style');
        style.id = 'glk-mobile-runtime-style';
        style.textContent = `
          @media(max-width:760px){
            #graph-line-knowledge-bridge.glk-mobile-docked{
              margin:12px 12px 16px!important;
              padding:14px!important;
              border:1px solid #d7c4a8!important;
              border-radius:14px!important;
              scroll-margin-top:12px;
              box-shadow:0 12px 30px rgba(91,62,27,.09)!important;
            }
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-mobile-cue{
              margin:-2px 0 10px;
              padding:8px 10px;
              border-radius:9px;
              background:#f8efe1;
              color:#754a16;
              font-size:13px;
              font-weight:700;
              line-height:1.45;
            }
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-head h3{font-size:18px!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-intro{font-size:14px!important;line-height:1.6!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-results{max-height:230px}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-candidate>p{font-size:14px!important;line-height:1.65!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-actions button{min-height:46px!important;font-size:13px!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-return{min-height:46px!important;font-size:13px!important}
          }
        `;
        document.head.appendChild(style);
      }

      panel.classList.add('glk-mobile-docked');
      if (!panel.querySelector('.glk-mobile-cue')) {
        const cue = document.createElement('div');
        cue.className = 'glk-mobile-cue';
        cue.textContent = 'LINEから開いています · 戻す文を選ぶ';
        panel.prepend(cue);
      }
      graphApp.prepend(panel);
      window.setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }, 100);
  };

  const ensureToast = () => {
    let toast = document.getElementById('glk-runtime-toast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'glk-runtime-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      zIndex: '9999',
      maxWidth: '360px',
      padding: '11px 14px',
      borderRadius: '10px',
      background: '#24282c',
      color: '#fff',
      fontSize: '13px',
      lineHeight: '1.45',
      boxShadow: '0 14px 40px rgba(0,0,0,.18)',
      opacity: '0',
      transform: 'translateY(8px)',
      transition: '.16s ease',
      pointerEvents: 'none',
    });
    document.body.appendChild(toast);
    return toast;
  };

  const showToast = (text, tone = 'normal') => {
    const toast = ensureToast();
    toast.textContent = text;
    toast.style.background = tone === 'bad' ? '#8d3232' : tone === 'ok' ? '#176747' : '#24282c';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  };

  const clearPending = () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = 0;
    pendingRequestId = '';
  };

  const returnToLine = () => {
    if (isEmbedded()) {
      try { window.parent.postMessage({ type: GRAPH_CLOSE }, window.location.origin); } catch {}
      return;
    }
    try { window.opener?.focus?.(); } catch {}
    window.setTimeout(() => {
      try { window.close(); } catch {}
    }, 220);
  };

  const handleResult = (detail) => {
    if (!detail || detail.type !== GRAPH_RESULT || !pendingRequestId || detail.requestId !== pendingRequestId) return;
    clearPending();
    showToast(detail.message || (detail.ok ? 'LINEへ反映しました' : 'LINEへ反映できませんでした'), detail.ok ? 'ok' : 'bad');
    if (detail.ok) returnToLine();
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    handleResult(event.data);
  });
  channel?.addEventListener('message', (event) => handleResult(event.data));

  const send = (action, card) => {
    const text = card.querySelector('p')?.textContent?.trim() || '';
    if (!text) {
      showToast('送る本文が見つかりませんでした', 'bad');
      return;
    }
    const role = card.querySelector('b')?.textContent?.trim() || '';
    const title = document.querySelector('#graph-line-knowledge-bridge .glk-detail-head h4')?.textContent?.trim() || '';
    const requestId = `graph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    pendingRequestId = requestId;
    const payload = {
      type: GRAPH_SELECTION,
      requestId,
      action,
      text,
      asset: { title, role, source: 'graph-runtime' },
    };

    showToast('LINEの選択中Stepへ送信中…');
    let sent = false;
    try {
      if (isEmbedded()) {
        window.parent.postMessage(payload, window.location.origin);
        sent = true;
      }
    } catch {}
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
        sent = true;
      }
    } catch {}
    try {
      if (channel) {
        channel.postMessage(payload);
        sent = true;
      }
    } catch {}

    if (!sent) {
      clearPending();
      showToast('LINEへ接続できません。LINE FlowからGraphを開き直してください', 'bad');
      return;
    }

    timeoutId = window.setTimeout(() => {
      if (pendingRequestId !== requestId) return;
      clearPending();
      showToast('LINE側の応答がありません。LINE FlowからGraphを開き直してください', 'bad');
    }, 4500);
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('#graph-line-knowledge-bridge .glk-actions button');
    if (!(button instanceof HTMLButtonElement)) return;
    const card = button.closest('.glk-candidate');
    if (!(card instanceof HTMLElement)) return;

    const label = button.textContent?.trim() || '';
    const action = label.includes('新Step') ? 'new-step' : label.includes('追記') ? 'append' : 'replace';
    event.preventDefault();
    event.stopImmediatePropagation();
    send(action, card);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const back = target?.closest('#graph-line-knowledge-bridge .glk-return');
    if (!(back instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    returnToLine();
  }, true);

  installMobileDock();
})();