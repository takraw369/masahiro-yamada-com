(() => {
  "use strict";

  // 並行作業と衝突させず、直前期の差し替えだけを独立レイヤーで適用する。
  // s16（化学泡の放射中閉止）は出題対象から外し、別論点の新問へ差し替える。
  const replacedIndex = QUESTIONS.findIndex((item) => item.id === "s16");
  if (replacedIndex >= 0) {
    QUESTIONS.splice(replacedIndex, 1, {
      id: "s27",
      category: "structure",
      topic: "容器の腐食・変形",
      priority: "high",
      question: "点検で消火器の本体容器に著しい腐食・変形が認められた。最も適切な判断はどれか。",
      choices: [
        "表面を塗装すれば、そのまま良好と判定できる",
        "指示圧力計が緑色範囲なら、容器の状態に関係なく良好である",
        "容器強度に関わる異常として、不良と判定する",
        "安全栓だけを交換すれば良好になる"
      ],
      answer: 2,
      explanation: "著しい腐食や変形は本体容器の強度に関わる異常です。圧力表示が正常でも、容器そのものの異常は別に判定します。",
      source: SOURCES.standard
    });
  }

  // 基礎配列を毎回シャッフルし、同順位の問題が固定順にならないようにする。
  // app.js 側の弱点・最新・頻出の優先順位は維持する。
  for (let i = QUESTIONS.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [QUESTIONS[i], QUESTIONS[j]] = [QUESTIONS[j], QUESTIONS[i]];
  }
})();
