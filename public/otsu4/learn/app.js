(() => {
  const lessons = window.OTSU4_LESSONS;
  const STORAGE_ID = ['otsu4', 'foundations', 'v1'].join('-');
  const $ = (id) => document.getElementById(id);
  const state = (() => { try { const value = JSON.parse(localStorage.getItem(STORAGE_ID)); return { completed: Array.isArray(value?.completed) ? value.completed.filter((id) => lessons.some((lesson) => lesson.id === id)) : [], current: lessons.some((lesson) => lesson.id === value?.current) ? value.current : lessons[0].id, drafts: value?.drafts && typeof value.drafts === 'object' ? value.drafts : {} }; } catch { return { completed: [], current: lessons[0].id, drafts: {} }; } })();
  let lessonIndex = 0;
  let questionIndex = 0;
  let answered = false;
  let correct = false;

  function save() { try { localStorage.setItem(STORAGE_ID, JSON.stringify(state)); } catch { /* Private browsing may disable storage. */ } }
  function node(tag, className, content) { const element = document.createElement(tag); if (className) element.className = className; if (content !== undefined) element.textContent = content; return element; }
  function overview() {
    $('lesson-view').hidden = true;
    $('overview').hidden = false;
    const done = new Set(state.completed);
    $('total-progress').textContent = `${done.size} / ${lessons.length} 完了`;
    const list = $('lesson-list'); list.replaceChildren();
    lessons.forEach((lesson, index) => {
      const button = node('button', `lesson-item${done.has(lesson.id) ? ' done' : ''}`);
      button.type = 'button';
      button.append(node('span', 'number', String(index + 1).padStart(2, '0')));
      const copy = node('span', 'lesson-copy');
      copy.append(node('small', '', lesson.area), node('strong', '', lesson.title));
      button.append(copy, node('span', 'status', done.has(lesson.id) ? '完了 ✓' : '学ぶ →'));
      button.addEventListener('click', () => open(index));
      list.append(button);
    });
    const next = lessons.find((lesson) => !done.has(lesson.id)) || lessons.find((lesson) => lesson.id === state.current) || lessons[0];
    $('continue').textContent = done.size ? (done.size === lessons.length ? 'レッスンを復習する' : '続きから学ぶ') : '最初から始める';
    $('continue').onclick = () => open(lessons.indexOf(next));
  }
  function open(index) {
    lessonIndex = index;
    questionIndex = 0;
    state.current = lessons[index].id;
    save();
    const lesson = lessons[index];
    $('overview').hidden = true;
    $('lesson-view').hidden = false;
    $('position').textContent = `${index + 1} / ${lessons.length}`;
    $('progress-bar').style.width = `${((index + 1) / lessons.length) * 100}%`;
    $('lesson-area').textContent = lesson.area;
    $('lesson-title').textContent = lesson.title;
    $('lesson-intro').textContent = lesson.intro;
    $('lesson-takeaway').textContent = lesson.takeaway;
    $('improvement-panel').open = Boolean(state.drafts[lesson.id]);
    $('improvement-message').value = state.drafts[lesson.id] || '';
    try { $('improvement-email').value = localStorage.getItem('otsu4-feedback-email-v1') || ''; } catch { $('improvement-email').value = ''; }
    $('improvement-status').textContent = '';
    const visual = $('lesson-visual'); visual.replaceChildren();
    const flow = node('div', `visual-flow${lesson.visualType === 'flow' ? '' : ' compare'}`);
    lesson.visual.forEach((item, i) => {
      if (i && lesson.visualType === 'flow') flow.append(node('span', 'flow-arrow', '→'));
      flow.append(node('span', 'flow-step', item));
    });
    visual.append(flow);
    const points = $('lesson-points'); points.replaceChildren();
    lesson.points.forEach(([title, body]) => { const section = node('section', 'point'); section.append(node('h2', '', title), node('p', '', body)); points.append(section); });
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('lesson-title').setAttribute('tabindex', '-1'); $('lesson-title').focus({ preventScroll: true });
  }
  function renderQuestion() {
    answered = false; correct = false;
    const questions = lessons[lessonIndex].questions;
    const question = questions[questionIndex];
    $('question-count').textContent = `${questionIndex + 1} / ${questions.length}`;
    $('question-text').textContent = question.text;
    $('answer').hidden = true;
    const choices = $('choices'); choices.replaceChildren();
    question.choices.forEach((choice, index) => {
      const button = node('button', 'choice'); button.type = 'button';
      button.append(node('span', 'choice-letter', String.fromCharCode(65 + index)), node('span', '', choice));
      button.addEventListener('click', () => select(index));
      choices.append(button);
    });
  }
  function select(selected) {
    if (answered) return;
    answered = true;
    const question = lessons[lessonIndex].questions[questionIndex];
    correct = selected === question.correct;
    Array.from($('choices').children).forEach((button, index) => {
      button.disabled = true;
      if (index === question.correct) button.classList.add('correct');
      if (index === selected && !correct) button.classList.add('incorrect');
    });
    $('verdict').textContent = correct ? '正解！' : '惜しい。理由を読んでもう一度。';
    $('verdict').className = correct ? 'right' : 'wrong';
    $('answer-summary').textContent = `正解は ${String.fromCharCode(65 + question.correct)}。各選択肢が何を指すかも確認しましょう。`;
    const reasons = $('reasons'); reasons.replaceChildren();
    question.reasons.forEach((reason, index) => {
      const row = node('div', `reason${index === question.correct ? ' right' : ''}`);
      row.append(node('b', '', `${String.fromCharCode(65 + index)} ${question.choices[index]}`), node('p', '', reason));
      reasons.append(row);
    });
    $('next').textContent = correct ? (questionIndex === lessons[lessonIndex].questions.length - 1 ? 'このレッスンを完了 →' : '次の問題へ →') : 'もう一度答える';
    $('answer').hidden = false;
    $('answer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('next').addEventListener('click', () => {
    if (!answered) return;
    if (!correct) { renderQuestion(); $('question-text').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (questionIndex + 1 < lessons[lessonIndex].questions.length) { questionIndex++; renderQuestion(); $('question-text').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const id = lessons[lessonIndex].id;
    if (!state.completed.includes(id)) state.completed.push(id);
    state.current = lessons[lessonIndex + 1]?.id || id;
    save();
    if (lessonIndex + 1 < lessons.length) open(lessonIndex + 1);
    else { overview(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  });
  $('back').addEventListener('click', () => { overview(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  $('improvement-message').addEventListener('input', () => { state.drafts[lessons[lessonIndex].id] = $('improvement-message').value; save(); });
  $('improvement-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const lesson = lessons[lessonIndex];
    const message = $('improvement-message').value.trim();
    const email = $('improvement-email').value.trim();
    if (!message || !email || !$('improvement-consent').checked) return;
    const button = $('improvement-submit');
    const status = $('improvement-status');
    button.disabled = true; status.textContent = '送信中…';
    try {
      localStorage.setItem('otsu4-feedback-email-v1', email);
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ category: 'technical', name: '乙4アプリ改善', email, consent: true, message: `[乙4基礎改善][${lesson.id}][問${questionIndex + 1}] ${lesson.questions[questionIndex].text}\nコメント: ${message}` }) });
      const receipt = await response.json();
      if (!response.ok || !receipt.ok || !receipt.id) throw new Error('send_failed');
      delete state.drafts[lesson.id]; save();
      if (lessons[lessonIndex].id === lesson.id) { $('improvement-message').value = ''; status.textContent = '送信しました。学習を続けられます。'; }
    } catch { if (lessons[lessonIndex].id === lesson.id) status.textContent = '送信できませんでした。コメントは端末に残っています。'; }
    finally { button.disabled = false; }
  });
  overview();
})();
