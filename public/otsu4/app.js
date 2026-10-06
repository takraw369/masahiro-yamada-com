(() => {
  "use strict";
  const KEY = "otsu4-study-state-v1";
  const SESSION = "otsu4-study-session-v1";
  const FEEDBACK_EMAIL = "otsu4-feedback-email-v1";
  const CATEGORIES = {
    "law-common": { label: "共通法令", subject: "law" },
    "law-class": { label: "第4類法令", subject: "law" },
    electric: { label: "電気基礎", subject: "electric" },
    structure: { label: "構造・機能・整備・規格", subject: "structure" },
    practical: { label: "鑑別・記述", subject: "practical" }
  };
  const SUBJECTS = { law: "法令", electric: "電気基礎", structure: "構造・機能等", practical: "鑑別等" };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const state = read(KEY, { attempts: {}, correct: {}, streak: {}, wrong: {}, notes: {}, ratings: {}, feedbackDrafts: {}, feedbackEventIds: {}, history: [] });
  for (const field of ["attempts", "correct", "streak", "wrong", "notes", "ratings", "feedbackDrafts", "feedbackEventIds"]) state[field] ||= {};
  state.history ||= [];
  let session = read(SESSION, null);
  let timer = null;
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const saveSession = () => session ? localStorage.setItem(SESSION, JSON.stringify(session)) : localStorage.removeItem(SESSION);
  const subject = (q) => CATEGORIES[q.category].subject;
  const attempts = (q) => state.attempts[q.id] || 0;
  const weak = (q) => (state.wrong[q.id] || 0) > 0 || ["weak", "repeat"].includes(state.ratings[q.id]);
  const mastered = (q) => (state.streak[q.id] || 0) >= 2 || state.ratings[q.id] === "mastered";
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const normalize = (s) => String(s || "").normalize("NFKC").replace(/[\s・。、,，.]/g, "").toLowerCase();
  const shuffle = (rows) => [...rows].sort(() => Math.random() - .5);

  function recentRate(name) {
    const recent = state.history.filter((row) => row.subject === name).slice(-20);
    return recent.length < 3 ? null : recent.filter((row) => row.correct).length / recent.length;
  }
  function risk(name) {
    const relevant = OTSU4_QUESTIONS.filter((q) => subject(q) === name);
    const coverage = relevant.filter((q) => attempts(q)).length / relevant.length;
    const rate = recentRate(name);
    return rate === null ? 65 + Math.round(30 * (1 - coverage)) : Math.round((1 - rate) * 70 + (1 - coverage) * 30);
  }
  function score(q, preferred = null) {
    let points = (attempts(q) === 0 ? 100 : 0) + (weak(q) ? 120 : 0) + (q.officialSignal ? 25 : 0);
    points += risk(subject(q)) * .5 + (preferred === subject(q) ? 45 : 0);
    if (mastered(q) && !weak(q)) points -= 90;
    const last = [...state.history].reverse().find((row) => row.id === q.id);
    if (last && Date.now() - last.at < 2 * 60 * 60 * 1000) points -= 100;
    if (state.history.slice(-8).some((row) => row.concept === q.concept)) points -= 55;
    return points + Math.random() * 8;
  }
  function selectByQuota(quota) {
    const used = new Set();
    const picked = [];
    for (const [category, count] of Object.entries(quota)) {
      for (const q of OTSU4_QUESTIONS.filter((item) => item.category === category).sort((a,b) => score(b) - score(a))) {
        if (picked.filter((item) => item.category === category).length >= count) break;
        if (used.has(q.concept)) continue;
        picked.push(q); used.add(q.concept);
      }
    }
    return shuffle(picked);
  }
  function adaptive() {
    const quotas = { law: 3, electric: 2, structure: 4, practical: 1 };
    const worst = Object.keys(quotas).sort((a,b) => risk(b) - risk(a))[0];
    if (risk(worst) >= 65) {
      const donor = Object.keys(quotas).filter((s) => s !== worst && quotas[s] > 1).sort((a,b) => risk(a) - risk(b))[0];
      if (donor) { quotas[donor]--; quotas[worst]++; }
    }
    const picked = [], used = new Set();
    for (const [name,count] of Object.entries(quotas)) {
      for (const q of OTSU4_QUESTIONS.filter((item) => subject(item) === name).sort((a,b) => score(b,name)-score(a,name))) {
        if (picked.filter((item) => subject(item) === name).length >= count) break;
        if (used.has(q.concept)) continue;
        picked.push(q); used.add(q.concept);
      }
    }
    for (const q of OTSU4_QUESTIONS.filter((item) => !picked.includes(item) && !used.has(item.concept)).sort((a,b) => score(b)-score(a))) {
      if (picked.length >= 10) break;
      picked.push(q); used.add(q.concept);
    }
    return shuffle(picked);
  }
  function questionsFor(mode) {
    if (mode === "mock") return selectByQuota({ "law-common":6, "law-class":4, electric:5, structure:15, practical:5 });
    if (mode === "weak" || mode === "unseen") {
      const subset = OTSU4_QUESTIONS.filter((q) => mode === "weak" ? weak(q) : attempts(q) === 0).sort((a,b) => score(b)-score(a)).slice(0,10);
      const used = new Set(subset.map((q) => q.concept));
      return shuffle([...subset, ...adaptive().filter((q) => !used.has(q.concept))].slice(0,10));
    }
    return adaptive();
  }
  function show(name) {
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    if (name === "home") renderHome();
    if (name === "map") renderMap();
    window.scrollTo(0,0);
  }
  function renderHome() {
    const days = Math.max(0, Math.ceil((new Date("2026-11-01T00:00:00+09:00") - new Date()) / 86400000));
    $("#days-left").textContent = days === 0 ? "試験当日" : `あと${days}日`;
    $("#phase-label").textContent = days <= 7 ? "本番形式" : days <= 21 ? "弱点回収" : "土台づくり";
    const done = OTSU4_QUESTIONS.filter((q) => attempts(q)).length;
    const unseen = OTSU4_QUESTIONS.length - done;
    const weakCount = OTSU4_QUESTIONS.filter(weak).length;
    $("#readiness-value").textContent = `${done}/${OTSU4_QUESTIONS.length}`;
    $("#mission-copy").textContent = `未出${unseen}問・弱点${weakCount}問。共通法令と乙4の新範囲を本番比率で練習。`;
    $("#resume-card").hidden = !session;
    $("#resume-copy").textContent = session ? `${session.index + 1}/${session.ids.length}問目から再開` : "";
    $("#risk-bars").innerHTML = Object.entries(SUBJECTS).map(([name,label]) => {
      const rate = recentRate(name), r = risk(name);
      const relevant = OTSU4_QUESTIONS.filter((q) => subject(q) === name);
      const seen = relevant.filter((q) => attempts(q)).length;
      const mastery = rate === null ? null : Math.round(rate * 100);
      return `<div class="risk-row"><span>${label}<small style="display:block;font-weight:400">経験 ${seen}/${relevant.length}問</small></span><div class="risk-track"><i style="width:${mastery ?? 0}%"></i></div><strong>${mastery === null ? "未測定" : "習熟 "+mastery+"%"}</strong><em class="risk ${r >= 65 ? "high" : r >= 40 ? "mid" : "low"}">弱点 ${r}%</em></div>`;
    }).join("");
  }
  function renderMap() {
    const concepts = new Map();
    for (const q of OTSU4_QUESTIONS) {
      const key = `${subject(q)}:${q.concept}`;
      const row = concepts.get(key) || { label:q.concept, subject:subject(q), count:0, seen:0, weak:false };
      row.count++; row.seen += Number(attempts(q) > 0); row.weak ||= weak(q); concepts.set(key,row);
    }
    $("#coverage-list").innerHTML = [...concepts.values()].sort((a,b) => Number(b.weak)-Number(a.weak) || a.seen/a.count-b.seen/b.count).map((row) =>
      `<div class="coverage-row"><span><b>${escapeHtml(row.label)}</b><small>${SUBJECTS[row.subject]}</small></span><strong class="${row.weak ? "weak" : ""}">${row.weak ? "弱点" : row.seen === row.count ? "確認済" : "未出あり"}</strong></div>`).join("");
  }
  function start(mode) {
    const rows = questionsFor(mode);
    session = { mode, ids:rows.map((q) => q.id), index:0, answers:[], endsAt:mode === "mock" ? Date.now()+105*60000 : null };
    saveSession(); show("quiz"); renderQuestion(); startTimer();
  }
  function current() { return OTSU4_QUESTIONS.find((q) => q.id === session?.ids[session.index]); }
  function drawDiagram(type) {
    if (!type) return "";
    const body = type === "air"
      ? '<rect x="28" y="25" width="115" height="65" rx="12" fill="#dcecf5" stroke="#28648b"/><path d="M39 65h90m-45 0v24m-18-36h36" stroke="#28648b" stroke-width="3"/><circle cx="143" cy="57" r="5" fill="#c93a2c"/><text x="23" y="120">空気室 → ダイヤフラム　• リーク孔</text>'
      : '<path d="M24 75h46q15 0 25-18t26-3h36" fill="none" stroke="#28648b" stroke-width="7"/><circle cx="120" cy="55" r="5" fill="#c93a2c"/><text x="24" y="120">熱で反転するバイメタル → 接点</text>';
    return `<svg class="study-diagram" viewBox="0 0 320 140" role="img" aria-label="学習用の模式図。実物写真ではありません">${body}</svg>`;
  }
  function renderQuestion() {
    const q = current(); if (!q) return finish();
    const answered = session.answers.some((row) => row.index === session.index);
    $("#quiz-mode-label").textContent = session.mode === "mock" ? "35問 本番" : "乙4 練習";
    $("#quiz-counter").textContent = `${session.index+1} / ${session.ids.length}`;
    $("#quiz-progress-bar").style.width = `${session.index/session.ids.length*100}%`;
    $("#question-category").textContent = CATEGORIES[q.category].label;
    $("#question-priority").textContent = q.category === "practical" ? "記述" : q.officialSignal ? "公式公開論点" : "基礎・応用";
    $("#why-now").textContent = weak(q) ? "前に迷った論点を回収" : attempts(q) === 0 ? "乙4の未出を確認" : q.officialSignal ? "公開問題の論点を別角度で確認" : "本番比率と科目別リスクから選択";
    $("#question-text").textContent = q.question;
    $("#choices").hidden = q.category === "practical";
    $("#write-answer").hidden = q.category !== "practical";
    $("#choices").innerHTML = q.category === "practical" ? "" : q.choices.map((choice,i) => `<button class="choice" data-answer="${i}" ${answered ? "disabled" : ""}><span class="choice-letter">${"ABCD"[i]}</span><span>${escapeHtml(choice)}</span></button>`).join("");
    if (q.category === "practical") {
      $("#written-response").value = session.answers.find((row) => row.index === session.index)?.written || "";
      $("#written-response").disabled = answered;
      $("#submit-written").hidden = answered;
      $("#write-answer").querySelector(".study-diagram")?.remove();
      $("#write-answer").insertAdjacentHTML("afterbegin",drawDiagram(q.diagram));
    }
    $("#feedback").hidden = true;
    $("#next-question").hidden = !answered;
    $("#question-note").value = state.notes[q.id] || "";
    $("#improvement-message").value = state.feedbackDrafts[q.id] || "";
    $("#improvement-email").value = localStorage.getItem(FEEDBACK_EMAIL) || "";
    $("#improvement-panel").open = Boolean(state.feedbackDrafts[q.id]);
    $("#improvement-status").textContent = "";
    $$("[data-self]").forEach((button) => button.classList.toggle("active",state.ratings[q.id] === button.dataset.self));
    $$("[data-answer]").forEach((button) => button.addEventListener("click",() => answer(Number(button.dataset.answer))));
    if (answered && session.mode !== "mock") feedback(q,session.answers.find((row) => row.index === session.index));
  }
  function feedback(q,row) {
    $("#feedback").hidden = false;
    $("#feedback-verdict").textContent = row.correct ? "○ 正解" : `× 正解：${q.category === "practical" ? q.expected : q.choices[q.answer]}`;
    $("#feedback-verdict").className = `feedback-verdict ${row.correct ? "ok" : "ng"}`;
    $("#feedback-explanation").textContent = q.explanation;
    $("#choice-explanations").innerHTML = choiceExplanations(q, row);
    $("#feedback-source").href = q.source.url;
    $("#feedback-source").textContent = q.source.label;
  }
  function choiceExplanations(q, row) {
    if (!q.choices) return "";
    return `<h3>各選択肢は何を指す？</h3><ol class="choice-reasons">${q.choices.map((label, index) => {
      const result = index === q.answer ? "正解" : "違う理由";
      const selected = row?.choice === index ? "・自分の回答" : "";
      return `<li class="${index === q.answer ? "right" : ""}"><strong>${"ABCD"[index]}｜${escapeHtml(label)} <small>（${result}${selected}）</small></strong><p>${escapeHtml(q.choiceNotes[index])}</p></li>`;
    }).join("")}</ol>`;
  }
  function answer(choice, written = "") {
    const q = current(); if (!q || session.answers.some((row) => row.index === session.index)) return;
    if (q.category === "practical" && !written.trim()) return;
    const correct = q.category === "practical" ? q.accepted.some((item) => normalize(item) === normalize(written)) : choice === q.answer;
    const row = { id:q.id, index:session.index, subject:subject(q), correct, choice, written };
    session.answers.push(row);
    state.attempts[q.id] = attempts(q)+1;
    if (correct) {
      state.correct[q.id] = (state.correct[q.id] || 0)+1;
      state.streak[q.id] = (state.streak[q.id] || 0)+1;
      if (state.streak[q.id] >= 2) state.wrong[q.id] = 0;
    } else { state.wrong[q.id] = (state.wrong[q.id] || 0)+1; state.streak[q.id] = 0; }
    state.history.push({ id:q.id, concept:q.concept, subject:subject(q), correct, at:Date.now() });
    state.history = state.history.slice(-300);
    save(); saveSession();
    if (session.mode === "mock") { $("#next-question").hidden = false; if (q.category === "practical") { $("#written-response").disabled = true; $("#submit-written").hidden = true; } else $$("[data-answer]").forEach((button) => button.disabled = true); }
    else renderQuestion();
  }
  function next() {
    if (!session?.answers.some((row) => row.index === session.index)) return;
    if (session.index === session.ids.length-1) return finish();
    session.index++; saveSession(); renderQuestion(); window.scrollTo(0,0);
  }
  function rate(rows) { return rows.length ? Math.round(rows.filter((row) => row.correct).length / rows.length * 100) : 0; }
  function finish() {
    clearInterval(timer); timer = null;
    const rows = session?.answers || [], total = rows.length, correct = rows.filter((row) => row.correct).length;
    $("#result-score").textContent = total ? `${rate(rows)}%` : "未回答";
    $("#result-ratio").textContent = `${correct}/${total}`;
    const written = rows.filter((row) => row.subject !== "practical");
    const checks = Object.keys(SUBJECTS).map((name) => ({ name, rows:rows.filter((row) => row.subject === name), threshold:name === "practical" ? 60 : 40 }));
    const pass = session?.mode === "mock" && checks.every((check) => rate(check.rows) >= check.threshold) && rate(written) >= 60;
    $("#result-message").textContent = session?.mode === "mock" ? (pass ? "基準達成。70%の安定を目指す。" : "基準未達の科目を次の10問で補強。") : "迷った論点は次回、別角度から優先します。";
    $("#result-breakdown").innerHTML = checks.filter((check) => check.rows.length).map((check) => `<div class="breakdown-row ${rate(check.rows) < check.threshold ? "fail" : "pass"}"><span>${SUBJECTS[check.name]}</span><strong>${rate(check.rows)}%</strong></div>`).join("") + (session?.mode === "mock" ? `<div class="breakdown-row ${rate(written)<60 ? "fail" : "pass"}"><span>筆記全体</span><strong>${rate(written)}%（基準60%）</strong></div>` : "");
    $("#written-review").innerHTML = session?.mode === "mock" ? rows.filter((row) => row.subject === "practical").map((row) => { const q = OTSU4_QUESTIONS.find((item) => item.id === row.id); return `<div class="coverage-row"><span><b>${escapeHtml(q.question)}</b><small>自分：${escapeHtml(row.written)} ／ 模範：${escapeHtml(q.expected)}</small></span><strong class="${row.correct ? "" : "weak"}">${row.correct ? "○" : "要確認"}</strong></div>`; }).join("") : "";
    $("#answer-review").innerHTML = session?.mode === "mock" ? `<h2>全選択肢の振り返り</h2>${rows.filter((row) => row.subject !== "practical").map((row) => {
      const q = OTSU4_QUESTIONS.find((item) => item.id === row.id);
      return `<details class="review-question"><summary>${row.correct ? "○" : "×"} ${escapeHtml(q.question)}</summary><p>${escapeHtml(q.explanation)}</p>${choiceExplanations(q, row)}<a href="${escapeHtml(q.source.url)}" target="_blank" rel="noopener noreferrer">根拠を見る</a></details>`;
    }).join("")}` : "";
    session = null; saveSession(); show("results");
  }
  async function submitImprovement(event) {
    event.preventDefault();
    const q = current();
    const message = $("#improvement-message").value.trim();
    const email = $("#improvement-email").value.trim();
    const status = $("#improvement-status");
    if (!q || !message || !email || !$("#improvement-consent").checked) return;
    const button = $("#improvement-submit");
    button.disabled = true;
    status.textContent = "送信中…";
    // Keep the address after an explicit send attempt, including when the network is unavailable.
    localStorage.setItem(FEEDBACK_EMAIL, email);
    try {
      const selected = session.answers.find((row) => row.index === session.index)?.choice;
      const clientEventId = state.feedbackEventIds[q.id] || (globalThis.crypto?.randomUUID?.() || `otsu4-${Date.now()}-${Math.random().toString(36).slice(2,10)}`);
      state.feedbackEventIds[q.id] = clientEventId;
      save();
      const response = await fetch('/api/app-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({
          clientEventId,
          appKey: 'otsu4',
          contextKey: `question:${q.id}`,
          message,
          actorRef: email,
          sourceRef: window.location.pathname,
          consent: true,
          meta: {
            questionId: q.id,
            category: q.category,
            categoryLabel: CATEGORIES[q.category].label,
            question: q.question,
            selectedOption: selected == null ? null : "ABCD"[selected],
            selectedChoice: selected == null ? null : q.choices?.[selected] ?? null,
            mode: session.mode,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.data?.accepted) throw new Error('send_failed');
      delete state.feedbackDrafts[q.id];
      delete state.feedbackEventIds[q.id];
      save();
      if (current()?.id === q.id) {
        $("#improvement-message").value = "";
        status.textContent = "送信しました。続けて学習できます。";
      }
    } catch {
      if (current()?.id === q.id) status.textContent = "送信できませんでした。コメントは端末に残っています。ここから再送できます。";
    } finally { button.disabled = false; }
  }
  function startTimer() {
    clearInterval(timer);
    if (!session?.endsAt) { $("#quiz-timer").textContent = ""; return; }
    const tick = () => { const ms = Math.max(0,session.endsAt-Date.now()); $("#quiz-timer").textContent = `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`; if (ms === 0) finish(); };
    tick(); timer = setInterval(tick,1000);
  }
  $$('[data-start]').forEach((button) => button.addEventListener("click",() => start(button.dataset.start)));
  $$('[data-view]').forEach((button) => button.addEventListener("click",() => show(button.dataset.view)));
  $("#quit-quiz").addEventListener("click",() => { clearInterval(timer); show("home"); });
  $("#next-question").addEventListener("click",next);
  $("#submit-written").addEventListener("click",() => answer(null,$("#written-response").value));
  $("#resume-quiz").addEventListener("click",() => { show("quiz"); renderQuestion(); startTimer(); });
  $("#discard-session").addEventListener("click",() => { session=null; saveSession(); renderHome(); });
  $("#question-note").addEventListener("input",(event) => { const q=current(); if(q){ state.notes[q.id]=event.target.value; save(); } });
  $("#jump-improvement").addEventListener("click",() => {
    $("#improvement-panel").open = true;
    $("#improvement-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#improvement-message").focus({ preventScroll: true });
  });
  $("#improvement-message").addEventListener("input",(event) => { const q=current(); if(q){ state.feedbackDrafts[q.id]=event.target.value; delete state.feedbackEventIds[q.id]; save(); } });
  $("#improvement-form").addEventListener("submit",submitImprovement);
  $$("[data-self]").forEach((button) => button.addEventListener("click",() => {
    const q=current(); if (!q) return;
    state.ratings[q.id]=button.dataset.self;
    if (button.dataset.self === "mastered") { state.wrong[q.id]=0; state.streak[q.id]=Math.max(2,state.streak[q.id] || 0); }
    save(); $$("[data-self]").forEach((item) => item.classList.toggle("active",item === button));
  }));
  document.addEventListener("keydown",(event) => {
    if (!$("#view-quiz").classList.contains("active")) return;
    if (event.target.matches("input,textarea")) { if (event.key === "Enter" && event.target.id === "written-response") answer(null,event.target.value); return; }
    if (session?.answers.some((row) => row.index === session.index)) { if (event.key === "Enter") next(); return; }
    if (current()?.category === "practical") return;
    const index = /^[1-4]$/.test(event.key) ? Number(event.key)-1 : "abcd".indexOf(event.key.toLowerCase());
    if (index >= 0 && index < 4) answer(index);
  });
  renderHome();
})();
