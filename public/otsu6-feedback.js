(() => {
  const FEEDBACK_KEY = 'selfFeedback';
  const STATE_META = {
    weak: { label: 'ここ弱い', icon: '🔴', boost: 6 },
    review: { label: 'もう1回', icon: '🟡', boost: 3.5 },
    solid: { label: 'もう大丈夫', icon: '🟢', boost: -4.5 },
  };

  const feedbackBox = document.getElementById('feedback');
  if (!feedbackBox) return;

  function getStats() {
    try {
      if (typeof stats !== 'undefined' && stats && typeof stats === 'object') return stats;
    } catch {}
    return null;
  }

  function getStore() {
    const appStats = getStats();
    if (!appStats) return null;
    appStats[FEEDBACK_KEY] ||= {};
    return appStats[FEEDBACK_KEY];
  }

  function persist() {
    try {
      if (typeof saveStats === 'function') saveStats();
    } catch {}
  }

  function getCurrentQuestion() {
    try {
      if (typeof session === 'undefined' || !session?.queue?.length) return null;
      return session.queue[session.index] || null;
    } catch {
      return null;
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .self-feedback-panel {
      margin-top: 12px;
      padding: 18px;
      border: 1px solid var(--line, #203653);
      border-radius: 16px;
      background: rgba(13, 26, 43, .94);
      box-shadow: 0 16px 50px rgba(0, 0, 0, .18);
    }
    .self-feedback-panel[hidden] { display: none !important; }
    .self-feedback-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .self-feedback-head strong {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
    }
    .self-feedback-head small,
    .self-feedback-question,
    .self-feedback-save-state {
      color: var(--muted, #98abc1);
      font-size: 11px;
      line-height: 1.5;
    }
    .self-feedback-question {
      flex: 0 0 auto;
      padding-top: 2px;
    }
    .self-feedback-state-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .self-feedback-state {
      min-height: 48px;
      padding: 10px 8px;
      border: 1px solid var(--line, #203653);
      border-radius: 12px;
      background: #0a1727;
      cursor: pointer;
      color: var(--text, #f2f6fb);
      font-size: 12px;
      font-weight: 800;
      line-height: 1.35;
      transition: border-color .16s ease, background .16s ease;
    }
    .self-feedback-state:hover,
    .self-feedback-state.active {
      border-color: var(--accent-2, #7cc7ff);
      background: #11243a;
    }
    .self-feedback-state.active[data-state='weak'] { border-color: var(--danger, #ff7f75); }
    .self-feedback-state.active[data-state='review'] { border-color: var(--warning, #f2bd5d); }
    .self-feedback-state.active[data-state='solid'] { border-color: var(--success, #5ad59a); }
    .self-feedback-note {
      width: 100%;
      min-height: 82px;
      resize: vertical;
      padding: 12px 13px;
      border: 1px solid var(--line, #203653);
      border-radius: 12px;
      outline: none;
      background: #081421;
      color: var(--text, #f2f6fb);
      font: inherit;
      font-size: 13px;
      line-height: 1.6;
    }
    .self-feedback-note:focus { border-color: var(--accent-2, #7cc7ff); }
    .self-feedback-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
    }
    .self-feedback-save {
      flex: 0 0 auto;
      padding: 10px 14px;
      border: 1px solid var(--line, #203653);
      border-radius: 10px;
      background: #122238;
      color: var(--text, #f2f6fb);
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
    }
    .self-feedback-save:hover { border-color: var(--accent, #62d6a8); }
    .self-feedback-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
      padding: 14px 16px;
      border: 1px solid var(--line, #203653);
      border-radius: 14px;
      background: rgba(13, 26, 43, .76);
    }
    .self-feedback-summary strong { font-size: 12px; }
    .self-feedback-summary p {
      margin: 3px 0 0;
      color: var(--muted, #98abc1);
      font-size: 11px;
      line-height: 1.5;
    }
    .self-feedback-summary-counts {
      display: flex;
      gap: 10px;
      white-space: nowrap;
      font-size: 11px;
    }
    @media (max-width: 560px) {
      .self-feedback-state-row { grid-template-columns: 1fr; }
      .self-feedback-state { min-height: 44px; text-align: left; }
      .self-feedback-summary { align-items: flex-start; flex-direction: column; }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'selfFeedbackPanel';
  panel.className = 'self-feedback-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '自分フィードバック');
  panel.innerHTML = `
    <div class="self-feedback-head">
      <div>
        <strong>自分フィードバック</strong>
        <small>感覚を残すと、次の「3問集中」「弱点10」に反映します。</small>
      </div>
      <span id="selfFeedbackQuestion" class="self-feedback-question"></span>
    </div>
    <div class="self-feedback-state-row" role="group" aria-label="この問題の定着度">
      <button type="button" class="self-feedback-state" data-state="weak" aria-pressed="false">🔴 ここ弱い</button>
      <button type="button" class="self-feedback-state" data-state="review" aria-pressed="false">🟡 もう1回</button>
      <button type="button" class="self-feedback-state" data-state="solid" aria-pressed="false">🟢 もう大丈夫</button>
    </div>
    <textarea id="selfFeedbackNote" class="self-feedback-note" maxlength="300" placeholder="例：300㎡と500㎡が混ざる／この数値はもう大丈夫／この解説わかりにくい"></textarea>
    <div class="self-feedback-actions">
      <span id="selfFeedbackSaveState" class="self-feedback-save-state">状態はタップで即保存。コメントは右のボタンで保存。</span>
      <button id="saveSelfFeedback" type="button" class="self-feedback-save">コメント保存</button>
    </div>
  `;
  feedbackBox.insertAdjacentElement('afterend', panel);

  const noteInput = panel.querySelector('#selfFeedbackNote');
  const saveButton = panel.querySelector('#saveSelfFeedback');
  const saveState = panel.querySelector('#selfFeedbackSaveState');
  const questionLabel = panel.querySelector('#selfFeedbackQuestion');
  const stateButtons = [...panel.querySelectorAll('[data-state]')];
  let activeState = '';
  let visibleQuestionId = '';

  function setSavedMessage(message) {
    saveState.textContent = message;
  }

  function paintState() {
    stateButtons.forEach((button) => {
      const active = button.dataset.state === activeState;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateSummary() {
    const store = getStore() || {};
    const counts = { weak: 0, review: 0, solid: 0 };
    Object.values(store).forEach((record) => {
      if (record?.state && counts[record.state] !== undefined) counts[record.state] += 1;
    });
    const summary = document.getElementById('selfFeedbackSummary');
    if (!summary) return;
    const countsNode = summary.querySelector('.self-feedback-summary-counts');
    countsNode.innerHTML = `<span>🔴 ${counts.weak}</span><span>🟡 ${counts.review}</span><span>🟢 ${counts.solid}</span>`;
  }

  function saveCurrent() {
    const q = getCurrentQuestion();
    const store = getStore();
    if (!q || !store) return;

    const note = noteInput.value.trim();
    if (!activeState && !note) {
      delete store[q.id];
    } else {
      store[q.id] = {
        ...(store[q.id] || {}),
        state: activeState,
        note,
        updatedAt: new Date().toISOString(),
      };
    }
    persist();
    updateSummary();
    setSavedMessage('保存済み。この感覚を次の出題に反映します。');
  }

  function renderPanel() {
    const q = getCurrentQuestion();
    if (!q || feedbackBox.hidden) {
      panel.hidden = true;
      visibleQuestionId = '';
      return;
    }

    panel.hidden = false;
    visibleQuestionId = q.id;
    questionLabel.textContent = q.id;
    const record = (getStore() || {})[q.id] || {};
    activeState = record.state || '';
    noteInput.value = record.note || '';
    paintState();
    setSavedMessage(record.state || record.note ? '前回の自己評価を表示中。変更できます。' : '状態はタップで即保存。コメントは右のボタンで保存。');
  }

  stateButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.state || '';
      activeState = activeState === next ? '' : next;
      paintState();
      saveCurrent();
    });
  });

  noteInput.addEventListener('input', () => setSavedMessage('コメントを編集中…'));
  saveButton.addEventListener('click', saveCurrent);

  const observer = new MutationObserver(() => {
    const q = getCurrentQuestion();
    if (!feedbackBox.hidden || (q && q.id !== visibleQuestionId)) renderPanel();
    if (feedbackBox.hidden) panel.hidden = true;
  });
  observer.observe(feedbackBox, { attributes: true, attributeFilter: ['hidden', 'class'] });

  try {
    if (typeof scoreQuestion === 'function') {
      const baseScoreQuestion = scoreQuestion;
      scoreQuestion = function scoreQuestionWithSelfFeedback(q) {
        const base = baseScoreQuestion(q);
        const record = (getStore() || {})[q.id];
        const meta = record?.state ? STATE_META[record.state] : null;
        if (!meta) return base;
        return Math.max(0.25, base + meta.boost);
      };
    }
  } catch {}

  const dashboard = document.getElementById('dashboard');
  const quickNote = dashboard?.querySelector('.quick-note');
  if (quickNote && !document.getElementById('selfFeedbackSummary')) {
    const summary = document.createElement('section');
    summary.id = 'selfFeedbackSummary';
    summary.className = 'self-feedback-summary';
    summary.innerHTML = `
      <div>
        <strong>自分の感覚も弱点判定に追加</strong>
        <p>「ここ弱い」は再出題しやすく、「もう大丈夫」は優先度を下げます。</p>
      </div>
      <div class="self-feedback-summary-counts" aria-label="自己評価件数"></div>
    `;
    quickNote.insertAdjacentElement('afterend', summary);
  }

  updateSummary();
})();
