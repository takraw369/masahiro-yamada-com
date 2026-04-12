import { useState } from 'react';

interface Quest {
  id: string;
  title: string;
  desc: string;
  category: 'brain' | 'health' | 'relation' | 'mental' | 'sport';
  keywords: string[];
  links: { label: string; url: string; type: 'youtube' | 'note' | 'web' }[];
}

const CAT_META = {
  brain:    { label: '脳科学',         color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
  health:   { label: '健康',           color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
  relation: { label: 'リレーション',   color: '#EC4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.3)'  },
  mental:   { label: 'メンタル',       color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  sport:    { label: 'スポーツ',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
};

const QUESTS: Quest[] = [
  // 脳科学
  { id: 'q1', category: 'brain', title: 'ドーパミンと習慣形成', desc: '報酬系を理解して、行動設計に活かす', keywords: ['ドーパミン', '習慣', '報酬系', '脳科学'], links: [{ label: 'Andrew Huberman: Dopamine', url: 'https://www.youtube.com/results?search_query=huberman+dopamine+habits', type: 'youtube' }] },
  { id: 'q2', category: 'brain', title: 'ADHD×前頭前野の科学', desc: '注意制御の神経基盤を知り、自己設計に使う', keywords: ['ADHD', '前頭前野', '注意制御', '実行機能'], links: [{ label: 'ADHDの脳科学を学ぶ', url: 'https://www.youtube.com/results?search_query=ADHD+前頭前野+脳科学', type: 'youtube' }] },
  { id: 'q3', category: 'brain', title: 'フロー状態を作る条件', desc: '集中の最適状態を再現可能にする', keywords: ['フロー', '集中力', 'ZONE', '没入'], links: [{ label: 'Flow State Science', url: 'https://www.youtube.com/results?search_query=flow+state+neuroscience', type: 'youtube' }] },
  { id: 'q4', category: 'brain', title: '睡眠と記憶の定着', desc: '睡眠がパフォーマンスを何倍にするか', keywords: ['睡眠', '記憶定着', '脳', 'パフォーマンス'], links: [{ label: 'Matthew Walker: Sleep', url: 'https://www.youtube.com/results?search_query=matthew+walker+sleep+memory', type: 'youtube' }] },
  // 健康
  { id: 'q5', category: 'health', title: '呼吸法と自律神経', desc: '呼吸でコンディションをコントロールする', keywords: ['呼吸法', '自律神経', 'コンディション', 'パラシンパ'], links: [{ label: 'Breathing & Nervous System', url: 'https://www.youtube.com/results?search_query=breathing+autonomic+nervous+system', type: 'youtube' }] },
  { id: 'q6', category: 'health', title: 'パフォーマンスのための食事', desc: '何をいつ食べるかで動きが変わる', keywords: ['食事設計', 'パフォーマンス', '栄養', 'アスリート'], links: [{ label: 'Sports Nutrition Science', url: 'https://www.youtube.com/results?search_query=sports+nutrition+performance+science', type: 'youtube' }] },
  { id: 'q7', category: 'health', title: '体のバイオリズム最適化', desc: 'サーカディアンリズムを味方につける', keywords: ['バイオリズム', '概日リズム', '体内時計', '最適化'], links: [{ label: 'Circadian Rhythm Optimization', url: 'https://www.youtube.com/results?search_query=circadian+rhythm+performance+optimization', type: 'youtube' }] },
  { id: 'q8', category: 'health', title: '回復力（リカバリー）の科学', desc: '休むことも練習。回復を設計する', keywords: ['回復', 'リカバリー', '超回復', 'HRV'], links: [{ label: 'Recovery Science', url: 'https://www.youtube.com/results?search_query=athletic+recovery+science+HRV', type: 'youtube' }] },
  // リレーション
  { id: 'q9', category: 'relation', title: 'コーチング心理学の基礎', desc: '人を動かすのは命令ではなく問いかけ', keywords: ['コーチング', '心理学', '傾聴', '問いかけ'], links: [{ label: 'Coaching Psychology', url: 'https://www.youtube.com/results?search_query=coaching+psychology+fundamentals', type: 'youtube' }] },
  { id: 'q10', category: 'relation', title: '信頼構築の神経科学', desc: 'オキシトシンと信頼の関係を知る', keywords: ['信頼', 'オキシトシン', '関係性', 'コミュニティ'], links: [{ label: 'Trust & Oxytocin', url: 'https://www.youtube.com/results?search_query=trust+oxytocin+neuroscience', type: 'youtube' }] },
  { id: 'q11', category: 'relation', title: 'コミュニティ設計論', desc: '人が集まり続ける場の作り方', keywords: ['コミュニティ', '場づくり', 'エンゲージメント', '共感'], links: [{ label: 'Community Design', url: 'https://www.youtube.com/results?search_query=community+design+building+engagement', type: 'youtube' }] },
  // メンタル
  { id: 'q12', category: 'mental', title: 'ZONE状態の作り方', desc: '本番で最高のパフォーマンスを出す心の準備', keywords: ['ZONE', 'ルーティン', 'メンタル', 'アクティベーション'], links: [{ label: 'Peak Performance Mental Skills', url: 'https://www.youtube.com/results?search_query=peak+performance+mental+skills+athletes', type: 'youtube' }] },
  { id: 'q13', category: 'mental', title: '逆境からの立ち直り（レジリエンス）', desc: '失敗を燃料に変える思考回路を作る', keywords: ['レジリエンス', '回復力', '逆境', '成長マインドセット'], links: [{ label: 'Resilience Science', url: 'https://www.youtube.com/results?search_query=resilience+growth+mindset+science', type: 'youtube' }] },
  // スポーツ
  { id: 'q14', category: 'sport', title: 'セパタクロー技術体系', desc: '世界レベルの動きを分解して再現する', keywords: ['セパタクロー', '技術', '体幹', 'キック'], links: [{ label: 'Sepak Takraw Skills', url: 'https://www.youtube.com/results?search_query=sepak+takraw+technique+training', type: 'youtube' }] },
  { id: 'q15', category: 'sport', title: 'アスリートの思考パターン', desc: 'トップ選手は何を考えているのか', keywords: ['アスリート', '思考', 'メンタルモデル', 'エリート'], links: [{ label: 'Elite Athlete Mindset', url: 'https://www.youtube.com/results?search_query=elite+athlete+mindset+mental+skills', type: 'youtube' }] },
];

const LINK_ICON: Record<string, string> = { youtube: '▶', note: '📝', web: '🔗' };

export default function QuestBoard() {
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('quest-done') ?? '{}'); } catch { return {}; }
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    localStorage.setItem('quest-done', JSON.stringify(next));
  };

  const toPost = (q: Quest) => {
    setPostDraft(`【${CAT_META[q.category].label}】${q.title}\n\n${q.keywords.map(k => `#${k}`).join(' ')}`);
  };

  const filtered = filterCat ? QUESTS.filter(q => q.category === filterCat) : QUESTS;
  const doneCount = QUESTS.filter(q => done[q.id]).length;

  const s: Record<string, React.CSSProperties> = {
    progress: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '18px 20px', marginBottom: 24 },
    progressLabel: { fontSize: '0.8rem', color: '#7070a0', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: 8 },
    progressNum: { fontSize: '2rem', fontWeight: 800, color: '#F59E0B', lineHeight: 1, marginBottom: 10 },
    bar: { background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden' },
    barFill: { background: 'linear-gradient(90deg,#F59E0B,#D97706)', height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },
    filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 },
    filterPill: (id: string | null, active: boolean) => {
      const m = id ? CAT_META[id as keyof typeof CAT_META] : null;
      return { padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${active ? (m?.color ?? '#F59E0B') : 'rgba(255,255,255,0.1)'}`, background: active ? (m?.bg ?? 'rgba(245,158,11,0.1)') : 'none', color: active ? (m?.color ?? '#F59E0B') : '#7070a0', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 600 };
    },
    card: (q: Quest, exp: boolean) => ({
      background: '#12121f', border: `1px solid ${exp ? CAT_META[q.category].border : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden', opacity: done[q.id] ? 0.55 : 1, transition: 'opacity 0.2s, border-color 0.2s',
    }),
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', cursor: 'pointer', gap: 12 },
    catTag: (q: Quest) => ({ fontSize: '0.75rem', fontWeight: 700, color: CAT_META[q.category].color, background: CAT_META[q.category].bg, border: `1px solid ${CAT_META[q.category].border}`, borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap' as const }),
    cardTitle: { fontWeight: 700, fontSize: '1rem', flex: 1 },
    cardBody: { borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' },
    cardDesc: { fontSize: '0.9rem', color: '#a0a0c0', marginBottom: 14, lineHeight: 1.6 },
    linksRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 14 },
    link: (q: Quest) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: CAT_META[q.category].bg, border: `1px solid ${CAT_META[q.category].border}`, color: CAT_META[q.category].color, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }),
    actRow: { display: 'flex', gap: 8 },
    doneBtn: (d: boolean) => ({ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${d ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, background: d ? 'rgba(34,197,94,0.1)' : 'none', color: d ? '#22c55e' : '#7070a0', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 600 }),
    postBtn: { flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#F59E0B', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 600 },
    draft: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 },
    draftLabel: { fontSize: '0.8rem', color: '#7070a0', marginBottom: 8 },
    draftText: { fontFamily: 'inherit', width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e8f0', fontSize: '0.95rem', padding: '10px 12px', resize: 'vertical' as const },
    draftLink: { display: 'inline-block', marginTop: 10, color: '#F59E0B', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 },
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Progress */}
      <div style={s.progress}>
        <div style={s.progressLabel}>Quest Progress</div>
        <div style={s.progressNum}>{doneCount}<span style={{ fontSize: '1rem', color: '#7070a0', fontWeight: 400 }}> / {QUESTS.length}</span></div>
        <div style={s.bar}><div style={{ ...s.barFill, width: `${Math.round((doneCount / QUESTS.length) * 100)}%` }} /></div>
      </div>

      {/* Post draft */}
      {postDraft && (
        <div style={s.draft}>
          <div style={s.draftLabel}>📋 X投稿ドラフト</div>
          <textarea style={s.draftText} value={postDraft} onChange={e => setPostDraft(e.target.value)} rows={4} />
          <a href="/dashboard/post" style={s.draftLink}>→ X Command Centerで投稿する</a>
        </div>
      )}

      {/* Category filter */}
      <div style={s.filterRow}>
        <button style={s.filterPill(null, filterCat === null)} onClick={() => setFilterCat(null)}>すべて</button>
        {Object.entries(CAT_META).map(([id]) => (
          <button key={id} style={s.filterPill(id, filterCat === id)} onClick={() => setFilterCat(filterCat === id ? null : id)}>
            {CAT_META[id as keyof typeof CAT_META].label}
          </button>
        ))}
      </div>

      {/* Quest cards */}
      {filtered.map(q => {
        const exp = expanded === q.id;
        return (
          <div key={q.id} style={s.card(q, exp)}>
            <div style={s.cardHeader} onClick={() => setExpanded(exp ? null : q.id)}>
              <span style={s.catTag(q)}>{CAT_META[q.category].label}</span>
              <span style={s.cardTitle}>{done[q.id] ? '✅ ' : ''}{q.title}</span>
              <span style={{ color: '#7070a0', fontSize: '0.8rem' }}>{exp ? '▲' : '▼'}</span>
            </div>
            {exp && (
              <div style={s.cardBody}>
                <p style={s.cardDesc}>{q.desc}</p>
                <div style={s.linksRow}>
                  {q.links.map(l => (
                    <a key={l.url} href={l.url} target="_blank" rel="noopener" style={s.link(q)}>
                      {LINK_ICON[l.type]} {l.label}
                    </a>
                  ))}
                </div>
                <div style={s.actRow}>
                  <button style={s.doneBtn(!!done[q.id])} onClick={() => toggle(q.id)}>
                    {done[q.id] ? '✓ 完了済み' : '完了にする'}
                  </button>
                  <button style={s.postBtn} onClick={() => toPost(q)}>
                    ✍️ 投稿ネタにする
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
