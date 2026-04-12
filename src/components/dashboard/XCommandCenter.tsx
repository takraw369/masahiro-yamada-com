import { useState, useEffect } from 'react';

const CATEGORIES = [
  {
    id: 'brain',
    label: '脳科学',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.35)',
    keywords: ['前頭前野', 'ドーパミン', '神経可塑性', '集中力', 'ADHD', '記憶定着', 'ワーキングメモリ', '睡眠と脳', 'フロー状態', '認知科学'],
  },
  {
    id: 'health',
    label: '健康',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
    keywords: ['呼吸法', '自律神経', 'パフォーマンス', '食事設計', '睡眠最適化', '体のリズム', '筋肉と脳', '回復力', 'バイオハック', 'コンディション'],
  },
  {
    id: 'relation',
    label: 'リレーション',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.35)',
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

  const s: Record<string, React.CSSProperties> = {
    section: { marginBottom: 28 },
    label: { fontSize: '0.82rem', color: '#7070a0', fontWeight: 600, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' },
    tabRow: { display: 'flex', gap: 8, marginBottom: 24 },
    tab: { flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 600, transition: 'all 0.15s' },
    catRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 },
    catPill: (c: typeof CATEGORIES[number], active: boolean) => ({
      padding: '7px 16px', borderRadius: 99, border: `1.5px solid ${active ? c.color : 'rgba(255,255,255,0.1)'}`,
      background: active ? c.bg : 'none', color: active ? c.color : '#7070a0',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.15s',
    }),
    kwRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16, padding: '12px 14px', background: cat?.bg ?? 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${cat?.border ?? 'rgba(255,255,255,0.06)'}` },
    kwChip: { padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: cat?.color ?? '#e8e8f0', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', transition: 'all 0.15s' },
    textarea: { width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e8e8f0', fontFamily: 'inherit', fontSize: '1rem', padding: '14px', resize: 'vertical' as const, outline: 'none', lineHeight: 1.6 },
    countRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 6, fontSize: '0.8rem', color: remaining < 20 ? '#ef4444' : '#7070a0' },
    modeRow: { display: 'flex', gap: 8, marginBottom: 16 },
    modeBtn: (active: boolean) => ({ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${active ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`, background: active ? 'rgba(245,158,11,0.1)' : 'none', color: active ? '#F59E0B' : '#7070a0', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600 }),
    dateInput: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e8f0', fontFamily: 'inherit', fontSize: '0.9rem', padding: '9px 12px', outline: 'none', marginBottom: 14 },
    postBtn: { width: '100%', padding: '13px 0', borderRadius: 10, background: 'linear-gradient(90deg,#F59E0B,#D97706)', border: 'none', color: '#0a0a1a', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.02em' },
    statusOk: { marginTop: 10, padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: '#22c55e', fontSize: '0.9rem' },
    statusErr: { marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: '0.9rem' },
    schedCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 },
    schedText: { fontSize: '0.95rem', marginBottom: 8, lineHeight: 1.5 },
    schedMeta: { fontSize: '0.8rem', color: '#7070a0' },
    acctSelect: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e8f0', fontFamily: 'inherit', fontSize: '0.9rem', padding: '9px 12px', width: '100%', outline: 'none', marginBottom: 16 },
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* tabs */}
      <div style={s.tabRow}>
        {(['compose', 'scheduled'] as const).map(t => (
          <button key={t} style={{ ...s.tab, color: tab === t ? '#F59E0B' : '#7070a0', borderColor: tab === t ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)', background: tab === t ? 'rgba(245,158,11,0.06)' : 'none' }} onClick={() => setTab(t)}>
            {t === 'compose' ? '✍️ 作成' : `📅 予約 (${scheduled.length})`}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <>
          {/* account */}
          {accounts.length > 1 && (
            <div style={s.section}>
              <label style={s.label}>アカウント</label>
              <select style={s.acctSelect} value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>@{a.username}</option>)}
              </select>
            </div>
          )}

          {/* category */}
          <div style={s.section}>
            <label style={s.label}>カテゴリ</label>
            <div style={s.catRow}>
              {CATEGORIES.map(c => (
                <button key={c.id} style={s.catPill(c, activeCat === c.id)} onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}>
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

          {/* compose */}
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

          {/* mode */}
          <div style={s.modeRow}>
            <button style={s.modeBtn(mode === 'now')} onClick={() => setMode('now')}>今すぐ投稿</button>
            <button style={s.modeBtn(mode === 'schedule')} onClick={() => setMode('schedule')}>予約投稿</button>
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
          {scheduled.length === 0 && <p style={{ color: '#7070a0', fontSize: '0.95rem' }}>予約投稿なし</p>}
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
