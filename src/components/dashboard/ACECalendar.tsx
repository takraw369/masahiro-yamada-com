import { useState, useRef } from 'react';

// ── Types ──────────────────────────────────────────────
interface Task {
  id: string;
  label: string;
  xp: number;
  done: boolean;
}
interface Theme {
  id: string;
  label: string;
  color: string;
  tasks: Task[];
}

// ── Defaults ──────────────────────────────────────────
const COLORS = ['#3B82F6','#22c55e','#A78BFA','#F59E0B','#EC4899','#F97316'];

const DEFAULT_6: Theme[] = [
  { id:'t1', label:'🧠 脳', color:'#3B82F6', tasks:[
    { id:'t1a', label:'前頭前野トレーニング', xp:15, done:false },
    { id:'t1b', label:'集中セッション60分', xp:20, done:false },
    { id:'t1c', label:'読書・インプット', xp:10, done:false },
  ]},
  { id:'t2', label:'💪 体', color:'#22c55e', tasks:[
    { id:'t2a', label:'朝の呼吸ルーティン', xp:10, done:false },
    { id:'t2b', label:'神経系アクティベーション', xp:15, done:false },
    { id:'t2c', label:'コンディション記録', xp:5, done:false },
  ]},
  { id:'t3', label:'🔮 メンタル', color:'#A78BFA', tasks:[
    { id:'t3a', label:'ZONEジャーナル', xp:10, done:false },
    { id:'t3b', label:'Core Values接続', xp:20, done:false },
    { id:'t3c', label:'夜の振り返り', xp:5, done:false },
  ]},
  { id:'t4', label:'⚡ 仕事', color:'#F59E0B', tasks:[
    { id:'t4a', label:'ACEコンテンツ作成', xp:25, done:false },
    { id:'t4b', label:'X投稿3本', xp:15, done:false },
    { id:'t4c', label:'売上振り返り', xp:10, done:false },
  ]},
  { id:'t5', label:'💚 関係', color:'#EC4899', tasks:[
    { id:'t5a', label:'リアンフォロー', xp:20, done:false },
    { id:'t5b', label:'メンタリング記録', xp:15, done:false },
    { id:'t5c', label:'コミュニティ投稿', xp:10, done:false },
  ]},
  { id:'t6', label:'🌀 習慣', color:'#F97316', tasks:[
    { id:'t6a', label:'睡眠7h確保', xp:15, done:false },
    { id:'t6b', label:'食事記録', xp:5, done:false },
    { id:'t6c', label:'デジタルデトックス', xp:10, done:false },
  ]},
];

const DEFAULT_3: Theme[] = [
  { id:'t1', label:'🧠 脳・体', color:'#3B82F6', tasks:[
    { id:'t1a', label:'前頭前野トレーニング', xp:15, done:false },
    { id:'t1b', label:'朝の呼吸ルーティン', xp:10, done:false },
    { id:'t1c', label:'コンディション記録', xp:5, done:false },
  ]},
  { id:'t2', label:'⚡ メンタル・仕事', color:'#F59E0B', tasks:[
    { id:'t2a', label:'ZONEジャーナル', xp:10, done:false },
    { id:'t2b', label:'ACEコンテンツ作成', xp:25, done:false },
    { id:'t2c', label:'X投稿3本', xp:15, done:false },
  ]},
  { id:'t3', label:'💚 関係・習慣', color:'#EC4899', tasks:[
    { id:'t3a', label:'リアンフォロー', xp:20, done:false },
    { id:'t3b', label:'睡眠7h確保', xp:15, done:false },
    { id:'t3c', label:'夜の振り返り', xp:5, done:false },
  ]},
];

function genId() { return Math.random().toString(36).slice(2,9); }
function load(): { themes: Theme[]; cols: 3|6 } {
  try {
    const s = localStorage.getItem('ace-themes-v2');
    if (s) return JSON.parse(s);
  } catch {}
  return { themes: DEFAULT_6, cols: 6 };
}
function save(themes: Theme[], cols: 3|6) {
  localStorage.setItem('ace-themes-v2', JSON.stringify({ themes, cols }));
}

// ── Component ──────────────────────────────────────────
export default function ACECalendar() {
  const stored = load();
  const [themes, setThemes] = useState<Theme[]>(stored.themes);
  const [cols, setCols]     = useState<3|6>(stored.cols);
  const [view, setView]     = useState<'grid'|'detail'>('grid');
  const [activeId, setActiveId] = useState<string|null>(null);
  const [editing, setEditing]   = useState(false);
  const [editThemeId, setEditThemeId] = useState<string|null>(null);
  // DnD
  const dragTaskRef = useRef<{themeId:string;taskId:string}|null>(null);
  const [dragOver, setDragOver] = useState<string|null>(null);

  const update = (t: Theme[], c?: 3|6) => {
    const nc = c ?? cols;
    setThemes(t); save(t, nc);
  };

  // ── Total XP ──
  const totalXP = themes.flatMap(t=>t.tasks).reduce((a,t)=>a+t.xp,0);
  const earnedXP = themes.flatMap(t=>t.tasks).filter(t=>t.done).reduce((a,t)=>a+t.xp,0);
  const pct = totalXP ? Math.round((earnedXP/totalXP)*100) : 0;

  // ── Task toggle ──
  const toggleTask = (themeId:string, taskId:string) => {
    const next = themes.map(th => th.id!==themeId ? th : {
      ...th, tasks: th.tasks.map(t => t.id!==taskId ? t : {...t,done:!t.done})
    });
    update(next);
  };

  // ── DnD tasks within detail view ──
  const onTaskDragStart = (themeId:string, taskId:string) => { dragTaskRef.current={themeId,taskId}; };
  const onTaskDragOver  = (e:React.DragEvent, taskId:string) => { e.preventDefault(); setDragOver(taskId); };
  const onTaskDrop      = (themeId:string, targetId:string) => {
    const src = dragTaskRef.current;
    if (!src||src.taskId===targetId) { dragTaskRef.current=null;setDragOver(null);return; }
    const next = themes.map(th => {
      if (th.id!==themeId) return th;
      const tasks=[...th.tasks];
      const fi=tasks.findIndex(t=>t.id===src.taskId);
      const ti=tasks.findIndex(t=>t.id===targetId);
      const [m]=tasks.splice(fi,1); tasks.splice(ti,0,m);
      return {...th,tasks};
    });
    update(next); dragTaskRef.current=null; setDragOver(null);
  };

  // ── Edit helpers ──
  const addTask = (themeId:string) => {
    const next = themes.map(th => th.id!==themeId ? th : {
      ...th, tasks:[...th.tasks,{id:genId(),label:'新しいタスク',xp:10,done:false}]
    });
    update(next);
  };
  const updateTask = (themeId:string, taskId:string, label:string, xp:number) => {
    const next = themes.map(th => th.id!==themeId ? th : {
      ...th, tasks:th.tasks.map(t=>t.id!==taskId?t:{...t,label,xp})
    });
    update(next);
  };
  const deleteTask = (themeId:string, taskId:string) => {
    const next = themes.map(th => th.id!==themeId ? th : {...th,tasks:th.tasks.filter(t=>t.id!==taskId)});
    update(next);
  };
  const updateTheme = (themeId:string, label:string, color:string) => {
    update(themes.map(th=>th.id!==themeId?th:{...th,label,color}));
  };
  const addTheme = () => {
    const idx = themes.length % COLORS.length;
    update([...themes,{id:genId(),label:'新テーマ',color:COLORS[idx],tasks:[]}]);
  };
  const deleteTheme = (id:string) => { update(themes.filter(t=>t.id!==id)); };

  const switchCols = (n:3|6) => {
    const base = n===6 ? DEFAULT_6 : DEFAULT_3;
    if (themes.length===0) { setThemes(base); save(base,n); }
    setCols(n); save(themes,n); setView('grid');
  };

  const activeTheme = themes.find(t=>t.id===activeId);

  // ── Styles ──
  const S = {
    wrap: { paddingBottom:40 } as React.CSSProperties,
    xpBox: { background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:14, padding:'18px 20px 14px', marginBottom:20 },
    xpNum: { fontSize:'2rem', fontWeight:800, color:'#F59E0B', lineHeight:1, marginBottom:8 },
    bar: { background:'rgba(255,255,255,0.06)', borderRadius:99, height:6, overflow:'hidden', marginBottom:4 },
    barFill: (p:number) => ({ background:'linear-gradient(90deg,#F59E0B,#D97706)', height:'100%', width:`${p}%`, borderRadius:99, transition:'width 0.4s ease' }),
    toolbar: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:8 },
    colBtns: { display:'flex', gap:6 },
    colBtn: (active:boolean) => ({ padding:'6px 16px', borderRadius:8, border:`1.5px solid ${active?'rgba(245,158,11,0.5)':'rgba(255,255,255,0.1)'}`, background:active?'rgba(245,158,11,0.1)':'none', color:active?'#F59E0B':'#7070a0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.88rem', fontWeight:700 }),
    editBtn: (active:boolean) => ({ padding:'6px 14px', borderRadius:8, border:`1.5px solid ${active?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.08)'}`, background:active?'rgba(167,139,250,0.1)':'none', color:active?'#A78BFA':'#7070a0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem', fontWeight:600 }),
    grid: (c:number) => ({ display:'grid', gridTemplateColumns:`repeat(${c},1fr)`, gap:10 }) as React.CSSProperties,
    themeCard: (t:Theme) => ({ background:'#12121f', border:`1.5px solid ${t.color}33`, borderRadius:14, padding:'14px 14px 12px', cursor:'pointer', transition:'border-color 0.2s, transform 0.15s', position:'relative' as const }),
    themeCardHover: (t:Theme) => ({ ...{} , borderColor:t.color+'88' }),
    themeName: { fontWeight:700, fontSize:'0.9rem', marginBottom:8 },
    themeProgress: (t:Theme) => { const d=t.tasks.filter(tk=>tk.done).length; const tot=t.tasks.length||1; return { background:'rgba(255,255,255,0.06)', borderRadius:99, height:4, overflow:'hidden', marginBottom:6, position:'relative' as const }; },
    themeBar: (t:Theme) => { const d=t.tasks.filter(tk=>tk.done).length; const tot=t.tasks.length||1; return { background:t.color, height:'100%', width:`${Math.round(d/tot*100)}%`, borderRadius:99, transition:'width 0.4s' }; },
    themeMeta: { fontSize:'0.75rem', color:'#7070a0' },
    // Detail view
    detailWrap: { } as React.CSSProperties,
    detailHeader: { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
    backBtn: { padding:'7px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'none', color:'#7070a0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.88rem' },
    detailTitle: { fontWeight:800, fontSize:'1.2rem', flex:1 },
    taskRow: (done:boolean, isOver:boolean) => ({ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', background:isOver?'rgba(255,255,255,0.06)':done?'rgba(245,158,11,0.05)':'rgba(255,255,255,0.02)', borderRadius:10, marginBottom:6, cursor:'grab', userSelect:'none' as const, transition:'background 0.15s' }),
    check: (done:boolean, color:string) => ({ width:22, height:22, borderRadius:6, border:`2px solid ${done?color:'rgba(255,255,255,0.15)'}`, background:done?color:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', color:done?'#0a0a1a':'transparent', flexShrink:0, transition:'all 0.15s', cursor:'pointer' }),
    taskLabel: (done:boolean) => ({ flex:1, fontSize:'0.95rem', color:done?'#7070a0':'#e8e8f0', textDecoration:done?'line-through':'none' }),
    taskXP: (done:boolean, color:string) => ({ fontSize:'0.78rem', fontWeight:700, color:done?color:'#7070a0', flexShrink:0 }),
    addBtn: (color:string) => ({ width:'100%', marginTop:10, padding:'10px', borderRadius:10, border:`1.5px dashed ${color}55`, background:'none', color:color, cursor:'pointer', fontFamily:'inherit', fontSize:'0.88rem', fontWeight:600 }),
    // Edit inputs
    editInput: { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.88rem', padding:'5px 8px', outline:'none' },
    xpInput: { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.85rem', padding:'5px 6px', outline:'none', width:52, textAlign:'right' as const },
    delBtn: { padding:'4px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'none', color:'#ef4444', cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem' },
    slideWrap: { position:'relative' as const, overflow:'hidden' },
    slideRow: (idx:number) => ({ display:'flex', transition:'transform 0.35s cubic-bezier(0.4,0,0.2,1)', transform:`translateX(-${idx*100}%)`, willChange:'transform' as const }),
    slide: { minWidth:'100%', padding:'0 4px' },
    slideNav: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
    navBtn: { padding:'8px 18px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'none', color:'#e8e8f0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.95rem' },
    dots: { display:'flex', gap:6 },
    dot: (active:boolean,color:string) => ({ width:active?20:8, height:8, borderRadius:99, background:active?color:'rgba(255,255,255,0.15)', transition:'all 0.2s' }),
  };

  const [slideIdx, setSlideIdx] = useState(0);

  // ── Grid view ──
  if (view==='grid') return (
    <div style={S.wrap}>
      {/* XP Bar */}
      <div style={S.xpBox}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:'0.75rem', color:'#7070a0', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>Total XP</span>
          <span style={{ fontSize:'0.75rem', color:'#7070a0' }}>{pct}%</span>
        </div>
        <div style={S.xpNum}>{earnedXP}<span style={{ fontSize:'1rem', fontWeight:400, color:'#7070a0', marginLeft:6 }}>/ {totalXP} XP</span></div>
        <div style={S.bar}><div style={S.barFill(pct)} /></div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.colBtns}>
          <button style={S.colBtn(cols===3)} onClick={()=>switchCols(3)}>3列</button>
          <button style={S.colBtn(cols===6)} onClick={()=>switchCols(6)}>6列</button>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {editing && <button style={S.editBtn(false)} onClick={addTheme}>＋ テーマ追加</button>}
          <button style={S.editBtn(editing)} onClick={()=>setEditing(!editing)}>
            {editing ? '✓ 完了' : '✎ 編集'}
          </button>
        </div>
      </div>

      {/* Theme Grid */}
      <div style={S.grid(cols)}>
        {themes.map(t => {
          const done = t.tasks.filter(tk=>tk.done).length;
          const tot  = t.tasks.length;
          return (
            <div key={t.id} style={S.themeCard(t)}
              onClick={()=>{ if(!editing){ setActiveId(t.id); setSlideIdx(themes.findIndex(th=>th.id===t.id)); setView('detail'); }}}
            >
              {editing ? (
                <div onClick={e=>e.stopPropagation()}>
                  <input style={{ ...S.editInput, width:'100%', marginBottom:6, fontSize:'0.85rem' }}
                    value={t.label} onChange={e=>updateTheme(t.id,e.target.value,t.color)} />
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                    {COLORS.map(c=>(
                      <button key={c} onClick={()=>updateTheme(t.id,t.label,c)}
                        style={{ width:18, height:18, borderRadius:99, background:c, border:t.color===c?'2px solid #fff':'2px solid transparent', cursor:'pointer' }} />
                    ))}
                  </div>
                  <button style={S.delBtn} onClick={()=>deleteTheme(t.id)}>削除</button>
                </div>
              ) : (
                <>
                  <div style={{ ...S.themeName, color:t.color }}>{t.label}</div>
                  <div style={S.themeProgress(t)}><div style={S.themeBar(t)} /></div>
                  <div style={S.themeMeta}>{done}/{tot} タスク · {t.tasks.filter(tk=>tk.done).reduce((a,tk)=>a+tk.xp,0)}/{t.tasks.reduce((a,tk)=>a+tk.xp,0)} XP</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Detail / Slide view ──
  return (
    <div style={S.wrap}>
      <div style={S.detailHeader}>
        <button style={S.backBtn} onClick={()=>setView('grid')}>← 一覧</button>
        <span style={{ ...S.detailTitle, color:themes[slideIdx]?.color??'#F59E0B' }}>{themes[slideIdx]?.label}</span>
        <button style={S.editBtn(editThemeId===themes[slideIdx]?.id)}
          onClick={()=>setEditThemeId(editThemeId===themes[slideIdx]?.id?null:themes[slideIdx]?.id??null)}>
          {editThemeId===themes[slideIdx]?.id?'✓ 完了':'✎ 編集'}
        </button>
      </div>

      {/* Dot nav */}
      <div style={S.slideNav}>
        <button style={S.navBtn} onClick={()=>setSlideIdx(Math.max(0,slideIdx-1))} disabled={slideIdx===0}>‹</button>
        <div style={S.dots}>
          {themes.map((t,i)=>(
            <div key={t.id} style={S.dot(i===slideIdx,t.color)} onClick={()=>setSlideIdx(i)} />
          ))}
        </div>
        <button style={S.navBtn} onClick={()=>setSlideIdx(Math.min(themes.length-1,slideIdx+1))} disabled={slideIdx===themes.length-1}>›</button>
      </div>

      {/* Slide container */}
      <div style={S.slideWrap}>
        <div style={S.slideRow(slideIdx)}>
          {themes.map(t => {
            const isEditing = editThemeId===t.id;
            return (
              <div key={t.id} style={S.slide}>
                {/* XP mini bar */}
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:'0.8rem', color:'#7070a0' }}>
                    {t.tasks.filter(tk=>tk.done).length}/{t.tasks.length} 完了
                  </span>
                  <span style={{ fontSize:'0.8rem', color:t.color, fontWeight:700 }}>
                    {t.tasks.filter(tk=>tk.done).reduce((a,tk)=>a+tk.xp,0)} XP
                  </span>
                </div>
                <div style={S.bar}>
                  <div style={{ ...S.barFill(t.tasks.length?Math.round(t.tasks.filter(tk=>tk.done).length/t.tasks.length*100):0), background:t.color }} />
                </div>
                <div style={{ marginTop:14 }}>
                  {t.tasks.map(task => {
                    const isOver = dragOver===task.id;
                    return (
                      <div key={task.id} style={S.taskRow(task.done,isOver)}
                        draggable onDragStart={()=>onTaskDragStart(t.id,task.id)}
                        onDragOver={e=>onTaskDragOver(e,task.id)}
                        onDrop={()=>onTaskDrop(t.id,task.id)}
                        onDragEnd={()=>{dragTaskRef.current=null;setDragOver(null);}}
                      >
                        <span style={{ opacity:0.3, fontSize:'0.85rem' }}>⠿</span>
                        <div style={S.check(task.done,t.color)} onClick={()=>toggleTask(t.id,task.id)}>✓</div>
                        {isEditing ? (
                          <>
                            <input style={{ ...S.editInput, flex:1 }} value={task.label}
                              onChange={e=>updateTask(t.id,task.id,e.target.value,task.xp)} />
                            <input type="number" style={S.xpInput} value={task.xp}
                              onChange={e=>updateTask(t.id,task.id,task.label,Number(e.target.value))} />
                            <span style={{ fontSize:'0.78rem', color:'#7070a0' }}>XP</span>
                            <button style={S.delBtn} onClick={()=>deleteTask(t.id,task.id)}>✕</button>
                          </>
                        ) : (
                          <>
                            <span style={S.taskLabel(task.done)}>{task.label}</span>
                            <span style={S.taskXP(task.done,t.color)}>+{task.xp} XP</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {isEditing && (
                    <button style={S.addBtn(t.color)} onClick={()=>addTask(t.id)}>＋ タスクを追加</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
