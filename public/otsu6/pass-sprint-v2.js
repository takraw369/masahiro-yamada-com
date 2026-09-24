(() => {
  "use strict";

  const STORAGE_KEY = "otsu6-cram-state-v1";
  const SESSION_KEY = "otsu6-pass-sprint-session-v2";
  const META_KEY = "otsu6-pass-sprint-meta-v2";
  const LETTERS = ["A", "B", "C", "D"];
  const CATEGORY_META = {
    "law-common": { label: "法令・共通", subject: "law", short: "法令" },
    "law-class": { label: "法令・第6類", subject: "law", short: "法令" },
    mechanics: { label: "基礎・機械", subject: "mechanics", short: "基礎" },
    structure: { label: "構造・機能・整備・規格", subject: "structure", short: "構造等" },
    practical: { label: "鑑別等", subject: "practical", short: "鑑別" }
  };
  const SUBJECTS = {
    law: { label: "消防関係法令", target: 70, floor: 40 },
    mechanics: { label: "基礎的知識", target: 70, floor: 40 },
    structure: { label: "構造・機能・整備・規格", target: 70, floor: 40 },
    practical: { label: "鑑別等", target: 70, floor: 60 }
  };
  const MASTERED_CONCEPT_HINTS = ["A火災", "B火災", "C火災", "業務範囲", "指示圧力計", "蓄圧式", "安全栓"];

  let state = loadJSON(STORAGE_KEY, {});
  state.attempts ||= {}; state.correct ||= {}; state.wrong ||= {}; state.streak ||= {}; state.notes ||= {}; state.self ||= {};
  let meta = loadJSON(META_KEY, { history: [], versions: {}, masteredConcepts: {}, dismissed: {} });
  let session = restoreSession();
  let timerHandle = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const now = () => Date.now();
  const daysLeft = () => Math.max(0, Math.ceil((new Date("2026-09-27T00:00:00+09:00") - new Date()) / 86400000));
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  function loadJSON(key, fallback) { try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return { ...fallback }; } }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  function saveSession() { session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY); }
  function restoreSession() { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY)); return s?.questions?.length ? s : null; } catch { return null; } }
  function questionById(id) { return QUESTIONS.find((q) => q.id === id); }
  function subjectOf(q) { return CATEGORY_META[q.category]?.subject || "structure"; }
  function isRetired(q) { return Boolean(window.OTSU6_RETIRED_BASIC_IDS?.has(q.id)); }
  function attempts(q) { return state.attempts[q.id] || 0; }
  function accuracy(q) { const a = attempts(q); return a ? (state.correct[q.id] || 0) / a : null; }
  function isWeak(q) { return (state.wrong[q.id] || 0) > 0 || state.self[q.id] === "weak" || state.self[q.id] === "repeat"; }
  function isMastered(q) { return (state.streak[q.id] || 0) >= 2 || state.self[q.id] === "mastered"; }
  function concept(q) { return q.concept || q.topic || q.id; }
  function escaped(v) { return String(v ?? "").replace(/[&<>'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c])); }

  function recentSubjectRate(subject) {
    const rows = (meta.history || []).filter((r) => r.subject === subject).slice(-20);
    if (rows.length >= 3) return rows.filter((r) => r.correct).length / rows.length;
    const qs = QUESTIONS.filter((q) => subjectOf(q) === subject && attempts(q) > 0);
    const total = qs.reduce((s, q) => s + attempts(q), 0);
    const correct = qs.reduce((s, q) => s + (state.correct[q.id] || 0), 0);
    return total ? correct / total : null;
  }

  function subjectRisk(subject) {
    const rate = recentSubjectRate(subject);
    const seen = QUESTIONS.filter((q) => subjectOf(q) === subject && attempts(q) > 0).length;
    const total = QUESTIONS.filter((q) => subjectOf(q) === subject && !isRetired(q)).length;
    const coverage = total ? seen / total : 0;
    if (rate === null) return 95;
    return Math.round((1 - rate) * 70 + (1 - coverage) * 30);
  }

  function questionScore(q, desiredSubject = null) {
    if (isRetired(q) || meta.dismissed?.[q.id]) return -9999;
    let score = 0;
    const a = attempts(q);
    const weak = isWeak(q);
    const mastered = isMastered(q);
    if (a === 0) score += 85;
    if (weak) score += 120;
    if (q.officialSignal) score += 28;
    if (q.priority === "latest") score += 18;
    if (q.sprintLevel >= 3) score += 15;
    if (q.practicalStyle) score += 12;
    if (desiredSubject && subjectOf(q) === desiredSubject) score += 45;
    score += subjectRisk(subjectOf(q)) * 0.5;
    if (mastered && !weak) score -= 90;
    if (a >= 3 && accuracy(q) >= .8 && !weak) score -= 70;
    if (MASTERED_CONCEPT_HINTS.some((x) => concept(q).includes(x)) && (q.sprintLevel || 1) < 3) score -= 35;
    const last = [...(meta.history || [])].reverse().find((r) => r.id === q.id);
    if (last && now() - last.at < 2 * 60 * 60 * 1000) score -= 70;
    return score + Math.random() * 8;
  }

  function pickBest(pool, count, subject, usedConcepts) {
    const ranked = pool
      .filter((q) => subjectOf(q) === subject && !usedConcepts.has(concept(q)))
      .map((q) => [q, questionScore(q, subject)])
      .sort((a, b) => b[1] - a[1]);
    const out = [];
    for (const [q] of ranked) {
      if (out.length >= count) break;
      out.push(q); usedConcepts.add(concept(q));
    }
    return out;
  }

  function buildAdaptiveSet(count = 10) {
    const quotas = count === 10 ? { law: 3, mechanics: 1, structure: 4, practical: 2 } : { law: 2, mechanics: 1, structure: 2, practical: 1 };
    const risks = Object.keys(SUBJECTS).sort((a,b) => subjectRisk(b) - subjectRisk(a));
    if (count === 10 && subjectRisk(risks[0]) >= 65) {
      const donor = Object.keys(quotas).filter((s) => s !== risks[0] && quotas[s] > 1).sort((a,b)=>subjectRisk(a)-subjectRisk(b))[0];
      if (donor) { quotas[donor]--; quotas[risks[0]]++; }
    }
    const pool = QUESTIONS.filter((q) => !isRetired(q));
    const usedConcepts = new Set();
    let result = [];
    for (const [subject, n] of Object.entries(quotas)) result.push(...pickBest(pool, n, subject, usedConcepts));
    if (result.length < count) {
      const rest = pool.filter((q) => !result.includes(q) && !usedConcepts.has(concept(q)))
        .sort((a,b) => questionScore(b) - questionScore(a));
      result.push(...rest.slice(0, count - result.length));
    }
    return shuffle(result).slice(0, count);
  }

  function buildWeakSet() {
    const weak = QUESTIONS.filter((q) => !isRetired(q) && isWeak(q)).sort((a,b) => questionScore(b) - questionScore(a));
    return (weak.length ? weak : buildAdaptiveSet(10)).slice(0, 10);
  }

  function buildUnseenSet() {
    const unseen = QUESTIONS.filter((q) => !isRetired(q) && attempts(q) === 0).sort((a,b) => questionScore(b) - questionScore(a));
    return (unseen.length >= 10 ? unseen.slice(0,10) : [...unseen, ...buildAdaptiveSet(10).filter(q => !unseen.includes(q))].slice(0,10));
  }

  function buildMock() {
    const quota = { "law-common":6, "law-class":4, mechanics:5, structure:15, practical:5 };
    return Object.entries(quota).flatMap(([cat,n]) => {
      const pool = QUESTIONS.filter((q) => q.category === cat && !isRetired(q)).sort((a,b) => questionScore(b) - questionScore(a));
      return pool.slice(0,n);
    });
  }

  function startQuiz(mode) {
    const qs = mode === "weak" ? buildWeakSet() : mode === "unseen" ? buildUnseenSet() : mode === "mock" ? buildMock() : buildAdaptiveSet(10);
    session = { mode, questions: qs.map(q=>q.id), index:0, answers:[], mistakes:[], startedAt:now(), endsAt:mode==="mock"? now()+105*60*1000:null, answered:false };
    saveSession();
    show("quiz"); renderQuestion(); startTimer();
  }

  function resumeQuiz() { if (!session) return; show("quiz"); renderQuestion(); startTimer(); }
  function currentQuestion() { return questionById(session?.questions?.[session.index]); }
  function show(name) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
    $(".bottom-nav").hidden = name === "quiz";
    if (name === "home") renderHome();
    if (name === "map") renderMap();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function whyNow(q) {
    if (isWeak(q)) return "前に落とした/弱い論点。別角度で回収";
    if (attempts(q) === 0) return "未出ジャンル。穴を先に潰す";
    if (q.officialSignal) return "2026公式公開論点からの独自アレンジ";
    const risk = subjectRisk(subjectOf(q));
    return risk >= 60 ? "この科目の足切りリスクを下げるため" : "本番比率を保つため";
  }

  function renderQuestion() {
    const q = currentQuestion(); if (!q) return finishQuiz();
    session.answered = Boolean(session.answers.find(a => a.index === session.index));
    $("#quiz-mode-label").textContent = session.mode === "mock" ? "35問 本番モード" : session.mode === "weak" ? "弱点回収" : session.mode === "unseen" ? "未出穴埋め" : "合格スプリント10";
    $("#quiz-counter").textContent = `${session.index+1} / ${session.questions.length}`;
    $("#quiz-progress-bar").style.width = `${(session.index/session.questions.length)*100}%`;
    $("#question-category").textContent = CATEGORY_META[q.category]?.label || q.category;
    $("#question-priority").textContent = q.practicalStyle ? "鑑別判断" : q.sprintLevel >= 3 ? "応用" : q.officialSignal ? "公式論点" : "本番対策";
    $("#why-now").textContent = whyNow(q);
    $("#question-text").textContent = q.question;
    $("#choices").innerHTML = q.choices.map((c,i)=>`<button class="choice" data-answer="${i}"><span class="choice-letter">${LETTERS[i]}</span><span>${escaped(c)}</span></button>`).join("");
    $("#feedback").hidden = true; $("#next-question").hidden = true;
    $$("#choices .choice").forEach(b=>b.addEventListener("click",()=>answer(Number(b.dataset.answer))));
    renderNote(q);
  }

  function answer(selected) {
    if (!session || session.answered) return;
    const q = currentQuestion(); const correct = selected === q.answer;
    session.answered = true;
    session.answers.push({ index:session.index, id:q.id, category:q.category, subject:subjectOf(q), correct, selected });
    if (!correct) session.mistakes.push(q.id);
    state.attempts[q.id] = (state.attempts[q.id] || 0) + 1;
    if (correct) {
      state.correct[q.id] = (state.correct[q.id] || 0) + 1;
      state.streak[q.id] = (state.streak[q.id] || 0) + 1;
      if ((state.wrong[q.id] || 0) > 0 && state.streak[q.id] >= 2) state.wrong[q.id] = 0;
    } else {
      state.wrong[q.id] = (state.wrong[q.id] || 0) + 1; state.streak[q.id] = 0;
    }
    meta.history.push({ id:q.id, concept:concept(q), subject:subjectOf(q), correct, at:now() });
    meta.history = meta.history.slice(-300);
    save(); saveSession();
    $$("#choices .choice").forEach((b,i)=>{ b.disabled=true; if(session.mode==="mock"){ if(i===selected)b.classList.add("selected"); } else { if(i===q.answer)b.classList.add("correct"); if(i===selected&&!correct)b.classList.add("wrong"); } });
    if (session.mode === "mock") { $("#next-question").hidden=false; $("#next-question").textContent = session.index===session.questions.length-1?"採点":"次へ"; return; }
    $("#feedback-verdict").textContent = correct ? "○ 正解" : `× 不正解　正解 ${LETTERS[q.answer]}`;
    $("#feedback-verdict").className = `feedback-verdict ${correct?"ok":"ng"}`;
    $("#feedback-explanation").textContent = q.explanation;
    $("#feedback-source").href = q.source?.url || "https://www.shoubo-shiken.or.jp/shoubou/exercise.html";
    $("#feedback-source").textContent = `根拠を見る：${q.source?.label || "公式資料"}`;
    $("#feedback").hidden=false; $("#next-question").hidden=false;
    $("#next-question").textContent = session.index===session.questions.length-1?"結果":"次へ";
  }

  function next() { if (!session?.answered) return; if (session.index >= session.questions.length-1) return finishQuiz(); session.index++; session.answered=false; saveSession(); renderQuestion(); window.scrollTo({top:0,behavior:"smooth"}); }
  function finishQuiz() {
    stopTimer();
    const answers = session?.answers || [];
    const total=answers.length, right=answers.filter(a=>a.correct).length, pct=total?Math.round(right/total*100):0;
    $("#result-score").textContent=`${pct}%`; $("#result-ratio").textContent=`${right}/${total}`;
    if (session?.mode === "mock") renderMockResult(answers); else renderSprintResult(answers);
    localStorage.removeItem(SESSION_KEY); session=null; show("results");
  }
  function rate(items){ return items.length ? Math.round(items.filter(x=>x.correct).length/items.length*100) : 0; }
  function renderSprintResult(answers){
    const wrong=answers.filter(a=>!a.correct); $("#result-message").textContent = wrong.length ? `落とした${wrong.length}問を次回は別角度で優先。単純な既習問題には戻しません。` : "全問正解。次は未出ジャンルと本番二択へ進めます。";
    $("#result-breakdown").innerHTML = Object.keys(SUBJECTS).map(s=>{const a=answers.filter(x=>x.subject===s);return a.length?`<div class="breakdown-row"><span>${SUBJECTS[s].label}</span><strong>${rate(a)}%</strong></div>`:""}).join("");
  }
  function renderMockResult(answers){
    const law=answers.filter(a=>a.subject==="law"), mec=answers.filter(a=>a.subject==="mechanics"), str=answers.filter(a=>a.subject==="structure"), pra=answers.filter(a=>a.subject==="practical"), written=[...law,...mec,...str];
    const pass=rate(law)>=40&&rate(mec)>=40&&rate(str)>=40&&rate(written)>=60&&rate(pra)>=60;
    $("#result-message").textContent = pass ? "合格条件はクリア。70%安定へ弱点だけ詰める。" : "足切りまたは60%未達。危険科目を次の10問に自動反映します。";
    const rows=[["法令",law,40],["基礎",mec,40],["構造等",str,40],["筆記全体",written,60],["鑑別",pra,60]];
    $("#result-breakdown").innerHTML=rows.map(([l,a,t])=>`<div class="breakdown-row ${rate(a)>=t?"pass":"fail"}"><span>${l}</span><strong>${rate(a)}%（基準${t}%）</strong></div>`).join("");
  }

  function renderHome() {
    $("#days-left").textContent = daysLeft()===0 ? "本番当日" : `あと${daysLeft()}日`;
    const totalAttempts=Object.values(state.attempts).reduce((a,b)=>a+b,0), totalCorrect=Object.values(state.correct).reduce((a,b)=>a+b,0);
    $("#readiness-value").textContent = totalAttempts ? `${Math.round(totalCorrect/totalAttempts*100)}%` : "--";
    const unseen = QUESTIONS.filter(q=>!isRetired(q)&&attempts(q)===0).length;
    const weak = QUESTIONS.filter(q=>!isRetired(q)&&isWeak(q)).length;
    $("#mission-copy").textContent = `次の10問：弱点${Math.min(weak,4)}＋未出優先。未出は残り${unseen}問。`;
    $("#resume-card").hidden = !session;
    $("#resume-copy").textContent = session ? `${session.index+1}/${session.questions.length}問目から再開` : "";
    renderRiskBars();
    const phase = daysLeft() <= 1 ? "最終確認" : daysLeft() <= 2 ? "本番モード移行" : "得点力強化";
    $("#phase-label").textContent = phase;
  }
  function renderRiskBars(){
    $("#risk-bars").innerHTML=Object.entries(SUBJECTS).map(([s,m])=>{const r=recentSubjectRate(s), pct=r===null?null:Math.round(r*100), risk=subjectRisk(s); return `<div class="risk-row"><span>${m.label}</span><div class="risk-track"><i style="width:${pct??0}%"></i></div><strong>${pct===null?"未測定":pct+"%"}</strong><em class="risk ${risk>=65?"high":risk>=40?"mid":"low"}">${risk>=65?"要補強":risk>=40?"注意":"安定"}</em></div>`}).join("");
  }
  function renderMap(){
    const topics = new Map();
    QUESTIONS.filter(q=>!isRetired(q)).forEach(q=>{ const k=concept(q); const x=topics.get(k)||{seen:0,weak:0,total:0,subject:subjectOf(q)}; x.total++; if(attempts(q)>0)x.seen++; if(isWeak(q))x.weak++; topics.set(k,x); });
    const rows=[...topics.entries()].sort((a,b)=>(b[1].weak-a[1].weak)||((a[1].seen/a[1].total)-(b[1].seen/b[1].total))).slice(0,30);
    $("#coverage-list").innerHTML=rows.map(([name,x])=>`<div class="coverage-row"><span><b>${escaped(name)}</b><small>${SUBJECTS[x.subject].label}</small></span><strong class="${x.weak?"weak":""}">${x.weak?"弱点":x.seen===x.total?"確認済":"未出あり"}</strong></div>`).join("");
  }
  function renderNote(q){ const input=$("#question-note"); input.value=state.notes[q.id]||""; input.oninput=()=>{state.notes[q.id]=input.value;save();}; $$("[data-self]").forEach(b=>{b.classList.toggle("active",state.self[q.id]===b.dataset.self); b.onclick=()=>{state.self[q.id]=b.dataset.self; if(b.dataset.self==="mastered"){state.wrong[q.id]=0;state.streak[q.id]=Math.max(2,state.streak[q.id]||0);} save(); renderNote(q);};}); }
  function startTimer(){ stopTimer(); if(!session?.endsAt){$("#quiz-timer").textContent="";return;} const tick=()=>{const left=Math.max(0,session.endsAt-now()),m=Math.floor(left/60000),s=Math.floor(left%60000/1000);$("#quiz-timer").textContent=`${m}:${String(s).padStart(2,"0")}`; if(!left)finishQuiz();};tick();timerHandle=setInterval(tick,1000); }
  function stopTimer(){ if(timerHandle){clearInterval(timerHandle);timerHandle=null;} }

  $$('[data-start]').forEach(b=>b.addEventListener('click',()=>startQuiz(b.dataset.start)));
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
  $("#next-question").addEventListener("click",next);
  $("#quit-quiz").addEventListener("click",()=>{stopTimer();saveSession();show("home");});
  $("#resume-quiz").addEventListener("click",resumeQuiz);
  $("#discard-session").addEventListener("click",()=>{session=null;localStorage.removeItem(SESSION_KEY);renderHome();});
  document.addEventListener("keydown",(e)=>{ if(!$("#view-quiz").classList.contains("active"))return; if(!session?.answered&&/[1-4]/.test(e.key)) answer(Number(e.key)-1); else if(!session?.answered&&/[a-dA-D]/.test(e.key)) answer("abcd".indexOf(e.key.toLowerCase())); else if(session?.answered&&e.key==="Enter")next(); });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/otsu6/service-worker.js").catch(()=>{});
  renderHome();
})();
