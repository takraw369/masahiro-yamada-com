import { useMemo, useState } from 'react';

type LoopType = 'curiosity' | 'bridge' | 'value';
type BridgeTarget = 'profile' | 'past-post' | 'note' | 'line' | 'quest' | 'service';
type CtaType = 'archive' | 'follow' | 'line' | 'note' | 'quest' | 'service' | 'none';

const LOOP_TYPES: Array<{ id: LoopType; label: string; title: string; description: string }> = [
  {
    id: 'curiosity',
    label: '① 好奇心型',
    title: '情報ギャップを作る',
    description: '「何があった？」を作り、Profileや関連投稿へ自発的に移動してもらう。',
  },
  {
    id: 'bridge',
    label: '② 過去投稿Bridge型',
    title: '前後の投稿をつなぐ',
    description: '昨日・朝・前回の投稿を自然に匂わせ、Archiveを読む理由を作る。',
  },
  {
    id: 'value',
    label: '③ Value Preview型',
    title: '継続価値を先に見せる',
    description: '「この人を追う理由」を明確にし、Profile確認→Followへつなぐ。',
  },
];

const BRIDGE_TARGETS: Array<{ id: BridgeTarget; label: string }> = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'past-post', label: '過去投稿' },
  { id: 'note', label: 'note' },
  { id: 'line', label: 'LINE' },
  { id: 'quest', label: 'Quest / 教材' },
  { id: 'service', label: 'サービス / 商品' },
];

const CTA_OPTIONS: Array<{ id: CtaType; label: string }> = [
  { id: 'archive', label: '過去投稿を見る' },
  { id: 'follow', label: 'フォロー' },
  { id: 'line', label: 'LINE' },
  { id: 'note', label: 'note' },
  { id: 'quest', label: 'Quest / 教材' },
  { id: 'service', label: 'サービス' },
  { id: 'none', label: 'CTAなし' },
];

const CTA_COPY: Record<CtaType, string> = {
  archive: '関連する過去投稿も置いてあるので、気になる人はプロフィールから辿ってみてください。',
  follow: '身体・脳・FLOWを、毎日ひとつずつ使える形にして出しています。続きが気になる人はフォローしておいてください。',
  line: 'もう少し体系的に受け取りたい人向けの導線はプロフィールにまとめています。',
  note: '背景まで含めた長文はnoteにまとめます。',
  quest: '知識で終わらせず実践したい人向けに、Quest化していきます。',
  service: '必要な人向けの実践サポートはプロフィールにまとめています。',
  none: '',
};

const BRIDGE_LABEL: Record<BridgeTarget, string> = {
  profile: 'Profile',
  'past-post': '過去投稿',
  note: 'note',
  line: 'LINE',
  quest: 'Quest / 教材',
  service: 'サービス / 商品',
};

function compact(text: string, max = 120) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function firstIdea(text: string) {
  const first = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);
  return compact(first ?? text, 120);
}

function buildLocalDraft(
  material: string,
  loopType: LoopType,
  bridgeTarget: BridgeTarget,
  bridgeDetail: string,
  cta: CtaType,
) {
  const core = firstIdea(material) || 'ここに伝えたい核を入れてください。';
  const detail = bridgeDetail.trim();
  const bridgeName = detail || BRIDGE_LABEL[bridgeTarget];
  const ctaCopy = CTA_COPY[cta];

  const body =
    loopType === 'curiosity'
      ? `待って。${core}\n\nこれ、思っていたより大事な話かもしれない。${detail ? `\n「${bridgeName}」につながる話です。` : ''}`
      : loopType === 'bridge'
        ? `${core}\n\n前に出した「${bridgeName}」と、実はここでつながります。単発で見るより、前後を合わせて読むと構造が見えやすい。`
        : `${core}\n\nこういう「身体・脳・FLOWを実践に落とす視点」を、点ではなくつながる形で出していきます。${detail ? `\n次は「${bridgeName}」へつなげます。` : ''}`;

  return [body, ctaCopy].filter(Boolean).join('\n\n');
}

function buildExecutionPrompt(
  material: string,
  loopType: LoopType,
  bridgeTarget: BridgeTarget,
  bridgeDetail: string,
  cta: CtaType,
) {
  const loop = LOOP_TYPES.find((item) => item.id === loopType)!;
  return `C107｜X PROFILE LOOP OS で設計してください。\n\n【入力素材】\n${material.trim()}\n\n【選択】\n- 回遊型: ${loop.label}｜${loop.title}\n- Bridge先: ${BRIDGE_LABEL[bridgeTarget]}${bridgeDetail.trim() ? `｜${bridgeDetail.trim()}` : ''}\n- CTA: ${CTA_OPTIONS.find((item) => item.id === cta)?.label ?? cta}\n\n【目的】\n投稿単体で完結させず、X投稿 → Profile → 過去投稿 / 関連資産 → Follow → LINE / note / Quest / Service の回遊を作る。表示数だけを狙わず、Profile Visit / Follow Conversion / Archive Depth / CTAまで一体で設計する。\n\n【MASA向けルール】\n- 煽りだけの釣りにしない。好奇心は作るが、本文で必ず価値を返す。\n- 「普通のコーチではない」と自然に伝わる探究・更新・構造化の人格に合わせる。\n- 存在しない体験・反響・アンチコメント・数字・実績を作らない。\n- 過去投稿を匂わせる場合、実在する投稿・資産が確認できない時は断定せず「関連テーマ」表現にする。\n- 1投稿1メッセージ。X本文は読みやすさを優先し、必要なら短文化する。\n\n【出力】\n1. メイン投稿 完成稿\n2. Hookの狙い（1行）\n3. Bridge先と、その理由\n4. 過去投稿 / 次投稿として置く補助投稿2本\n5. CTA文 1つ\n6. Profileとの整合チェック（プロフィール文に必要な要素があれば指摘）\n7. 計測するKPI（Profile Visit Rate / Follow Conversion / Archive Depth / CTA）\n\n最初に第一推奨の完成稿を出し、その後に設計意図を短く説明してください。`;
}

export default function XProfileLoopBuilder() {
  const [material, setMaterial] = useState('');
  const [loopType, setLoopType] = useState<LoopType>('bridge');
  const [bridgeTarget, setBridgeTarget] = useState<BridgeTarget>('past-post');
  const [bridgeDetail, setBridgeDetail] = useState('');
  const [cta, setCta] = useState<CtaType>('archive');
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState<'draft' | 'prompt' | null>(null);

  const localDraft = useMemo(
    () => buildLocalDraft(material, loopType, bridgeTarget, bridgeDetail, cta),
    [material, loopType, bridgeTarget, bridgeDetail, cta],
  );
  const executionPrompt = useMemo(
    () => buildExecutionPrompt(material, loopType, bridgeTarget, bridgeDetail, cta),
    [material, loopType, bridgeTarget, bridgeDetail, cta],
  );

  const copy = async (value: string, kind: 'draft' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(null);
    }
  };

  const handoff = () => {
    if (!generated) setGenerated(true);
    window.dispatchEvent(new CustomEvent('masa:x-compose', { detail: { text: localDraft } }));
  };

  const ink = '#25211d';
  const muted = '#736b61';
  const border = 'rgba(37,33,29,0.13)';
  const gold = '#9a6d24';
  const surface = '#ffffff';
  const soft = '#f8f6f2';

  const cardStyle = (active: boolean): React.CSSProperties => ({
    textAlign: 'left',
    padding: '14px 15px',
    borderRadius: 12,
    border: `1px solid ${active ? 'rgba(154,109,36,.48)' : border}`,
    background: active ? 'rgba(154,109,36,.07)' : surface,
    color: ink,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: 112,
  });

  const selectStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 42,
    padding: '9px 11px',
    borderRadius: 9,
    border: `1px solid ${border}`,
    background: surface,
    color: ink,
    font: 'inherit',
  };

  return (
    <section style={{ marginBottom: 28, border: `1px solid ${border}`, borderRadius: 18, background: surface, overflow: 'hidden', boxShadow: '0 8px 28px rgba(37,33,29,.04)' }}>
      <div style={{ padding: '18px 20px', borderBottom: `1px solid ${border}`, background: 'linear-gradient(135deg,#fffdf9,#f7f1e8)' }}>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: gold, fontSize: '.7rem', fontWeight: 800, letterSpacing: '.1em' }}>C107 · X PROFILE LOOP OS</div>
            <h2 style={{ margin: '4px 0 5px', fontSize: '1.15rem', color: ink }}>投稿を「点」で終わらせず、回遊にする。</h2>
            <p style={{ margin: 0, color: muted, fontSize: '.86rem', lineHeight: 1.7 }}>素材 → 回遊型 → Bridge先 → CTA → 下書き → X Composer。AIで精緻化する時は同時生成する実行Promptを使う。</p>
          </div>
          <a href="https://docs.google.com/document/d/1eQVMTzw-7rTprCRy7Tb53SiEInKiqRVFKYkS5iYvliI/edit" target="_blank" rel="noopener noreferrer" style={{ color: gold, fontSize: '.72rem', textDecoration: 'none', fontWeight: 700 }}>Drive正本 ↗</a>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <label style={{ display: 'block', color: muted, fontSize: '.74rem', fontWeight: 800, marginBottom: 7, letterSpacing: '.06em' }}>1 · 素材</label>
        <textarea
          value={material}
          onChange={(event) => { setMaterial(event.target.value); setGenerated(false); }}
          placeholder="例：身体だけ鍛えても、試合で力を出し切れない子がいる。問題はメンタルの弱さではなく、脳・感情・身体の順番が崩れていることかもしれない。"
          rows={5}
          style={{ width: '100%', resize: 'vertical', padding: 13, border: `1px solid ${border}`, borderRadius: 10, background: soft, color: ink, font: 'inherit', lineHeight: 1.7, boxSizing: 'border-box' }}
        />

        <div style={{ marginTop: 20 }}>
          <div style={{ color: muted, fontSize: '.74rem', fontWeight: 800, marginBottom: 8, letterSpacing: '.06em' }}>2 · 回遊型</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
            {LOOP_TYPES.map((item) => (
              <button key={item.id} type="button" style={cardStyle(loopType === item.id)} onClick={() => { setLoopType(item.id); setGenerated(false); }}>
                <strong style={{ display: 'block', color: loopType === item.id ? gold : ink, fontSize: '.84rem' }}>{item.label}</strong>
                <span style={{ display: 'block', marginTop: 5, fontSize: '.82rem', fontWeight: 700 }}>{item.title}</span>
                <span style={{ display: 'block', marginTop: 6, color: muted, fontSize: '.74rem', lineHeight: 1.55 }}>{item.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 20 }}>
          <div>
            <label style={{ display: 'block', color: muted, fontSize: '.74rem', fontWeight: 800, marginBottom: 7, letterSpacing: '.06em' }}>3 · Bridge先</label>
            <select value={bridgeTarget} onChange={(event) => { setBridgeTarget(event.target.value as BridgeTarget); setGenerated(false); }} style={selectStyle}>
              {BRIDGE_TARGETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: muted, fontSize: '.74rem', fontWeight: 800, marginBottom: 7, letterSpacing: '.06em' }}>Bridgeの具体名</label>
            <input value={bridgeDetail} onChange={(event) => { setBridgeDetail(event.target.value); setGenerated(false); }} placeholder="例：昨日の『努力より整え方』投稿" style={selectStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: muted, fontSize: '.74rem', fontWeight: 800, marginBottom: 7, letterSpacing: '.06em' }}>4 · CTA</label>
            <select value={cta} onChange={(event) => { setCta(event.target.value as CtaType); setGenerated(false); }} style={selectStyle}>
              {CTA_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setGenerated(true)}
          disabled={!material.trim()}
          style={{ width: '100%', marginTop: 18, minHeight: 44, borderRadius: 10, border: '1px solid #8f6525', background: material.trim() ? '#b4863b' : '#d9d3ca', color: material.trim() ? '#211b13' : '#79736c', font: 'inherit', fontWeight: 800, cursor: material.trim() ? 'pointer' : 'not-allowed' }}
        >
          回遊設計を生成
        </button>

        {generated && (
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            <article style={{ padding: 15, border: `1px solid ${border}`, borderRadius: 12, background: '#fff' }}>
              <div style={{ color: gold, fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em' }}>LOCAL DRAFT</div>
              <h3 style={{ margin: '4px 0 9px', fontSize: '.95rem' }}>すぐ使える叩き台</h3>
              <div style={{ whiteSpace: 'pre-wrap', color: ink, fontSize: '.86rem', lineHeight: 1.75, minHeight: 120 }}>{localDraft}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
                <button type="button" onClick={handoff} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #8f6525', background: '#b4863b', color: '#211b13', font: 'inherit', fontSize: '.78rem', fontWeight: 800, cursor: 'pointer' }}>X Composerへ送る</button>
                <button type="button" onClick={() => copy(localDraft, 'draft')} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surface, color: muted, font: 'inherit', fontSize: '.78rem', cursor: 'pointer' }}>{copied === 'draft' ? 'コピー済み ✓' : '下書きをコピー'}</button>
              </div>
            </article>

            <article style={{ padding: 15, border: `1px solid ${border}`, borderRadius: 12, background: soft }}>
              <div style={{ color: gold, fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em' }}>AI HANDOFF</div>
              <h3 style={{ margin: '4px 0 9px', fontSize: '.95rem' }}>C107実行Prompt</h3>
              <p style={{ margin: 0, color: muted, fontSize: '.8rem', lineHeight: 1.65 }}>AIに渡すと、完成稿・補助投稿2本・Bridge・CTA・KPIまで一括で精緻化できる。</p>
              <div style={{ marginTop: 10, maxHeight: 170, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#56504a', fontSize: '.75rem', lineHeight: 1.55 }}>{executionPrompt}</div>
              <button type="button" onClick={() => copy(executionPrompt, 'prompt')} style={{ marginTop: 13, padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surface, color: muted, font: 'inherit', fontSize: '.78rem', cursor: 'pointer' }}>{copied === 'prompt' ? 'コピー済み ✓' : 'AI用Promptをコピー'}</button>
            </article>
          </div>
        )}

        <div style={{ marginTop: 16, padding: '11px 13px', borderRadius: 10, background: 'rgba(154,109,36,.06)', color: muted, fontSize: '.76rem', lineHeight: 1.6 }}>
          KPIは表示数だけでなく、Profile Visit Rate → Follow Conversion → Archive Depth → CTAを追う。実在しない過去投稿や反響は生成しない。
        </div>
      </div>
    </section>
  );
}
