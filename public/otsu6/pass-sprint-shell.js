(() => {
  "use strict";
  if (window.__OTSU6_PASS_SPRINT_V2__) return;
  window.__OTSU6_PASS_SPRINT_V2__ = true;

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/otsu6/pass-sprint-v2.css?v=20260924b";
  document.head.appendChild(css);
  document.title = "乙6 合格スプリント";

  document.body.innerHTML = `
<a class="skip-link" href="#main">本文へ</a>
<header class="topbar"><button class="brand" data-view="home"><span class="brand-mark">6</span><span><strong>乙6 合格スプリント</strong><small>9/27まで、点になる問題だけ</small></span></button></header>
<main id="main">
  <section id="view-home" class="view active">
    <div class="hero"><div><p class="eyebrow">PASS SPRINT</p><h1><span id="days-left">あと3日</span>。穴から潰す。</h1><p>既習の単純問題は卒業。弱点・未出・本番二択を自動で優先。</p></div><div class="readiness"><strong id="readiness-value">--</strong></div></div>
    <div id="resume-card" class="panel resume" hidden><b>途中の特訓があります</b><p id="resume-copy"></p><div class="resume-actions"><button id="resume-quiz">続きから</button><button id="discard-session">破棄</button></div></div>
    <section class="panel mission"><div class="mission-head"><p class="eyebrow">NEXT ACTION</p><span id="phase-label" class="phase">得点力強化</span></div><h2>今は「何問やったか」より、落とす穴を減らす</h2><p id="mission-copy">次の10問を最適化中…</p><div class="actions"><button class="primary wide" data-start="adaptive">合格スプリント10</button><button class="secondary" data-start="weak">弱点だけ</button><button class="secondary" data-start="unseen">未出だけ</button></div></section>
    <section class="section"><h2>科目別リスク</h2><div id="risk-bars"></div></section>
    <section class="section"><h2>本番へつなぐ</h2><div class="mode-grid"><button class="mode-card hot" data-start="mock"><b>35問 本番モード</b><small>30筆記＋5鑑別 / 途中採点なし</small></button><button class="mode-card" data-view="map"><b>全範囲マップ</b><small>未出・弱点だけ見える化</small></button></div></section>
    <p class="source-note">公式の2026年6月更新公開問題・現行試験科目・消防庁資料を軸に、問題文は独自作成。公開問題の丸写しはしません。</p>
  </section>
  <section id="view-quiz" class="view"><div class="quiz-meta"><button id="quit-quiz" class="text-button">← 終了</button><div><span id="quiz-mode-label"></span><strong id="quiz-counter"></strong></div><span id="quiz-timer" class="timer"></span></div><div class="quiz-progress"><span id="quiz-progress-bar"></span></div><article class="question-card"><div class="question-tags"><span id="question-category"></span><span id="question-priority"></span></div><p id="why-now"></p><h2 id="question-text"></h2><div id="choices" class="choices"></div><div id="feedback" class="feedback" hidden><div id="feedback-verdict" class="feedback-verdict"></div><p id="feedback-explanation"></p><a id="feedback-source" target="_blank" rel="noreferrer"></a></div><div class="self-feedback"><div class="self-buttons"><button data-self="weak">ここ弱い</button><button data-self="repeat">別角度でもう1回</button><button data-self="mastered">もう大丈夫</button></div><textarea id="question-note" class="note" placeholder="自分メモ（例：数字混同、二択で迷う）"></textarea></div><button id="next-question" class="next-button" hidden>次へ</button></article></section>
  <section id="view-results" class="view"><div class="results-hero"><p class="eyebrow">SESSION COMPLETE</p><div id="result-score" class="score">0%</div><strong id="result-ratio">0/0</strong><p id="result-message"></p></div><div id="result-breakdown" class="breakdown"></div><div class="result-actions"><button class="primary" data-start="adaptive">次の最適10問</button><button class="secondary" data-view="home">ホーム</button></div></section>
  <section id="view-map" class="view"><p class="eyebrow">COVERAGE MAP</p><h1>全範囲の穴</h1><p>弱点 → 未出あり → 確認済みの順。単純な既習問題はここからも除外。</p><div id="coverage-list"></div><div class="result-actions"><button class="primary" data-start="unseen">未出10問</button><button class="secondary" data-view="home">ホーム</button></div></section>
</main>
<nav class="bottom-nav"><button data-view="home">ホーム</button><button data-start="adaptive">10問</button><button data-view="map">範囲</button></nav>`;

  const bank = document.createElement("script");
  bank.src = "/otsu6/pass-sprint-bank.js?v=20260924b";
  bank.onload = () => {
    const engine = document.createElement("script");
    engine.src = "/otsu6/pass-sprint-v2.js?v=20260924b";
    document.body.appendChild(engine);
  };
  document.body.appendChild(bank);
})();
