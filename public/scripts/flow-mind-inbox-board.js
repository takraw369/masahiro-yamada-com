(() => {
  const panel = document.querySelector('.ko-view[data-panel="inbox"]');
  if (!(panel instanceof HTMLElement)) return;

  const STORAGE_KEY = 'masa:flow-mind-inbox-board:v1';
  const columns = [
    { id: 'inbox', label: 'INBOX', hint: 'とりあえず置く' },
    { id: 'grow', label: 'GROW', hint: '考える・つなぐ' },
    { id: 'ready', label: 'READY', hint: '使う・外へ出す' },
  ];

  const state = { items: [], layout: {}, order: [], dragging: '' };

  function loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        state.layout = saved.layout && typeof saved.layout === 'object' ? saved.layout : {};
        state.order = Array.isArray(saved.order) ? saved.order : [];
      }
    } catch {}
  }

  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout: state.layout, order: state.order })); } catch {}
  }

  function text(value) { return typeof value === 'string' ? value : ''; }
  function esc(value) {
    return text(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  }

  function defaultColumn(item) {
    const layer = text(item.layer).toLowerCase();
    const status = text(item.status).toLowerCase();
    const type = text(item.item_type).toLowerCase();
    if (/canonical|content|publish|output/.test(`${layer} ${status} ${type}`)) return 'ready';
    if (/insight|definition|review|develop/.test(`${layer} ${status} ${type}`)) return 'grow';
    return 'inbox';
  }

  function columnFor(item) { return state.layout[item.id] || defaultColumn(item); }

  function ordered(items) {
    const positions = new Map(state.order.map((id, index) => [id, index]));
    return [...items].sort((a, b) => (positions.get(a.id) ?? 999999) - (positions.get(b.id) ?? 999999));
  }

  function move(id, column, beforeId) {
    state.layout[id] = column;
    const base = state.order.length ? state.order : state.items.map((item) => item.id);
    const next = base.filter((itemId) => itemId !== id);
    const index = beforeId ? next.indexOf(beforeId) : -1;
    if (index >= 0) next.splice(index, 0, id); else next.push(id);
    state.order = next;
    saveLocal();
    render();
  }

  function card(item) {
    const summary = text(item.summary) || text(item.content);
    const article = document.createElement('article');
    article.className = 'fmi-card';
    article.draggable = true;
    article.dataset.id = item.id;
    article.innerHTML = `
      <div class="fmi-meta"><span>${esc(item.layer || item.item_type || 'Seed')}</span>${item.domain ? `<span>${esc(item.domain)}</span>` : ''}</div>
      <h3>${esc(item.title || summary.slice(0, 90) || 'Untitled')}</h3>
      ${summary ? `<p>${esc(summary.slice(0, 260))}${summary.length > 260 ? '…' : ''}</p>` : ''}
      <div class="fmi-actions"><button type="button" data-copy>Copy</button><button type="button" data-reader>読む</button></div>`;

    article.addEventListener('dragstart', () => { state.dragging = item.id; article.classList.add('dragging'); });
    article.addEventListener('dragend', () => { state.dragging = ''; article.classList.remove('dragging'); });
    article.addEventListener('dragover', (event) => event.preventDefault());
    article.addEventListener('drop', (event) => {
      event.preventDefault(); event.stopPropagation();
      if (state.dragging && state.dragging !== item.id) move(state.dragging, columnFor(item), item.id);
    });

    article.querySelector('[data-copy]')?.addEventListener('click', () => navigator.clipboard.writeText(summary || item.title || ''));
    article.querySelector('[data-reader]')?.addEventListener('click', async () => {
      try {
        const response = await fetch(`/api/dashboard/knowledge?id=${encodeURIComponent(item.id)}`, { credentials:'same-origin', headers:{ Accept:'application/json' } });
        const payload = await response.json();
        const full = payload?.data?.item;
        const reader = document.getElementById('reader-article');
        if (!response.ok || !payload?.ok || !full || !reader) throw new Error('unavailable');
        reader.dataset.knowledgeId = String(full.id || item.id);
        const title = reader.querySelector('.ko-reader-title');
        const articleBody = reader.querySelector('.ko-article');
        if (title) title.textContent = text(full.title) || 'Untitled knowledge';
        if (articleBody) {
          articleBody.textContent = '';
          if (full.summary) {
            const note = document.createElement('aside'); note.className = 'ko-note'; note.textContent = full.summary; articleBody.appendChild(note);
          }
          const chunks = text(full.content).split(/\n\s*\n/).filter(Boolean);
          (chunks.length ? chunks : [full.summary || '本文はまだありません。']).forEach((chunk) => {
            const p = document.createElement('p'); p.textContent = chunk; articleBody.appendChild(p);
          });
        }
        const button = document.querySelector('[data-view="reader"]');
        if (button instanceof HTMLElement) button.click();
      } catch {}
    });
    return article;
  }

  function render() {
    let board = panel.querySelector('.fmi-board');
    if (!board) return;
    board.textContent = '';
    columns.forEach((column) => {
      const section = document.createElement('section');
      section.className = `fmi-column fmi-${column.id}`;
      const rows = ordered(state.items.filter((item) => columnFor(item) === column.id));
      section.innerHTML = `<header><div><h2>${column.label}</h2><p>${column.hint}</p></div><b>${rows.length}</b></header><div class="fmi-stack"></div>`;
      section.addEventListener('dragover', (event) => event.preventDefault());
      section.addEventListener('drop', (event) => {
        event.preventDefault();
        if (state.dragging) move(state.dragging, column.id);
      });
      const stack = section.querySelector('.fmi-stack');
      rows.forEach((item) => stack?.appendChild(card(item)));
      if (!rows.length && stack) {
        const empty = document.createElement('div'); empty.className = 'fmi-empty'; empty.textContent = 'ここへドラッグ'; stack.appendChild(empty);
      }
      board.appendChild(section);
    });
  }

  async function load() {
    try {
      const response = await fetch('/api/dashboard/knowledge?q=&limit=50', { credentials:'same-origin', headers:{ Accept:'application/json' } });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error('load_failed');
      state.items = Array.isArray(payload?.data?.knowledge) ? payload.data.knowledge : [];
      render();
    } catch {
      const board = panel.querySelector('.fmi-board');
      if (board) board.innerHTML = '<div class="fmi-empty">Knowledgeを読み込めませんでした。Captureはそのまま使えます。</div>';
    }
  }

  loadLocal();

  const oldList = panel.querySelector('#capture-list');
  if (oldList instanceof HTMLElement) oldList.hidden = true;
  const sub = panel.querySelector('.ko-sub');
  const toolbar = document.createElement('div');
  toolbar.className = 'fmi-toolbar';
  toolbar.innerHTML = '<button type="button" data-capture>＋ メモを書く</button><span>左右＝段階 / 上下＝優先順。並び方はこの端末だけに保存。</span>';
  toolbar.querySelector('[data-capture]')?.addEventListener('click', () => {
    const capture = document.querySelector('[data-open-capture]');
    if (capture instanceof HTMLElement) capture.click();
  });

  const board = document.createElement('div');
  board.className = 'fmi-board';
  if (sub) sub.after(toolbar, board); else panel.append(toolbar, board);

  const style = document.createElement('style');
  style.textContent = `
    .fmi-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 10px;padding:10px 11px;border:1px solid #d8d2ca;background:#fff}.fmi-toolbar button{min-height:40px;border:1px solid #c9ad82;background:#f5ead9;color:#714b1d;font:inherit;font-size:.82rem;font-weight:700;padding:7px 11px;cursor:pointer}.fmi-toolbar span{font-size:.78rem;color:#65707a;line-height:1.55}.fmi-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}.fmi-column{min-width:0;min-height:320px;padding:9px;border:1px solid #d9d3cb;background:#eae6df}.fmi-column>header{display:flex;justify-content:space-between;gap:10px;padding:5px 5px 10px}.fmi-column h2{font-size:.86rem;letter-spacing:.08em}.fmi-column header p{font-size:.76rem;color:#68717a;margin-top:3px}.fmi-column header>b{font-size:1.15rem;color:#8b5b2c}.fmi-stack{display:grid;gap:8px}.fmi-card{padding:12px;border:1px solid #d8d2ca;background:#fff;cursor:grab}.fmi-card.dragging{opacity:.5}.fmi-card h3{font-size:.96rem;line-height:1.55;margin-top:7px}.fmi-card p{font-size:.84rem;line-height:1.72;color:#59636e;margin-top:6px}.fmi-meta{display:flex;gap:5px;flex-wrap:wrap}.fmi-meta span{font-size:.72rem;padding:2px 5px;border:1px solid #ded8d0;color:#69727b}.fmi-actions{display:flex;gap:5px;margin-top:9px}.fmi-actions button{min-height:34px;border:1px solid #d6d0c8;background:#fff;color:#59636e;font:inherit;font-size:.78rem;padding:5px 8px;cursor:pointer}.fmi-empty{padding:24px;text-align:center;border:1px dashed #cec7bd;color:#747c84;font-size:.8rem;background:rgba(255,255,255,.5)}.fmi-inbox .fmi-card{border-left:3px solid #b8afa4}.fmi-grow .fmi-card{border-left:3px solid #b88b4b}.fmi-ready .fmi-card{border-left:3px solid #779078}@media(max-width:900px){.fmi-board{grid-template-columns:1fr}.fmi-column{min-height:120px}}@media(max-width:560px){.fmi-toolbar{align-items:flex-start;flex-direction:column}.fmi-toolbar button{width:100%;min-height:44px}.fmi-card p{font-size:.9rem}}
  `;
  document.head.appendChild(style);
  void load();
})();
