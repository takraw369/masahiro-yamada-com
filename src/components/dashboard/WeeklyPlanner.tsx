import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────
interface Template {
  id: string; title: string; category: string; color: string;
  estimated_minutes: number; default_time_slot: string | null;
  platforms: string | null; ai_templates: string | null; xp_multiplier: number;
}
interface Item {
  id: string; template_id: string | null; title: string; category: string | null;
  color: string | null; date: string; time_slot: string;
  estimated_minutes: number; platforms: string | null; content: string | null;
  image_memo: string | null; memo: string | null; status: string;
  platform_status: string | null; completed: number; xp_earned: number;
}
interface Streak {
  week_start: string; total_xp: number; target_xp: number;
  items_completed: number; items_total: number; content_posted: number;
}

// ── Constants ──────────────────────────────────────────────
const TIME_SLOTS = [
  { id: 'morning',   label: '朝',  sub: '6–9時' },
  { id: 'forenoon',  label: '午前', sub: '9–12時' },
  { id: 'afternoon', label: '午後', sub: '12–18時' },
  { id: 'evening',   label: '夜',  sub: '18–22時' },
];
const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日'];
const CAT_LABELS: Record<string, string> = {
  content: 'コンテンツ', ace_work: 'ACEワーク', business: 'ビジネス', life: '生活',
};
const STATUS_ICONS: Record<string, string> = {
  empty: '📋', draft: '✍️', ready: '✅', posted: '🚀', done: '⏭️',
};

// ── Styles ─────────────────────────────────────────────────
const bg   = '#0a0a1a';
const surf = '#12121f';
const bord = 'rgba(255,255,255,0.08)';
const gold = '#F59E0B';
const dim  = '#7070a0';
const txt  = '#e8e8f0';
const em   = '#22c55e';

function genId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function currentWeek() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekDates(week: string): string[] {
  const [year, w] = week.split('-W').map(Number);
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const weekStart = new Date(jan1);
  weekStart.setDate(jan1.getDate() + (w - 1) * 7 - dayOfWeek + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function shiftWeek(week: string, delta: number) {
  const [year, w] = week.split('-W').map(Number);
  let newW = w + delta;
  let newY = year;
  if (newW < 1) { newY--; newW = 52; }
  if (newW > 52) { newY++; newW = 1; }
  return `${newY}-W${String(newW).padStart(2, '0')}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

// ── Main Component ─────────────────────────────────────────
export default function WeeklyPlanner() {
  const [week, setWeek]         = useState(currentWeek);
  const [templates, setTmpl]    = useState<Template[]>([]);
  const [items, setItems]       = useState<Item[]>([]);
  const [streak, setStreak]     = useState<Streak | null>(null);
  const [dragTmpl, setDragTmpl] = useState<Template | null>(null);
  const [dragItem, setDragItem] = useState<Item | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [loading, setLoading]   = useState(true);
  const [confetti, setConfetti] = useState<string[]>([]);
  const dates = weekDates(week);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/schedule?week=${week}`);
    const data = await res.json() as { templates: Template[]; items: Item[]; streak: Streak | null };
    setTmpl(data.templates);
    setItems(data.items);
    setStreak(data.streak);
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);

  const cellKey = (date: string, slot: string) => `${date}__${slot}`;
  const cellItems = (date: string, slot: string) => items.filter(i => i.date === date && i.time_slot === slot);

  // ── Drag from template ──────────────────────────────────
  const onTmplDragStart = (t: Template) => setDragTmpl(t);
  const onTmplDragEnd   = () => { setDragTmpl(null); setDragOver(null); };

  // ── Drag from existing item (move) ──────────────────────
  const onItemDragStart = (item: Item) => setDragItem(item);
  const onItemDragEnd   = () => { setDragItem(null); setDragOver(null); };

  // ── Drop on cell ────────────────────────────────────────
  const onDrop = async (date: string, slot: string) => {
    setDragOver(null);
    if (dragTmpl) {
      const id = genId();
      const newItem: Item = {
        id, template_id: dragTmpl.id, title: dragTmpl.title, category: dragTmpl.category,
        color: dragTmpl.color, date, time_slot: slot,
        estimated_minutes: dragTmpl.estimated_minutes,
        platforms: dragTmpl.platforms, content: null, image_memo: null, memo: null,
        status: 'empty', platform_status: null, completed: 0, xp_earned: 0,
      };
      setItems(prev => [...prev, newItem]);
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, template_id: dragTmpl.id, title: dragTmpl.title, category: dragTmpl.category, color: dragTmpl.color, date, time_slot: slot, estimated_minutes: dragTmpl.estimated_minutes, platforms: dragTmpl.platforms }),
      });
      setDragTmpl(null);
    } else if (dragItem && (dragItem.date !== date || dragItem.time_slot !== slot)) {
      setItems(prev => prev.map(i => i.id === dragItem.id ? { ...i, date, time_slot: slot } : i));
      await fetch('/api/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dragItem.id, date, time_slot: slot }),
      });
      setDragItem(null);
    }
  };

  // ── Delete item ─────────────────────────────────────────
  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch('/api/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  // ── Complete item ────────────────────────────────────────
  const completeItem = async (item: Item) => {
    const newCompleted = !item.completed;
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, completed: newCompleted ? 1 : 0, status: newCompleted ? 'done' : 'empty' }
      : i
    ));
    const res = await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, completed: newCompleted, status: newCompleted ? 'done' : 'empty' }),
    });
    if (newCompleted) {
      const { xp } = await res.json() as { xp: number };
      if (xp > 0) {
        const eid = genId();
        setConfetti(prev => [...prev, eid]);
        setTimeout(() => setConfetti(prev => prev.filter(e => e !== eid)), 1000);
        setStreak(prev => prev ? { ...prev, total_xp: prev.total_xp + xp, items_completed: prev.items_completed + 1 } : prev);
      }
    }
  };

  // ── Save edit modal ──────────────────────────────────────
  const saveEdit = async (updated: Partial<Item>) => {
    if (!editItem) return;
    setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...updated } : i));
    setEditItem(null);
    await fetch('/api/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editItem.id, ...updated }),
    });
  };

  const xpPct = streak ? Math.min(100, Math.round((streak.total_xp / streak.target_xp) * 100)) : 0;
  const catGroups = ['content', 'ace_work', 'business', 'life'];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 58px)', background:bg, color:txt, fontFamily:"'Inter','Noto Sans JP',sans-serif", overflow:'hidden' }}>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:`1px solid ${bord}`, background:surf, flexShrink:0, gap:12, flexWrap:'wrap' }}>
        {/* XP Bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:240 }}>
          <span style={{ fontSize:'0.78rem', color:dim }}>週間XP</span>
          <div style={{ flex:1, minWidth:120, height:6, borderRadius:3, background:'rgba(255,255,255,0.08)' }}>
            <div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${gold},${gold}cc)`, width:`${xpPct}%`, transition:'width 0.4s' }} />
          </div>
          <span style={{ fontSize:'0.82rem', color:gold, fontWeight:700 }}>{streak?.total_xp ?? 0}/{streak?.target_xp ?? 500}</span>
        </div>
        {/* Week nav */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => setWeek(shiftWeek(week, -1))} style={{ background:'none', border:`1px solid ${bord}`, color:txt, borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:'0.9rem' }}>←</button>
          <span style={{ fontSize:'0.85rem', color:dim, minWidth:90, textAlign:'center' }}>{week}</span>
          <button onClick={() => setWeek(shiftWeek(week, 1))} style={{ background:'none', border:`1px solid ${bord}`, color:txt, borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:'0.9rem' }}>→</button>
          <button onClick={() => setWeek(currentWeek())} style={{ background:`${gold}11`, border:`1px solid ${gold}44`, color:gold, borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:'0.78rem' }}>今週</button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Left: Card Deck */}
        <div style={{ width:200, borderRight:`1px solid ${bord}`, background:surf, display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>
          <div style={{ padding:'10px 12px', borderBottom:`1px solid ${bord}`, fontSize:'0.72rem', color:dim, letterSpacing:'0.06em', textTransform:'uppercase' }}>CARD DECK</div>
          {catGroups.map(cat => (
            <div key={cat}>
              <div style={{ padding:'8px 12px 4px', fontSize:'0.68rem', color:dim, letterSpacing:'0.05em' }}>{CAT_LABELS[cat]}</div>
              {templates.filter(t => t.category === cat).map(t => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => onTmplDragStart(t)}
                  onDragEnd={onTmplDragEnd}
                  style={{
                    margin:'2px 8px', padding:'7px 10px', borderRadius:8,
                    borderLeft:`3px solid ${t.color}`, background:`${t.color}11`,
                    cursor:'grab', fontSize:'0.78rem', fontWeight:600, color:txt,
                    userSelect:'none', transition:'transform 0.1s, box-shadow 0.1s',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow=`0 3px 10px ${t.color}33`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}
                >
                  <span>{t.title}</span>
                  <span style={{ fontSize:'0.65rem', color:dim }}>{t.estimated_minutes}分</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right: Calendar */}
        <div style={{ flex:1, overflowX:'auto', overflowY:'auto' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:dim }}>読み込み中...</div>
          ) : (
            <table style={{ borderCollapse:'collapse', width:'100%', minWidth:700, tableLayout:'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width:64, padding:'8px 6px', borderBottom:`1px solid ${bord}`, fontSize:'0.7rem', color:dim, textAlign:'center', position:'sticky', top:0, background:surf, zIndex:5 }}>時間</th>
                  {dates.map((date, i) => (
                    <th key={date} style={{
                      padding:'8px 4px', borderBottom:`1px solid ${bord}`,
                      fontSize:'0.78rem', textAlign:'center',
                      background: isToday(date) ? `${gold}11` : surf,
                      color: isToday(date) ? gold : txt,
                      fontWeight: isToday(date) ? 800 : 600,
                      position:'sticky', top:0, zIndex:5,
                      borderBottom: isToday(date) ? `2px solid ${gold}` : `1px solid ${bord}`,
                    }}>
                      <div>{DAYS_JP[i]}</div>
                      <div style={{ fontSize:'0.65rem', color: isToday(date) ? gold : dim }}>{formatDate(date)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot.id}>
                    <td style={{ padding:'6px 4px', borderBottom:`1px solid ${bord}`, verticalAlign:'top', textAlign:'center', fontSize:'0.7rem', color:dim, lineHeight:1.3 }}>
                      <div style={{ fontWeight:600 }}>{slot.label}</div>
                      <div style={{ fontSize:'0.58rem' }}>{slot.sub}</div>
                    </td>
                    {dates.map(date => {
                      const key = cellKey(date, slot.id);
                      const cellItms = cellItems(date, slot.id);
                      const isOver = dragOver === key;
                      return (
                        <td
                          key={date}
                          style={{
                            padding:'4px 3px', borderBottom:`1px solid ${bord}`,
                            borderLeft:`1px solid ${bord}`, verticalAlign:'top',
                            minHeight:60, background: isOver ? `${gold}11` : isToday(date) ? `${gold}06` : 'transparent',
                            transition:'background 0.15s',
                          }}
                          onDragOver={e => { e.preventDefault(); setDragOver(key); }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={() => onDrop(date, slot.id)}
                        >
                          {cellItms.length === 0 ? (
                            <div style={{
                              height:54, border:`1px dashed ${isOver ? gold : bord}`,
                              borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                              color: isOver ? gold : 'transparent', fontSize:'0.7rem', cursor:'pointer',
                              transition:'all 0.15s',
                            }}
                              onClick={() => {/* could open picker */}}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=dim; (e.currentTarget as HTMLElement).style.color=dim; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=isOver?gold:bord; (e.currentTarget as HTMLElement).style.color=isOver?gold:'transparent'; }}
                            >+</div>
                          ) : (
                            cellItms.map(item => (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={() => onItemDragStart(item)}
                                onDragEnd={onItemDragEnd}
                                style={{
                                  marginBottom:3, padding:'5px 7px', borderRadius:6,
                                  borderLeft:`3px solid ${item.color ?? gold}`,
                                  background:`${item.color ?? gold}11`,
                                  cursor:'grab', fontSize:'0.72rem',
                                  opacity: item.completed ? 0.45 : 1,
                                  textDecoration: item.completed ? 'line-through' : 'none',
                                  userSelect:'none',
                                }}
                                onClick={() => setEditItem(item)}
                              >
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                                  <span style={{ fontWeight:600, color:txt, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{item.title}</span>
                                  <span style={{ fontSize:'0.65rem', flexShrink:0 }}>{STATUS_ICONS[item.status] ?? '📋'}</span>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                                  <span style={{ color:dim, fontSize:'0.65rem' }}>{item.estimated_minutes}分</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); completeItem(item); }}
                                    style={{ background:'none', border:'none', cursor:'pointer', color: item.completed ? em : dim, fontSize:'0.72rem', padding:0 }}
                                  >{item.completed ? '✅' : '○'}</button>
                                </div>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confetti */}
      {confetti.map(id => (
        <div key={id} style={{ position:'fixed', top:'40%', left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:999, animation:'confetti 0.8s ease-out forwards' }}>
          <span style={{ fontSize:'1.5rem' }}>✨</span>
        </div>
      ))}

      {/* Edit Modal */}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={saveEdit}
          onDelete={async () => { await deleteItem(editItem.id); setEditItem(null); }}
          onComplete={() => { completeItem(editItem); setEditItem(null); }}
        />
      )}

      <style>{`@keyframes confetti { from { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } to { opacity:0; transform:translateX(-50%) translateY(-60px) scale(1.5); } }`}</style>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────
function EditModal({ item, onClose, onSave, onDelete, onComplete }: {
  item: Item;
  onClose: () => void;
  onSave: (u: Partial<Item>) => void;
  onDelete: () => void;
  onComplete: () => void;
}) {
  const [content, setContent]     = useState(item.content ?? '');
  const [imageMemo, setImageMemo] = useState(item.image_memo ?? '');
  const [memo, setMemo]           = useState(item.memo ?? '');
  const [status, setStatus]       = useState(item.status);

  const surf2 = '#1a1a2e';
  const inp: React.CSSProperties = {
    width:'100%', background:'#0d0d20', border:`1px solid rgba(255,255,255,0.1)`,
    borderRadius:8, color:txt, padding:'9px 12px', fontSize:'0.85rem',
    outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box',
  };

  const xPlatforms = item.platforms ? JSON.parse(item.platforms) as string[] : [];
  const charCount = content.length;
  const xPlatform = xPlatforms.includes('x');

  const copyAndOpen = (platform: string) => {
    navigator.clipboard.writeText(content);
    const urls: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`,
    };
    if (urls[platform]) window.open(urls[platform], '_blank');
  };

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background:surf2, border:`1px solid rgba(255,255,255,0.1)`, borderRadius:16, padding:24, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'0.78rem', color:dim }}>編集</div>
            <div style={{ fontSize:'1rem', fontWeight:800, color:item.color ?? gold }}>{item.title}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:dim, cursor:'pointer', fontSize:'1.2rem' }}>×</button>
        </div>

        {/* Status */}
        <div>
          <div style={{ fontSize:'0.72rem', color:dim, marginBottom:6 }}>ステータス</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {Object.entries(STATUS_ICONS).map(([k, v]) => (
              <button key={k} onClick={() => setStatus(k)} style={{
                padding:'5px 10px', borderRadius:6, fontSize:'0.75rem', cursor:'pointer',
                border:`1px solid ${status === k ? gold : 'rgba(255,255,255,0.1)'}`,
                background: status === k ? `${gold}22` : 'transparent', color: status === k ? gold : dim,
              }}>{v} {k}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:'0.72rem', color:dim }}>コンテンツ</span>
            {xPlatform && <span style={{ fontSize:'0.7rem', color: charCount > 280 ? '#EC4899' : dim }}>{charCount}/280</span>}
          </div>
          <textarea rows={6} style={inp} value={content} onChange={e => setContent(e.target.value)} placeholder="投稿テキストをここに書く..." />
        </div>

        {/* Image memo */}
        <div>
          <div style={{ fontSize:'0.72rem', color:dim, marginBottom:4 }}>画像メモ</div>
          <textarea rows={2} style={inp} value={imageMemo} onChange={e => setImageMemo(e.target.value)} placeholder="サムネイル案・画像イメージを記述" />
        </div>

        {/* Private memo */}
        <div>
          <div style={{ fontSize:'0.72rem', color:dim, marginBottom:4 }}>メモ（非公開）</div>
          <textarea rows={2} style={inp} value={memo} onChange={e => setMemo(e.target.value)} placeholder="自分用の補足。公開されない" />
        </div>

        {/* Quick links */}
        {content && (
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:'0.72rem', color:dim, marginBottom:8 }}>投稿先クイックリンク</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => navigator.clipboard.writeText(content)} style={{ padding:'6px 12px', borderRadius:6, border:`1px solid rgba(255,255,255,0.1)`, background:'transparent', color:txt, cursor:'pointer', fontSize:'0.78rem' }}>📋 コピー</button>
              {xPlatforms.includes('x') && <button onClick={() => copyAndOpen('x')} style={{ padding:'6px 12px', borderRadius:6, border:`1px solid #1DA1F2aa`, background:'rgba(29,161,242,0.1)', color:'#1DA1F2', cursor:'pointer', fontSize:'0.78rem' }}>𝕏 Xで開く</button>}
              {xPlatforms.includes('instagram') && <button style={{ padding:'6px 12px', borderRadius:6, border:`1px solid rgba(255,255,255,0.1)`, background:'transparent', color:dim, cursor:'pointer', fontSize:'0.78rem' }}>📸 IGコピー</button>}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingTop:4 }}>
          <button onClick={onDelete} style={{ padding:'8px 14px', borderRadius:8, border:`1px solid rgba(236,72,153,0.4)`, background:'rgba(236,72,153,0.1)', color:'#EC4899', cursor:'pointer', fontSize:'0.82rem' }}>🗑 削除</button>
          <div style={{ flex:1 }} />
          <button onClick={onComplete} style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${em}66`, background:`${em}11`, color:em, cursor:'pointer', fontSize:'0.82rem' }}>
            {item.completed ? '完了解除' : '⏭️ 完了'}
          </button>
          <button
            onClick={() => onSave({ content, image_memo: imageMemo, memo, status })}
            style={{ padding:'8px 18px', borderRadius:8, border:`1px solid ${gold}`, background:`${gold}22`, color:gold, cursor:'pointer', fontSize:'0.82rem', fontWeight:700 }}
          >💾 保存</button>
        </div>
      </div>
    </div>
  );
}
