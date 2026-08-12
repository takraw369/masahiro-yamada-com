import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────
interface Deck {
  id: string; name: string; description: string; color: string; sort_order: number;
}
interface Card {
  id: string; front: string; back: string; deck_id: string;
  tags: string | null; difficulty: string; next_review: string;
  review_count: number; ease_factor: number; interval_days: number; xp_total: number;
}

// ── Styles ─────────────────────────────────────────────────
const bg    = '#0a0a1a';
const surf  = '#12121f';
const bord  = 'rgba(255,255,255,0.08)';
const gold  = '#F59E0B';
const dim   = '#7070a0';
const text  = '#e8e8f0';
const em    = '#22c55e';
const rose  = '#EC4899';
const blue  = '#3B82F6';

const S = {
  wrap: { display:'flex', flexDirection:'column' as const, height:'calc(100vh - 58px)', background:bg, color:text, fontFamily:"'Inter','Noto Sans JP',sans-serif" },
  topBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:`1px solid ${bord}`, background:surf, flexShrink:0, gap:12, flexWrap:'wrap' as const },
  deckRow: { display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center' },
  deckBtn: (active: boolean, color: string) => ({
    padding:'6px 14px', borderRadius:20, border:`1px solid ${active ? color : bord}`,
    background: active ? color + '22' : 'transparent', color: active ? color : dim,
    cursor:'pointer', fontSize:'0.82rem', fontWeight: active ? 700 : 400, transition:'all 0.15s',
  }),
  modeBtn: (active: boolean) => ({
    padding:'5px 12px', borderRadius:6, border:`1px solid ${active ? gold : bord}`,
    background: active ? gold + '22' : 'transparent', color: active ? gold : dim,
    cursor:'pointer', fontSize:'0.78rem', transition:'all 0.15s',
  }),
  body: { flex:1, display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', padding:'20px 16px', gap:24, overflow:'hidden' },
  progress: { width:'100%', maxWidth:500, display:'flex', flexDirection:'column' as const, gap:6 },
  progressBar: { height:6, borderRadius:3, background:'rgba(255,255,255,0.08)' },
  progressFill: (pct: number) => ({ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${gold},${gold}cc)`, width:`${pct}%`, transition:'width 0.4s ease' }),
  progressMeta: { display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:dim },
  cardWrap: { perspective:1000, width:'100%', maxWidth:520, height:280 },
  cardInner: (flipped: boolean) => ({
    position:'relative' as const, width:'100%', height:'100%',
    transformStyle:'preserve-3d' as const,
    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
    transition:'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
  }),
  cardFace: (back?: boolean) => ({
    position:'absolute' as const, inset:0, borderRadius:16,
    border:`1px solid ${bord}`, background:surf,
    display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center',
    padding:'28px 32px', backfaceVisibility:'hidden' as const,
    transform: back ? 'rotateY(180deg)' : undefined,
    cursor:'pointer', userSelect:'none' as const,
    boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
  }),
  cardLabel: { fontSize:'0.72rem', color:dim, marginBottom:12, letterSpacing:'0.08em', textTransform:'uppercase' as const },
  cardText: { fontSize:'1.2rem', fontWeight:700, textAlign:'center' as const, lineHeight:1.5, color:text },
  cardBack: { fontSize:'0.95rem', textAlign:'center' as const, lineHeight:1.7, color:'#c0c0d8' },
  cardHint: { fontSize:'0.72rem', color:dim, marginTop:16 },
  ratingRow: { display:'flex', gap:12, width:'100%', maxWidth:520 },
  ratingBtn: (color: string) => ({
    flex:1, padding:'14px', borderRadius:12, border:`1px solid ${color}33`,
    background:`${color}11`, color, cursor:'pointer', fontSize:'0.88rem', fontWeight:700,
    textAlign:'center' as const, transition:'all 0.15s',
  }),
  xpToast: { position:'fixed' as const, top:80, right:24, background:surf, border:`1px solid ${gold}66`,
    color:gold, padding:'10px 18px', borderRadius:10, fontSize:'0.9rem', fontWeight:700,
    boxShadow:'0 4px 20px rgba(0,0,0,0.4)', pointerEvents:'none' as const, zIndex:100 },
  done: { textAlign:'center' as const, padding:32 },
  doneTitle: { fontSize:'1.4rem', fontWeight:800, color:gold, marginBottom:8 },
  doneBody: { color:dim, fontSize:'0.9rem', lineHeight:1.7 },
  newBtn: { padding:'10px 20px', borderRadius:8, border:`1px solid ${gold}`, background:`${gold}11`, color:gold, cursor:'pointer', fontSize:'0.88rem', fontWeight:700 },
  // new card modal
  overlay: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 },
  modal: { background:surf, border:`1px solid ${bord}`, borderRadius:16, padding:28, width:'100%', maxWidth:480, display:'flex', flexDirection:'column' as const, gap:14 },
  modalTitle: { fontSize:'1rem', fontWeight:800, color:gold },
  label: { fontSize:'0.78rem', color:dim, marginBottom:4, display:'block' },
  input: { width:'100%', background:'#0d0d20', border:`1px solid ${bord}`, borderRadius:8, color:text, padding:'9px 12px', fontSize:'0.88rem', outline:'none', resize:'vertical' as const, fontFamily:"inherit", boxSizing:'border-box' as const },
  select: { width:'100%', background:'#0d0d20', border:`1px solid ${bord}`, borderRadius:8, color:text, padding:'9px 12px', fontSize:'0.88rem', outline:'none', fontFamily:"inherit" },
  btnRow: { display:'flex', gap:10, justifyContent:'flex-end' },
  cancelBtn: { padding:'8px 16px', borderRadius:8, border:`1px solid ${bord}`, background:'transparent', color:dim, cursor:'pointer', fontSize:'0.85rem' },
  saveBtn: { padding:'8px 16px', borderRadius:8, border:`1px solid ${gold}`, background:`${gold}22`, color:gold, cursor:'pointer', fontSize:'0.85rem', fontWeight:700 },
  statsRow: { display:'flex', gap:16, fontSize:'0.78rem', color:dim },
  diffDot: (d: string) => ({ width:8, height:8, borderRadius:'50%', display:'inline-block', marginRight:4,
    background: d === 'easy' ? em : d === 'medium' ? gold : rose }),
};

// ── Component ──────────────────────────────────────────────
export default function FlashCards() {
  const [decks, setDecks]       = useState<Deck[]>([]);
  const [cards, setCards]       = useState<Card[]>([]);
  const [idx, setIdx]           = useState(0);
  const [flipped, setFlipped]   = useState(false);
  const [deckId, setDeckId]     = useState<string | null>(null);
  const [mode, setMode]         = useState<'today' | 'all'>('today');
  const [sessionXP, setSessionXP] = useState(0);
  const [xpToast, setXpToast]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack]   = useState('');
  const [newDeck, setNewDeck]   = useState('deck-ace');
  const [newTags, setNewTags]   = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ mode });
    if (deckId) p.set('deck', deckId);
    const res = await fetch(`/api/flashcards?${p}`);
    const data = await res.json() as { decks: Deck[]; cards: Card[] };
    setDecks(data.decks);
    setCards(data.cards);
    setIdx(0);
    setFlipped(false);
    setLoading(false);
  }, [deckId, mode]);

  useEffect(() => { load(); }, [load]);

  const card = cards[idx];
  const pct  = cards.length ? Math.round((idx / cards.length) * 100) : 0;

  const rate = async (rating: 'easy' | 'medium' | 'hard') => {
    if (!card) return;
    const res = await fetch('/api/flashcards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, rating }),
    });
    const { xp } = await res.json() as { xp: number };
    setSessionXP(s => s + xp);
    showXP(`+${xp} XP`);
    setFlipped(false);
    setTimeout(() => setIdx(i => i + 1), 160);
  };

  const showXP = (msg: string) => {
    setXpToast(msg);
    setTimeout(() => setXpToast(null), 1800);
  };

  const saveNew = async () => {
    if (!newFront.trim() || !newBack.trim()) return;
    setSaving(true);
    await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ front: newFront, back: newBack, deck_id: newDeck, tags: newTags }),
    });
    setSaving(false);
    setShowNew(false);
    setNewFront(''); setNewBack(''); setNewTags('');
    load();
  };

  const deck = decks.find(d => d.id === deckId);

  return (
    <div style={S.wrap}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.deckRow}>
          <button style={S.deckBtn(!deckId, gold)} onClick={() => setDeckId(null)}>全て</button>
          {decks.map(d => (
            <button key={d.id} style={S.deckBtn(deckId === d.id, d.color)}
              onClick={() => setDeckId(d.id)}>
              {d.name}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button style={S.modeBtn(mode === 'today')} onClick={() => setMode('today')}>今日のレビュー</button>
          <button style={S.modeBtn(mode === 'all')} onClick={() => setMode('all')}>全カード</button>
          <button style={{ ...S.newBtn, padding:'6px 14px', fontSize:'0.8rem' }} onClick={() => setShowNew(true)}>+ 新規</button>
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {loading ? (
          <div style={{ color:dim }}>読み込み中...</div>
        ) : cards.length === 0 ? (
          <div style={S.done}>
            <div style={S.doneTitle}>
              {mode === 'today' ? '今日のレビュー完了！' : 'カードがありません'}
            </div>
            <div style={S.doneBody}>
              {mode === 'today'
                ? `獲得XP: ${sessionXP} XP\n次のカードは明日以降に登場します。`
                : 'カードを追加してください。'}
            </div>
            {mode === 'today' && (
              <button style={{ ...S.newBtn, marginTop:20 }} onClick={() => setMode('all')}>全カードを見る</button>
            )}
          </div>
        ) : idx >= cards.length ? (
          <div style={S.done}>
            <div style={S.doneTitle}>セッション完了！</div>
            <div style={S.doneBody}>
              {`${cards.length}枚レビュー完了\n獲得XP: ${sessionXP} XP`}
            </div>
            <button style={{ ...S.newBtn, marginTop:20 }} onClick={() => { setIdx(0); setFlipped(false); setSessionXP(0); }}>もう一周</button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div style={S.progress}>
              <div style={S.statsRow}>
                <span>{idx + 1} / {cards.length}枚</span>
                <span style={{ color:gold }}>今日のXP: +{sessionXP}</span>
                {deck && <span style={{ color: deck.color }}>{deck.name}</span>}
              </div>
              <div style={S.progressBar}>
                <div style={S.progressFill(pct)} />
              </div>
              <div style={S.progressMeta}>
                <span>
                  <span style={S.diffDot(card.difficulty)} />
                  {card.difficulty === 'easy' ? '簡単' : card.difficulty === 'medium' ? '普通' : '難しい'} · {card.review_count}回レビュー
                </span>
                <span>次回: {card.next_review}</span>
              </div>
            </div>

            {/* Card */}
            <div style={S.cardWrap} onClick={() => setFlipped(f => !f)}>
              <div style={S.cardInner(flipped)}>
                {/* Front */}
                <div style={S.cardFace()}>
                  <div style={S.cardLabel}>表面</div>
                  <div style={S.cardText}>{card.front}</div>
                  {card.tags && <div style={{ ...S.cardHint, color:dim+'aa' }}>#{card.tags}</div>}
                  <div style={S.cardHint}>タップで裏面へ</div>
                </div>
                {/* Back */}
                <div style={S.cardFace(true)}>
                  <div style={S.cardLabel}>裏面</div>
                  <div style={S.cardBack}>{card.back}</div>
                  <div style={S.cardHint}>評価してください</div>
                </div>
              </div>
            </div>

            {/* Rating buttons — only show when flipped */}
            {flipped && (
              <div style={S.ratingRow}>
                <button style={S.ratingBtn(rose)} onClick={() => rate('hard')}>
                  😅 忘れてた<br /><span style={{ fontSize:'0.7rem', fontWeight:400 }}>+30XP · 翌日</span>
                </button>
                <button style={S.ratingBtn(gold)} onClick={() => rate('medium')}>
                  🤔 微妙<br /><span style={{ fontSize:'0.7rem', fontWeight:400 }}>+20XP</span>
                </button>
                <button style={S.ratingBtn(em)} onClick={() => rate('easy')}>
                  ✅ 知ってた<br /><span style={{ fontSize:'0.7rem', fontWeight:400 }}>+10XP · 7日後</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* XP Toast */}
      {xpToast && <div style={S.xpToast}>{xpToast}</div>}

      {/* New Card Modal */}
      {showNew && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div style={S.modal}>
            <div style={S.modalTitle}>新規カード作成</div>
            <div>
              <label style={S.label}>表面（用語・質問）</label>
              <textarea rows={2} style={S.input} value={newFront} onChange={e => setNewFront(e.target.value)} placeholder="例: 五蘊（パンチャ・カンダ）" />
            </div>
            <div>
              <label style={S.label}>裏面（定義・回答）</label>
              <textarea rows={4} style={S.input} value={newBack} onChange={e => setNewBack(e.target.value)} placeholder="例: 色・受・想・行・識の5層構造..." />
            </div>
            <div>
              <label style={S.label}>デッキ</label>
              <select style={S.select} value={newDeck} onChange={e => setNewDeck(e.target.value)}>
                {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>タグ（任意）</label>
              <input style={S.input} value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="例: 認知, 脳科学" />
            </div>
            <div style={S.btnRow}>
              <button style={S.cancelBtn} onClick={() => setShowNew(false)}>キャンセル</button>
              <button style={S.saveBtn} onClick={saveNew} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
