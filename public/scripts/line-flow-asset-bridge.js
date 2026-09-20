(() => {
  const EVENT = 'masa:line-flow-asset';
  const RESULT = 'masa:line-flow-asset-result';
  const GRAPH_SELECTION = 'masa:line-graph-selection';
  const GRAPH_RESULT = 'masa:line-graph-result';
  const GRAPH_CLOSE = 'masa:line-graph-close';
  const GRAPH_CHANNEL = 'masa-line-graph-roundtrip-v1';
  const GRAPH_SCRIPT_ID = 'masa-line-graph-knowledge-bridge';
  const GRAPH_SCRIPT_SRC = '/scripts/graph-line-knowledge-bridge.js';
  const GRAPH_RUNTIME_ID = 'masa-line-graph-roundtrip-runtime';
  const GRAPH_RUNTIME_SRC = '/scripts/graph-line-roundtrip-runtime.js';
  const GRAPH_OVERLAY_ID = 'masa-line-graph-overlay';
  const processedGraphRequests = new Set();
  const graphChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(GRAPH_CHANNEL) : null;

  const emit = (ok, message, requestId) => {
    window.dispatchEvent(new CustomEvent(RESULT, { detail: { ok, message, requestId } }));
  };

  const messageField = () => document.querySelector('.inspect textarea');
  const addButton = () => document.querySelector('.add');
  const selectedStepId = () => document.querySelector('.step.sel')?.closest('.step-shell')?.dataset?.stepId || '';
  const isMobile = () => {
    try { return window.matchMedia('(max-width: 760px)').matches; } catch { return window.innerWidth <= 760; }
  };

  const setNativeValue = (field, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor?.set) descriptor.set.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus();
  };

  const applyToSelected = ({ text, append, requestId }) => {
    const field = messageField();
    if (!(field instanceof HTMLTextAreaElement)) {
      emit(false, '先にStepを選んでください', requestId);
      return;
    }
    const next = append && field.value.trim()
      ? `${field.value.trim()}\n\n${text}`
      : text;
    setNativeValue(field, next);
    window.setTimeout(() => {
      const current = messageField();
      const applied = current instanceof HTMLTextAreaElement && current.value.trim() === next.trim();
      emit(applied, applied ? (append ? '本文へ追記しました' : '本文へ置きました') : '本文への反映を確認できませんでした', requestId);
    }, 80);
  };

  const createStep = ({ text, requestId }) => {
    const add = addButton();
    if (!(add instanceof HTMLElement)) {
      emit(false, 'Flowを選んでください', requestId);
      return;
    }

    const beforeCount = document.querySelectorAll('.step').length;
    const beforeSelected = selectedStepId();
    add.click();
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const field = messageField();
      const nextSelected = selectedStepId();
      const stepReady = document.querySelectorAll('.step').length > beforeCount
        && nextSelected
        && nextSelected !== beforeSelected;
      if (field instanceof HTMLTextAreaElement && stepReady) {
        window.clearInterval(timer);
        setNativeValue(field, text);
        window.setTimeout(() => {
          const current = messageField();
          const applied = current instanceof HTMLTextAreaElement && current.value.trim() === text.trim();
          emit(applied, applied ? '新Stepへ入れました。保存で確定します' : '新Stepへの反映を確認できませんでした', requestId);
        }, 80);
        return;
      }
      if (Date.now() - startedAt > 6500) {
        window.clearInterval(timer);
        emit(false, '新Stepを準備できませんでした', requestId);
      }
    }, 120);
  };

  const injectScript = (doc, id, src) => {
    if (doc.getElementById(id)) return;
    const script = doc.createElement('script');
    script.id = id;
    script.src = src;
    script.dataset.source = 'line';
    doc.head.appendChild(script);
  };

  const injectGraphBridge = (graphWindow) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (!graphWindow || graphWindow.closed || Date.now() - startedAt > 12000) {
        window.clearInterval(timer);
        return;
      }
      try {
        if (graphWindow.location.origin !== window.location.origin) return;
        if (graphWindow.location.pathname !== '/dashboard/graph') return;
        const doc = graphWindow.document;
        if (doc.readyState === 'loading' || !doc.head || !doc.body) return;
        window.clearInterval(timer);
        injectScript(doc, GRAPH_SCRIPT_ID, GRAPH_SCRIPT_SRC);
        injectScript(doc, GRAPH_RUNTIME_ID, GRAPH_RUNTIME_SRC);
      } catch {
        // The child can briefly be inaccessible while navigating. Keep polling.
      }
    }, 120);
  };

  const closeGraphOverlay = () => {
    const overlay = document.getElementById(GRAPH_OVERLAY_ID);
    if (overlay) overlay.remove();
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
  };

  const openGraphOverlay = (url) => {
    closeGraphOverlay();
    const overlay = document.createElement('div');
    overlay.id = GRAPH_OVERLAY_ID;
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483000', background: '#f3f1ed',
      display: 'grid', gridTemplateRows: '52px minmax(0,1fr)', height: '100dvh', width: '100vw',
    });

    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: 'max(8px, env(safe-area-inset-top)) 12px 8px', background: '#fbfaf8',
      borderBottom: '1px solid #d8d4cd', color: '#24282c', fontSize: '14px', fontWeight: '700',
    });
    const title = document.createElement('span');
    title.textContent = 'LINE ⇄ KNOWLEDGE';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '× LINEへ戻る';
    Object.assign(close.style, {
      minHeight: '36px', border: '1px solid #cfc8bd', borderRadius: '8px', background: '#fff',
      color: '#56606a', padding: '0 10px', font: 'inherit', cursor: 'pointer',
    });
    close.addEventListener('click', closeGraphOverlay);
    bar.append(title, close);

    const frame = document.createElement('iframe');
    frame.src = url.toString();
    frame.title = 'MASA Brain Graph — LINE roundtrip';
    frame.setAttribute('allow', 'clipboard-read; clipboard-write');
    Object.assign(frame.style, { width: '100%', height: '100%', border: '0', background: '#f3f1ed' });
    frame.addEventListener('load', () => injectGraphBridge(frame.contentWindow));

    overlay.append(bar, frame);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  };

  const openGraphBridge = (href) => {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('from', 'line');
    url.searchParams.set('bridge', 'line');
    if (isMobile()) {
      openGraphOverlay(url);
      return;
    }
    const graphWindow = window.open(url.toString(), 'masa-line-knowledge-graph');
    if (!graphWindow) return;
    injectGraphBridge(graphWindow);
    graphWindow.focus?.();
  };

  window.addEventListener(EVENT, (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!detail || typeof detail.text !== 'string' || !detail.text.trim()) return;
    const request = {
      text: detail.text.trim(),
      requestId: detail.requestId || '',
      append: detail.action === 'append',
    };
    if (detail.action === 'new-step') createStep(request);
    else applyToSelected(request);
  });

  const handleGraphSelection = (detail, source, origin = window.location.origin) => {
    if (!detail || detail.type !== GRAPH_SELECTION || typeof detail.text !== 'string' || !detail.text.trim()) return;
    const requestId = detail.requestId || `graph-${Date.now()}`;
    if (processedGraphRequests.has(requestId)) return;
    processedGraphRequests.add(requestId);
    window.setTimeout(() => processedGraphRequests.delete(requestId), 15000);

    const reply = (resultEvent) => {
      const result = resultEvent instanceof CustomEvent ? resultEvent.detail : null;
      if (!result || result.requestId !== requestId) return;
      window.removeEventListener(RESULT, reply);
      const payload = { type: GRAPH_RESULT, ...result };
      try { source?.postMessage?.(payload, origin); } catch {}
      try { graphChannel?.postMessage(payload); } catch {}
    };

    window.addEventListener(RESULT, reply);
    window.dispatchEvent(new CustomEvent(EVENT, {
      detail: {
        action: detail.action || 'replace',
        text: detail.text.trim(),
        asset: detail.asset || null,
        requestId,
      },
    }));
    window.setTimeout(() => window.removeEventListener(RESULT, reply), 7000);
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === GRAPH_CLOSE) {
      closeGraphOverlay();
      return;
    }
    handleGraphSelection(event.data, event.source, event.origin);
  });

  if (graphChannel) {
    graphChannel.addEventListener('message', (event) => handleGraphSelection(event.data, null, window.location.origin));
  }

  document.addEventListener('click', (event) => {
    if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest('.la-links a[href*="/dashboard/graph"]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    openGraphBridge(anchor.href);
  });
})();