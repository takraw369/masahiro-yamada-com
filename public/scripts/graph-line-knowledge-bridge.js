(() => {
  if (window.__MASA_GRAPH_LINE_KNOWLEDGE_BRIDGE__) return;
  window.__MASA_GRAPH_LINE_KNOWLEDGE_BRIDGE__ = true;
  if (window.location.pathname !== '/dashboard/graph') return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'line' && params.get('bridge') !== 'line') return;

  const GRAPH_SELECTION = 'masa:line-graph-selection';
  const GRAPH_RESULT = 'masa:line-graph-result';
  const state = {
    query: params.get('q')?.trim() || '',
    results: [],
    item: null,
    candidates: [],
    sources: [],
    loading: false,
    requestId: '',
  };

  const node = (tag, cls = '', text = '') => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };

  const normalize = (value) => String(value || '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  const compact = (value, max = 150) => {
    const text = normalize(value).replace(/\s+/g, ' ');
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };

  const classifySentence = (text, index) => {
    const value = normalize(text);
    if (!value) return 'core';
    if (/[？?]$/.test(value) || /^(なぜ|何|どんな|どう|いつ|どれ|今いちばん)/.test(value)) return 'question';
    if (/返信|教えて|選んで|どれに|番号で/.test(value)) return 'reply';
    if (/再開|戻る|止まった|久しぶり|また始め/.test(value)) return 'restart';
    if (/申込|商品|プログラム|参加|購入|案内/.test(value)) return 'offer';
    if (/次の入口|次へ|詳しく|見てみ|進みたい|こちら/.test(value)) return 'cta';
    if (/Quest|クエスト|やってみ|試して|実践|今日.+(?:分|つ)|行動/.test(value)) return 'quest';
    if (/経験|事例|昔|ある日|たとえば|例えば/.test(value)) return 'story';
    if (/大丈夫|急が|焦ら|そのまま|まず.+観察|安心/.test(value)) return 'safe';
    if (/ではなく|というより|再定義|つまり|本当は|とは[、。]/.test(value)) return 'reframe';
    if (/理由|原理|仕組み|なぜなら|重要|ポイント|ということ/.test(value)) return 'education';
    return index < 2 ? 'hook' : 'core';
  };

  const roleLabels = {
    core: 'コア', hook: 'Hook', safe: '安心', question: '問い', reframe: '再定義',
    education: '教育', story: 'Story', quest: 'Quest', cta: 'CTA', reply: '返信',
    restart: '再開', offer: 'Offer',
  };

  const buildCandidates = (item) => {
    const out = [];
    const seen = new Set();
    const push = (role, text, label = roleLabels[role] || 'コア') => {
      const value = normalize(text);
      if (!value || value.length < 6 || seen.has(value)) return;
      seen.add(value);
      out.push({ role, label, text: value });
    };

    push('core', item?.summary, '要約');
    const content = normalize(item?.content);
    const markerRules = [
      ['hook', /(?:^|\n)(?:Hook|フック|冒頭)[：:]\s*([^\n]+)/gi],
      ['safe', /(?:^|\n)(?:安心|共感)[：:]\s*([^\n]+)/g],
      ['question', /(?:^|\n)(?:問い|質問)[：:]\s*([^\n]+)/g],
      ['reframe', /(?:^|\n)(?:MASA再定義|再定義)[：:]\s*([^\n]+)/g],
      ['education', /(?:^|\n)(?:教育|原理|ポイント)[：:]\s*([^\n]+)/g],
      ['story', /(?:^|\n)(?:Story|物語|事例)[：:]\s*([^\n]+)/gi],
      ['quest', /(?:^|\n)(?:24h\s*Quest|Quest|実践|行動)[：:]\s*([^\n]+)/gi],
      ['cta', /(?:^|\n)(?:CTA|次の一歩|次の入口)[：:]\s*([^\n]+)/gi],
      ['reply', /(?:^|\n)(?:返信|Reply)[：:]\s*([^\n]+)/gi],
      ['restart', /(?:^|\n)(?:再開|休眠)[：:]\s*([^\n]+)/g],
      ['offer', /(?:^|\n)(?:Offer|商品|案内)[：:]\s*([^\n]+)/gi],
    ];
    markerRules.forEach(([role, regex]) => {
      let match;
      while ((match = regex.exec(content))) push(role, match[1]);
    });

    if (content) {
      content
        .split(/\n{2,}|(?<=[。！？!?])\s+/)
        .map((value) => normalize(value.replace(/^[-・*#>\s]+/, '')))
        .filter((value) => value.length >= 12 && value.length <= 360)
        .slice(0, 18)
        .forEach((sentence, index) => push(classifySentence(sentence, index), sentence));
    }
    if (!out.length && content) push('core', content.slice(0, 600), '本文');
    return out.slice(0, 12);
  };

  const style = () => {
    if (document.getElementById('glk-style')) return;
    const tag = document.createElement('style');
    tag.id = 'glk-style';
    tag.textContent = `
      .glk-card{border-color:#d7c4a8!important;background:#fffdf9!important;box-shadow:0 10px 28px rgba(91,62,27,.07)}
      .glk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.glk-kicker{font-size:12px;font-weight:700;letter-spacing:.09em;color:#8b5b2c}.glk-head h3{margin:2px 0 0;font-size:16px;line-height:1.45}.glk-status{white-space:nowrap;border:1px solid #d9c6a7;background:#f8efe1;color:#754a16;border-radius:999px;padding:4px 7px;font-size:11px;font-weight:700}
      .glk-intro{margin:8px 0 10px;color:#59636e;font-size:13px;line-height:1.6}.glk-search{display:flex;gap:6px}.glk-search input{min-width:0;flex:1;height:40px;border:1px solid #d2ccc2;border-radius:8px;padding:0 10px;background:#fff;color:#20262d;font:inherit;font-size:14px}.glk-search button,.glk-return{min-height:40px;border:1px solid #cfc7bc;border-radius:8px;background:#fff;color:#5b6670;padding:0 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
      .glk-results{display:grid;gap:5px;max-height:190px;overflow:auto;margin-top:9px;padding-right:2px}.glk-result{width:100%;display:grid;gap:2px;border:1px solid #e0dbd3;border-radius:8px;background:#fff;padding:8px;text-align:left;cursor:pointer}.glk-result:hover,.glk-result.on{border-color:#c9aa7d;background:#fcf6ec}.glk-result small{color:#8b5b2c;font-size:11px}.glk-result strong{font-size:13px;line-height:1.45;color:#30363c}.glk-result span{color:#68717b;font-size:12px;line-height:1.5}.glk-empty{padding:13px 4px;color:#777f87;font-size:12px;line-height:1.55;text-align:center}
      .glk-detail{margin-top:10px;padding-top:10px;border-top:1px solid #e6e0d7}.glk-detail-head small{color:#8b5b2c;font-size:11px}.glk-detail-head h4{margin:3px 0;font-size:15px;line-height:1.45}.glk-detail-head p{margin:0;color:#5f6973;font-size:12px;line-height:1.55}.glk-links{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.glk-links a{border:1px solid #d7dfe5;background:#f8fbfd;color:#49657c;border-radius:7px;padding:5px 7px;text-decoration:none;font-size:11px}
      .glk-candidates{display:grid;gap:7px;margin-top:9px}.glk-candidate{border:1px solid #dfd8ce;border-radius:9px;background:#fbfaf8;padding:8px}.glk-candidate>b{display:block;color:#8b5b2c;font-size:11px}.glk-candidate>p{margin:5px 0 0;white-space:pre-wrap;color:#30363c;font-size:13px;line-height:1.6}.glk-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:7px}.glk-actions button{min-height:36px;border:1px solid #d2cbc1;border-radius:7px;background:#fff;color:#56606a;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.glk-actions button:first-child{background:#24282c;color:#fff;border-color:#24282c}
      .glk-feedback{min-height:18px;margin:8px 0 0;color:#68717b;font-size:11px;line-height:1.5}.glk-feedback.ok{color:#137a4f}.glk-feedback.bad{color:#a23b3b}.glk-footer{display:flex;justify-content:flex-end;margin-top:7px}
      @media(max-width:760px){.glk-actions{grid-template-columns:1fr}.glk-actions button{min-height:42px}.glk-search input{font-size:16px}}
    `;
    document.head.appendChild(tag);
  };

  let panel;
  let resultsRoot;
  let detailRoot;
  let feedback;
  let searchInput;

  const setFeedback = (text, tone = '') => {
    if (!feedback) return;
    feedback.textContent = text;
    feedback.className = `glk-feedback ${tone}`.trim();
  };

  const focusKnowledgeFactory = () => {
    const button = document.querySelector('.node-list-item[data-node="N017"]');
    if (button instanceof HTMLElement) button.click();
  };

  const renderResults = () => {
    if (!resultsRoot) return;
    resultsRoot.textContent = '';
    if (state.loading) {
      resultsRoot.append(node('div', 'glk-empty', 'Knowledgeを探しています…'));
      return;
    }
    if (!state.results.length) {
      resultsRoot.append(node('div', 'glk-empty', '一致するKnowledgeがありません。検索語を変えてください。'));
      return;
    }
    state.results.forEach((item) => {
      const button = node('button', `glk-result ${state.item?.id === item.id ? 'on' : ''}`);
      button.type = 'button';
      button.append(
        node('small', '', [item.domain, item.item_type].filter(Boolean).join(' · ')),
        node('strong', '', item.title || 'Untitled'),
        node('span', '', compact(item.summary || '要約なし')),
      );
      button.addEventListener('click', () => selectItem(item));
      resultsRoot.append(button);
    });
  };

  const renderDetail = () => {
    if (!detailRoot) return;
    detailRoot.textContent = '';
    if (!state.item) {
      detailRoot.append(node('div', 'glk-empty', 'Knowledge Nodeを選ぶと、LINEへ戻せるメッセージ候補を表示します。'));
      return;
    }

    const head = node('div', 'glk-detail-head');
    head.append(
      node('small', '', [state.item.domain, state.item.item_type].filter(Boolean).join(' · ')),
      node('h4', '', state.item.title || 'Untitled'),
      node('p', '', state.item.summary || ''),
    );
    const links = node('div', 'glk-links');
    const mind = node('a', '', 'FLOW MIND ↗');
    mind.href = `/dashboard/knowledge?q=${encodeURIComponent(state.item.title || '')}`;
    mind.target = '_blank';
    mind.rel = 'noopener noreferrer';
    links.append(mind);
    const sourceUrl = state.sources.find((source) => source?.source_url)?.source_url || '';
    if (sourceUrl) {
      const drive = node('a', '', 'DRIVE原本 ↗');
      drive.href = sourceUrl;
      drive.target = '_blank';
      drive.rel = 'noopener noreferrer';
      links.append(drive);
    }
    head.append(links);
    detailRoot.append(head);

    const candidatesRoot = node('div', 'glk-candidates');
    if (!state.candidates.length) candidatesRoot.append(node('div', 'glk-empty', 'LINEへ送れる文候補を作れませんでした。'));
    state.candidates.slice(0, 8).forEach((candidate) => {
      const card = node('article', 'glk-candidate');
      card.append(node('b', '', candidate.label), node('p', '', candidate.text));
      const actions = node('div', 'glk-actions');
      const replace = node('button', '', '本文に置く');
      const append = node('button', '', '＋ 追記');
      const step = node('button', '', '新Step');
      [replace, append, step].forEach((button) => { button.type = 'button'; });
      replace.addEventListener('click', () => sendToLine('replace', candidate, sourceUrl));
      append.addEventListener('click', () => sendToLine('append', candidate, sourceUrl));
      step.addEventListener('click', () => sendToLine('new-step', candidate, sourceUrl));
      actions.append(replace, append, step);
      card.append(actions);
      candidatesRoot.append(card);
    });
    detailRoot.append(candidatesRoot);
  };

  const selectItem = async (item) => {
    state.item = item;
    state.candidates = [];
    state.sources = [];
    renderResults();
    renderDetail();
    setFeedback('Knowledge本文を読み込み中…');
    try {
      const response = await fetch(`/api/dashboard/knowledge?id=${encodeURIComponent(item.id)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload?.data?.item) throw new Error('knowledge_detail_failed');
      state.item = payload.data.item;
      state.sources = Array.isArray(payload.data.sources) ? payload.data.sources : [];
      state.candidates = buildCandidates(state.item);
      setFeedback('Graphで選んだKnowledgeをLINEへ戻せます。');
    } catch {
      state.candidates = buildCandidates(state.item);
      setFeedback('詳細の読み込みに失敗。要約から候補を作りました。', 'bad');
    }
    renderResults();
    renderDetail();
  };

  const searchKnowledge = async () => {
    const query = searchInput?.value.trim() || '';
    state.query = query;
    state.loading = true;
    state.results = [];
    state.item = null;
    state.candidates = [];
    state.sources = [];
    renderResults();
    renderDetail();
    setFeedback(query ? `「${query}」で検索中…` : 'Knowledgeを検索中…');
    try {
      const response = await fetch(`/api/dashboard/knowledge?q=${encodeURIComponent(query)}&limit=20`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error('knowledge_search_failed');
      state.results = Array.isArray(payload?.data?.knowledge)
        ? payload.data.knowledge
        : Array.isArray(payload?.data) ? payload.data : [];
      setFeedback(state.results.length ? `${state.results.length}件のKnowledge Node` : '一致するKnowledgeがありません。');
    } catch {
      state.results = [];
      setFeedback('Knowledgeを読み込めませんでした。', 'bad');
    } finally {
      state.loading = false;
      renderResults();
      if (state.results.length) await selectItem(state.results[0]);
    }
  };

  const sendToLine = (action, candidate, sourceUrl) => {
    if (!window.opener || window.opener.closed) {
      setFeedback('元のLINEタブが見つかりません。LINE FlowからGraphを開き直してください。', 'bad');
      return;
    }
    const requestId = `graph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    state.requestId = requestId;
    setFeedback('元のLINE Stepへ送信中…');
    window.opener.postMessage({
      type: GRAPH_SELECTION,
      requestId,
      action,
      text: candidate.text,
      asset: {
        id: state.item?.id || '',
        title: state.item?.title || '',
        role: candidate.role,
        sourceUrl: sourceUrl || '',
        source: 'graph',
      },
    }, window.location.origin);
  };

  const buildPanel = () => {
    const inspector = document.querySelector('.inspector');
    if (!(inspector instanceof HTMLElement)) return false;
    style();
    panel = node('section', 'inspector-card glk-card');
    panel.id = 'graph-line-knowledge-bridge';

    const head = node('div', 'glk-head');
    const title = node('div');
    title.append(node('div', 'glk-kicker', 'LINE ⇄ KNOWLEDGE'), node('h3', '', 'Knowledge NodeをLINEへ返す'));
    head.append(title, node('span', 'glk-status', 'ROUNDTRIP ON'));
    panel.append(head, node('p', 'glk-intro', 'Graphで文脈を見ながらKnowledgeを選び、元のFlow / Stepへそのまま戻します。'));

    const searchRow = node('div', 'glk-search');
    searchInput = node('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Knowledge検索　例：自信 / RETURN / 教育';
    searchInput.value = state.query;
    const searchButton = node('button', '', '検索');
    searchButton.type = 'button';
    searchButton.addEventListener('click', searchKnowledge);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchKnowledge();
      }
    });
    searchRow.append(searchInput, searchButton);
    panel.append(searchRow);

    resultsRoot = node('div', 'glk-results');
    detailRoot = node('div', 'glk-detail');
    feedback = node('p', 'glk-feedback', 'Knowledge Factoryを開いています。');
    const footer = node('div', 'glk-footer');
    const back = node('button', 'glk-return', 'LINEタブへ戻る');
    back.type = 'button';
    back.addEventListener('click', () => window.opener?.focus?.());
    footer.append(back);
    panel.append(resultsRoot, detailRoot, feedback, footer);

    const primary = inspector.querySelector('.primary-card');
    if (primary?.parentElement === inspector) primary.insertAdjacentElement('afterend', panel);
    else inspector.prepend(panel);
    renderResults();
    renderDetail();
    return true;
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const detail = event.data;
    if (!detail || detail.type !== GRAPH_RESULT || detail.requestId !== state.requestId) return;
    setFeedback(detail.message || (detail.ok ? 'LINEへ反映しました。' : 'LINEへ反映できませんでした。'), detail.ok ? 'ok' : 'bad');
    if (detail.ok) window.setTimeout(() => window.opener?.focus?.(), 180);
  });

  const boot = () => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (buildPanel()) {
        window.clearInterval(timer);
        focusKnowledgeFactory();
        searchKnowledge();
      } else if (attempts > 80) {
        window.clearInterval(timer);
      }
    }, 100);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();