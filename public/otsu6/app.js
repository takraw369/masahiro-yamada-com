(() => {
  "use strict";

  const STORAGE_KEY = "otsu6-cram-state-v1";
  const LETTERS = ["A", "B", "C", "D"];
  // 2026年6月更新の公式公開問題から、乙6に直接効く論点を優先。
  // 受験報告由来の論点は10問特訓の重み付けには使うが、ここでは公式を優先する。
  const LATEST_SET_IDS = ["lc01", "lc03", "lc04", "lc05", "lc06", "lc07", "l601", "m01", "m03", "m04", "p05", "p06"];
  const defaultState = {
    attempts: {},
    correct: {},
    wrong: {},
    streak: {},
    comments: {},
    rating: {},
    activeSession: null,
    sound: false,
    sessions: 0
  };

  let state = loadState();
  let session = null;
  let timerHandle = null;
  let toastHandle = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        ...defaultState,
        ...saved,
        attempts: saved?.attempts || {},
        correct: saved?.correct || {},
        wrong: saved?.wrong || {},
        streak: saved?.streak || {},
        comments: saved?.comments || {},
        rating: saved?.rating || {},
        activeSession: saved?.activeSession || null
      };
    } catch {
      return { ...defaultState };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function shuffle(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function weightedPool() {
    const selfWeak = QUESTIONS.filter((item) => state.rating[item.id] === "weak");
    const weak = QUESTIONS.filter((item) => (state.wrong[item.id] || 0) > 0)
      .sort((a, b) => (state.wrong[b.id] || 0) - (state.wrong[a.id] || 0));
    const selfReview = QUESTIONS.filter((item) => state.rating[item.id] === "review");
    const latest = shuffle(QUESTIONS.filter((item) => item.priority === "latest"));
    const high = shuffle(QUESTIONS.filter((item) => item.priority === "high"));
    const normal = shuffle(QUESTIONS.filter((item) => state.rating[item.id] !== "solid"));
    const solid = shuffle(QUESTIONS.filter((item) => state.rating[item.id] === "solid"));
    return [...new Map([...selfWeak, ...weak, ...selfReview, ...latest, ...high, ...normal, ...solid].map((item) => [item.id, item])).values()];
  }

  function getModeQuestions(mode) {
    if (mode === "latest") return LATEST_SET_IDS.map((id) => QUESTIONS.find((item) => item.id === id)).filter(Boolean);
    if (mode === "quick") return weightedPool().slice(0, 10);
    if (mode === "weak") {
      const weak = QUESTIONS.filter((item) => (state.wrong[item.id] || 0) > 0 || ["weak", "review"].includes(state.rating[item.id]))
        .sort((a, b) => (state.wrong[b.id] || 0) - (state.wrong[a.id] || 0));
      return weak.length ? weak.slice(0, 20) : weightedPool().slice(0, 10);
    }
    if (mode === "review-session") {
      return session?.mistakes?.length
        ? session.mistakes.map((id) => QUESTIONS.find((item) => item.id === id)).filter(Boolean)
        : weightedPool().slice(0, 10);
    }
    if (mode === "mock") {
      const quotas = { "law-common": 6, "law-class": 4, mechanics: 5, structure: 15, practical: 5 };
      return Object.entries(quotas).flatMap(([category, count]) =>
        shuffle(QUESTIONS.filter((item) => item.category === category)).slice(0, count)
      );
    }
    return weightedPool().slice(0, 10);
  }

  function modeLabel(mode) {
    return {
      latest: "最新公式・頻出12問",
      quick: "10問特訓",
      weak: "弱点特訓",
      mock: "35問模試",
      "review-session": "ミス解き直し"
    }[mode] || "特訓";
  }

  function ensureQuestionNoteUi() {
    if ($("#question-note-panel")) return;
    const style = document.createElement("style");
    style.textContent = `
      .question-note-panel{margin-top:18px;padding:14px;border:1px solid #e2d8c8;border-radius:18px;background:#fffaf3}
      .question-note-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .question-note-head strong{font-size:14px;color:#282826}.question-note-head small{font-size:11px;color:#8a8177}
      .question-rating{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}
      .question-rating button{min-height:40px;padding:8px 6px;border:1px solid #ddd3c5;border-radius:12px;background:#fff;color:#4b4741;font:inherit;font-size:11px;font-weight:800}
      .question-rating button.active{border-color:#c63b2d;background:#fbe7e1;color:#8f291f}
      #question-note{display:block;width:100%;min-height:72px;padding:11px 12px;border:1px solid #ddd3c5;border-radius:12px;background:#fff;color:#282826;font:inherit;font-size:14px;line-height:1.55;resize:vertical}
      #question-note:focus{outline:2px solid rgba(198,59,45,.18);border-color:#c63b2d}
      @media(max-width:520px){.question-rating{grid-template-columns:1fr}.question-note-panel{padding:12px}}
    `;
    document.head.appendChild(style);

    const panel = document.createElement("section");
    panel.id = "question-note-panel";
    panel.className = "question-note-panel";
    panel.innerHTML = `
      <div class="question-note-head"><strong>コメント・自分メモ</strong><small id="question-note-status">自動保存</small></div>
      <div class="question-rating" role="group" aria-label="この問題の定着度">
        <button type="button" data-rating="weak">🔴 ここ弱い</button>
        <button type="button" data-rating="review">🟡 もう1回</button>
        <button type="button" data-rating="solid">🟢 もう大丈夫</button>
      </div>
      <textarea id="question-note" maxlength="300" placeholder="例：焼入れと焼戻しが混ざる／この数値まだ不安"></textarea>`;
    $("#choices").insertAdjacentElement("afterend", panel);

    $("#question-note").addEventListener("input", () => saveCurrentNote());
    $$("#question-note-panel [data-rating]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = currentQuestion();
        if (!item) return;
        const next = state.rating[item.id] === button.dataset.rating ? "" : button.dataset.rating;
        if (next) state.rating[item.id] = next;
        else delete state.rating[item.id];
        saveState();
        renderQuestionNote(item);
        $("#question-note-status").textContent = "保存済み";
      });
    });
  }

  function currentQuestion() {
    return session?.questions?.[session.index] || null;
  }

  function saveCurrentNote() {
    const item = currentQuestion();
    if (!item || !$("#question-note")) return;
    const value = $("#question-note").value.trim();
    if (value) state.comments[item.id] = value;
    else delete state.comments[item.id];
    saveState();
    $("#question-note-status").textContent = "保存済み";
  }

  function renderQuestionNote(item) {
    if (!item || !$("#question-note")) return;
    $("#question-note").value = state.comments[item.id] || "";
    const active = state.rating[item.id] || "";
    $$("#question-note-panel [data-rating]").forEach((button) => button.classList.toggle("active", button.dataset.rating === active));
    $("#question-note-status").textContent = state.comments[item.id] || active ? "保存済み" : "自動保存";
  }

  function persistActiveSession() {
    if (!session?.questions?.length) return;
    state.activeSession = {
      version: 1,
      mode: session.mode,
      questionIds: session.questions.map((item) => item.id),
      index: session.index,
      answers: session.answers,
      mistakes: session.mistakes,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      answered: Boolean(session.answered),
      updatedAt: Date.now()
    };
    saveState();
  }

  function clearActiveSession() {
    state.activeSession = null;
    saveState();
  }

  function restoreActiveSession() {
    const saved = state.activeSession;
    if (!saved?.questionIds?.length) return false;
    const questionMap = new Map(QUESTIONS.map((item) => [item.id, item]));
    const questions = saved.questionIds.map((id) => questionMap.get(id)).filter(Boolean);
    if (!questions.length) {
      clearActiveSession();
      return false;
    }
    session = {
      mode: saved.mode || "quick",
      questions,
      index: Math.min(Math.max(Number(saved.index) || 0, 0), questions.length - 1),
      answers: Array.isArray(saved.answers) ? saved.answers : [],
      mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
      startedAt: Number(saved.startedAt) || Date.now(),
      endsAt: saved.endsAt ? Number(saved.endsAt) : null,
      answered: Boolean(saved.answered)
    };
    $("#quiz-mode-label").textContent = modeLabel(session.mode);
    showView("quiz");
    startTimer();
    renderQuestion(true);
    toast(`前回の続き ${session.index + 1}/${session.questions.length} から再開`);
    return true;
  }

  function showView(name) {
    if (session && name !== "quiz" && name !== "results") {
      persistActiveSession();
      stopTimer();
    }
    $(".bottom-nav").hidden = name === "quiz";
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    $$(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
    if (name === "home") renderDashboard();
    if (name === "weak") renderWeakList();
    if (name === "memorize") renderMemoryCards();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startQuiz(mode) {
    if (state.activeSession?.questionIds?.length) {
      const startNew = window.confirm("途中の問題があります。保存中の続きは残っています。新しいコースを始めますか？");
      if (!startNew) {
        restoreActiveSession();
        return;
      }
      state.activeSession = null;
    }
    const questions = getModeQuestions(mode);
    if (!questions.length) {
      toast("まだ弱点問題がありません。10問特訓を始めます。");
      return startQuiz("quick");
    }
    session = {
      mode,
      questions,
      index: 0,
      answers: [],
      mistakes: [],
      startedAt: Date.now(),
      endsAt: mode === "mock" ? Date.now() + 105 * 60 * 1000 : null,
      answered: false
    };
    $("#quiz-mode-label").textContent = modeLabel(mode);
    showView("quiz");
    startTimer();
    renderQuestion(false);
    persistActiveSession();
  }

  function renderQuestion(restoring = false) {
    const item = currentQuestion();
    if (!item) return;
    if (!restoring) session.answered = false;
    $("#quiz-counter").textContent = `${session.index + 1} / ${session.questions.length}`;
    $("#quiz-progress-bar").style.width = `${(session.index / session.questions.length) * 100}%`;
    $("#question-category").textContent = CATEGORY_META[item.category].label;
    $("#question-priority").textContent = item.priority === "latest" ? "最新優先" : item.priority === "high" ? "頻出" : "基礎";
    $("#question-text").textContent = item.question;
    $("#feedback").hidden = true;
    $("#next-question").hidden = true;
    $("#choices").innerHTML = item.choices
      .map((choice, index) => `<button class="choice" type="button" data-answer="${index}"><span class="choice-letter">${LETTERS[index]}</span><span>${escapeHtml(choice)}</span></button>`)
      .join("");
    $$("#choices .choice").forEach((button) => button.addEventListener("click", () => answerQuestion(Number(button.dataset.answer))));
    renderQuestionNote(item);

    if (restoring && session.answered) {
      const savedAnswer = [...session.answers].reverse().find((answer) => answer.id === item.id);
      if (savedAnswer) paintAnsweredState(item, savedAnswer, false);
      else session.answered = false;
    }
    if (state.sound && !session.answered) speakQuestion(item);
  }

  function updateWeakState(itemId, isCorrect) {
    if (isCorrect) {
      state.correct[itemId] = (state.correct[itemId] || 0) + 1;
      state.streak[itemId] = (state.streak[itemId] || 0) + 1;
      // 一度間違えた問題は、2連続正解するまで弱点に残す。
      if ((state.wrong[itemId] || 0) > 0 && state.streak[itemId] >= 2) state.wrong[itemId] = 0;
    } else {
      state.wrong[itemId] = (state.wrong[itemId] || 0) + 1;
      state.streak[itemId] = 0;
    }
  }

  function paintAnsweredState(item, answer, focusNext = true) {
    $$("#choices .choice").forEach((button, index) => {
      button.disabled = true;
      if (session.mode === "mock") {
        if (index === answer.selected) button.classList.add("selected");
      } else {
        if (index === item.answer) button.classList.add("correct");
        if (index === answer.selected && !answer.correct) button.classList.add("wrong");
      }
    });

    if (session.mode === "mock") {
      $("#feedback").hidden = true;
    } else {
      $("#feedback-verdict").textContent = answer.correct ? "正解。ここは取れる。" : `不正解。正解は ${LETTERS[item.answer]}。`;
      $("#feedback-verdict").style.color = answer.correct ? "var(--green)" : "var(--red)";
      $("#feedback-explanation").textContent = item.explanation;
      $("#feedback-source").href = item.source.url;
      $("#feedback-source").textContent = `根拠：${item.source.label}`;
      $("#feedback").hidden = false;
    }
    $("#next-question").hidden = false;
    $("#next-question").textContent = session.index === session.questions.length - 1
      ? (session.mode === "mock" ? "採点する" : "結果を見る")
      : "次の問題へ";
    if (focusNext) $("#next-question").focus({ preventScroll: true });
  }

  function answerQuestion(selected) {
    if (!session || session.answered) return;
    session.answered = true;
    const item = currentQuestion();
    const isCorrect = selected === item.answer;
    const answer = { id: item.id, category: item.category, correct: isCorrect, selected };
    session.answers.push(answer);
    state.attempts[item.id] = (state.attempts[item.id] || 0) + 1;
    updateWeakState(item.id, isCorrect);
    if (!isCorrect) session.mistakes.push(item.id);
    saveState();
    paintAnsweredState(item, answer, true);
    persistActiveSession();
  }

  function nextQuestion() {
    if (!session?.answered) return;
    if (session.index >= session.questions.length - 1) return finishQuiz();
    session.index += 1;
    session.answered = false;
    renderQuestion(false);
    persistActiveSession();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finishQuiz() {
    stopTimer();
    state.sessions += 1;
    state.activeSession = null;
    saveState();
    const total = session.answers.length;
    const correct = session.answers.filter((answer) => answer.correct).length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    $("#result-score").textContent = `${percent}%`;
    $("#result-ratio").textContent = `${correct} / ${total}`;
    const mockPass = session.mode === "mock" ? assessMock(session.answers) : null;
    $("#result-message").textContent = mockPass === null
      ? (percent >= 80 ? "仕上がっています。次は弱点をゼロへ。" : percent >= 60 ? "合格圏が見えています。ミスだけ即復習。" : "まだ伸びます。解説を読んで同じ論点をもう一周。")
      : (mockPass ? "合格基準クリア。弱点を詰めて70%前後の安全圏へ。" : "足切りまたは合格点未達。赤い科目から直す。");
    renderBreakdown(session.answers, session.mode === "mock");
    showView("results");
  }

  function assessMock(answers) {
    const groups = groupResults(answers);
    const law = [...(groups["law-common"] || []), ...(groups["law-class"] || [])];
    const mechanics = groups.mechanics || [];
    const structure = groups.structure || [];
    const practical = groups.practical || [];
    const written = [...law, ...mechanics, ...structure];
    const rate = (items) => items.length ? items.filter((item) => item.correct).length / items.length : 0;
    return rate(law) >= .4 && rate(mechanics) >= .4 && rate(structure) >= .4 && rate(written) >= .6 && rate(practical) >= .6;
  }

  function groupResults(answers) {
    return answers.reduce((groups, answer) => {
      (groups[answer.category] ||= []).push(answer);
      return groups;
    }, {});
  }

  function statRow(label, items, threshold) {
    if (!items.length) return "";
    const correct = items.filter((item) => item.correct).length;
    const percent = Math.round((correct / items.length) * 100);
    return `<div class="breakdown-row ${percent >= threshold ? "pass" : "fail"}"><span>${label}</span><strong>${correct}/${items.length}（${percent}%）</strong></div>`;
  }

  function renderBreakdown(answers, isMock) {
    const groups = groupResults(answers);
    if (isMock) {
      const law = [...(groups["law-common"] || []), ...(groups["law-class"] || [])];
      const mechanics = groups.mechanics || [];
      const structure = groups.structure || [];
      const practical = groups.practical || [];
      const written = [...law, ...mechanics, ...structure];
      $("#result-breakdown").innerHTML = [
        statRow("消防関係法令", law, 40),
        statRow("基礎的知識", mechanics, 40),
        statRow("構造・機能・整備", structure, 40),
        statRow("筆記全体", written, 60),
        statRow("鑑別等", practical, 60)
      ].join("");
      return;
    }
    $("#result-breakdown").innerHTML = Object.entries(CATEGORY_META).map(([key, meta]) => {
      const items = groups[key] || [];
      if (!items.length) return "";
      return statRow(meta.label, items, key === "practical" ? 60 : 40);
    }).join("");
  }

  function renderDashboard() {
    const attempts = Object.values(state.attempts).reduce((sum, value) => sum + value, 0);
    const correct = Object.values(state.correct).reduce((sum, value) => sum + value, 0);
    const percent = attempts ? Math.round((correct / attempts) * 100) : 0;
    $("#readiness-value").textContent = attempts ? `${percent}%` : "--";
    $(".readiness").style.setProperty("--score", `${percent}%`);
    const weakCount = QUESTIONS.filter((item) => (state.wrong[item.id] || 0) > 0 || ["weak", "review"].includes(state.rating[item.id])).length;
    $("#weak-count-home").textContent = weakCount ? `${weakCount}問を復習` : "まだ0問";
    const target = new Date("2026-09-27T00:00:00+09:00");
    const now = new Date();
    const days = Math.max(0, Math.ceil((target - now) / 86400000));
    $("#days-left").textContent = days === 0 ? "いよいよ本番" : `あと${days}日`;
    $("#category-progress").innerHTML = Object.entries(CATEGORY_META).map(([key, meta]) => {
      const ids = QUESTIONS.filter((item) => item.category === key).map((item) => item.id);
      const catAttempts = ids.reduce((sum, id) => sum + (state.attempts[id] || 0), 0);
      const catCorrect = ids.reduce((sum, id) => sum + (state.correct[id] || 0), 0);
      const catPercent = catAttempts ? Math.round((catCorrect / catAttempts) * 100) : 0;
      return `<div class="progress-row"><span>${meta.short}</span><div class="progress-track"><span style="width:${catPercent}%"></span></div><strong>${catAttempts ? `${catPercent}%` : "未着手"}</strong></div>`;
    }).join("");
  }

  function renderWeakList() {
    const weak = QUESTIONS.filter((item) => (state.wrong[item.id] || 0) > 0 || ["weak", "review"].includes(state.rating[item.id]))
      .sort((a, b) => (state.wrong[b.id] || 0) - (state.wrong[a.id] || 0));
    $("#weak-list").innerHTML = weak.length
      ? weak.map((item) => {
          const rating = state.rating[item.id] === "weak" ? " / 🔴ここ弱い" : state.rating[item.id] === "review" ? " / 🟡もう1回" : "";
          const comment = state.comments[item.id] ? `<small>メモ：${escapeHtml(state.comments[item.id])}</small>` : "";
          return `<article class="weak-item"><div><strong>${escapeHtml(item.topic)}</strong><span>ミス ${state.wrong[item.id] || 0}回 / 連続正解 ${state.streak[item.id] || 0}/2${rating}</span></div><p>${escapeHtml(item.question)}</p>${comment}</article>`;
        }).join("")
      : `<div class="empty-state">まだ弱点はありません。まず10問特訓で診断しましょう。</div>`;
  }

  function renderMemoryCards() {
    $("#memory-cards").innerHTML = MEMORY_CARDS.map(([label, prompt, answer], index) =>
      `<button class="memory-card" type="button" data-memory="${index}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(prompt)}</strong><span>${escapeHtml(answer)}</span></button>`
    ).join("");
    $$(".memory-card").forEach((card) => card.addEventListener("click", () => card.classList.toggle("revealed")));
  }

  function speakQuestion(item) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const text = `${item.question}。${item.choices.map((choice, index) => `${LETTERS[index]}、${choice}`).join("。")}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = .92;
    window.speechSynthesis.speak(utterance);
  }

  function startTimer() {
    stopTimer();
    if (!session?.endsAt) {
      $("#quiz-timer").textContent = "";
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, session.endsAt - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      $("#quiz-timer").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      if (remaining <= 0) finishQuiz();
    };
    tick();
    timerHandle = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function toast(message) {
    clearTimeout(toastHandle);
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    toastHandle = setTimeout(() => $("#toast").classList.remove("show"), 2400);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view]");
      const startButton = event.target.closest("[data-start]");
      if (viewButton) showView(viewButton.dataset.view);
      if (startButton) startQuiz(startButton.dataset.start);
    });
    $("#next-question").addEventListener("click", nextQuestion);
    $("#quit-quiz").addEventListener("click", () => {
      if (!session) return showView("home");
      persistActiveSession();
      window.speechSynthesis?.cancel();
      stopTimer();
      session = null;
      showView("home");
      toast("途中位置を保存しました");
    });
    $("#sound-toggle").addEventListener("click", () => {
      state.sound = !state.sound;
      $("#sound-toggle").setAttribute("aria-pressed", String(state.sound));
      saveState();
      toast(state.sound ? "自動読み上げをONにしました" : "自動読み上げをOFFにしました");
      if (state.sound && session) speakQuestion(currentQuestion());
      else window.speechSynthesis?.cancel();
    });
    $("#reset-progress").addEventListener("click", () => {
      if (!window.confirm("正答率・弱点・コメント・途中位置をすべて消しますか？")) return;
      state = { ...defaultState, attempts: {}, correct: {}, wrong: {}, streak: {}, comments: {}, rating: {}, activeSession: null };
      session = null;
      saveState();
      renderDashboard();
      toast("学習記録をリセットしました");
    });
    document.addEventListener("keydown", (event) => {
      if (!session || !$("#view-quiz").classList.contains("active")) return;
      if (event.target?.matches?.("textarea,input")) return;
      if (event.key === "Enter" && session.answered) return nextQuestion();
      const key = event.key.toUpperCase();
      const index = LETTERS.indexOf(key) >= 0
        ? LETTERS.indexOf(key)
        : Number(event.key) >= 1 && Number(event.key) <= 4
          ? Number(event.key) - 1
          : -1;
      if (index >= 0) answerQuestion(index);
    });
    window.addEventListener("pagehide", () => persistActiveSession());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistActiveSession();
    });
  }

  function init() {
    ensureQuestionNoteUi();
    bindEvents();
    $("#sound-toggle").setAttribute("aria-pressed", String(state.sound));
    renderDashboard();
    renderMemoryCards();
    const restored = restoreActiveSession();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {});
    }
    if (!restored) showView("home");
  }

  init();
})();
