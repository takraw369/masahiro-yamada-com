import { useState, useEffect } from 'react';

const CATEGORIES = [
  {
    id: 'brain',
    label: '脳科学',
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.24)',
    keywords: ['前頭前野', 'ドーパミン', '神経可塑性', '集中力', 'ADHD', '記憶定着', 'ワーキングメモリ', '睡眠と脳', 'フロー状態', '認知科学'],
  },
  {
    id: 'health',
    label: '健康',
    color: '#15803D',
    bg: 'rgba(21,128,61,0.08)',
    border: 'rgba(21,128,61,0.24)',
    keywords: ['呼吸法', '自律神経', 'パフォーマンス', '食事設計', '睡眠最適化', '体のリズム', '筋肉と脳', '回復力', 'バイオハック', 'コンディション'],
  },
  {
    id: 'relation',
    label: 'リレーション',
    color: '#BE185D',
    bg: 'rgba(190,24,93,0.08)',
    border: 'rgba(190,24,93,0.24)',
    keywords: ['コーチング', '信頼構築', '心理的安全性', 'コミュニティ', '選手との関係', '傾聴力', '影響力', 'チーム設計', '共感', 'メンター'],
  },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

interface XAccount {
  id: string;
  username: string;
  isActive: boolean;
}

interface ScheduledPost {
  id: string;
  xAccountId: string;
  text: string;
  scheduledAt: string;
  status: string;
}

const MAX_CHARS = 280;

export default function XCommandCenter() {
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [activeCat, setActiveCat] = useState<CategoryId | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [status, setStatus] = useState<'idle' | 'posting' | 'ok' | 'err'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [tab, setTab] = useState<'compose' | 'scheduled'>('compose');

  useEffect(() => {
    fetch('/api/x-harness/x-accounts')
      .then(r => r.json() as Promise<{ data: XAccount[] }>)
      .then(d => {
        const active = (d.data ?? []).filter(a => a.isActive);
        setAccounts(active);
        if (active.length > 0) setSelectedAccount(active[0].id);
      })
      .catch(() => {});
    loadScheduled();
  }, []);

  const loadScheduled = () => {
    fetch('/api/x-harness/posts/scheduled')
      .then(r => r.json() as Promise<{ data: ScheduledPost[] }>)
      .then(d => setScheduled(d.data ?? []))
      .catch(() => {});
  };

  const insertKeyword = (kw: string) => {
    setText(prev => prev ? `${prev} #${kw}` : `#${kw}`);
  };

  const handlePost = async () => {
    if (!text.trim() || !selectedAccount) return;
    setStatus('posting');
    try {
      if (mode === 'now') {
        const res = await fetch('/api/x-harness/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xAccountId: selectedAccount, text }),
        });
        const json = await res.json() as { success: boolean; error?: string };
        if (json.success) {
          setStatus('ok'); setStatusMsg('投稿しました'); setText('');
        } else {
          setStatus('err'); setStatusMsg(json.error ?? 'エラー');
        }
      } else {
        if (!scheduledAt) { setStatus('err'); setStatusMsg('日時を選択してください'); return; }
        const res = await fetch('/api/x-harness/posts/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xAccountId: selectedAccount, text, scheduledAt }),
        });
        const json = await res.json() as { success: boolean; error?: string };
        if (json.success) {
          setStatus('ok'); setStatusMsg('スケジュールしました'); setText(''); loadScheduled();
        } else {
          setStatus('err'); setStatusMsg(json.error ?? 'エラー');
        }
      }
    } catch (e) {
      setStatus('err'); setStatusMsg(String(e));
    }
    setTimeout(() => setStatus('idle'), 3000);
  };

  const cat = CATEGORIES.find(c => c.id === activeCat);
  const remaining = MAX_CHARS - text.length;
  const ink = '#25211d';
  const muted = '#736b61';
  const border = 'rgba(37,33,29,0.13)';
  const surface = '#ffffff';
  const soft = '#f8f6f2';
  const gold = '#9a6d24';

  const catPillStyle = (c: typeof CATEGORIES[number], active: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: 99,
    border: `1.5px solid ${active ? c.color : border}`,
    background: active ? c.bg : surface,
    color: active ? c.color : muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    fontWeight: 700,
    transition: 'all 0.15s',
  });

  const modeBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '9px 0',
    borderRadius: 8,
    border: `1.5px solid ${active ? 'rgba(154,109,36,0.42)' : border}`,
    background: active ? 'rgba(154,109,36,0.08)' : surface,
    color: active ? gold : muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    fontWeight: 700,
  });

  const s: Record<string, React.CSSProperties> = {
    section: { marginBottom: 28 },
    label: { fontSize: '0.78rem', color: muted, fontWeight: 700, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' },
    tabRow: { display: 'flex', gap: 8, marginBottom: 24 },
    tab: { flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${border}`, background: surface, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem', fontWeight: 700, transition: 'all 0.15s' },
    catRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
    kwRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', background: cat?.bg ?? soft, borderRadius: 10, border: `1px solid ${cat?.border ?? border}` },
    kwChip: { padding: '4px 10px', borderRadius: 99, background: surface, border: `1px solid ${border}`, color: cat?.color ?? ink, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', transition: 'all 0.15s' },
    textarea: { width: '100%', minHeight: 140, background: surface, border: `1px solid ${border}`, borderRadius: 12, color: ink, fontFamily: 'inherit', fontSize: '1rem', padding: '14px', resize: 'vertical', outline: 'none', lineHeight: 1.7, boxShadow: '0 1px 2px rgba(37,33,29,0.03)' },
    countRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 6, fontSize: '0.78rem', color: remaining < 20 ? '#b91c1c' : muted },
    modeRow: { display: 'flex', gap: 8, marginBottom: 16 },
    dateInput: { width: '100%', background: surface, border: `1px solid ${border}`, borderRadius: 8, color: ink, fontFamily: 'inherit', fontSize: '0.9rem', padding: '9px 12px', outline: 'none', marginBottom: 14 },
    postBtn: { width: '100%', padding: '13px 0', borderRadius: 10, background: '#b4863b', border: '1px solid #9a6d24', color: '#1f1a14', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.02em' },
    statusOk: { marginTop: 10, padding: '10px 14px', background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)', borderRadius: 8, color: '#166534', fontSize: '0.88rem' },
    statusErr: { marginTop: 10, padding: '10px 14px', background: 'rgba(185,28,28,0.07)', border: '1px solid rgba(185,28,28,0.18)', borderRadius: 8, color: '#991b1b', fontSize: '0.88rem' },
    schedCard: { background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 2px rgba(37,33,29,0.03)' },
    schedText: { fontSize: '0.95rem', marginBottom: 8, lineHeight: 1.6, color: ink },
    schedMeta: { fontSize: '0.78rem', color: muted },
    acctSelect: { background: surface, border: `1px solid ${border}`, borderRadius: 8, color: ink, fontFamily: 'inherit', fontSize: '0.9rem', padding: '9px 12px', width: '100%', outline: 'none', marginBottom: 16 },
  };

  return (
    <div style={{ paddingBottom: 40, color: ink }}>
      <div style={s.tabRow}>
        {(['compose', 'scheduled'] as const).map(t => (
          <button key={t} style={{ ...s.tab, color: tab === t ? gold : muted, borderColor: tab === t ? 'rgba(154,109,36,0.38)' : border, background: tab === t ? 'rgba(154,109,36,0.07)' : surface }} onClick={() => setTab(t)}>
            {t === 'compose' ? '✍️ 作成' : `📅 予約 (${scheduled.length})`}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <>
          {accounts.length > 1 && (
            <div style={s.section}>
              <label style={s.label}>アカウント</label>
              <select style={s.acctSelect} value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>@{a.username}</option>)}
              </select>
            </div>
          )}

          <div style={s.section}>
            <label style={s.label}>カテゴリ</label>
            <div style={s.catRow}>
              {CATEGORIES.map(c => (
                <button key={c.id} style={catPillStyle(c, activeCat === c.id)} onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            {cat && (
              <div style={s.kwRow}>
                {cat.keywords.map(kw => (
                  <button key={kw} style={s.kwChip} onClick={() => insertKeyword(kw)}>#{kw}</button>
                ))}
              </div>
            )}
          </div>

          <div style={s.section}>
            <label style={s.label}>本文</label>
            <textarea
              style={s.textarea}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="今日の気づきをシェアする…"
              maxLength={MAX_CHARS}
            />
            <div style={s.countRow}>{remaining}</div>
          </div>

          <div style={s.modeRow}>
            <button style={modeBtnStyle(mode === 'now')} onClick={() => setMode('now')}>今すぐ投稿</button>
            <button style={modeBtnStyle(mode === 'schedule')} onClick={() => setMode('schedule')}>予約投稿</button>
          </div>

          {mode === 'schedule' && (
            <input type="datetime-local" style={s.dateInput} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          )}

          <button style={s.postBtn} onClick={handlePost} disabled={status === 'posting' || !text.trim()}>
            {status === 'posting' ? '送信中…' : mode === 'now' ? '投稿する' : '予約する'}
          </button>

          {status === 'ok' && <div style={s.statusOk}>✓ {statusMsg}</div>}
          {status === 'err' && <div style={s.statusErr}>✗ {statusMsg}</div>}
        </>
      )}

      {tab === 'scheduled' && (
        <>
          {scheduled.length === 0 && <p style={{ color: muted, fontSize: '0.95rem' }}>予約投稿なし</p>}
          {scheduled.map(p => (
            <div key={p.id} style={s.schedCard}>
              <div style={s.schedText}>{p.text}</div>
              <div style={s.schedMeta}>
                📅 {new Date(p.scheduledAt).toLocaleString('ja-JP')} · {p.status}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}