/* Otsu4 chat practice bridge: private results stay in this browser, never in a public repo/API. */
(() => {
  "use strict";
  const KEY = "otsu4-chat-practice-v1";
  const STUDY_KEY = "otsu4-study-state-v1";
  const MAX_ITEMS = 100;
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : fallback;
    } catch { return fallback; }
  };
  const valid = (session) =>
    session && session.version === 1 &&
    typeof session.id === "string" && /^chat-[a-zA-Z0-9_-]{4,80}$/.test(session.id) &&
    /^20\d{2}-\d{2}-\d{2}$/.test(session.date || "") &&
    Array.isArray(session.items) && session.items.length > 0 && session.items.length <= MAX_ITEMS &&
    session.items.every((item) =>
      item && typeof item.topic === "string" && item.topic.length <= 100 &&
      typeof item.correct === "boolean" &&
      (!Object.prototype.hasOwnProperty.call(item, "review") || typeof item.review === "boolean") &&
      (!item.relatedQuestionIds || (Array.isArray(item.relatedQuestionIds) &&
        item.relatedQuestionIds.length <= 10 &&
        item.relatedQuestionIds.every((id) => /^[a-z]\d{2}$/.test(id))))
    );
  const getSessions = () => {
    const data = read(KEY, { sessions: [] });
    return Array.isArray(data.sessions) ? data.sessions : [];
  };
  function importSession(session) {
    if (!valid(session)) return { ok: false, message: "記録形式を確認してください。" };
    const sessions = getSessions();
    if (sessions.some((entry) => entry.id === session.id)) {
      return { ok: true, added: false, message: "この回はすでに取り込み済みです。" };
    }
    const record = {
      version: 1, id: session.id, date: session.date,
      items: session.items.map((item) => ({
        topic: item.topic, correct: item.correct, review: item.review === true,
        category: typeof item.category === "string" ? item.category.slice(0, 40) : "",
        relatedQuestionIds: Array.isArray(item.relatedQuestionIds) ? item.relatedQuestionIds : []
      }))
    };
    // Do not fabricate app quiz attempts, streaks, scores, or a completed app session.
    // Only seed repeat priority for an actual chat mistake with a reviewed related app question ID.
    const study = read(STUDY_KEY, {});
    study.ratings ||= {};
    for (const item of record.items) {
      if (!item.correct || item.review) for (const id of item.relatedQuestionIds) study.ratings[id] = "repeat";
    }
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify(study));
      localStorage.setItem(KEY, JSON.stringify({ version: 1, sessions: [...sessions, record] }));
      return { ok: true, added: true, message: "取り込み完了。間違い・迷いのあった論点をアプリの復習候補にも反映しました。" };
    } catch {
      return { ok: false, message: "端末への保存に失敗しました。ブラウザの保存設定を確認してください。" };
    }
  }
  function importBatch(payload) {
    const sessions = Array.isArray(payload) ? payload : [payload];
    if (!sessions.length || sessions.length > 20 || !sessions.every(valid)) {
      return { ok: false, message: "記録形式を確認してください。" };
    }
    let added = 0;
    for (const session of sessions) {
      const result = importSession(session);
      if (!result.ok) return result;
      if (result.added) added += 1;
    }
    return { ok: true, added: added > 0,
      message: added ? added + "回分の取り込みが完了しました。" : "すべて取り込み済みです。" };
  }
  function summary() {
    const sessions = getSessions();
    const items = sessions.flatMap((s) => s.items);
    const correct = items.filter((item) => item.correct).length;
    const weak = new Map();
    const review = new Map();
    for (const item of items.filter((item) => !item.correct)) weak.set(item.topic, (weak.get(item.topic) || 0) + 1);
    for (const item of items.filter((item) => item.review)) review.set(item.topic, (review.get(item.topic) || 0) + 1);
    return { sessions: sessions.length, total: items.length, correct,
      weak: [...weak].sort((a,b) => b[1]-a[1]),
      review: [...review].sort((a,b) => b[1]-a[1]) };
  }
  function renderHome() {
    const home = document.getElementById("view-home");
    if (!home) return;
    const data = summary();
    if (!data.sessions) return;
    let panel = document.getElementById("chat-practice-summary");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "chat-practice-summary";
      panel.className = "panel";
      panel.setAttribute("aria-label", "チャット演習の学習履歴");
      const target = home.querySelector(".study-launch");
      if (target) target.insertAdjacentElement("afterend", panel);
      else home.prepend(panel);
    }
    panel.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "チャット演習の記録";
    const stats = document.createElement("p");
    stats.textContent = data.sessions + "回・" + data.total + "問 / 正解" + data.correct + "問";
    const weak = document.createElement("p");
    weak.textContent = data.weak.length
      ? "復習候補：" + data.weak.slice(0, 3).map(([name,count]) => name + "（" + count + "回）").join("、")
      : "今回の記録に誤答はありません。";
    const link = document.createElement("a");
    link.href = "/otsu4/chat-import/";
    link.textContent = "チャット学習の履歴を見る →";
    const review = document.createElement("p");
    review.textContent = data.review.length
      ? "△迷った： " + data.review.slice(0, 3).map(([name,count]) => name + "（" + count + "回）").join("、")
      : "";
    panel.append(heading, stats, weak, review, link);
  }
  function renderImport() {
    const output = document.getElementById("chat-import-result");
    if (!output) return;
    const show = (message) => { output.textContent = message; };
    function attempt(value) {
      try {
        const data = JSON.parse(value);
        const result = importBatch(data);
        show(result.message);
        renderHistory();
      } catch { show("JSONが読み取れません。入力を確認してください。"); }
    }
    function renderHistory() {
      const result = summary();
      const info = document.getElementById("chat-history");
      if (!info) return;
      info.replaceChildren();
      const stats = document.createElement("p");
      stats.textContent = result.sessions + "回 / " + result.total + "問 / " + result.correct + "問正解";
      info.append(stats);
      for (const [topic,count] of result.weak) {
        const p = document.createElement("p");
        p.textContent = "要復習：" + topic + "（誤答" + count + "回）";
        info.append(p);
      }
      for (const [topic,count] of result.review) {
        const p = document.createElement("p");
        p.textContent = "△迷った：" + topic + "（" + count + "回）";
        info.append(p);
      }
    }
    const hash = window.location.hash;
    if (hash.startsWith("#data=")) {
      attempt(decodeURIComponent(hash.slice(6)));
      window.history.replaceState(null, "", window.location.pathname);
    } else renderHistory();
    const button = document.getElementById("chat-import-submit");
    if (button) button.addEventListener("click", () => attempt(document.getElementById("chat-import-json").value.trim()));
  }
  window.Otsu4ChatPractice = { importSession, importBatch, summary };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { renderHome(); renderImport(); });
  else { renderHome(); renderImport(); }
})();
