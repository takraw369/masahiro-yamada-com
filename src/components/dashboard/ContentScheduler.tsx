import { useState, useEffect, useRef } from 'react';

// ── Types ──────────────────────────────────────────────
interface PostItem {
  id: string;
  platform: 'x' | 'line';
  category: string | null;
  text: string;
  title: string;
  scheduledHour: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'sending';
  createdAt: string;
  xAccountId?: string;
  lineAccountId?: string;
  order: number;
}

interface XAccount    { id: string; username: string; isActive: boolean; }
interface LineAccount { id: string; name: string; channelId: string; }

// ── Constants ──────────────────────────────────────────
const CATS = [
  { id: 'brain',    label: '🧠 脳科学',       color: '#3B82F6', bg: 'rgba(59,130,246,0.13)'  },
  { id: 'health',   label: '💪 健康',          color: '#22c55e', bg: 'rgba(34,197,94,0.13)'   },
  { id: 'relation', label: '💚 リレーション',  color: '#EC4899', bg: 'rgba(236,72,153,0.13)'  },
  { id: 'ace',      label: '⚡ ACE',           color: '#F59E0B', bg: 'rgba(245,158,11,0.13)'  },
  { id: 'sport',    label: '🏃 スポーツ',      color: '#A78BFA', bg: 'rgba(167,139,250,0.13)' },
  { id: 'other',    label: '📌 その他',        color: '#7070a0', bg: 'rgba(112,112,160,0.13)' },
] as const;

const KW: Record<string, string[]> = {
  brain:    ['ドーパミン','前頭前野','フロー','ADHD','集中力','記憶定着','睡眠'],
  health:   ['呼吸法','自律神経','食事設計','リカバリー','バイオリズム'],
  relation: ['コーチング','信頼','コミュニティ','傾聴','心理的安全性'],
  ace:      ['ACEメソッド','ZONE','調律','パフォーマンス','習慣'],
  sport:    ['セパタクロー','アスリート','体幹','技術','トレーニング'],
  other:    [],
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
function genId()  { return Math.random().toString(36).slice(2, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function hourKey(date: string, h: number) { return `${date}T${String(h).padStart(2,'0')}:00`; }
function fmtHour(h: number) { return `${String(h).padStart(2,'0')}:00`; }
function catOf(id: string | null) { return CATS.find(c => c.id === id) ?? null; }

function loadLib(): PostItem[] {
  try { return JSON.parse(localStorage.getItem('ace-content-lib') ?? '[]'); } catch { return []; }
}
function saveLib(q: PostItem[]) { localStorage.setItem('ace-content-lib', JSON.stringify(q)); }

// ── Component ──────────────────────────────────────────
export default function ContentScheduler() {
  const [lib, setLib]               = useState<PostItem[]>(loadLib);
  const [xAccounts, setXAccounts]   = useState<XAccount[]>([]);
  const [lineAccounts, setLineAccts]= useState<LineAccount[]>([]);
  const [viewDate, setViewDate]     = useState(todayStr());
  // compose
  const [composing, setComposing]   = useState(false);
  const [platform,  setPlatform]    = useState<'x'|'line'>('x');
  const [catId,     setCatId]       = useState<string|null>(null);
  const [text,      setText]        = useState('');
  const [title,     setTitle]       = useState('');
  const [xAccId,    setXAccId]      = useState('');
  const [lineAccId, setLineAccId]   = useState('');
  // library tab
  const [libTab,    setLibTab]      = useState<'x'|'line'>('x');
  const [collapsed, setCollapsed]   = useState<Record<string,boolean>>({});
  // dnd
  const dragIdRef   = useRef<string|null>(null);
  const dragSrcCat  = useRef<string|null>(null);
  const [dragOver,  setDragOver]    = useState<string|null>(null); // itemId or hourKey
  // status
  const [statusMsg, setStatusMsg]   = useState('');
  // schedule modal
  const [schedModal, setSchedModal] = useState<PostItem|null>(null);
  const [schedDate,  setSchedDate]  = useState(todayStr());
  const [schedHour,  setSchedHour]  = useState(9);

  useEffect(() => {
    fetch('/api/x-harness/x-accounts')
      .then(r=>r.json() as Promise<{data:XAccount[]}> )
      .then(d=>{ const a=(d.data??[]).filter(a=>a.isActive); setXAccounts(a); if(a[0]) setXAccId(a[0].id); })
      .catch(()=>{});
    fetch('/api/line-harness/line-accounts')
      .then(r=>r.json() as Promise<{data:LineAccount[]}> )
      .then(d=>{ const a=d.data??[]; setLineAccts(a); if(a[0]) setLineAccId(a[0].id); })
      .catch(()=>{});
  }, []);

  const updateLib = (next: PostItem[]) => { setLib(next); saveLib(next); };

  // ── Add to library ──
  const addToLib = () => {
    if (!text.trim()) return;
    const maxOrder = lib.filter(p=>p.platform===platform && p.category===catId).reduce((a,p)=>Math.max(a,p.order),-1);
    const item: PostItem = {
      id: genId(), platform, category: catId, text, title: title||text.slice(0,30),
      scheduledHour: null, status: 'draft', createdAt: new Date().toISOString(),
      xAccountId: platform==='x'?xAccId:undefined,
      lineAccountId: platform==='line'?lineAccId:undefined,
      order: maxOrder+1,
    };
    updateLib([item, ...lib]);
    setText(''); setTitle(''); setCatId(null); setComposing(false);
    setLibTab(platform);
  };

  // ── Library DnD (reorder within same category) ──
  const onLibDragStart = (id: string, cat: string|null) => {
    dragIdRef.current = id;
    dragSrcCat.current = cat;
  };
  const onLibDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(id);
  };
  const onLibDrop = (targetId: string) => {
    const srcId = dragIdRef.current;
    if (!srcId || srcId===targetId) { dragIdRef.current=null; setDragOver(null); return; }
    const next = [...lib];
    const fi = next.findIndex(p=>p.id===srcId);
    const ti = next.findIndex(p=>p.id===targetId);
    const [m] = next.splice(fi,1); next.splice(ti,0,m);
    // re-assign order within category
    let ord = 0;
    const cat = next[ti].category;
    next.forEach(p=>{ if(p.category===cat && p.platform===next[ti].platform) p.order = ord++; });
    updateLib(next); dragIdRef.current=null; setDragOver(null);
  };

  // ── Timeline DnD ──
  const onTimelineDragOver = (e: React.DragEvent, hk: string) => { e.preventDefault(); setDragOver(hk); };
  const onTimelineDrop = (hk: string) => {
    const id = dragIdRef.current;
    if (!id) { setDragOver(null); return; }
    const next = lib.map(p=>p.id===id?{...p,scheduledHour:hk,status:'scheduled' as const}:p);
    updateLib(next); dragIdRef.current=null; setDragOver(null);
  };
  const onTimelineItemDrop = (e: React.DragEvent, targetId: string) => {
    e.stopPropagation();
    const srcId = dragIdRef.current;
    if (!srcId||srcId===targetId) { dragIdRef.current=null; return; }
    const src = lib.find(p=>p.id===srcId);
    const tgt = lib.find(p=>p.id===targetId);
    if (!src||!tgt) return;
    const next = lib.map(p=>{
      if(p.id===srcId) return {...p,scheduledHour:tgt.scheduledHour};
      if(p.id===targetId) return {...p,scheduledHour:src.scheduledHour};
      return p;
    });
    updateLib(next); dragIdRef.current=null;
  };

  // ── Send ──
  const send = async (item: PostItem) => {
    updateLib(lib.map(p=>p.id===item.id?{...p,status:'sending' as const}:p));
    try {
      let ok = false;
      if (item.platform==='x') {
        const body = { xAccountId: item.xAccountId??xAccId, text: item.text };
        if (item.scheduledHour) {
          const r = await fetch('/api/x-harness/posts/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,scheduledAt:item.scheduledHour})});
          ok = ((await r.json()) as {success:boolean}).success;
        } else {
          const r = await fetch('/api/x-harness/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
          ok = ((await r.json()) as {success:boolean}).success;
        }
      } else {
        const r = await fetch('/api/line-harness/broadcasts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:item.title||item.text.slice(0,20),messageType:'text',messageContent:item.text,targetType:'all',lineAccountId:item.lineAccountId||lineAccId,scheduledAt:item.scheduledHour??undefined})});
        ok = ((await r.json()) as {success:boolean}).success;
      }
      updateLib(lib.map(p=>p.id===item.id?{...p,status:(ok?'sent':'draft') as const}:p));
      setStatusMsg(ok?'✓ 送信完了':'✗ 送信失敗');
    } catch(e) {
      updateLib(lib.map(p=>p.id===item.id?{...p,status:'draft' as const}:p));
      setStatusMsg('✗ '+String(e));
    }
    setTimeout(()=>setStatusMsg(''),3000);
  };

  const del = (id: string) => updateLib(lib.filter(p=>p.id!==id));
  const unschedule = (id: string) => updateLib(lib.map(p=>p.id===id?{...p,scheduledHour:null,status:'draft' as const}:p));

  // ── Schedule modal confirm ──
  const confirmSchedule = () => {
    if (!schedModal) return;
    const hk = hourKey(schedDate, schedHour);
    updateLib(lib.map(p=>p.id===schedModal.id?{...p,scheduledHour:hk,status:'scheduled' as const}:p));
    setSchedModal(null);
  };

  // ── Derived ──
  const libItems    = lib.filter(p=>p.platform===libTab && !p.scheduledHour && p.status!=='sent');
  const scheduled   = lib.filter(p=>!!p.scheduledHour && p.status!=='sent');
  const byHour      = (hk: string) => scheduled.filter(p=>p.scheduledHour===hk);
  const groupByCat  = (items: PostItem[]) => {
    const groups: Record<string, PostItem[]> = {};
    CATS.forEach(c=>{ groups[c.id]=[]; });
    groups['__none'] = [];
    items.forEach(p=>{ const k=p.category??'__none'; if(!groups[k]) groups[k]=[]; groups[k].push(p); });
    return groups;
  };

  const prevDay = () => { const d=new Date(viewDate); d.setDate(d.getDate()-1); setViewDate(d.toISOString().slice(0,10)); };
  const nextDay = () => { const d=new Date(viewDate); d.setDate(d.getDate()+1); setViewDate(d.toISOString().slice(0,10)); };

  // ── Styles ──
  const dark = '#0a0a1a';
  const surf = '#12121f';
  const bord = 'rgba(255,255,255,0.08)';
  const dim  = '#7070a0';

  const s = {
    root: { display:'flex', height:'calc(100vh - 58px)', fontFamily:"'Inter','Noto Sans JP',sans-serif", color:'#e8e8f0', overflow:'hidden' } as React.CSSProperties,
    // Left
    left: { width:320, flexShrink:0, borderRight:`1px solid ${bord}`, display:'flex', flexDirection:'column' as const, background:surf } as React.CSSProperties,
    leftTop: { padding:'14px 14px 10px', borderBottom:`1px solid ${bord}`, flexShrink:0 } as React.CSSProperties,
    addBtn: { width:'100%', padding:'10px', borderRadius:10, background:'linear-gradient(90deg,#F59E0B,#D97706)', border:'none', color:'#0a0a1a', fontFamily:'inherit', fontSize:'0.9rem', fontWeight:800, cursor:'pointer', marginBottom:composing?12:0 } as React.CSSProperties,
    platformRow: { display:'flex', gap:6, marginBottom:10 },
    platBtn: (active:boolean, pl:'x'|'line') => ({ flex:1, padding:'7px 0', borderRadius:8, border:`1.5px solid ${active?(pl==='x'?'rgba(29,161,242,0.6)':'rgba(6,199,85,0.5)'):'rgba(255,255,255,0.08)'}`, background:active?(pl==='x'?'rgba(29,161,242,0.1)':'rgba(6,199,85,0.08)'):'none', color:active?(pl==='x'?'#1DA1F2':'#06c755'):'#7070a0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem', fontWeight:700 }) as React.CSSProperties,
    catRow: { display:'flex', flexWrap:'wrap' as const, gap:5, marginBottom:8 },
    catPill: (id:string, active:boolean) => { const m=catOf(id); return { padding:'4px 10px', borderRadius:99, border:`1.5px solid ${active?(m?.color??'#fff'):'rgba(255,255,255,0.08)'}`, background:active?(m?.bg??'transparent'):'none', color:active?(m?.color??'#fff'):'#7070a0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', fontWeight:600 } as React.CSSProperties; },
    kwRow: { display:'flex', flexWrap:'wrap' as const, gap:4, marginBottom:8 },
    kw: { padding:'3px 8px', borderRadius:99, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#a0a0c0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.75rem' },
    ta: { width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${bord}`, borderRadius:8, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.88rem', padding:'8px 10px', resize:'vertical' as const, outline:'none', marginBottom:6, lineHeight:1.5 },
    ti: { width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid rgba(255,255,255,0.07)`, borderRadius:6, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.82rem', padding:'6px 9px', outline:'none', marginBottom:6 },
    sel: { width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid rgba(255,255,255,0.07)`, borderRadius:6, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.82rem', padding:'6px 9px', outline:'none', marginBottom:6 },
    confirmRow: { display:'flex', gap:6 },
    confirmBtn: { flex:1, padding:'8px 0', borderRadius:8, background:'linear-gradient(90deg,#F59E0B,#D97706)', border:'none', color:'#0a0a1a', fontFamily:'inherit', fontSize:'0.88rem', fontWeight:800, cursor:'pointer' },
    cancelBtn: { padding:'8px 14px', borderRadius:8, border:`1px solid ${bord}`, background:'none', color:dim, cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' },
    // Lib tabs
    tabRow: { display:'flex', borderBottom:`1px solid ${bord}`, flexShrink:0 } as React.CSSProperties,
    tab: (active:boolean, pl:'x'|'line') => ({ flex:1, padding:'10px 0', border:'none', background:'none', color:active?(pl==='x'?'#1DA1F2':'#06c755'):dim, fontFamily:'inherit', fontSize:'0.9rem', fontWeight:700, cursor:'pointer', borderBottom:`2px solid ${active?(pl==='x'?'#1DA1F2':'#06c755'):'transparent'}`, transition:'all 0.15s' }) as React.CSSProperties,
    libBody: { flex:1, overflowY:'auto' as const, padding:'10px 12px' } as React.CSSProperties,
    groupHeader: (color:string, open:boolean) => ({ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:8, marginBottom:4, cursor:'pointer', background:`${color}18`, border:`1px solid ${color}33` }) as React.CSSProperties,
    groupLabel: { fontSize:'0.82rem', fontWeight:700 },
    groupCount: { fontSize:'0.75rem', color:dim },
    card: (isOver:boolean) => ({ background:isOver?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.02)', border:`1px solid ${isOver?'rgba(245,158,11,0.4)':bord}`, borderRadius:10, padding:'10px 12px', marginBottom:6, cursor:'grab', userSelect:'none' as const, transition:'background 0.12s, border-color 0.12s' }) as React.CSSProperties,
    cardTop: { display:'flex', alignItems:'center', gap:6, marginBottom:5 },
    cardPf: (pl:'x'|'line') => ({ fontSize:'0.72rem', fontWeight:700, padding:'2px 7px', borderRadius:99, background:pl==='x'?'rgba(29,161,242,0.15)':'rgba(6,199,85,0.12)', color:pl==='x'?'#1DA1F2':'#06c755' }),
    cardCat: (id:string|null) => { const m=catOf(id); return m?{ fontSize:'0.72rem', color:m.color, background:m.bg, padding:'2px 7px', borderRadius:99 }:{} as React.CSSProperties; },
    cardText: { fontSize:'0.85rem', color:'#c0c0d8', lineHeight:1.4, display:'-webkit-box' as const, WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const, overflow:'hidden' } as React.CSSProperties,
    cardActions: { display:'flex', gap:5, marginTop:8, flexWrap:'wrap' as const },
    actBtn: (color:string, bg:string) => ({ fontSize:'0.75rem', padding:'4px 9px', borderRadius:6, background:bg, border:`1px solid ${color}55`, color, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }) as React.CSSProperties,
    // Right
    right: { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden', background:dark } as React.CSSProperties,
    rightHead: { padding:'12px 20px', borderBottom:`1px solid ${bord}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 } as React.CSSProperties,
    dayNav: { display:'flex', alignItems:'center', gap:10 },
    dayBtn: { padding:'5px 12px', borderRadius:6, border:`1px solid ${bord}`, background:'none', color:'#e8e8f0', cursor:'pointer', fontFamily:'inherit', fontSize:'0.9rem' },
    dayLabel: { fontWeight:700, fontSize:'1rem' },
    timeline: { flex:1, overflowY:'auto' as const, padding:'8px 16px 24px' } as React.CSSProperties,
    hourRow: (isOver:boolean) => ({ display:'flex', alignItems:'flex-start', gap:8, padding:'5px 0', borderBottom:`1px solid ${isOver?'rgba(245,158,11,0.3)':bord+'44'}`, background:isOver?'rgba(245,158,11,0.05)':'transparent', transition:'background 0.12s', minHeight:46 }) as React.CSSProperties,
    hourLabel: { width:44, flexShrink:0, fontSize:'0.8rem', color:dim, paddingTop:6, textAlign:'right' as const, paddingRight:8 },
    hourSlot: { flex:1, display:'flex', flexWrap:'wrap' as const, gap:6, padding:'4px 0', minHeight:36 },
    schCard: (p:PostItem) => { const m=catOf(p.category); return { background:'#1a1a2e', border:`1px solid ${m?.color+'55'??bord}`, borderRadius:8, padding:'7px 10px', cursor:'grab', maxWidth:200, userSelect:'none' as const } as React.CSSProperties; },
    schPf: (pl:'x'|'line') => ({ fontSize:'0.7rem', fontWeight:700, color:pl==='x'?'#1DA1F2':'#06c755', marginRight:4 }),
    schText: { fontSize:'0.78rem', color:'#c0c0d8', marginTop:3, lineHeight:1.3, overflow:'hidden', display:'-webkit-box' as const, WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const } as React.CSSProperties,
    schBtns: { display:'flex', gap:4, marginTop:5 },
    schSend: { fontSize:'0.7rem', padding:'3px 8px', borderRadius:5, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)', color:'#F59E0B', cursor:'pointer', fontFamily:'inherit', fontWeight:600 },
    schDel: { fontSize:'0.7rem', padding:'3px 7px', borderRadius:5, background:'none', border:`1px solid ${bord}`, color:dim, cursor:'pointer', fontFamily:'inherit' },
    statusBar: { padding:'8px 20px', fontSize:'0.85rem', color:'#22c55e', background:'rgba(34,197,94,0.08)', borderBottom:'1px solid rgba(34,197,94,0.15)', flexShrink:0 } as React.CSSProperties,
    // Modal
    overlay: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
    modal: { background:'#1a1a2e', border:`1px solid ${bord}`, borderRadius:16, padding:'24px', width:320, maxWidth:'90vw' },
    modalTitle: { fontWeight:800, fontSize:'1rem', marginBottom:16 },
    modalLabel: { fontSize:'0.82rem', color:dim, marginBottom:6, display:'block' },
    modalInput: { width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid ${bord}`, borderRadius:8, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.9rem', padding:'9px 12px', outline:'none', marginBottom:14 },
    modalSel: { width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid ${bord}`, borderRadius:8, color:'#e8e8f0', fontFamily:'inherit', fontSize:'0.9rem', padding:'9px 12px', outline:'none', marginBottom:14 },
    modalBtns: { display:'flex', gap:8 },
    modalOk: { flex:1, padding:'10px 0', borderRadius:8, background:'linear-gradient(90deg,#F59E0B,#D97706)', border:'none', color:'#0a0a1a', fontFamily:'inherit', fontSize:'0.9rem', fontWeight:800, cursor:'pointer' },
    modalCancel: { padding:'10px 16px', borderRadius:8, border:`1px solid ${bord}`, background:'none', color:dim, cursor:'pointer', fontFamily:'inherit', fontSize:'0.9rem' },
  };

  const groups = groupByCat(libItems);

  return (
    <div style={s.root}>
      {/* ── Left: Library ── */}
      <div style={s.left}>
        {/* Compose */}
        <div style={s.leftTop}>
          <button style={s.addBtn} onClick={()=>setComposing(!composing)}>
            {composing?'✕ 閉じる':'＋ コンテンツを作成'}
          </button>

          {composing && (<>
            <div style={s.platformRow}>
              <button style={s.platBtn(platform==='x','x')} onClick={()=>setPlatform('x')}>𝕏 X</button>
              <button style={s.platBtn(platform==='line','line')} onClick={()=>setPlatform('line')}>💚 LINE</button>
            </div>

            {platform==='x' && xAccounts.length>1 && (
              <select style={s.sel} value={xAccId} onChange={e=>setXAccId(e.target.value)}>
                {xAccounts.map(a=><option key={a.id} value={a.id}>@{a.username}</option>)}
              </select>
            )}
            {platform==='line' && lineAccounts.length>0 && (
              <select style={s.sel} value={lineAccId} onChange={e=>setLineAccId(e.target.value)}>
                {lineAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}

            <div style={s.catRow}>
              {CATS.map(c=>(
                <button key={c.id} style={s.catPill(c.id,catId===c.id)} onClick={()=>setCatId(catId===c.id?null:c.id)}>{c.label}</button>
              ))}
            </div>

            {catId && KW[catId]?.length>0 && (
              <div style={s.kwRow}>
                {KW[catId].map(kw=>(
                  <button key={kw} style={s.kw} onClick={()=>setText(t=>t?`${t} #${kw}`:`#${kw}`)}>#{kw}</button>
                ))}
              </div>
            )}

            {platform==='line' && (
              <input style={s.ti} placeholder="配信タイトル" value={title} onChange={e=>setTitle(e.target.value)} />
            )}

            <textarea style={s.ta} rows={4}
              placeholder={platform==='x'?'投稿内容（280字）…':'LINE配信内容…'}
              value={text} onChange={e=>setText(e.target.value)}
              maxLength={platform==='x'?280:5000}
            />
            <div style={{ fontSize:'0.75rem', color:dim, textAlign:'right', marginBottom:8 }}>
              {platform==='x'?`${280-text.length}字`:''} 
            </div>

            <div style={s.confirmRow}>
              <button style={s.confirmBtn} onClick={addToLib}>ライブラリに保存</button>
              <button style={s.cancelBtn} onClick={()=>setComposing(false)}>キャンセル</button>
            </div>
          </>)}
        </div>

        {/* Platform tabs */}
        <div style={s.tabRow}>
          <button style={s.tab(libTab==='x','x')} onClick={()=>setLibTab('x')}>𝕏 X ({lib.filter(p=>p.platform==='x'&&!p.scheduledHour&&p.status!=='sent').length})</button>
          <button style={s.tab(libTab==='line','line')} onClick={()=>setLibTab('line')}>LINE ({lib.filter(p=>p.platform==='line'&&!p.scheduledHour&&p.status!=='sent').length})</button>
        </div>

        {/* Library grouped by category */}
        <div style={s.libBody}>
          {libItems.length===0 && (
            <p style={{ color:dim, fontSize:'0.85rem', textAlign:'center', marginTop:24 }}>
              まだ{libTab==='x'?'X':'LINE'}のコンテンツがありません
            </p>
          )}

          {CATS.map(cat => {
            const items = (groups[cat.id]??[]).sort((a,b)=>a.order-b.order);
            if (items.length===0) return null;
            const open = !collapsed[cat.id];
            return (
              <div key={cat.id} style={{ marginBottom:10 }}>
                <div style={s.groupHeader(cat.color, open)} onClick={()=>setCollapsed(c=>({...c,[cat.id]:!c[cat.id]}))}>
                  <span style={{ ...s.groupLabel, color:cat.color }}>{cat.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={s.groupCount}>{items.length}件</span>
                    <span style={{ color:dim, fontSize:'0.75rem' }}>{open?'▲':'▼'}</span>
                  </div>
                </div>

                {open && items.map(p=>(
                  <div key={p.id} style={s.card(dragOver===p.id)}
                    draggable
                    onDragStart={()=>onLibDragStart(p.id, p.category)}
                    onDragOver={e=>onLibDragOver(e,p.id)}
                    onDrop={()=>onLibDrop(p.id)}
                    onDragEnd={()=>{ dragIdRef.current=null; setDragOver(null); }}
                  >
                    <div style={s.cardTop}>
                      <span style={{ opacity:0.3, fontSize:'0.85rem' }}>⠿</span>
                      <span style={s.cardPf(p.platform)}>{p.platform==='x'?'𝕏':'LINE'}</span>
                      <span style={s.cardCat(p.category)}>{catOf(p.category)?.label}</span>
                    </div>
                    <div style={s.cardText}>{p.text}</div>
                    <div style={s.cardActions}>
                      <button style={s.actBtn('#F59E0B','rgba(245,158,11,0.1)')}
                        onClick={()=>{ setSchedModal(p); setSchedDate(todayStr()); setSchedHour(9); }}>
                        📅 カレンダーへ
                      </button>
                      <button style={s.actBtn('#22c55e','rgba(34,197,94,0.1)')}
                        onClick={()=>send(p)}>
                        {p.status==='sending'?'…':'今すぐ送信'}
                      </button>
                      <button style={s.actBtn('#ef4444','rgba(239,68,68,0.08)')} onClick={()=>del(p.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Uncategorized */}
          {(groups['__none']??[]).length>0 && (
            <div style={{ marginBottom:10 }}>
              <div style={s.groupHeader('#7070a0', !collapsed['__none'])} onClick={()=>setCollapsed(c=>({...c,'__none':!c['__none']}))}>
                <span style={{ ...s.groupLabel, color:'#7070a0' }}>📌 未分類</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={s.groupCount}>{groups['__none'].length}件</span>
                  <span style={{ color:dim, fontSize:'0.75rem' }}>{!collapsed['__none']?'▲':'▼'}</span>
                </div>
              </div>
              {!collapsed['__none'] && (groups['__none']??[]).map(p=>(
                <div key={p.id} style={s.card(dragOver===p.id)}
                  draggable onDragStart={()=>onLibDragStart(p.id,p.category)}
                  onDragOver={e=>onLibDragOver(e,p.id)} onDrop={()=>onLibDrop(p.id)}
                  onDragEnd={()=>{ dragIdRef.current=null; setDragOver(null); }}
                >
                  <div style={s.cardTop}>
                    <span style={{ opacity:0.3, fontSize:'0.85rem' }}>⠿</span>
                    <span style={s.cardPf(p.platform)}>{p.platform==='x'?'𝕏':'LINE'}</span>
                  </div>
                  <div style={s.cardText}>{p.text}</div>
                  <div style={s.cardActions}>
                    <button style={s.actBtn('#F59E0B','rgba(245,158,11,0.1)')}
                      onClick={()=>{ setSchedModal(p); setSchedDate(todayStr()); setSchedHour(9); }}>
                      📅 カレンダーへ
                    </button>
                    <button style={s.actBtn('#22c55e','rgba(34,197,94,0.1)')} onClick={()=>send(p)}>
                      {p.status==='sending'?'…':'今すぐ送信'}
                    </button>
                    <button style={s.actBtn('#ef4444','rgba(239,68,68,0.08)')} onClick={()=>del(p.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Timeline ── */}
      <div style={s.right}>
        {statusMsg && <div style={s.statusBar}>{statusMsg}</div>}
        <div style={s.rightHead}>
          <div style={s.dayNav}>
            <button style={s.dayBtn} onClick={prevDay}>‹</button>
            <span style={s.dayLabel}>{new Date(viewDate+'T00:00').toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})}</span>
            <button style={s.dayBtn} onClick={nextDay}>›</button>
          </div>
          <button style={s.dayBtn} onClick={()=>setViewDate(todayStr())}>今日</button>
        </div>

        <div style={s.timeline}>
          <p style={{ fontSize:'0.78rem', color:dim, marginBottom:12 }}>← 左からカードをドラッグして時間帯にドロップ</p>
          {HOURS.map(h=>{
            const hk = hourKey(viewDate,h);
            const items = byHour(hk);
            const isOver = dragOver===hk;
            return (
              <div key={h} style={s.hourRow(isOver)}
                onDragOver={e=>onTimelineDragOver(e,hk)}
                onDrop={()=>onTimelineDrop(hk)}
                onDragLeave={()=>setDragOver(null)}
              >
                <div style={s.hourLabel}>{fmtHour(h)}</div>
                <div style={s.hourSlot}>
                  {items.map(p=>(
                    <div key={p.id} style={s.schCard(p)} draggable
                      onDragStart={()=>{ dragIdRef.current=p.id; }}
                      onDragOver={e=>{e.stopPropagation();e.preventDefault();}}
                      onDrop={e=>onTimelineItemDrop(e,p.id)}
                    >
                      <div>
                        <span style={s.schPf(p.platform)}>{p.platform==='x'?'𝕏':'LINE'}</span>
                        {p.category&&<span style={{ fontSize:'0.68rem', color:catOf(p.category)?.color }}>{catOf(p.category)?.label}</span>}
                      </div>
                      <div style={s.schText}>{p.text}</div>
                      <div style={s.schBtns}>
                        <button style={s.schSend} onClick={()=>send(p)}>{p.status==='sending'?'…':'送信'}</button>
                        <button style={s.schDel} onClick={()=>unschedule(p.id)}>戻す</button>
                        <button style={s.schDel} onClick={()=>del(p.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Schedule Modal ── */}
      {schedModal && (
        <div style={s.overlay} onClick={()=>setSchedModal(null)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={s.modalTitle}>📅 カレンダーに追加</div>
            <div style={{ fontSize:'0.85rem', color:'#c0c0d8', marginBottom:14, lineHeight:1.4 }}>
              {schedModal.text.slice(0,60)}{schedModal.text.length>60?'…':''}
            </div>
            <label style={s.modalLabel}>日付</label>
            <input type="date" style={s.modalInput} value={schedDate} onChange={e=>setSchedDate(e.target.value)} />
            <label style={s.modalLabel}>時間帯</label>
            <select style={s.modalSel} value={schedHour} onChange={e=>setSchedHour(Number(e.target.value))}>
              {HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
            <div style={s.modalBtns}>
              <button style={s.modalOk} onClick={confirmSchedule}>追加する</button>
              <button style={s.modalCancel} onClick={()=>setSchedModal(null)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
