(() => {
  const FEEDBACK_KEY = 'selfFeedback';
  const WRONG_KEY = 'wrongQuestions';
  const WRONG_MIGRATION_MARK = 'wrong-list-migrated';
  const RESUME_KEY = 'otsu6.resume.v1';
  const STATE_META = {
    weak: { label: 'ここ弱い', boost: 6 },
    review: { label: 'もう1回', boost: 3.5 },
    solid: { label: 'もう大丈夫', boost: -4.5 },
  };

  const feedbackBox = document.getElementById('feedback');
  const dashboard = document.getElementById('dashboard');
  if (!feedbackBox || !dashboard) return;

  const safeStats = () => {
    try { return typeof stats !== 'undefined' && stats && typeof stats === 'object' ? stats : null; }
    catch { return null; }
  };
  const safeSession = () => {
    try { return typeof session !== 'undefined' ? session : null; }
    catch { return null; }
  };
  const bank = () => {
    try { return Array.isArray(BANK) ? BANK : []; }
    catch { return []; }
  };
  const persistStats = () => {
    try { if (typeof saveStats === 'function') saveStats(); }
    catch {}
  };
  const feedbackStore = () => {
    const s = safeStats();
    if (!s) return null;
    s[FEEDBACK_KEY] ||= {};
    return s[FEEDBACK_KEY];
  };
  const wrongStore = () => {
    const s = safeStats();
    if (!s) return null;
    s[WRONG_KEY] ||= {};
    return s[WRONG_KEY];
  };
  const currentQuestion = () => {
    const s = safeSession();
    return s?.queue?.[s.index] || null;
  };
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const sectionName = (section) => {
    try { return SECTION_LABEL?.[section] || section; }
    catch { return section; }
  };

  const style = document.createElement('style');
  style.textContent = `
    .self-feedback-panel,.resume-card,.wrong-question-panel{margin-top:14px;padding:16px;border:1px solid var(--line,#203653);border-radius:16px;background:rgba(13,26,43,.9)}
    .self-feedback-panel[hidden],.resume-card[hidden]{display:none!important}
    .self-feedback-head,.resume-card,.wrong-question-head,.self-feedback-actions,.resume-actions,.wrong-question-actions{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .self-feedback-head strong,.resume-card strong,.wrong-question-panel strong{display:block;font-size:14px}
    .self-feedback-head small,.self-feedback-question,.self-feedback-save-state,.resume-card p,.resume-card small,.wrong-question-meta,.wrong-question-empty,.wrong-question-head p{color:var(--muted,#98abc1);font-size:11px;line-height:1.55}
    .self-feedback-state-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
    .self-feedback-state,.self-feedback-save,.resume-button,.wrong-review-button,.wrong-one-button{border:1px solid var(--line,#203653);border-radius:10px;background:#122238;color:var(--text,#f2f6fb);cursor:pointer;font-size:11px;font-weight:800}
    .self-feedback-state{min-height:46px;padding:9px 8px;background:#0a1727}
    .self-feedback-state.active,.self-feedback-state:hover,.self-feedback-save:hover,.resume-button:hover,.wrong-review-button:hover,.wrong-one-button:hover{border-color:var(--accent-2,#7cc7ff)}
    .self-feedback-state.active[data-state='weak']{border-color:var(--danger,#ff7f75)}
    .self-feedback-state.active[data-state='review']{border-color:var(--warning,#f2bd5d)}
    .self-feedback-state.active[data-state='solid']{border-color:var(--success,#5ad59a)}
    .self-feedback-note{width:100%;min-height:78px;resize:vertical;padding:11px 12px;border:1px solid var(--line,#203653);border-radius:11px;background:#081421;color:var(--text,#f2f6fb);font:inherit;font-size:13px;line-height:1.6;outline:none}
    .self-feedback-note:focus{border-color:var(--accent-2,#7cc7ff)}
    .self-feedback-actions{align-items:center;margin-top:9px}.self-feedback-save,.resume-button,.wrong-review-button,.wrong-one-button{padding:9px 11px}
    .self-feedback-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:14px 16px;border:1px solid var(--line,#203653);border-radius:14px;background:rgba(13,26,43,.76)}
    .self-feedback-summary strong{font-size:12px}.self-feedback-summary p{margin:3px 0 0;color:var(--muted,#98abc1);font-size:11px}.self-feedback-summary-counts{display:flex;gap:10px;white-space:nowrap;font-size:11px}
    .resume-card{align-items:center;border-color:rgba(98,214,168,.55);background:linear-gradient(135deg,rgba(98,214,168,.12),rgba(13,26,43,.92))}.resume-card p{margin:4px 0}.resume-actions{align-items:center;flex:0 0 auto}.resume-button.primary,.wrong-review-button{border-color:rgba(98,214,168,.65);background:rgba(98,214,168,.14)}
    .wrong-question-head{margin-bottom:12px}.wrong-question-head p{margin:4px 0 0}.wrong-question-count{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:22px;margin-left:5px;padding:0 7px;border-radius:999px;background:rgba(255,127,117,.14);color:var(--danger,#ff7f75);font-size:11px}
    .wrong-question-list{display:grid;gap:8px;max-height:520px;overflow:auto}.wrong-question-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line,#203653);border-radius:12px;background:#0a1727}.wrong-question-item p{margin:4px 0;font-size:12px;line-height:1.55}.wrong-question-meta{display:block}.wrong-question-empty{padding:5px 0}
    @media(max-width:620px){.self-feedback-state-row{grid-template-columns:1fr}.self-feedback-summary,.resume-card,.wrong-question-head,.self-feedback-actions{align-items:stretch;flex-direction:column}.wrong-question-item{grid-template-columns:1fr}.resume-actions,.wrong-question-actions{width:100%}.resume-button,.wrong-review-button,.wrong-one-button{flex:1}}
  `;
  document.head.appendChild(style);

  const feedbackPanel = document.createElement('section');
  feedbackPanel.id = 'selfFeedbackPanel';
  feedbackPanel.className = 'self-feedback-panel';
  feedbackPanel.hidden = true;
  feedbackPanel.innerHTML = `
    <div class="self-feedback-head"><div><strong>自分フィードバック</strong><small>感覚を残すと「3問集中」「弱点10」の優先度に反映します。</small></div><span id="selfFeedbackQuestion" class="self-feedback-question"></span></div>
    <div class="self-feedback-state-row" role="group" aria-label="この問題の定着度">
      <button type="button" class="self-feedback-state" data-state="weak">🔴 ここ弱い</button>
      <button type="button" class="self-feedback-state" data-state="review">🟡 もう1回</button>
      <button type="button" class="self-feedback-state" data-state="solid">🟢 もう大丈夫</button>
    </div>
    <textarea id="selfFeedbackNote" class="self-feedback-note" maxlength="300" placeholder="例：300㎡と500㎡が混ざる／この数値はもう大丈夫／この解説わかりにくい"></textarea>
    <div class="self-feedback-actions"><span id="selfFeedbackSaveState" class="self-feedback-save-state">状態はタップで即保存。コメントは右で保存。</span><button id="saveSelfFeedback" type="button" class="self-feedback-save">コメント保存</button></div>`;
  feedbackBox.insertAdjacentElement('afterend', feedbackPanel);
  const note = feedbackPanel.querySelector('#selfFeedbackNote');
  const feedbackMessage = feedbackPanel.querySelector('#selfFeedbackSaveState');
  const feedbackQuestion = feedbackPanel.querySelector('#selfFeedbackQuestion');
  const stateButtons = [...feedbackPanel.querySelectorAll('[data-state]')];
  let activeState = '';
  let visibleQuestionId = '';

  const paintState = () => stateButtons.forEach((b) => {
    const on = b.dataset.state === activeState;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const saveFeedback = () => {
    const q = currentQuestion();
    const store = feedbackStore();
    if (!q || !store) return;
    const text = note.value.trim();
    if (!activeState && !text) delete store[q.id];
    else store[q.id] = { ...(store[q.id] || {}), state: activeState, note: text, updatedAt: new Date().toISOString() };
    persistStats();
    updateFeedbackSummary();
    feedbackMessage.textContent = '保存済み。この感覚を次の出題に反映します。';
  };
  const renderFeedback = () => {
    const q = currentQuestion();
    if (!q || feedbackBox.hidden) { feedbackPanel.hidden = true; visibleQuestionId = ''; return; }
    feedbackPanel.hidden = false; visibleQuestionId = q.id; feedbackQuestion.textContent = q.id;
    const record = (feedbackStore() || {})[q.id] || {};
    activeState = record.state || ''; note.value = record.note || ''; paintState();
    feedbackMessage.textContent = record.state || record.note ? '前回の自己評価を表示中。変更できます。' : '状態はタップで即保存。コメントは右で保存。';
  };
  stateButtons.forEach((b) => b.addEventListener('click', () => { activeState = activeState === b.dataset.state ? '' : b.dataset.state; paintState(); saveFeedback(); }));
  note.addEventListener('input', () => { feedbackMessage.textContent = 'コメントを編集中…'; });
  feedbackPanel.querySelector('#saveSelfFeedback').addEventListener('click', saveFeedback);
  new MutationObserver(() => {
    const q = currentQuestion();
    if (!feedbackBox.hidden || (q && q.id !== visibleQuestionId)) renderFeedback();
    if (feedbackBox.hidden) feedbackPanel.hidden = true;
  }).observe(feedbackBox, { attributes: true, attributeFilter: ['hidden', 'class'] });

  const quickNote = dashboard.querySelector('.quick-note');
  const feedbackSummary = document.createElement('section');
  feedbackSummary.id = 'selfFeedbackSummary';
  feedbackSummary.className = 'self-feedback-summary';
  feedbackSummary.innerHTML = `<div><strong>自分の感覚も弱点判定に追加</strong><p>「ここ弱い」は再出題しやすく、「もう大丈夫」は優先度を下げます。</p></div><div class="self-feedback-summary-counts"></div>`;
  quickNote?.insertAdjacentElement('afterend', feedbackSummary);
  function updateFeedbackSummary() {
    const counts = { weak: 0, review: 0, solid: 0 };
    Object.values(feedbackStore() || {}).forEach((r) => { if (r?.state in counts) counts[r.state] += 1; });
    feedbackSummary.querySelector('.self-feedback-summary-counts').innerHTML = `<span>🔴 ${counts.weak}</span><span>🟡 ${counts.review}</span><span>🟢 ${counts.solid}</span>`;
  }

  const modeGrid = dashboard.querySelector('.mode-grid');
  const resumeCard = document.createElement('section');
  resumeCard.id = 'resumeSessionCard'; resumeCard.className = 'resume-card'; resumeCard.hidden = true;
  resumeCard.innerHTML = `<div><strong>前回の続きがあります</strong><p id="resumeSessionMeta"></p><small>途中経過はこの端末に保存されています。</small></div><div class="resume-actions"><button type="button" class="resume-button" data-resume-clear>最初から</button><button type="button" class="resume-button primary" data-resume-start>続きから再開</button></div>`;
  modeGrid?.insertAdjacentElement('beforebegin', resumeCard);
  const loadResume = () => {
    try { const v = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); return v?.version === 1 && Array.isArray(v.queueIds) && v.queueIds.length ? v : null; }
    catch { return null; }
  };
  const clearResume = () => { try { localStorage.removeItem(RESUME_KEY); } catch {} };
  function saveResume() {
    const s = safeSession();
    if (!s?.queue?.length || !document.getElementById('quiz')?.classList.contains('active')) return;
    try {
      const answers = Array.isArray(s.answers) ? s.answers : [];
      localStorage.setItem(RESUME_KEY, JSON.stringify({
        version: 1, mode: s.mode || 'sprint', title: s.title || '', queueIds: s.queue.map((q) => q.id), answers,
        index: Math.min(s.queue.length, Math.max(Number(s.index) || 0, answers.length)),
        complete: answers.length >= s.queue.length,
        elapsedMs: Math.max(0, Date.now() - (Number(s.startedAt) || Date.now())),
        draft: { index: Number(s.index) || 0, selectedChoice: typeof selectedChoice !== 'undefined' ? selectedChoice : null, typedAnswer: typeof typedAnswer !== 'undefined' ? typedAnswer : '' },
        savedAt: new Date().toISOString(),
      }));
      renderResumeCard();
    } catch {}
  }
  function renderResumeCard() {
    const saved = loadResume();
    if (!saved) { resumeCard.hidden = true; return; }
    const ids = new Set(bank().map((q) => q.id));
    const available = saved.queueIds.filter((id) => ids.has(id));
    if (!available.length) { clearResume(); resumeCard.hidden = true; return; }
    const current = Math.min((Number(saved.index) || 0) + 1, available.length);
    resumeCard.querySelector('#resumeSessionMeta').textContent = `${saved.title || saved.mode || '学習'}｜${saved.complete ? '全問回答済み・結果表示前' : `${current} / ${available.length} 問目から`}`;
    resumeCard.hidden = false;
  }

  const wrongPanel = document.createElement('section');
  wrongPanel.id = 'wrongQuestionPanel'; wrongPanel.className = 'wrong-question-panel';
  wrongPanel.innerHTML = `<div class="wrong-question-head"><div><strong>間違えた問題 <span id="wrongQuestionCount" class="wrong-question-count">0</span></strong><p>正解し直すまで残ります。1問だけでも、まとめても解き直せます。</p></div><div class="wrong-question-actions"><button type="button" id="reviewAllWrong" class="wrong-review-button">まとめて解き直す</button></div></div><div id="wrongQuestionList" class="wrong-question-list"></div>`;
  feedbackSummary.insertAdjacentElement('afterend', wrongPanel);
  function migrateWrongHistory() {
    const s = safeStats(), store = wrongStore();
    if (!s || !store || s[WRONG_MIGRATION_MARK]) return;
    const ids = new Set(bank().map((q) => q.id));
    Object.entries(s.byQuestion || {}).forEach(([id, v]) => {
      const misses = Math.max(0, (Number(v?.answered) || 0) - (Number(v?.correct) || 0));
      if (misses && ids.has(id) && !store[id]) store[id] = { id, misses, lastWrongAt: '', imported: true };
    });
    s[WRONG_MIGRATION_MARK] = true; persistStats();
  }
  const wrongEntries = () => {
    const byId = new Map(bank().map((q) => [q.id, q]));
    return Object.values(wrongStore() || {}).map((record) => ({ record, q: byId.get(record.id) })).filter((x) => x.q)
      .sort((a, b) => String(b.record.lastWrongAt || '').localeCompare(String(a.record.lastWrongAt || '')) || (b.record.misses || 0) - (a.record.misses || 0));
  };
  function renderWrongList() {
    const entries = wrongEntries();
    wrongPanel.querySelector('#wrongQuestionCount').textContent = String(entries.length);
    const allButton = wrongPanel.querySelector('#reviewAllWrong'); allButton.hidden = !entries.length; allButton.disabled = !entries.length;
    const list = wrongPanel.querySelector('#wrongQuestionList');
    if (!entries.length) { list.innerHTML = '<div class="wrong-question-empty">いま残っている間違いはありません。間違えるとここに自動追加されます。</div>'; return; }
    list.innerHTML = entries.map(({ record, q }) => `<article class="wrong-question-item"><div><span class="wrong-question-meta">${esc(sectionName(q.section))}・${esc(q.topic)} / ${esc(q.id)} / ミス ${Number(record.misses) || 1}回</span><p>${esc(q.prompt)}</p></div><button type="button" class="wrong-one-button" data-review-wrong="${esc(q.id)}">この1問を解く</button></article>`).join('');
  }

  try {
    if (typeof scoreQuestion === 'function') {
      const base = scoreQuestion;
      scoreQuestion = function(q) {
        const score = base(q), record = (feedbackStore() || {})[q.id], meta = record?.state ? STATE_META[record.state] : null;
        return meta ? Math.max(.25, score + meta.boost) : score;
      };
    }
  } catch {}

  try {
    if (typeof recordAnswer === 'function') {
      const base = recordAnswer;
      recordAnswer = function(q, correct) {
        const result = base(q, correct), store = wrongStore();
        if (store && q?.id) {
          if (correct) delete store[q.id];
          else { const prev = store[q.id] || {}; store[q.id] = { id: q.id, misses: (Number(prev.misses) || 0) + 1, lastWrongAt: new Date().toISOString() }; }
          persistStats(); renderWrongList();
        }
        return result;
      };
    }
  } catch {}

  let baseStartSession = null;
  let restoring = false;
  try {
    if (typeof startSession === 'function') {
      baseStartSession = startSession;
      startSession = function(mode, queueOverride = null) {
        if (!restoring && loadResume() && !safeSession()) {
          const ok = confirm('途中のセッションがあります。新しく始めると保存中の続きは上書きされます。新しく始めますか？');
          if (!ok) { renderResumeCard(); return; }
        }
        const result = baseStartSession(mode, queueOverride); saveResume(); return result;
      };
    }
  } catch {}

  try {
    if (typeof finishSession === 'function') {
      const base = finishSession;
      finishSession = function(...args) { const result = base(...args); clearResume(); renderResumeCard(); return result; };
    }
  } catch {}

  function restoreDraft(saved) {
    const s = safeSession(); if (!s || !saved?.draft || Number(saved.draft.index) !== Number(s.index)) return;
    const q = s.queue[s.index]; if (!q) return;
    if (q.type === 'choice' && Number.isInteger(saved.draft.selectedChoice)) document.querySelector(`.choice-button[data-index="${saved.draft.selectedChoice}"]`)?.click();
    if (q.type === 'text' && saved.draft.typedAnswer) {
      const input = document.getElementById('textAnswer'); if (!input) return;
      input.value = saved.draft.typedAnswer; try { typedAnswer = saved.draft.typedAnswer; } catch {}
      document.getElementById('submitAnswer').disabled = !String(saved.draft.typedAnswer).trim();
    }
  }
  function restoreSession() {
    const saved = loadResume(); if (!saved || !baseStartSession) return;
    const byId = new Map(bank().map((q) => [q.id, q])); const queue = saved.queueIds.map((id) => byId.get(id)).filter(Boolean);
    if (!queue.length) { clearResume(); renderResumeCard(); return; }
    restoring = true;
    try {
      baseStartSession(saved.mode || 'sprint', queue);
      const s = safeSession(); if (!s) return;
      s.answers = Array.isArray(saved.answers) ? saved.answers : [];
      s.startedAt = Date.now() - Math.max(0, Number(saved.elapsedMs) || 0);
      s.index = Math.min(Math.max(0, Number(saved.index) || 0), queue.length - 1);
      if (saved.complete && s.answers.length >= queue.length) { if (typeof finishSession === 'function') finishSession(); return; }
      if (typeof renderQuestion === 'function') renderQuestion(); if (typeof startTimer === 'function') startTimer();
      restoreDraft(saved); saveResume();
    } catch {} finally { restoring = false; }
  }
  function startWrong(queue) {
    if (!queue.length || typeof startSession !== 'function') return;
    startSession('weak', queue);
    const s = safeSession(); if (!s?.queue?.length) return;
    s.title = `間違い復習 ${queue.length}問`; const label = document.getElementById('modeLabel'); if (label) label.textContent = '間違い復習'; saveResume();
  }

  wrongPanel.addEventListener('click', (event) => {
    const one = event.target.closest('[data-review-wrong]');
    if (one) { const q = bank().find((x) => x.id === one.dataset.reviewWrong); if (q) startWrong([q]); return; }
    if (event.target.closest('#reviewAllWrong')) startWrong(wrongEntries().map((x) => x.q));
  });
  resumeCard.addEventListener('click', (event) => {
    if (event.target.closest('[data-resume-start]')) restoreSession();
    if (event.target.closest('[data-resume-clear]')) {
      if (!confirm('保存中の途中セッションを消して、最初からにしますか？')) return;
      clearResume(); renderResumeCard();
    }
  });

  document.getElementById('submitAnswer')?.addEventListener('click', () => queueMicrotask(saveResume));
  document.getElementById('nextQuestion')?.addEventListener('click', () => queueMicrotask(saveResume));
  document.getElementById('textAnswer')?.addEventListener('input', () => queueMicrotask(saveResume));
  document.addEventListener('click', (event) => { if (event.target.closest('.choice-button')) queueMicrotask(saveResume); });
  document.getElementById('quitQuiz')?.addEventListener('click', () => queueMicrotask(() => { if (!safeSession()) { clearResume(); renderResumeCard(); } }));
  document.getElementById('backDashboard')?.addEventListener('click', () => queueMicrotask(() => { if (!safeSession()) { clearResume(); renderResumeCard(); } }));
  window.addEventListener('pagehide', saveResume);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveResume(); });

  migrateWrongHistory();
  updateFeedbackSummary();
  renderWrongList();
  renderResumeCard();
})();
