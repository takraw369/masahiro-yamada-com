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
  let selectedCard = null;
  let useDock = null;
  let useChoicesOpen = false;

  const isMobile = () => {
    try { return window.matchMedia('(max-width: 760px)').matches; } catch { return window.innerWidth <= 760; }
  };
  const isEmbedded = () => {
    try { return window.parent && window.parent !== window; } catch { return false; }
  };
  const compactText = (value, max = 92) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };

  const setChoiceState = (open) => {
    useChoicesOpen = Boolean(open);
    if (!useDock) return;
    const primary = useDock.querySelector('.glk-use-primary');
    const choices = useDock.querySelector('.glk-use-choices');
    if (primary instanceof HTMLElement) primary.hidden = useChoicesOpen;
    if (choices instanceof HTMLElement) choices.hidden = !useChoicesOpen;
  };

  const selectCard = (card) => {
    if (!(card instanceof HTMLElement)) return;
    const panel = document.getElementById('graph-line-knowledge-bridge');
    panel?.querySelectorAll('.glk-candidate.glk-selected').forEach((item) => item.classList.remove('glk-selected'));
    card.classList.add('glk-selected');
    selectedCard = card;
    setChoiceState(false);

    if (!useDock) return;
    const preview = useDock.querySelector('.glk-use-preview');
    const label = card.querySelector('b')?.textContent?.trim() || '選択中';
    const text = card.querySelector('p')?.textContent?.trim() || '';
    if (preview instanceof HTMLElement) preview.textContent = `${label}｜${compactText(text)}`;
    const primary = useDock.querySelector('.glk-use-primary');
    if (primary instanceof HTMLButtonElement) primary.disabled = !text;
  };

  const decorateCandidates = (panel) => {
    const cards = [...panel.querySelectorAll('.glk-candidate')].filter((card) => card instanceof HTMLElement);
    cards.forEach((card) => {
      if (card.querySelector('.glk-pick')) return;
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'glk-pick';
      pick.textContent = 'この文を選ぶ';
      card.appendChild(pick);
    });

    if (!selectedCard || !selectedCard.isConnected) {
      const first = cards[0];
      if (first instanceof HTMLElement) selectCard(first);
    }
  };

  const ensureMobileUseDock = (panel) => {
    if (useDock?.isConnected) return useDock;
    const dock = document.createElement('section');
    dock.id = 'glk-mobile-use-dock';
    dock.className = 'glk-use-dock';
    dock.innerHTML = `
      <div class="glk-use-copy">
        <small>LINEで使う文</small>
        <strong class="glk-use-preview">上の文から選んでください</strong>
      </div>
      <button type="button" class="glk-use-primary" disabled>この文をLINEで使う</button>
      <div class="glk-use-choices" hidden>
        <p>どう使う？</p>
        <button type="button" class="glk-use-choice" data-action="replace">今のStepと入れ替える</button>
        <button type="button" class="glk-use-choice" data-action="append">下に足す</button>
        <button type="button" class="glk-use-choice" data-action="new-step">新しいStepにする</button>
        <button type="button" class="glk-use-back">← 文を選び直す</button>
      </div>
    `;
    document.body.appendChild(dock);
    document.body.classList.add('glk-mobile-use-open');
    useDock = dock;

    const primary = dock.querySelector('.glk-use-primary');
    primary?.addEventListener('click', () => {
      if (!selectedCard?.isConnected) return;
      setChoiceState(true);
    });
    dock.querySelector('.glk-use-back')?.addEventListener('click', () => setChoiceState(false));
    dock.querySelectorAll('.glk-use-choice').forEach((button) => {
      button.addEventListener('click', () => {
        if (!selectedCard?.isConnected) return;
        const action = button.getAttribute('data-action') || 'replace';
        send(action, selectedCard);
      });
    });

    decorateCandidates(panel);
    return dock;
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
            body.glk-mobile-use-open{padding-bottom:calc(162px + env(safe-area-inset-bottom))!important}
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
              padding:9px 10px;
              border-radius:9px;
              background:#f8efe1;
              color:#754a16;
              font-size:14px;
              font-weight:700;
              line-height:1.45;
            }
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-head h3{font-size:18px!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-intro{font-size:14px!important;line-height:1.6!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-results{max-height:230px}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-candidate{padding:12px!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-candidate.glk-selected{border:2px solid #8b5b2c!important;background:#fff9ef!important;box-shadow:0 0 0 3px rgba(139,91,44,.08)}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-candidate>p{font-size:15px!important;line-height:1.7!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-actions{display:none!important}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-pick{display:flex;width:100%;min-height:48px;margin-top:10px;align-items:center;justify-content:center;border:1px solid #bfa17a;border-radius:10px;background:#fff;color:#754a16;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-candidate.glk-selected .glk-pick{background:#754a16;color:#fff;border-color:#754a16}
            #graph-line-knowledge-bridge.glk-mobile-docked .glk-return{min-height:46px!important;font-size:13px!important}
            .glk-use-dock{position:fixed;left:0;right:0;bottom:0;z-index:10001;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #d9d2c8;background:rgba(255,253,249,.97);backdrop-filter:blur(14px);box-shadow:0 -12px 36px rgba(44,34,22,.14)}
            .glk-use-copy{display:grid;gap:2px;margin-bottom:8px}.glk-use-copy small{color:#8b5b2c;font-size:11px;font-weight:700;letter-spacing:.06em}.glk-use-preview{display:block;overflow:hidden;color:#30363c;font-size:13px;line-height:1.45;white-space:nowrap;text-overflow:ellipsis}
            .glk-use-primary{width:100%;min-height:52px;border:0;border-radius:12px;background:#24282c;color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer}.glk-use-primary:disabled{opacity:.4;cursor:not-allowed}
            .glk-use-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.glk-use-choices[hidden]{display:none}.glk-use-choices p{grid-column:1/-1;margin:0;color:#59636e;font-size:12px;font-weight:700}.glk-use-choice,.glk-use-back{min-height:48px;border:1px solid #cfc7bc;border-radius:10px;background:#fff;color:#30363c;font:inherit;font-size:13px;font-weight:700}.glk-use-choice:first-of-type{background:#24282c;color:#fff;border-color:#24282c}.glk-use-choice[data-action="new-step"],.glk-use-back{grid-column:1/-1}.glk-use-back{min-height:40px;border:0;background:transparent;color:#6d747c;font-size:12px}
          }
          @media(min-width:761px){.glk-pick,.glk-use-dock{display:none!important}}
        `;
        document.head.appendChild(style);
      }

      panel.classList.add('glk-mobile-docked');
      if (!panel.querySelector('.glk-mobile-cue')) {
        const cue = document.createElement('div');
        cue.className = 'glk-mobile-cue';
        cue.textContent = 'LINEに使う文を選ぶ';
        panel.prepend(cue);
      }
      graphApp.prepend(panel);
      ensureMobileUseDock(panel);

      const observer = new MutationObserver(() => decorateCandidates(panel));
      observer.observe(panel, { childList: true, subtree: true });
      decorateCandidates(panel);
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
      bottom: isMobile() ? '178px' : '18px',
      zIndex: '10002',
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
    const pick = target?.closest('#graph-line-knowledge-bridge .glk-pick');
    if (!(pick instanceof HTMLButtonElement)) return;
    const card = pick.closest('.glk-candidate');
    if (!(card instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectCard(card);
  }, true);

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