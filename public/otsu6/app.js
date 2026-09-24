(() => {
  "use strict";

  const STORAGE_KEY = "otsu6-cram-state-v1";
  const LETTERS = ["A", "B", "C", "D"];
  const EXAM_AT = new Date("2026-09-27T00:00:00+09:00");
  const SUBJECTS = {
    law: { label: "消防関係法令", floor: 40 },
    mechanics: { label: "基礎的知識", floor: 40 },
    structure: { label: "構造・機能・整備・規格", floor: 40 },
    practical: { label: "鑑別等", floor: 60 }
  };
  const DIRECT_MASTERED_PATTERNS = [
    /定期講習の受講義務がある主な目的/,
    /乙種消防設備士が.*行える業務/,
    /地下街に設置できる組合せ.*①.*②.*③/,
    /最低必要能力単位を求める基本式/,
    /指示圧力計.*緑色.*色/,
    /指示圧力計が付いている.*方式/,
    /レバーの不用意な作動.*引き抜く部品/,
    /放射中にノズルを閉止してはいけない主な理由/,
    /最初に整理すべきものはどれか/
  ];

  const defaultState = {
    attempts: {}, correct: {}, wrong: {}, streak: {}, comments: {}, rating: {},
    history: [], activeSession: null, sound: false, sessions: 0
  };

  applyFinalSprintQuestionLayer();

  let state = loadState();
  let session = null;
  let timerHandle = null;
  let toastHandle = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function addQuestion(item) {
    if (!QUESTIONS.some((question) => question.id === item.id)) QUESTIONS.push(item);
  }

  function sprintQuestion(id, category, topic, question, choices, answer, explanation, sourceKey = "official", extra = {}) {
    return {
      id, category, topic, priority: extra.priority || "high", question, choices, answer, explanation,
      source: SOURCES[sourceKey] || SOURCES.official,
      concept: extra.concept || topic,
      sprintLevel: extra.level || 3,
      officialSignal: Boolean(extra.officialSignal),
      practicalStyle: Boolean(extra.practicalStyle)
    };
  }

  function applyFinalSprintQuestionLayer() {
    const variants = [
      sprintQuestion("sprint-lc01", "law-common", "点検・報告周期", "特定防火対象物の消火器について、機器点検と点検結果報告の周期を混同しない組合せはどれか。", ["機器点検6か月・報告1年", "機器点検1年・報告6か月", "機器点検6か月・報告3年", "機器点検1年・報告3年"], 0, "機器点検は6か月ごと。点検結果報告は特定防火対象物で1年ごとです。点検する周期と報告する周期は別に判断します。", "regulation", { officialSignal: true }),
      sprintQuestion("sprint-lc02", "law-common", "検定制度", "型式承認を受けた消火器を販売目的で陳列するまでに、さらに必要なものはどれか。", ["型式承認だけでよい", "型式適合検定を受け、合格表示を付す", "消防署長の個別許可だけ", "購入者による点検票"], 1, "型式承認後、製造された製品は型式適合検定を受け、合格表示が付されたものが販売・販売目的の陳列等をできます。", "official", { officialSignal: true }),
      sprintQuestion("sprint-lc03", "law-common", "法令改正", "消防関係法令の改正が試験日の前日に施行された。試験で基準になる内容として公式FAQの考え方に合うものはどれか。", ["申込日時点の旧法令", "参考書発行日時点の法令", "施行日以後は改正後の法令", "受験者が新旧を選べる"], 2, "公式FAQでは、法令改正の施行日以後に実施される試験は改正後の内容で出題されます。", "official", { officialSignal: true }),
      sprintQuestion("sprint-l601", "law-class", "歩行距離", "同じ階に小型消火器と大型消火器を配置する。各部分から一つの消火器までの歩行距離の原則を正しく組み合わせたものはどれか。", ["小型10m・大型20m", "小型20m・大型30m", "小型30m・大型20m", "小型30m・大型50m"], 1, "小型は20m以下、大型は30m以下です。単独の数字暗記ではなく大小を比較して判断します。", "regulation"),
      sprintQuestion("sprint-l602", "law-class", "能力単位計算", "ある用途の算定基準面積が200㎡で、その階の床面積が450㎡だった。ほかの補正条件を考えないとき、最低必要能力単位はいくつか。", ["2単位", "2.25単位", "3単位", "4単位"], 2, "450÷200＝2.25なので、必要能力単位は端数を切り上げて3単位です。", "regulation"),
      sprintQuestion("sprint-m01", "mechanics", "熱処理", "炭素鋼を焼入れして硬さを上げた後、もろさを減らして粘りを戻すために続けて行う処理はどれか。", ["焼もどし", "浸炭", "再び焼入れ", "急冷の反復"], 0, "焼入れで硬くした後は、焼もどしで粘りを戻します。", "official", { officialSignal: true }),
      sprintQuestion("sprint-m02", "mechanics", "ボイルの法則", "温度一定の密閉気体を、体積が元の1/2になるまで圧縮した。理想化すると圧力はどうなるか。", ["1/4", "1/2", "変わらない", "2倍"], 3, "温度一定ならP×Vは一定。体積が1/2なら圧力は2倍です。", "official", { officialSignal: true }),
      sprintQuestion("sprint-m03", "mechanics", "応力", "断面積200mm²の棒に10,000Nの引張力がかかる。平均引張応力はどれか。", ["5N/mm²", "20N/mm²", "50N/mm²", "200N/mm²"], 2, "応力＝力÷断面積。10,000÷200＝50N/mm²です。", "official", { officialSignal: true }),
      sprintQuestion("sprint-m04", "mechanics", "運動エネルギー", "同じ質量の物体で速度だけを2倍にしたとき、運動エネルギーは何倍になるか。", ["2倍", "4倍", "1/2", "変わらない"], 1, "運動エネルギーは1/2mv²。速度が2倍なら4倍です。", "official", { officialSignal: true }),
      sprintQuestion("sprint-m05", "mechanics", "力のモーメント", "同じ大きさの力でナットを回すとき、回転軸から力点までの距離を2倍にするとモーメントはどうなるか。", ["1/2", "変わらない", "2倍", "4倍"], 2, "モーメント＝力×腕の長さ。力が同じなら距離2倍でモーメントも2倍です。", "official"),
      sprintQuestion("sprint-s01", "structure", "指示圧力計・総合判定", "蓄圧式粉末消火器を点検した。指針は緑色範囲内だが、安全栓の封が切れ、本体底部にも著しい腐食がある。最も適切な判断はどれか。", ["圧力が正常なので異常なし", "封だけ交換すればよい", "圧力以外にも異常があるため正常扱いしない", "緑色なら容器強度も保証される"], 2, "指示圧力計が示すのは圧力状態です。封や容器腐食は別項目なので、ゲージ正常だけで全体を正常判定しません。", "standard", { officialSignal: true }),
      sprintQuestion("sprint-s02", "structure", "二酸化炭素・点検", "二酸化炭素消火器の薬剤量を確認する方法として適切なのはどれか。", ["安全栓を抜いて放射する", "質量を測定する", "容器を振った音だけで判断する", "ノズル径を測る"], 1, "指示圧力計を有しない二酸化炭素消火器等は、質量測定で薬剤量を確認します。", "standard"),
      sprintQuestion("sprint-s03", "structure", "消火器適応・比較", "通電中の電気設備火災に対して、次のうち不適切な選択はどれか。", ["二酸化炭素消火器", "ABC粉末消火器", "霧状に放射する強化液消火器", "泡消火器"], 3, "泡消火器は電気火災に不適切です。CO2・ABC粉末・霧状強化液は電気火災に適応するものがあります。", "standard"),
      sprintQuestion("sprint-s04", "structure", "粉末薬剤・比較", "A火災にも適応する粉末消火薬剤を選ぶとき、主成分として最も適切なのはどれか。", ["りん酸塩類", "炭酸水素ナトリウムのみ", "炭酸水素カリウムのみ", "二酸化炭素"], 0, "りん酸塩類等を主成分とする粉末はA・B・C火災に適応します。重炭酸塩系粉末は基本的にB・C火災です。", "standard"),
      sprintQuestion("sprint-s05", "structure", "放射性能", "消火器の放射性能について、規格上の基本条件として正しいものはどれか。", ["充てん消火薬剤の90%以上を放射できる", "半分放射できればよい", "全種類で放射時間1秒以上ならよい", "放射性能は規格に含まれない"], 0, "所定の条件で充てん消火薬剤の90%以上を放射できることが基本要件です。", "standard"),
      sprintQuestion("sprint-s06", "structure", "化学泡・異常判断", "化学泡消火器のノズルが、放射途中でも閉止できる開閉式ノズルへ交換されていた。最も重要な問題はどれか。", ["反応でガス発生が続くため、閉止時に異常圧力の危険がある", "薬剤が必ず凍結する", "容器が軽くなる", "泡が電気を通さなくなる"], 0, "化学泡は反応開始後もガスが発生するため、途中閉止で容器内圧が上がる危険があります。名称暗記ではなく構造上の理由で判断します。", "standard"),
      sprintQuestion("sprint-p01", "practical", "鑑別・圧力調整器", "【鑑別】窒素ガス容器と蓄圧式消火器の間に接続し、高圧ガスを所定の充填圧力まで下げる器具はどれか。", ["圧力調整器", "安全栓", "ろ過網", "サイホン管"], 0, "圧力調整器は高圧ガスを適切な充填圧力へ減圧・調整する整備器具です。", "standard", { practicalStyle: true }),
      sprintQuestion("sprint-p02", "practical", "鑑別・二酸化炭素", "【鑑別】赤い容器、ホーン状の放射器、一般的な指示圧力計なし。薬剤量は質量で確認する。この消火器はどれか。", ["水消火器", "二酸化炭素消火器", "化学泡消火器", "ABC粉末蓄圧式"], 1, "ホーン状放射器と質量確認が二酸化炭素消火器の強い手掛かりです。", "standard", { practicalStyle: true }),
      sprintQuestion("sprint-p03", "practical", "鑑別・容器腐食", "【鑑別】指示圧力計の針は正常だが、容器底部に深い腐食がある。優先すべき判定はどれか。", ["正常", "容器異常として不良", "圧力だけ補充", "安全栓だけ交換"], 1, "底部腐食は容器の安全性に直結します。ゲージが正常でも容器異常は別に判定します。", "standard", { practicalStyle: true }),
      sprintQuestion("sprint-p04", "practical", "鑑別・方式比較", "【鑑別】粉末消火器Aは圧力計あり。Bは圧力計なしで内部に小型の加圧用ガス容器がある。AとBの方式はどれか。", ["蓄圧式・ガス加圧式", "ガス加圧式・蓄圧式", "反応式・蓄圧式", "蓄圧式・反応式"], 0, "Aは常時加圧の蓄圧式、Bは使用時に加圧用ガス容器を作動させるガス加圧式です。", "standard", { practicalStyle: true }),
      sprintQuestion("sprint-p05", "practical", "鑑別・安全栓封", "【鑑別】安全栓は差さっているが封が切れている。放射したかは外観だけでは断定できない。最初の判断はどれか。", ["安全栓があるので正常", "使用・作動の可能性を含む異常として確認する", "封は点検対象外", "圧力計があれば封を無視する"], 1, "安全栓が残っていても封切れは異常です。使用・作動の可能性を含めて状態確認します。", "standard", { practicalStyle: true })
    ];
    variants.forEach(addQuestion);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        ...defaultState, ...saved,
        attempts: saved?.attempts || {}, correct: saved?.correct || {}, wrong: saved?.wrong || {},
        streak: saved?.streak || {}, comments: saved?.comments || {}, rating: saved?.rating || {},
        history: Array.isArray(saved?.history) ? saved.history : [], activeSession: saved?.activeSession || null
      };
    } catch { return { ...defaultState }; }
  }

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function daysLeft() { return Math.max(0, Math.ceil((EXAM_AT - new Date()) / 86400000)); }
  function phase() { const d = daysLeft(); return d === 0 ? "final" : d <= 2 ? "exam" : "build"; }
  function subjectOf(item) { return item.category === "law-common" || item.category === "law-class" ? "law" : item.category; }
  function conceptOf(item) { return item.concept || item.topic || item.id; }
  function isDirectMastered(item) { return DIRECT_MASTERED_PATTERNS.some((pattern) => pattern.test(item.question)); }
  function isEligible(item) { return !isDirectMastered(item); }
  function attempts(item) { return state.attempts[item.id] || 0; }
  function accuracy(item) { return attempts(item) ? (state.correct[item.id] || 0) / attempts(item) : null; }
  function isWeak(item) { return (state.wrong[item.id] || 0) > 0 || ["weak", "review"].includes(state.rating[item.id]); }
  function isSolid(item) { return state.rating[item.id] === "solid" || (state.streak[item.id] || 0) >= 2; }

  function shuffle(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function subjectRate(subject) {
    const recent = state.history.filter((row) => row.subject === subject).slice(-20);
    if (recent.length >= 3) return recent.filter((row) => row.correct).length / recent.length;
    const items = QUESTIONS.filter((item) => subjectOf(item) === subject && attempts(item) > 0);
    const total = items.reduce((sum, item) => sum + attempts(item), 0);
    const correct = items.reduce((sum, item) => sum + (state.correct[item.id] || 0), 0);
    return total ? correct / total : null;
  }

  function subjectRisk(subject) {
    const rate = subjectRate(subject);
    const eligible = QUESTIONS.filter((item) => isEligible(item) && subjectOf(item) === subject);
    const seen = eligible.filter((item) => attempts(item) > 0).length;
    const coverage = eligible.length ? seen / eligible.length : 0;
    if (rate === null) return 95;
    return Math.round((1 - rate) * 70 + (1 - coverage) * 30);
  }

  function recentPenalty(item) {
    const recent = state.history.slice(-18);
    const same = [...recent].reverse().find((row) => row.id === item.id);
    if (same && Date.now() - same.at < 2 * 60 * 60 * 1000) return 110;
    const conceptHits = recent.filter((row) => row.concept === conceptOf(item)).length;
    return Math.min(60, conceptHits * 20);
  }

  function questionScore(item, wantedSubject = null, mode = "quick") {
    if (!isEligible(item)) return -9999;
    let score = 0;
    const p = phase();
    if (isWeak(item)) score += 150 + Math.min(60, (state.wrong[item.id] || 0) * 15);
    if (state.rating[item.id] === "review") score += 35;
    if (attempts(item) === 0) score += p === "build" ? 110 : p === "exam" ? 55 : 8;
    if (item.priority === "latest") score += 30;
    if (item.priority === "high") score += 15;
    if (item.officialSignal) score += 24;
    if ((item.sprintLevel || 0) >= 3) score += 16;
    if (item.practicalStyle) score += 10;
    if (wantedSubject && subjectOf(item) === wantedSubject) score += 45;
    score += subjectRisk(subjectOf(item)) * 0.55;
    if (isSolid(item) && !isWeak(item)) score -= 110;
    if (attempts(item) >= 3 && (accuracy(item) || 0) >= .8 && !isWeak(item)) score -= 80;
    score -= recentPenalty(item);
    if (p === "final" && /法令|数字|周期|距離|能力単位|適応|安全栓|封|腐食|点検|圧力|鑑別|操作/.test(`${item.topic} ${item.question}`)) score += 35;
    if (mode === "unseen" && attempts(item) === 0) score += 180;
    return score + Math.random() * 7;
  }

  function pickForSubject(pool, count, subject, usedConcepts, mode) {
    return pool
      .filter((item) => subjectOf(item) === subject && !usedConcepts.has(conceptOf(item)))
      .map((item) => [item, questionScore(item, subject, mode)])
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([item]) => { usedConcepts.add(conceptOf(item)); return item; });
  }

  function adaptiveSet(count = 10, mode = "quick") {
    const pool = QUESTIONS.filter(isEligible);
    const quotas = { law: 3, mechanics: 1, structure: 4, practical: 2 };
    const risks = Object.keys(SUBJECTS).sort((a, b) => subjectRisk(b) - subjectRisk(a));
    if (subjectRisk(risks[0]) >= 65) {
      const donor = Object.keys(quotas).filter((subject) => subject !== risks[0] && quotas[subject] > 1)
        .sort((a, b) => subjectRisk(a) - subjectRisk(b))[0];
      if (donor) { quotas[donor] -= 1; quotas[risks[0]] += 1; }
    }
    const used = new Set();
    let result = [];
    for (const [subject, quota] of Object.entries(quotas)) result.push(...pickForSubject(pool, quota, subject, used, mode));
    if (result.length < count) {
      result.push(...pool.filter((item) => !result.includes(item) && !used.has(conceptOf(item)))
        .sort((a, b) => questionScore(b, null, mode) - questionScore(a, null, mode)).slice(0, count - result.length));
    }
    return shuffle(result).slice(0, count);
  }

  function weakSet() {
    const weak = QUESTIONS.filter((item) => isEligible(item) && isWeak(item))
      .sort((a, b) => questionScore(b) - questionScore(a));
    if (weak.length >= 10) return weak.slice(0, 10);
    const fill = adaptiveSet(10).filter((item) => !weak.includes(item));
    return [...weak, ...fill].slice(0, 10);
  }

  function unseenSet() {
    const unseen = QUESTIONS.filter((item) => isEligible(item) && attempts(item) === 0);
    const selected = adaptiveSet(10, "unseen").filter((item) => attempts(item) === 0);
    if (selected.length >= 10) return selected.slice(0, 10);
    const rest = unseen.filter((item) => !selected.includes(item)).sort((a, b) => questionScore(b, null, "unseen") - questionScore(a, null, "unseen"));
    const fill = adaptiveSet(10).filter((item) => !selected.includes(item) && !rest.includes(item));
    return [...selected, ...rest, ...fill].slice(0, 10);
  }

  function mockSet() {
    const quotas = { "law-common": 6, "law-class": 4, mechanics: 5, structure: 15, practical: 5 };
    return Object.entries(quotas).flatMap(([category, count]) => {
      const pool = QUESTIONS.filter((item) => item.category === category && isEligible(item));
      return shuffle(pool).sort((a, b) => questionScore(b) - questionScore(a)).slice(0, count);
    });
  }

  function getModeQuestions(mode) {
    if (mode === "quick") return adaptiveSet(10);
    if (mode === "unseen") return unseenSet();
    if (mode === "weak") return weakSet();
    if (mode === "mock") return mockSet();
    if (mode === "review-session") {
      const mistakes = session?.mistakes?.map((id) => QUESTIONS.find((item) => item.id === id)).filter(Boolean) || [];
      return mistakes.length ? mistakes : weakSet();
    }
    return adaptiveSet(10);
  }

  function modeLabel(mode) {
    return { quick: "合格スプリント10", unseen: "未出穴埋め", weak: "弱点回収", mock: "35問 本番モード", "review-session": "今回のミス" }[mode] || "特訓";
  }

  function currentQuestion() { return session?.questions?.[session.index] || null; }
  function saveCurrentNote() {
    const item = currentQuestion(); if (!item) return;
    const value = $("#question-note").value.trim();
    if (value) state.comments[item.id] = value; else delete state.comments[item.id];
    saveState(); $("#question-note-status").textContent = "保存済み";
  }
  function renderQuestionNote(item) {
    $("#question-note").value = state.comments[item.id] || "";
    const active = state.rating[item.id] || "";
    $$("#question-note-panel [data-rating]").forEach((button) => button.classList.toggle("active", button.dataset.rating === active));
    $("#question-note-status").textContent = state.comments[item.id] || active ? "保存済み" : "自動保存";
  }

  function persistActiveSession() {
    if (!session?.questions?.length) return;
    state.activeSession = {
      version: 2, mode: session.mode, questionIds: session.questions.map((item) => item.id), index: session.index,
      answers: session.answers, mistakes: session.mistakes, startedAt: session.startedAt, endsAt: session.endsAt,
      answered: Boolean(session.answered), updatedAt: Date.now()
    };
    saveState();
  }
  function clearActiveSession() { state.activeSession = null; saveState(); }
  function restoreActiveSession() {
    const saved = state.activeSession; if (!saved?.questionIds?.length) return false;
    const map = new Map(QUESTIONS.map((item) => [item.id, item]));
    const questions = saved.questionIds.map((id) => map.get(id)).filter(Boolean);
    if (!questions.length) { clearActiveSession(); return false; }
    session = { mode: saved.mode || "quick", questions, index: Math.min(Math.max(Number(saved.index) || 0, 0), questions.length - 1), answers: saved.answers || [], mistakes: saved.mistakes || [], startedAt: saved.startedAt || Date.now(), endsAt: saved.endsAt || null, answered: Boolean(saved.answered) };
    $("#quiz-mode-label").textContent = modeLabel(session.mode); showView("quiz"); startTimer(); renderQuestion(true); toast(`前回の続き ${session.index + 1}/${session.questions.length} から再開`); return true;
  }

  function showView(name) {
    if (session && name !== "quiz" && name !== "results") { persistActiveSession(); stopTimer(); }
    $(".bottom-nav").hidden = name === "quiz";
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
    $$(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
    if (name === "home") renderDashboard();
    if (name === "weak") renderWeakList();
    if (name === "memorize") renderMemoryCards();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startQuiz(mode) {
    if (state.activeSession?.questionIds?.length && session === null) {
      if (!window.confirm("途中の問題があります。新しいコースを始めますか？")) return restoreActiveSession();
      state.activeSession = null;
    }
    const questions = getModeQuestions(mode);
    if (!questions.length) { toast("対象問題がありません。合格スプリント10へ切り替えます。"); return startQuiz("quick"); }
    session = { mode, questions, index: 0, answers: [], mistakes: [], startedAt: Date.now(), endsAt: mode === "mock" ? Date.now() + 105 * 60 * 1000 : null, answered: false };
    $("#quiz-mode-label").textContent = modeLabel(mode); showView("quiz"); startTimer(); renderQuestion(false); persistActiveSession();
  }

  function whyNow(item) {
    if (isWeak(item)) return "前に落とした／自分で弱いと付けた論点。別角度で回収。";
    if (attempts(item) === 0) return "まだ触れていない論点。9/24は穴を先に埋める。";
    if (item.officialSignal) return "2026年6月更新の公式公開論点を独自アレンジ。";
    const risk = subjectRisk(subjectOf(item));
    return risk >= 65 ? "この科目の足切りリスクを下げるため。" : "本試験の出題比率を崩さないため。";
  }

  function renderQuestion(restoring = false) {
    const item = currentQuestion(); if (!item) return;
    if (!restoring) session.answered = false;
    $("#quiz-counter").textContent = `${session.index + 1} / ${session.questions.length}`;
    $("#quiz-progress-bar").style.width = `${(session.index / session.questions.length) * 100}%`;
    const examLike = session.mode === "mock" || phase() === "exam";
    $("#question-category").textContent = examLike ? "本番混合" : (CATEGORY_META[item.category]?.label || item.category);
    $("#question-priority").textContent = item.practicalStyle ? "鑑別判断" : (item.sprintLevel || 0) >= 3 ? "応用" : item.priority === "latest" ? "公式論点" : "本番対策";
    $("#why-now").hidden = examLike;
    $("#why-now").textContent = examLike ? "" : whyNow(item);
    $("#question-text").textContent = item.question;
    $("#feedback").hidden = true; $("#next-question").hidden = true;
    $("#choices").innerHTML = item.choices.map((choice, index) => `<button class="choice" type="button" data-answer="${index}"><span class="choice-letter">${LETTERS[index]}</span><span>${escapeHtml(choice)}</span></button>`).join("");
    $$("#choices .choice").forEach((button) => button.addEventListener("click", () => answerQuestion(Number(button.dataset.answer))));
    renderQuestionNote(item);
    if (restoring && session.answered) {
      const savedAnswer = [...session.answers].reverse().find((answer) => answer.id === item.id);
      if (savedAnswer) paintAnsweredState(item, savedAnswer, false); else session.answered = false;
    }
    if (state.sound && !session.answered) speakQuestion(item);
  }

  function updateWeakState(itemId, isCorrect) {
    if (isCorrect) {
      state.correct[itemId] = (state.correct[itemId] || 0) + 1;
      state.streak[itemId] = (state.streak[itemId] || 0) + 1;
      if ((state.wrong[itemId] || 0) > 0 && state.streak[itemId] >= 2) state.wrong[itemId] = 0;
    } else { state.wrong[itemId] = (state.wrong[itemId] || 0) + 1; state.streak[itemId] = 0; }
  }

  function paintAnsweredState(item, answer, focusNext = true) {
    $$("#choices .choice").forEach((button, index) => {
      button.disabled = true;
      if (session.mode === "mock") { if (index === answer.selected) button.classList.add("selected"); }
      else { if (index === item.answer) button.classList.add("correct"); if (index === answer.selected && !answer.correct) button.classList.add("wrong"); }
    });
    if (session.mode === "mock") $("#feedback").hidden = true;
    else {
      $("#feedback-verdict").textContent = answer.correct ? "○ 正解" : `× 不正解　正解 ${LETTERS[item.answer]}`;
      $("#feedback-verdict").style.color = answer.correct ? "var(--green)" : "var(--red)";
      $("#feedback-explanation").textContent = item.explanation;
      $("#feedback-source").href = item.source?.url || "https://www.shoubo-shiken.or.jp/shoubou/exercise.html";
      $("#feedback-source").textContent = `根拠：${item.source?.label || "公式資料"}`;
      $("#feedback").hidden = false;
    }
    $("#next-question").hidden = false;
    $("#next-question").textContent = session.index === session.questions.length - 1 ? (session.mode === "mock" ? "採点する" : "結果を見る") : "次の問題へ";
    if (focusNext) $("#next-question").focus({ preventScroll: true });
  }

  function answerQuestion(selected) {
    if (!session || session.answered) return;
    session.answered = true;
    const item = currentQuestion(); const isCorrect = selected === item.answer;
    const answer = { id: item.id, category: item.category, subject: subjectOf(item), correct: isCorrect, selected };
    session.answers.push(answer); state.attempts[item.id] = (state.attempts[item.id] || 0) + 1; updateWeakState(item.id, isCorrect);
    if (!isCorrect) session.mistakes.push(item.id);
    state.history.push({ id: item.id, concept: conceptOf(item), subject: subjectOf(item), correct: isCorrect, at: Date.now() });
    state.history = state.history.slice(-350);
    saveState(); paintAnsweredState(item, answer, true); persistActiveSession();
  }

  function nextQuestion() {
    if (!session?.answered) return;
    if (session.index >= session.questions.length - 1) return finishQuiz();
    session.index += 1; session.answered = false; renderQuestion(false); persistActiveSession(); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function rate(items) { return items.length ? Math.round(items.filter((item) => item.correct).length / items.length * 100) : 0; }
  function assessMock(answers) {
    const law = answers.filter((a) => a.subject === "law"), mechanics = answers.filter((a) => a.subject === "mechanics"), structure = answers.filter((a) => a.subject === "structure"), practical = answers.filter((a) => a.subject === "practical"), written = [...law, ...mechanics, ...structure];
    return rate(law) >= 40 && rate(mechanics) >= 40 && rate(structure) >= 40 && rate(written) >= 60 && rate(practical) >= 60;
  }
  function statRow(label, items, threshold) {
    if (!items.length) return "";
    const percent = rate(items), correct = items.filter((item) => item.correct).length;
    return `<div class="breakdown-row ${percent >= threshold ? "pass" : "fail"}"><span>${label}</span><strong>${correct}/${items.length}（${percent}%）</strong></div>`;
  }
  function renderBreakdown(answers, isMock) {
    if (isMock) {
      const law = answers.filter((a) => a.subject === "law"), mechanics = answers.filter((a) => a.subject === "mechanics"), structure = answers.filter((a) => a.subject === "structure"), practical = answers.filter((a) => a.subject === "practical"), written = [...law, ...mechanics, ...structure];
      $("#result-breakdown").innerHTML = [statRow("消防関係法令", law, 40), statRow("基礎的知識", mechanics, 40), statRow("構造・機能・整備・規格", structure, 40), statRow("筆記全体", written, 60), statRow("鑑別等", practical, 60)].join("");
      return;
    }
    $("#result-breakdown").innerHTML = Object.entries(SUBJECTS).map(([key, meta]) => statRow(meta.label, answers.filter((a) => a.subject === key), key === "practical" ? 60 : 40)).join("");
  }
  function finishQuiz() {
    stopTimer(); state.sessions += 1; state.activeSession = null; saveState();
    const total = session.answers.length, correct = session.answers.filter((answer) => answer.correct).length, percent = total ? Math.round(correct / total * 100) : 0;
    $("#result-score").textContent = `${percent}%`; $("#result-ratio").textContent = `${correct} / ${total}`;
    if (session.mode === "mock") $("#result-message").textContent = assessMock(session.answers) ? "合格条件クリア。次は70%前後を安定させる。" : "足切りまたは60%未達。危険科目を次の10問へ自動反映します。";
    else $("#result-message").textContent = session.mistakes.length ? `ミス${session.mistakes.length}問。次の10問ではこの弱点を別角度で優先します。` : "全問正解。次は未出と本番二択へ進みます。";
    renderBreakdown(session.answers, session.mode === "mock"); showView("results");
  }

  function renderDashboard() {
    const eligible = QUESTIONS.filter(isEligible);
    const totalAttempts = Object.values(state.attempts).reduce((sum, value) => sum + value, 0);
    const totalCorrect = Object.values(state.correct).reduce((sum, value) => sum + value, 0);
    const overall = totalAttempts ? Math.round(totalCorrect / totalAttempts * 100) : 0;
    $("#readiness-value").textContent = totalAttempts ? `${overall}%` : "--";
    $(".readiness").style.setProperty("--score", `${overall}%`);
    const weakCount = eligible.filter(isWeak).length, unseenCount = eligible.filter((item) => attempts(item) === 0).length;
    $("#weak-count-home").textContent = weakCount ? `${weakCount}論点を優先` : "弱点なし";
    $("#unseen-count-home").textContent = unseenCount ? `未出 ${unseenCount}問` : "未出なし";
    const d = daysLeft(); $("#days-left").textContent = d === 0 ? "本番当日" : `あと${d}日`;
    const p = phase();
    $("#phase-title").textContent = p === "final" ? "最終確認" : p === "exam" ? "本番モード" : "得点力強化";
    $("#phase-copy").textContent = p === "final" ? "新しい難問は増やさず、ミス・数字・法令・類似用語・鑑別を短く回収。" : p === "exam" ? "分野名を隠し、本試験と同じ判断テンポへ。全範囲混合を優先。" : "弱点と未出を先に潰し、簡単な既習問題には戻りません。";
    const riskOrder = Object.keys(SUBJECTS).sort((a, b) => subjectRisk(b) - subjectRisk(a));
    const worst = riskOrder[0];
    $("#mission-copy").textContent = `弱点 ${weakCount} / 未出 ${unseenCount}。現在の最優先は「${SUBJECTS[worst].label}」。`;
    $("#category-progress").innerHTML = Object.entries(SUBJECTS).map(([subject, meta]) => {
      const r = subjectRate(subject), percent = r === null ? 0 : Math.round(r * 100), risk = subjectRisk(subject);
      const label = r === null ? "未測定" : `${percent}%`;
      const status = risk >= 65 ? "要補強" : risk >= 40 ? "注意" : "安定";
      return `<div class="progress-row"><span>${meta.label}</span><div class="progress-track"><span style="width:${percent}%"></span></div><strong>${label}</strong><em class="risk-chip ${risk >= 65 ? "high" : risk >= 40 ? "mid" : "low"}">${status}</em></div>`;
    }).join("");
  }

  function renderWeakList() {
    const weak = QUESTIONS.filter((item) => isEligible(item) && isWeak(item)).sort((a, b) => questionScore(b) - questionScore(a));
    $("#weak-list").innerHTML = weak.length ? weak.map((item) => `<article class="weak-item"><div><strong>${escapeHtml(item.topic)}</strong><span>ミス ${state.wrong[item.id] || 0}回 / 連続正解 ${state.streak[item.id] || 0}/2</span></div><p>${escapeHtml(item.question)}</p>${state.comments[item.id] ? `<small>メモ：${escapeHtml(state.comments[item.id])}</small>` : ""}</article>`).join("") : `<div class="empty-state">現在の弱点はありません。未出10問で穴を探しましょう。</div>`;
  }
  function renderMemoryCards() {
    $("#memory-cards").innerHTML = MEMORY_CARDS.map(([label, prompt, answer], index) => `<button class="memory-card" type="button" data-memory="${index}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(prompt)}</strong><span>${escapeHtml(answer)}</span></button>`).join("");
    $$(".memory-card").forEach((card) => card.addEventListener("click", () => card.classList.toggle("revealed")));
  }
  function speakQuestion(item) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${item.question}。${item.choices.map((choice, index) => `${LETTERS[index]}、${choice}`).join("。")}`);
    utterance.lang = "ja-JP"; utterance.rate = .92; window.speechSynthesis.speak(utterance);
  }
  function startTimer() {
    stopTimer(); if (!session?.endsAt) { $("#quiz-timer").textContent = ""; return; }
    const tick = () => { const remaining = Math.max(0, session.endsAt - Date.now()), minutes = Math.floor(remaining / 60000), seconds = Math.floor((remaining % 60000) / 1000); $("#quiz-timer").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`; if (remaining <= 0) finishQuiz(); };
    tick(); timerHandle = setInterval(tick, 1000);
  }
  function stopTimer() { if (timerHandle) clearInterval(timerHandle); timerHandle = null; }
  function toast(message) { clearTimeout(toastHandle); $("#toast").textContent = message; $("#toast").classList.add("show"); toastHandle = setTimeout(() => $("#toast").classList.remove("show"), 2200); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

  function bindEvents() {
    $$('[data-view]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
    $$('[data-start]').forEach((button) => button.addEventListener("click", () => startQuiz(button.dataset.start)));
    $("#next-question").addEventListener("click", nextQuestion);
    $("#quit-quiz").addEventListener("click", () => { persistActiveSession(); showView("home"); });
    $("#question-note").addEventListener("input", saveCurrentNote);
    $$("#question-note-panel [data-rating]").forEach((button) => button.addEventListener("click", () => {
      const item = currentQuestion(); if (!item) return;
      const next = state.rating[item.id] === button.dataset.rating ? "" : button.dataset.rating;
      if (next) state.rating[item.id] = next; else delete state.rating[item.id];
      if (next === "solid") { state.wrong[item.id] = 0; state.streak[item.id] = Math.max(2, state.streak[item.id] || 0); }
      saveState(); renderQuestionNote(item);
    }));
    $("#sound-toggle").addEventListener("click", () => { state.sound = !state.sound; $("#sound-toggle").setAttribute("aria-pressed", String(state.sound)); saveState(); toast(state.sound ? "自動読み上げON" : "自動読み上げOFF"); if (state.sound && session) speakQuestion(currentQuestion()); else window.speechSynthesis?.cancel(); });
    $("#reset-progress").addEventListener("click", () => {
      if (!window.confirm("正答率・弱点・コメント・途中位置をすべて消しますか？")) return;
      state = { ...defaultState, attempts: {}, correct: {}, wrong: {}, streak: {}, comments: {}, rating: {}, history: [], activeSession: null }; session = null; saveState(); renderDashboard(); toast("学習記録をリセットしました");
    });
    document.addEventListener("keydown", (event) => {
      if (!session || !$("#view-quiz").classList.contains("active") || event.target?.matches?.("textarea,input")) return;
      if (event.key === "Enter" && session.answered) return nextQuestion();
      const key = event.key.toUpperCase();
      const index = LETTERS.indexOf(key) >= 0 ? LETTERS.indexOf(key) : Number(event.key) >= 1 && Number(event.key) <= 4 ? Number(event.key) - 1 : -1;
      if (index >= 0) answerQuestion(index);
    });
    window.addEventListener("pagehide", () => persistActiveSession());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persistActiveSession(); });
  }

  function init() {
    bindEvents(); $("#sound-toggle").setAttribute("aria-pressed", String(state.sound)); renderDashboard(); renderMemoryCards();
    const restored = restoreActiveSession();
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
    if (!restored) showView("home");
  }

  init();
})();
