import { useState, useEffect, useMemo, useCallback } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA LAYER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LINE_URL = "https://lin.ee/pcAHpTBy";

const MBTI_QUESTIONS = [
  { q: "エネルギーの源は？", a: ["人と話すと充電される", "ひとりの時間で回復する"], dim: "EI" },
  { q: "初対面の場では？", a: ["自分から話しかける", "相手の出方を見る"], dim: "EI" },
  { q: "休日の理想は？", a: ["誰かと過ごす", "自分だけの時間"], dim: "EI" },
  { q: "情報の受け取り方は？", a: ["五感で確かめたい", "直感でパターンを掴む"], dim: "SN" },
  { q: "説明するとき重視するのは？", a: ["具体例・事実", "全体像・可能性"], dim: "SN" },
  { q: "未来を考えるとき？", a: ["現実的な計画を立てる", "ビジョンから逆算する"], dim: "SN" },
  { q: "判断の軸は？", a: ["論理的に正しいか", "人の気持ちに配慮する"], dim: "TF" },
  { q: "フィードバックで大事なのは？", a: ["事実を正確に伝える", "相手の受け取り方を考える"], dim: "TF" },
  { q: "対立が起きたとき？", a: ["原則に基づいて判断する", "調和を優先する"], dim: "TF" },
  { q: "予定の管理は？", a: ["きっちり決めて動く", "流れに任せて対応する"], dim: "JP" },
  { q: "締切に対して？", a: ["早めに終わらせたい", "直前に集中力が出る"], dim: "JP" },
  { q: "旅行のスタイルは？", a: ["計画を立てて回る", "気分で動く"], dim: "JP" },
];

const ENNEAGRAM_QUESTIONS = [
  { q: "根底にある恐れは？", options: [
    { label: "不完全であること", type: 1 },
    { label: "愛されないこと", type: 2 },
    { label: "価値がないと思われること", type: 3 },
    { label: "自分が何者でもないこと", type: 4 },
    { label: "無能であること", type: 5 },
    { label: "支えがないこと", type: 6 },
    { label: "苦痛に囚われること", type: 7 },
    { label: "他者にコントロールされること", type: 8 },
    { label: "争いや断絶", type: 9 },
  ]},
  { q: "無意識に求めているものは？", options: [
    { label: "正しさ・誠実さ", type: 1 },
    { label: "感謝・必要とされる感覚", type: 2 },
    { label: "成功・賞賛", type: 3 },
    { label: "独自性・深い理解", type: 4 },
    { label: "知識・理解の深さ", type: 5 },
    { label: "安全・確実さ", type: 6 },
    { label: "自由・刺激・満足", type: 7 },
    { label: "力・自立・主導権", type: 8 },
    { label: "平和・調和・安定", type: 9 },
  ]},
  { q: "ストレス時に出る反応は？", options: [
    { label: "怒りを抑え込み批判的になる", type: 1 },
    { label: "自分を犠牲にして尽くす", type: 2 },
    { label: "さらに成果を出そうとする", type: 3 },
    { label: "感情に沈み引きこもる", type: 4 },
    { label: "情報収集に没頭する", type: 5 },
    { label: "最悪のシナリオを想定する", type: 6 },
    { label: "逃避・気分転換に走る", type: 7 },
    { label: "力で押し通そうとする", type: 8 },
    { label: "思考停止・無気力になる", type: 9 },
  ]},
];

const MBTI_PROFILES = {
  INTJ: { title: "建築家", desc: "戦略的ビジョナリー。複雑なシステムを構想し、長期計画を着実に実行する。", element: "風", color: "#4A6FA5" },
  INTP: { title: "論理学者", desc: "知的探求者。理論と可能性の世界に没頭し、革新を生む。", element: "風", color: "#6B8EC2" },
  ENTJ: { title: "指揮官", desc: "決断のリーダー。効率と成果を追求し、組織を前進させる。", element: "火", color: "#C44536" },
  ENTP: { title: "討論者", desc: "知的挑戦者。既存の枠を壊し、新しい可能性を拓く。", element: "火", color: "#E76F51" },
  INFJ: { title: "提唱者", desc: "静かなる理想主義者。深い洞察で人の本質を見抜き、変容を導く。", element: "水", color: "#5E7CE2" },
  INFP: { title: "仲介者", desc: "内なる炎を持つ理想家。価値観に忠実に、世界を変えようとする。", element: "水", color: "#7B9ED9" },
  ENFJ: { title: "主人公", desc: "カリスマ教育者。他者の潜在能力を引き出し、成長を導く。", element: "火", color: "#E09F3E" },
  ENFP: { title: "広報運動家", desc: "情熱の探求者。可能性を見出し、人々をインスパイアする。", element: "火", color: "#F4A261" },
  ISTJ: { title: "管理者", desc: "責任の守護者。確実性と秩序を重んじ、約束を必ず果たす。", element: "地", color: "#6B705C" },
  ISFJ: { title: "擁護者", desc: "献身の守り手。細やかな気配りで、周囲の安定を支える。", element: "地", color: "#8B9474" },
  ESTJ: { title: "幹部", desc: "組織の柱。明確な基準と行動力で、チームを統率する。", element: "地", color: "#9C6644" },
  ESFJ: { title: "領事官", desc: "コミュニティの核。人を繋ぎ、調和ある環境を築く。", element: "地", color: "#B08968" },
  ISTP: { title: "巨匠", desc: "冷静な実践者。状況を分析し、最適な行動を瞬時に選ぶ。", element: "風", color: "#588B8B" },
  ISFP: { title: "冒険家", desc: "感覚の芸術家。今この瞬間を深く味わい、美を創り出す。", element: "水", color: "#78A5A3" },
  ESTP: { title: "起業家", desc: "行動の達人。リスクを恐れず、チャンスを即座に掴む。", element: "火", color: "#D4A276" },
  ESFP: { title: "エンターテイナー", desc: "人生の演者。場を明るくし、人々を巻き込む。", element: "火", color: "#E6B89C" },
};

const ENNEAGRAM_PROFILES = {
  1: { title: "改革者", core: "正しさへの渇望", growth: "不完全さの中に美を見出す", wing: [9,2] },
  2: { title: "助ける人", core: "愛されたい欲求", growth: "自分自身のニーズを認める", wing: [1,3] },
  3: { title: "達成者", core: "価値の証明", growth: "存在そのものが価値だと知る", wing: [2,4] },
  4: { title: "個性的な人", core: "独自性への渇望", growth: "普遍的な繋がりの中に自分を見る", wing: [3,5] },
  5: { title: "観察者", core: "理解への欲求", growth: "知識を体験に変換する", wing: [4,6] },
  6: { title: "忠実な人", core: "安全の確保", growth: "不確実さの中で信頼する力", wing: [5,7] },
  7: { title: "楽天家", core: "自由と充足", growth: "深く留まる勇気", wing: [6,8] },
  8: { title: "挑戦者", core: "自立と力", growth: "脆さを見せる強さ", wing: [7,9] },
  9: { title: "平和主義者", core: "調和と安定", growth: "自分の声を取り戻す", wing: [8,1] },
};

const NUMEROLOGY_MEANINGS = {
  1:  { title: "開拓者", essence: "始まり・独立・リーダーシップ", shadow: "孤立・支配", color: "#E85D4A" },
  2:  { title: "調和者", essence: "協調・受容・パートナーシップ", shadow: "依存・優柔不断", color: "#5A9BD5" },
  3:  { title: "表現者", essence: "創造・表現・喜び", shadow: "散漫・表面的", color: "#E8A838" },
  4:  { title: "構築者", essence: "安定・基盤・秩序", shadow: "頑固・制限", color: "#5DAA68" },
  5:  { title: "冒険者", essence: "変化・自由・経験", shadow: "無節制・逃避", color: "#E87B3A" },
  6:  { title: "調整者", essence: "責任・愛・養育", shadow: "過干渉・自己犠牲", color: "#9B6EC6" },
  7:  { title: "探求者", essence: "内省・分析・精神性", shadow: "孤立・懐疑", color: "#6078C6" },
  8:  { title: "統率者", essence: "力・豊かさ・達成", shadow: "支配・物質主義", color: "#8B7B3E" },
  9:  { title: "完成者", essence: "普遍・叡智・完結", shadow: "理想主義・自己喪失", color: "#C680A0" },
  11: { title: "霊的直感者", essence: "直感・啓示・高次の気づき", shadow: "過敏・現実逃避", color: "#C6A844" },
  22: { title: "大建築家", essence: "大きなビジョンの具現化", shadow: "過大な重圧・自己破壊", color: "#4A8888" },
  33: { title: "大教師", essence: "無条件の愛・奉仕・癒し", shadow: "殉教・自己犠牲", color: "#A848A8" },
};

// ━━━ Calculation ━━━
function reduceToSingle(n) {
  if (n === 11 || n === 22 || n === 33) return n;
  while (n > 9) { n = String(n).split("").reduce((s, d) => s + Number(d), 0); }
  return n;
}
function sumDigitsMaster(v) {
  let s = String(v).split("").reduce((a, c) => a + Number(c), 0);
  while (s > 9 && s !== 11 && s !== 22 && s !== 33) s = String(s).split("").reduce((a, c) => a + Number(c), 0);
  return s;
}
function calcLifePath(y, m, d) { return reduceToSingle(sumDigitsMaster(y) + sumDigitsMaster(m) + sumDigitsMaster(d)); }
function calcDestiny(name) {
  const map = {a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8};
  let sum = 0; name.toLowerCase().replace(/[^a-z]/g, "").split("").forEach(c => { sum += map[c] || 0; });
  return reduceToSingle(sum);
}
function calcFuture(y, m, d) {
  return reduceToSingle(String(2026).split("").reduce((s, c) => s + Number(c), 0) + String(m).split("").reduce((s, c) => s + Number(c), 0) + String(d).split("").reduce((s, c) => s + Number(c), 0));
}

// ━━━ Cross Analysis ━━━
function generateCrossAnalysis(mbti, enneagram, past, destiny, future) {
  const mp = MBTI_PROFILES[mbti]; const ep = ENNEAGRAM_PROFILES[enneagram];
  const pastN = NUMEROLOGY_MEANINGS[past]; const destN = NUMEROLOGY_MEANINGS[destiny]; const futN = NUMEROLOGY_MEANINGS[future];
  const tp = [], sy = [], ai = [];
  if (mbti.includes("F") && [1,5,8].includes(enneagram)) tp.push("感情機能と理知的/力の追求の間に創造的な緊張がある。この葛藤こそがあなたの深みの源泉。");
  if (mbti.includes("N") && [4,5,7].includes(enneagram)) sy.push("直感と探求心の共鳴。パターン認識力が極めて高く、見えない繋がりを見出す天性。");
  if (mbti.includes("J") && [7,9].includes(enneagram)) tp.push("構造化したい衝動と、流れに身を任せたい欲求。統合できた時、柔軟な戦略家が生まれる。");
  if (mbti.includes("I") && [2,3].includes(enneagram)) tp.push("内向エネルギーと外への承認欲求。深い内省から生まれた洞察を、勇気を持って表現する挑戦。");
  if (mbti.includes("E") && [5,4].includes(enneagram)) tp.push("外向的行動力と内面の深い探求心。社交と孤独の間で揺れるが、両方があなたの知性を育てている。");
  if ([1,8].includes(past) && mbti.includes("E")) sy.push("生来のリーダーシップ数と外向性の共鳴。行動力と影響力が自然に一致。");
  if ([7,9].includes(destiny) && mbti.includes("N")) sy.push("運命数の精神性と直感機能の融合。深い洞察を通じて人々を導く使命。");
  if ([5,7].includes(future) && [3,7].includes(enneagram)) ai.push("今年は変化と探求の年。エニアグラムの欲求と数秘の波動が共振し、新しい挑戦に最適なタイミング。");
  if (enneagram === 1 && [4,8].includes(destiny)) sy.push("完璧主義の力を構築/統率の運命数が受け止める。理想を形にする強力な配置。");
  if (enneagram === 4 && [3,5].includes(past)) tp.push("独自性への渇望と、表現力/探求力の過去数。幼少期の体験が創造性の根源になっている。");
  if (mbti.includes("T") && [2,6,9].includes(enneagram)) tp.push("思考優位と関係性・安全を求める根源動機。論理と感情の架け橋になれる稀有な配置。");
  if (mbti.includes("P") && [1,3].includes(enneagram)) tp.push("柔軟な知覚と完璧/達成への衝動。締切前の爆発力が強みだが、普段の自己批判に注意。");
  if ([3,8].includes(destiny) && [1,3,8].includes(enneagram)) sy.push("達成・力の運命数とエニアグラムの完全一致。外部承認なしに自走できるエンジンを持っている。");
  if ([2,6].includes(past) && mbti.includes("F")) sy.push("過去数の協調性と感情機能が響き合う。人の痛みを直感的に理解し、寄り添う天性。");
  ai.push(`${mp.title}（${mbti}）× Type${enneagram}（${ep.title}）は、ACEメソッドの「${mbti.includes("N") ? "認知の書き換え" : "身体性からの気づき"}」アプローチと高相性。`);
  ai.push(`${past}→${destiny}→${future} の軌道は「${past < destiny ? "拡大" : past > destiny ? "深化" : "安定"}」のアーク。${futN.essence.split("・")[0]}の年に${ep.growth}が加速する配置。`);
  if (tp.length === 0) tp.push("三体系間に大きな矛盾がなく統合がスムーズ。むしろ「摩擦の少なさ」自体が盲点になりうる。");
  if (sy.length === 0) sy.push("三体系がそれぞれ異なる方向を指す多面的配置。状況に応じて異なる顔を見せる複雑さが強み。");
  return { tensionPoints: tp, synergies: sy, aceInsights: ai };
}

// ━━━ URL ━━━
function decodeResult(p) {
  if (!p) return null;
  // Handle master numbers: e.g. INFJ-11-9-5-4 or INFJ-1195-4
  const m = p.match(/^([A-Z]{4})-(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (m) {
    const mbti = m[1]; const past = parseInt(m[2]); const dest = parseInt(m[3]); const fut = parseInt(m[4]); const ennea = parseInt(m[5]);
    if (MBTI_PROFILES[mbti] && NUMEROLOGY_MEANINGS[past] && NUMEROLOGY_MEANINGS[dest] && NUMEROLOGY_MEANINGS[fut] && ENNEAGRAM_PROFILES[ennea])
      return { mbti, past, dest, fut, ennea };
  }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const fonts = `'Zen Kaku Gothic New', sans-serif`;
const fontDisplay = `'Cormorant Garamond', serif`;
const C = {
  bg: "#0D0B08", bgCard: "rgba(30,26,22,0.7)", border: "#2E2822",
  borderHover: "#8B7355", gold: "#C9A96E", goldMuted: "#8B7355",
  text: "#D4C5A9", textMuted: "#7A6F5F", textDim: "#4A4030",
  accent: "#E85D4A", water: "#5E7CE2",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function HoverBtn({ children, style, hover, ...p }) {
  const [h, setH] = useState(false);
  return <button {...p} style={{ ...style, ...(h ? hover : {}) }} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}>{children}</button>;
}

function IntroScreen({ onStart }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", opacity: show ? 1 : 0, transform: show ? "none" : "translateY(20px)", transition: "all 0.8s ease" }}>
      <div style={{ fontSize: "10px", letterSpacing: "8px", color: C.goldMuted, fontFamily: fontDisplay, marginBottom: "20px" }}>ACE METHOD</div>
      <h1 style={{ fontFamily: fontDisplay, fontSize: "36px", fontWeight: 300, color: C.text, lineHeight: 1.2, margin: "0 0 6px" }}>TRINITY</h1>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "18px", fontWeight: 300, color: C.goldMuted, letterSpacing: "6px", margin: 0 }}>DIAGNOSIS</h2>
      <div style={{ width: "48px", height: "1px", background: `linear-gradient(90deg, transparent, ${C.goldMuted}, transparent)`, margin: "28px auto" }} />
      <p style={{ color: C.textMuted, fontSize: "13px", lineHeight: 2, maxWidth: "300px", margin: "0 auto 36px" }}>
        MBTI × 数秘術 × エニアグラム<br/>3つの体系を掛け合わせ<br/>あなたの認知構造を立体的に解き明かす
      </p>
      <div style={{ display: "flex", gap: "28px", justifyContent: "center", marginBottom: "44px" }}>
        {[["◈","MBTI","認知の型"],["◇","数秘","魂の軌道"],["△","Enneagram","根源動機"]].map(([ic, t, s]) => (
          <div key={t} style={{ textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: "20px", color: C.text }}>{ic}</div>
            <div style={{ fontSize: "10px", color: C.goldMuted, letterSpacing: "2px" }}>{t}</div>
            <div style={{ fontSize: "9px", color: C.textDim, marginTop: "3px" }}>{s}</div>
          </div>
        ))}
      </div>
      <HoverBtn onClick={onStart} style={{ background: `linear-gradient(135deg, ${C.goldMuted}, #5A4D3A)`, color: C.bg, border: "none", padding: "16px 56px", fontSize: "14px", letterSpacing: "4px", cursor: "pointer", fontFamily: fontDisplay, fontWeight: 600, transition: "all 0.3s" }}
        hover={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldMuted})` }}>診断を始める</HoverBtn>
    </div>
  );
}

function MBTIStep({ onComplete }) {
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState({ E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0 });
  const [anim, setAnim] = useState(false);
  const answer = useCallback((c) => {
    if (anim) return; setAnim(true);
    const q = MBTI_QUESTIONS[idx]; const ns = { ...scores };
    if (c === 0) ns[q.dim[0]]++; else ns[q.dim[1]]++; setScores(ns);
    setTimeout(() => {
      if (idx < MBTI_QUESTIONS.length - 1) setIdx(idx + 1);
      else { const t = (ns.E>=ns.I?"E":"I")+(ns.S>=ns.N?"S":"N")+(ns.T>=ns.F?"T":"F")+(ns.J>=ns.P?"J":"P"); onComplete(t); }
      setAnim(false);
    }, 250);
  }, [idx, scores, anim, onComplete]);
  const q = MBTI_QUESTIONS[idx]; const pct = ((idx+1)/MBTI_QUESTIONS.length)*100;
  return (
    <div style={{ padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "10px", color: C.goldMuted, letterSpacing: "4px", fontFamily: fontDisplay }}>MBTI</span>
        <span style={{ fontSize: "11px", color: C.textDim }}>{idx+1} / {MBTI_QUESTIONS.length}</span>
      </div>
      <div style={{ height: "2px", background: C.border, marginBottom: "36px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.goldMuted}, ${C.gold})`, transition: "width 0.5s" }} />
      </div>
      <p style={{ fontSize: "20px", color: C.text, fontWeight: 300, marginBottom: "36px", lineHeight: 1.6, opacity: anim?0:1, transform: anim?"translateX(-10px)":"none", transition: "all 0.25s" }}>{q.q}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {q.a.map((o, i) => (
          <HoverBtn key={`${idx}-${i}`} onClick={() => answer(i)}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "18px 20px", fontSize: "14px", cursor: "pointer", textAlign: "left", transition: "all 0.3s", lineHeight: 1.5, opacity: anim?0.3:1 }}
            hover={{ borderColor: C.goldMuted, color: C.text, background: "rgba(139,115,85,0.06)" }}>{o}</HoverBtn>
        ))}
      </div>
    </div>
  );
}

function NumerologyStep({ onComplete }) {
  const [name, setName] = useState(""); const [year, setYear] = useState(""); const [month, setMonth] = useState(""); const [day, setDay] = useState(""); const [error, setError] = useState("");
  const submit = () => {
    if (!name.trim()||!year||!month||!day) { setError("すべて入力してください"); return; }
    const y=parseInt(year),m=parseInt(month),d=parseInt(day);
    if (y<1900||y>2025||m<1||m>12||d<1||d>31) { setError("正しい日付を入力してください"); return; }
    onComplete({ past: calcLifePath(y,m,d), destiny: calcDestiny(name), future: calcFuture(y,m,d) });
  };
  const iS = { background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text, padding: "14px 4px", fontSize: "17px", outline: "none", width: "100%", transition: "border-color 0.3s", fontFamily: fonts };
  return (
    <div style={{ padding: "28px 20px" }}>
      <div style={{ fontSize: "10px", color: C.goldMuted, letterSpacing: "4px", fontFamily: fontDisplay, marginBottom: "36px" }}>NUMEROLOGY</div>
      <div style={{ marginBottom: "32px" }}>
        <label style={{ fontSize: "10px", color: C.textDim, letterSpacing: "2px", display: "block", marginBottom: "10px" }}>NAME（ローマ字）</label>
        <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Masahiro Yamada" style={iS}
          onFocus={e=>e.target.style.borderBottomColor=C.goldMuted} onBlur={e=>e.target.style.borderBottomColor=C.border} />
      </div>
      <div style={{ marginBottom: "32px" }}>
        <label style={{ fontSize: "10px", color: C.textDim, letterSpacing: "2px", display: "block", marginBottom: "14px" }}>BIRTHDATE</label>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "16px" }}>
          {[["年",year,setYear,"1985"],["月",month,setMonth,"01"],["日",day,setDay,"15"]].map(([l,v,fn,ph]) => (
            <div key={l}>
              <input type="number" value={v} onChange={e=>fn(e.target.value)} placeholder={ph} style={iS}
                onFocus={e=>e.target.style.borderBottomColor=C.goldMuted} onBlur={e=>e.target.style.borderBottomColor=C.border} />
              <span style={{ fontSize: "9px", color: C.textDim, marginTop: "4px", display: "block" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      {error && <p style={{ color: C.accent, fontSize: "12px", marginBottom: "16px" }}>{error}</p>}
      <HoverBtn onClick={submit} style={{ background: `linear-gradient(135deg, ${C.goldMuted}, #5A4D3A)`, color: C.bg, border: "none", padding: "16px 0", fontSize: "14px", letterSpacing: "4px", cursor: "pointer", fontFamily: fontDisplay, fontWeight: 600, width: "100%", transition: "all 0.3s" }}
        hover={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldMuted})` }}>CALCULATE</HoverBtn>
    </div>
  );
}

function EnneagramStep({ onComplete }) {
  const [idx, setIdx] = useState(0); const [scores, setScores] = useState({});
  const answer = (type) => {
    const ns = { ...scores, [type]: (scores[type]||0)+1 }; setScores(ns);
    if (idx < ENNEAGRAM_QUESTIONS.length-1) setIdx(idx+1);
    else { const sorted = Object.entries(ns).sort((a,b)=>b[1]-a[1]); onComplete(parseInt(sorted[0][0])); }
  };
  const q = ENNEAGRAM_QUESTIONS[idx];
  return (
    <div style={{ padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "10px", color: C.goldMuted, letterSpacing: "4px", fontFamily: fontDisplay }}>ENNEAGRAM</span>
        <span style={{ fontSize: "11px", color: C.textDim }}>{idx+1} / {ENNEAGRAM_QUESTIONS.length}</span>
      </div>
      <p style={{ fontSize: "20px", color: C.text, fontWeight: 300, marginBottom: "28px", lineHeight: 1.6 }}>{q.q}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {q.options.map((o, i) => (
          <HoverBtn key={`${idx}-${i}`} onClick={() => answer(o.type)}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "15px 16px", fontSize: "13px", cursor: "pointer", textAlign: "left", transition: "all 0.3s", display: "flex", alignItems: "center", gap: "12px" }}
            hover={{ borderColor: C.goldMuted, color: C.text, background: "rgba(139,115,85,0.06)" }}>
            <span style={{ fontSize: "10px", color: C.textDim, width: "16px", flexShrink: 0, textAlign: "center" }}>{o.type}</span>{o.label}
          </HoverBtn>
        ))}
      </div>
    </div>
  );
}

function ResultScreen({ mbti, numerology, enneagram, unlocked, onReset }) {
  const [reveal, setReveal] = useState(0);
  const mp = MBTI_PROFILES[mbti]; const ep = ENNEAGRAM_PROFILES[enneagram];
  const pastN = NUMEROLOGY_MEANINGS[numerology.past]; const destN = NUMEROLOGY_MEANINGS[numerology.destiny]; const futN = NUMEROLOGY_MEANINGS[numerology.future];
  const cross = useMemo(() => generateCrossAnalysis(mbti, enneagram, numerology.past, numerology.destiny, numerology.future), [mbti, enneagram, numerology]);

  useEffect(() => {
    const ts = [0,200,400,600,800,1000,1200,1400].map((d,i)=>setTimeout(()=>setReveal(i+1),d));
    return () => ts.forEach(clearTimeout);
  }, []);

  const resultCode = `${mbti}-${numerology.past}-${numerology.destiny}-${numerology.future}-${enneagram}`;
  const shareUrl = `https://masahiro-yamada.com/trinity?r=${resultCode}`;
  const shareText = `【Trinity Diagnosis】\n${mp.title}（${mbti}）× ${pastN.title}→${destN.title}→${futN.title} × Type${enneagram}「${ep.title}」\n\n3体系の交差が映し出す認知構造\n#ACE診断 #TrinityDiagnosis`;

  const shareToX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  const copyLink = () => { navigator.clipboard?.writeText(shareUrl); alert("リンクをコピーしました"); };

  const sec = (i) => ({ opacity: reveal>=i?1:0, transform: reveal>=i?"none":"translateY(16px)", transition: "all 0.5s ease", marginBottom: "24px" });
  const lbl = { fontSize: "9px", color: C.goldMuted, letterSpacing: "4px", marginBottom: "12px", fontFamily: fontDisplay };
  const crd = { background: C.bgCard, border: `1px solid ${C.border}`, padding: "20px" };
  const blur = (locked) => locked ? { filter: "blur(7px)", userSelect: "none", pointerEvents: "none", WebkitUserSelect: "none" } : {};

  return (
    <div style={{ padding: "24px 20px", position: "relative" }}>
      {/* Header */}
      <div style={{ ...sec(1), textAlign: "center" }}>
        <div style={{ fontSize: "9px", letterSpacing: "6px", color: C.textDim, marginBottom: "12px" }}>YOUR TRINITY</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
          <span style={{ fontFamily: fontDisplay, fontSize: "26px", color: mp.color, fontWeight: 300 }}>{mbti}</span>
          <span style={{ color: C.border, fontSize: "14px" }}>×</span>
          <span style={{ fontFamily: fontDisplay, fontSize: "26px", color: C.text, fontWeight: 300 }}>{numerology.past}-{numerology.destiny}-{numerology.future}</span>
          <span style={{ color: C.border, fontSize: "14px" }}>×</span>
          <span style={{ fontFamily: fontDisplay, fontSize: "26px", color: C.textMuted, fontWeight: 300 }}>T{enneagram}</span>
        </div>
        <div style={{ width: "56px", height: "1px", background: `linear-gradient(90deg, transparent, ${C.goldMuted}, transparent)`, margin: "0 auto" }} />
      </div>

      {/* MBTI */}
      <div style={sec(2)}>
        <div style={lbl}>MBTI — 認知の型</div>
        <div style={crd}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
            <span style={{ fontFamily: fontDisplay, fontSize: "22px", color: mp.color }}>{mp.title}</span>
            <span style={{ fontSize: "11px", color: C.textDim }}>{mp.element}の属性</span>
          </div>
          <p style={{ fontSize: "13px", color: C.textMuted, lineHeight: 1.8, margin: 0 }}>{mp.desc}</p>
        </div>
      </div>

      {/* Numerology */}
      <div style={sec(3)}>
        <div style={lbl}>NUMEROLOGY — 魂の軌道</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[["過去",numerology.past,pastN,"ライフパス"],["現在",numerology.destiny,destN,"運命数"],["未来",numerology.future,futN,"2026年"]].map(([l,n,d,sub]) => (
            <div key={l} style={{ ...crd, textAlign: "center", padding: "16px 10px" }}>
              <div style={{ fontSize: "9px", color: C.textDim, marginBottom: "4px" }}>{l}</div>
              <div style={{ fontFamily: fontDisplay, fontSize: "30px", color: d.color, fontWeight: 300 }}>{n}</div>
              <div style={{ fontSize: "12px", color: C.text, marginTop: "2px" }}>{d.title}</div>
              <div style={{ fontSize: "8px", color: C.textDim, marginTop: "2px" }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ ...crd, marginTop: "8px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "13px" }}>
            <span style={{ color: pastN.color }}>{pastN.essence.split("・")[0]}</span>
            <span style={{ color: C.border }}>→</span>
            <span style={{ color: destN.color }}>{destN.essence.split("・")[0]}</span>
            <span style={{ color: C.border }}>→</span>
            <span style={{ color: futN.color }}>{futN.essence.split("・")[0]}</span>
          </div>
        </div>
      </div>

      {/* Enneagram */}
      <div style={sec(4)}>
        <div style={lbl}>ENNEAGRAM — 根源の動機</div>
        <div style={crd}>
          <span style={{ fontFamily: fontDisplay, fontSize: "20px", color: C.text }}>Type {enneagram}「{ep.title}」</span>
          <div style={{ fontSize: "12px", color: C.goldMuted, marginTop: "8px" }}>核心の動機: {ep.core}</div>
          <div style={{ fontSize: "12px", color: C.water, marginTop: "4px" }}>成長の方向: {ep.growth}</div>
        </div>
      </div>

      {/* LINE Gate */}
      {!unlocked && (
        <div style={{ ...sec(5), position: "relative" }}>
          <div style={{ textAlign: "center", padding: "36px 20px", border: `1px solid ${C.gold}33`, background: `linear-gradient(180deg, rgba(201,169,110,0.06) 0%, transparent 100%)` }}>
            <div style={{ fontSize: "10px", letterSpacing: "4px", color: C.gold, marginBottom: "14px", fontFamily: fontDisplay }}>DEEP ANALYSIS</div>
            <p style={{ fontSize: "14px", color: C.text, lineHeight: 1.9, marginBottom: "24px" }}>
              交差分析・ACE Insight・Shadow & Light<br/>完全版を受け取る
            </p>
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-block", background: "#06C755", color: "#fff", padding: "16px 44px", fontSize: "15px", fontWeight: 700, textDecoration: "none", letterSpacing: "1px", borderRadius: "6px", transition: "opacity 0.3s", boxShadow: "0 4px 20px rgba(6,199,85,0.25)"
            }}>LINE登録で完全版を見る</a>
            <p style={{ fontSize: "11px", color: C.textDim, marginTop: "16px", lineHeight: 1.7 }}>登録後、トーク画面に完全版URLが届きます</p>
          </div>
        </div>
      )}

      {/* Cross Analysis */}
      <div style={sec(6)}>
        <div style={lbl}>CROSS ANALYSIS — 三体系の交差</div>
        <div style={blur(!unlocked)}>
          <div style={crd}>
            <div style={{ fontSize: "11px", color: C.gold, marginBottom: "10px", letterSpacing: "2px" }}>◈ 共鳴ポイント</div>
            {cross.synergies.map((s,i)=><p key={i} style={{ fontSize: "13px", color: C.textMuted, lineHeight: 1.8, margin: "0 0 8px" }}>{s}</p>)}
          </div>
          <div style={{ ...crd, marginTop: "8px" }}>
            <div style={{ fontSize: "11px", color: C.accent, marginBottom: "10px", letterSpacing: "2px" }}>◇ 創造的緊張</div>
            {cross.tensionPoints.map((t,i)=><p key={i} style={{ fontSize: "13px", color: C.textMuted, lineHeight: 1.8, margin: "0 0 8px" }}>{t}</p>)}
          </div>
        </div>
      </div>

      {/* ACE Insight */}
      <div style={sec(7)}>
        <div style={lbl}>ACE INSIGHT — 認知変容への示唆</div>
        <div style={blur(!unlocked)}>
          <div style={{ ...crd, borderColor: "#3D3325", background: "rgba(139,115,85,0.06)" }}>
            {cross.aceInsights.map((a,i)=><p key={i} style={{ fontSize: "13px", color: C.text, lineHeight: 1.9, margin: "0 0 12px" }}>{a}</p>)}
          </div>
        </div>
      </div>

      {/* Shadow & Light */}
      <div style={sec(8)}>
        <div style={lbl}>SHADOW & LIGHT</div>
        <div style={blur(!unlocked)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={crd}>
              <div style={{ fontSize: "10px", color: C.textDim, marginBottom: "8px" }}>影の統合課題</div>
              <p style={{ fontSize: "12px", color: C.textMuted, lineHeight: 1.6, margin: 0 }}>{pastN.shadow}</p>
              <p style={{ fontSize: "12px", color: C.textMuted, lineHeight: 1.6, margin: "6px 0 0" }}>E{enneagram}: {ep.core}の裏返し</p>
            </div>
            <div style={crd}>
              <div style={{ fontSize: "10px", color: C.goldMuted, marginBottom: "8px" }}>光の発現</div>
              <p style={{ fontSize: "12px", color: C.text, lineHeight: 1.6, margin: 0 }}>{destN.essence}</p>
              <p style={{ fontSize: "12px", color: C.text, lineHeight: 1.6, margin: "6px 0 0" }}>→ {ep.growth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Share */}
      <div style={{ ...sec(8), textAlign: "center", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
        <HoverBtn onClick={shareToX} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "12px 24px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", fontFamily: fontDisplay, transition: "all 0.3s" }}
          hover={{ borderColor: C.goldMuted, color: C.gold }}>Xでシェア</HoverBtn>
        <HoverBtn onClick={copyLink} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "12px 24px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", fontFamily: fontDisplay, transition: "all 0.3s" }}
          hover={{ borderColor: C.goldMuted, color: C.gold }}>リンクをコピー</HoverBtn>
      </div>

      {/* Retake */}
      <div style={{ textAlign: "center", marginTop: "8px", opacity: reveal>=5?1:0, transition: "opacity 0.5s" }}>
        <HoverBtn onClick={onReset} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, padding: "12px 32px", fontSize: "11px", letterSpacing: "3px", cursor: "pointer", fontFamily: fontDisplay, transition: "all 0.3s" }}
          hover={{ borderColor: C.goldMuted, color: C.goldMuted }}>もう一度診断する</HoverBtn>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function TrinityDiagnosis() {
  const [step, setStep] = useState("loading");
  const [mbti, setMbti] = useState(null);
  const [numerology, setNumerology] = useState(null);
  const [enneagram, setEnneagram] = useState(null);
  const [sharedData, setSharedData] = useState(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r");
    const u = params.get("u");
    if (r) {
      const decoded = decodeResult(r);
      if (decoded) {
        if (u === "1") {
          setMbti(decoded.mbti);
          setNumerology({ past: decoded.past, destiny: decoded.dest, future: decoded.fut });
          setEnneagram(decoded.ennea);
          setUnlocked(true);
          setStep("result");
        } else {
          setSharedData(decoded);
          setStep("shared");
        }
        return;
      }
    }
    setStep("intro");
  }, []);

  const reset = () => {
    setStep("intro"); setMbti(null); setNumerology(null); setEnneagram(null); setSharedData(null); setUnlocked(false);
    window.history?.replaceState({}, "", window.location.pathname);
  };

  if (step === "loading") return <div style={{ minHeight: "100vh", background: C.bg }} />;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(175deg, #13100C 0%, ${C.bg} 35%, #13100C 100%)`, color: C.text, fontFamily: fonts, maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(139,115,85,0.04) 0%, transparent 50%)", pointerEvents: "none" }} />
      {["mbti","numerology","enneagram"].includes(step) && (
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "20px 0 0" }}>
          {["mbti","numerology","enneagram"].map(s => (
            <div key={s} style={{ width: "6px", height: "6px", borderRadius: "50%", background: s===step?C.goldMuted:C.border, transition: "background 0.4s" }} />
          ))}
        </div>
      )}
      {step === "intro" && <IntroScreen onStart={() => setStep("mbti")} />}
      {step === "mbti" && <MBTIStep onComplete={t => { setMbti(t); setStep("numerology"); }} />}
      {step === "numerology" && <NumerologyStep onComplete={n => { setNumerology(n); setStep("enneagram"); }} />}
      {step === "enneagram" && <EnneagramStep onComplete={e => { setEnneagram(e); setStep("result"); }} />}
      {step === "result" && <ResultScreen mbti={mbti} numerology={numerology} enneagram={enneagram} unlocked={unlocked} onReset={reset} />}
      {step === "shared" && (
        <div>
          <ResultScreen mbti={sharedData.mbti} numerology={{ past: sharedData.past, destiny: sharedData.dest, future: sharedData.fut }} enneagram={sharedData.ennea} unlocked={true} onReset={reset} />
          <div style={{ textAlign: "center", padding: "0 20px 48px" }}>
            <div style={{ width: "40px", height: "1px", background: `linear-gradient(90deg, transparent, ${C.goldMuted}, transparent)`, margin: "0 auto 24px" }} />
            <p style={{ fontSize: "14px", color: C.text, marginBottom: "20px", lineHeight: 1.8 }}>あなたもTrinity Diagnosisを受けてみませんか？</p>
            <HoverBtn onClick={reset} style={{ background: `linear-gradient(135deg, ${C.goldMuted}, #5A4D3A)`, color: C.bg, border: "none", padding: "16px 48px", fontSize: "14px", letterSpacing: "4px", cursor: "pointer", fontFamily: fontDisplay, fontWeight: 600, transition: "all 0.3s" }}
              hover={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldMuted})` }}>自分も診断する</HoverBtn>
          </div>
        </div>
      )}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Zen+Kaku+Gothic+New:wght@300;400;500&display=swap" rel="stylesheet" />
    </div>
  );
}
