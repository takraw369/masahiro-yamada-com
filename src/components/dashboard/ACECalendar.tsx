import { useState, useEffect } from 'react';

interface Slot {
  id: string;
  label: string;
  xp: number;
}

interface Week {
  id: string;
  label: string;
  slots: Slot[];
}

interface CheckedState {
  [slotId: string]: boolean;
}

const WEEKS: Week[] = [
  {
    id: 'w1',
    label: 'Week 1 — 基礎調律',
    slots: [
      { id: 'w1s1', label: '朝の呼吸ルーティン', xp: 10 },
      { id: 'w1s2', label: '神経系アクティベーション', xp: 15 },
      { id: 'w1s3', label: 'ZONEジャーナル記入', xp: 10 },
      { id: 'w1s4', label: '夜の振り返り', xp: 5 },
    ],
  },
  {
    id: 'w2',
    label: 'Week 2 — 脳調律',
    slots: [
      { id: 'w2s1', label: '視覚フォーカストレーニング', xp: 15 },
      { id: 'w2s2', label: '前庭覚エクサ', xp: 15 },
      { id: 'w2s3', label: 'ノイズキャンセルセッション', xp: 10 },
      { id: 'w2s4', label: '集中記録', xp: 5 },
    ],
  },
  {
    id: 'w3',
    label: 'Week 3 — 体調律',
    slots: [
      { id: 'w3s1', label: 'バイオメカニクスチェック', xp: 15 },
      { id: 'w3s2', label: '呼吸×姿勢リセット', xp: 10 },
      { id: 'w3s3', label: 'パフォーマンス動作', xp: 20 },
      { id: 'w3s4', label: 'コンディション記録', xp: 5 },
    ],
  },
  {
    id: 'w4',
    label: 'Week 4 — 精神調律',
    slots: [
      { id: 'w4s1', label: 'Core Values接続', xp: 20 },
      { id: 'w4s2', label: '儀式プロトコル設計', xp: 20 },
      { id: 'w4s3', label: 'ビジョンボード更新', xp: 15 },
      { id: 'w4s4', label: 'ZONE入室テスト', xp: 25 },
    ],
  },
  {
    id: 'w5',
    label: 'Week 5 — 統合',
    slots: [
      { id: 'w5s1', label: '全調律レビュー', xp: 20 },
      { id: 'w5s2', label: '本番シミュレーション', xp: 30 },
      { id: 'w5s3', label: 'メンター報告', xp: 15 },
      { id: 'w5s4', label: 'ACE証明書受領', xp: 50 },
    ],
  },
];

const TOTAL_XP = WEEKS.flatMap((w) => w.slots).reduce((a, s) => a + s.xp, 0);
const ALL_SLOTS = WEEKS.flatMap((w) => w.slots);

export default function ACECalendar() {
  const [checked, setChecked] = useState<CheckedState>({});
  const [openWeek, setOpenWeek] = useState<string | null>('w1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/state')
      .then((r) => r.json())
      .then((data: { checked: CheckedState }) => {
        if (data.checked) setChecked(data.checked);
      })
      .catch(() => {
        const saved = localStorage.getItem('ace-dashboard-state');
        if (saved) setChecked(JSON.parse(saved));
      });
  }, []);

  const toggleSlot = async (slotId: string, xp: number) => {
    const next = { ...checked, [slotId]: !checked[slotId] };
    setChecked(next);
    localStorage.setItem('ace-dashboard-state', JSON.stringify(next));
    setSaving(true);
    try {
      await fetch('/api/dashboard/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, checked: next[slotId], xp }),
      });
    } finally {
      setSaving(false);
    }
  };

  const earnedXP = Object.entries(checked)
    .filter(([, v]) => v)
    .reduce((a, [id]) => a + (ALL_SLOTS.find((s) => s.id === id)?.xp ?? 0), 0);

  const progressPct = Math.round((earnedXP / TOTAL_XP) * 100);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* XP Header */}
      <div style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 14,
        padding: '20px 20px 16px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: '0.72rem', color: '#7070a0', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            Total XP
          </span>
          {saving && <span style={{ fontSize: '0.7rem', color: '#7070a0' }}>saving…</span>}
        </div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F59E0B', lineHeight: 1, marginBottom: 10 }}>
          {earnedXP}
          <span style={{ fontSize: '1rem', fontWeight: 400, color: '#7070a0', marginLeft: 6 }}>
            / {TOTAL_XP} XP
          </span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(90deg, #F59E0B, #D97706)',
            height: '100%',
            width: `${progressPct}%`,
            borderRadius: 99,
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#7070a0', marginTop: 6, textAlign: 'right' as const }}>
          {progressPct}% complete
        </div>
      </div>

      {/* Weeks */}
      {WEEKS.map((week) => {
        const weekXP = week.slots.reduce((a, s) => a + s.xp, 0);
        const weekEarned = week.slots.filter((s) => checked[s.id]).reduce((a, s) => a + s.xp, 0);
        const weekDone = week.slots.filter((s) => checked[s.id]).length;
        const isOpen = openWeek === week.id;
        const allDone = weekDone === week.slots.length;

        return (
          <div key={week.id} style={{
            background: '#12121f',
            border: `1px solid ${isOpen ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 14,
            marginBottom: 12,
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setOpenWeek(isOpen ? null : week.id)}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 18px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', color: '#e8e8f0', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>{allDone ? '✅' : '○'}</span>
                <div style={{ textAlign: 'left' as const }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{week.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#7070a0', marginTop: 2 }}>
                    {weekDone}/{week.slots.length} 完了 · {weekEarned}/{weekXP} XP
                  </div>
                </div>
              </div>
              <span style={{
                color: '#7070a0', fontSize: '0.8rem',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s', display: 'inline-block',
              }}>▼</span>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
                {week.slots.map((slot) => {
                  const done = !!checked[slot.id];
                  return (
                    <button
                      key={slot.id}
                      onClick={() => toggleSlot(slot.id, slot.xp)}
                      style={{
                        width: '100%', background: done ? 'rgba(245,158,11,0.06)' : 'none',
                        border: 'none', cursor: 'pointer', padding: '13px 18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        color: done ? '#F59E0B' : '#a0a0c0', fontFamily: 'inherit',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6,
                          border: `2px solid ${done ? '#F59E0B' : 'rgba(255,255,255,0.15)'}`,
                          background: done ? '#F59E0B' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', color: done ? '#0a0a1a' : 'transparent',
                          flexShrink: 0, transition: 'all 0.15s',
                        }}>✓</span>
                        <span style={{
                          fontSize: '0.9rem',
                          textDecoration: done ? 'line-through' : 'none',
                          textAlign: 'left' as const,
                        }}>{slot.label}</span>
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700,
                        color: done ? '#F59E0B' : '#7070a0',
                        flexShrink: 0, marginLeft: 8,
                      }}>+{slot.xp} XP</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
