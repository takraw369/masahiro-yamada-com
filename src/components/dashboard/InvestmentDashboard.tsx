import { useEffect, useMemo, useState } from 'react';

type Thesis = { id:string; title:string; confidence:number; status:'watching'|'active'|'invalidated'; nextTrigger:string; invalidation:string };
type Position = { id:string; asset:string; amount:number; entryReason:string; status:'seed'|'core'|'exit'; entryDate:string };
type Intelligence = { id:string; summary:string; source:string; createdAt:string };
type MarketSignal = { key:string; label:string; symbol:string; ok:boolean; formatted:string; changePct:number|null; observedAt:string|null; source:string };
type DashboardState = { version:1; capital:number; theses:Thesis[]; positions:Position[]; intelligence:Intelligence[] };

const STORAGE_KEY = 'masa-investment-dashboard-v2';
const baseState: DashboardState = {
  version: 1,
  capital: 30000,
  theses: [{
    id: 'THESIS-001',
    title: '日本マネー逆流｜Japan Capital Repatriation',
    confidence: 64,
    status: 'active',
    nextTrigger: '日銀利上げ + 円高定着 + 日本勢の海外証券売り越し',
    invalidation: '日銀が正常化を後退 / 円安再加速 / 国内金利低下',
  }],
  positions: [],
  intelligence: [{
    id: 'seed-thesis-001',
    summary: 'THESIS-001：日銀正常化 → 円高 → 国内金利上昇 → 資金回帰の連鎖を監視。',
    source: 'Capital Flow Lab',
    createdAt: '2026-09-08T00:00:00.000Z',
  }],
};

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
function mergeState(v: any): DashboardState {
  return {
    version: 1,
    capital: typeof v?.capital === 'number' ? Math.max(0, v.capital) : baseState.capital,
    theses: Array.isArray(v?.theses) && v.theses.length ? v.theses : baseState.theses,
    positions: Array.isArray(v?.positions) ? v.positions : [],
    intelligence: Array.isArray(v?.intelligence) ? v.intelligence : baseState.intelligence,
  };
}
const makeId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

export default function InvestmentDashboard() {
  const [state, setState] = useState<DashboardState>(baseState);
  const [hydrated, setHydrated] = useState(false);
  const [sync, setSync] = useState<'loading'|'saved'|'saving'|'local'|'error'>('loading');
  const [market, setMarket] = useState<MarketSignal[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketAsOf, setMarketAsOf] = useState<string|null>(null);
  const [draft, setDraft] = useState({ asset:'1475 TOPIX ETF', amount:'4000', entryReason:'日本資金回帰の種ポジション' });
  const [intel, setIntel] = useState({ summary:'', source:'' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: DashboardState | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const parsed = JSON.parse(raw); if (isRecord(parsed)) local = mergeState(parsed); }
      } catch {}
      if (local && !cancelled) setState(local);
      try {
        const r = await fetch('/api/dashboard/investment-state', { cache:'no-store' });
        const d = await r.json();
        if (r.ok && d?.ok && isRecord(d.state) && Object.keys(d.state).length && !cancelled) setState(mergeState(d.state));
        if (!cancelled) setSync(r.ok ? 'saved' : local ? 'local' : 'error');
      } catch { if (!cancelled) setSync(local ? 'local' : 'error'); }
      finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    const timer = window.setTimeout(async () => {
      setSync('saving');
      try {
        const r = await fetch('/api/dashboard/investment-state', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({state}) });
        if (!r.ok) throw new Error('save_failed');
        setSync('saved');
      } catch { setSync('local'); }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  const loadMarket = async () => {
    setMarketLoading(true);
    try {
      const r = await fetch('/api/dashboard/investment-market', { cache:'no-store' });
      const d = await r.json();
      setMarket(Array.isArray(d?.signals) ? d.signals : []);
      setMarketAsOf(d?.asOf || new Date().toISOString());
    } catch { setMarket([]); }
    finally { setMarketLoading(false); }
  };
  useEffect(() => { loadMarket(); }, []);

  const invested = useMemo(() => state.positions.filter(p => p.status !== 'exit').reduce((n,p) => n + p.amount, 0), [state.positions]);
  const cash = Math.max(state.capital - invested, 0);
  const syncLabel = sync === 'saved' ? 'Cloud Saved' : sync === 'saving' ? 'Saving…' : sync === 'local' ? 'Local Fallback' : sync === 'error' ? 'Save Error' : 'Loading…';

  const changeConfidence = (id:string, delta:number) => setState(s => ({...s, theses:s.theses.map(t => t.id===id ? {...t, confidence:Math.max(0,Math.min(100,t.confidence+delta))} : t)}));
  const addPosition = () => {
    const amount = Number(draft.amount);
    if (!draft.asset.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const p: Position = { id:makeId(), asset:draft.asset.trim(), amount, entryReason:draft.entryReason.trim(), status:'seed', entryDate:new Date().toISOString() };
    setState(s => ({...s, positions:[p,...s.positions]}));
    setDraft(d => ({...d, amount:'', entryReason:''}));
  };
  const cyclePosition = (id:string) => setState(s => ({...s, positions:s.positions.map(p => p.id===id ? {...p,status:p.status==='seed'?'core':p.status==='core'?'exit':'seed'} : p)}));
  const addIntel = () => {
    if (!intel.summary.trim()) return;
    const i: Intelligence = { id:makeId(), summary:intel.summary.trim().slice(0,2000), source:intel.source.trim().slice(0,300)||'Manual / AI', createdAt:new Date().toISOString() };
    setState(s => ({...s, intelligence:[i,...s.intelligence].slice(0,100)}));
    setIntel({summary:'',source:''});
  };

  return <div className="inv">
    <style>{`
      .inv{color:#D4C5A9;padding-bottom:48px}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:22px}.eyebrow,.label{color:#7A6F5F;font-size:.69rem;letter-spacing:.1em;text-transform:uppercase}.hero h1{margin:4px 0 0;font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:300;color:#C9A96E}.hero p{margin:8px 0 0;color:#7A6F5F;max-width:760px;line-height:1.7;font-size:.86rem}.status,.card{border:1px solid #2E2822;background:#1A1612}.status{padding:9px 13px;color:#C9A96E;font-size:.72rem;white-space:nowrap}.toolbar,.section-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.toolbar{margin-bottom:12px}.muted,.note{color:#7A6F5F;font-size:.73rem}.grid{display:grid;gap:12px}.signals{grid-template-columns:repeat(4,minmax(0,1fr))}.card{padding:16px}.value,.money{font-family:'Cormorant Garamond',serif;color:#D4C5A9}.value{font-size:1.28rem;margin-top:6px}.change{font-size:.72rem;color:#8B7355;margin-top:5px}.note{line-height:1.5;margin-top:7px}.section{margin-top:28px}.section-title{border-bottom:1px solid #2E2822;padding-bottom:8px;margin-bottom:13px}.section-title h2{margin:0;font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:300;color:#C9A96E}.two{grid-template-columns:1.35fr .65fr}.thesis{font-size:1rem;margin:8px 0 12px}.confidence{display:flex;align-items:center;gap:12px}.meter{height:6px;background:#2E2822;flex:1}.meter span{display:block;height:100%;background:#8B7355}.num{color:#C9A96E}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.meta>div{border-top:1px solid #2E2822;padding-top:9px}.meta b{display:block;color:#8B7355;font-size:.68rem;margin-bottom:5px}.meta span{color:#7A6F5F;font-size:.77rem;line-height:1.5}.btns{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}button{background:transparent;border:1px solid #3A332B;color:#D4C5A9;padding:8px 11px;cursor:pointer;font:inherit;font-size:.75rem}button:hover{border-color:#8B7355;color:#C9A96E}.capital{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.money{font-size:1.3rem;color:#C9A96E}.form{display:grid;grid-template-columns:1.1fr .45fr 1.5fr auto;gap:8px;margin-top:12px}.intel-form{grid-template-columns:2fr 1fr auto}input{width:100%;background:#0D0B08;color:#D4C5A9;border:1px solid #2E2822;padding:9px 10px;font:inherit;font-size:.79rem}.position{display:grid;grid-template-columns:1fr .45fr 1.5fr .45fr auto;gap:9px;align-items:center;padding:10px 0;border-bottom:1px solid #2E2822;font-size:.78rem}.pill{border:1px solid #3A332B;padding:3px 7px;color:#8B7355;font-size:.66rem}.feed{display:grid;gap:8px;margin-top:14px}.feed-item{border-left:2px solid #5A4D3A;padding:7px 0 7px 11px}.feed-item strong{display:block;font-size:.79rem}.feed-item span{color:#7A6F5F;font-size:.7rem}.auto{grid-template-columns:repeat(4,1fr)}.auto-state{color:#C9A96E;font-size:.8rem;margin-top:5px}@media(max-width:1000px){.signals,.auto{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}}@media(max-width:700px){.hero{display:block}.status{display:inline-block;margin-top:12px}.signals,.auto,.capital,.meta,.form,.position{grid-template-columns:1fr}.toolbar{align-items:flex-start;flex-direction:column}}
    `}</style>

    <div className="hero"><div><div className="eyebrow">MASA OS / Capital Flow Lab</div><h1>Investment Dashboard</h1><p>世界のFlowを「観測 → 仮説 → 少額実験 → 検証 → 増減判断」に変換する。情報と記録は半自動、実注文は手動。</p></div><div className="status">{syncLabel}</div></div>
    <div className="toolbar"><span className="muted">市場データ: {marketLoading?'取得中…':marketAsOf?new Date(marketAsOf).toLocaleString('ja-JP'):'取得不可'}</span><button onClick={loadMarket} disabled={marketLoading}>{marketLoading?'更新中…':'市場データ更新'}</button></div>

    <div className="grid signals">
      {market.map(s => <div className="card" key={s.key}><div className="label">{s.label}</div><div className="value">{s.formatted}</div><div className="change">{s.changePct==null?'—':`${s.changePct>=0?'+':''}${s.changePct.toFixed(2)}%`}</div><div className="note">{s.observedAt?new Date(s.observedAt).toLocaleString('ja-JP'):'時刻不明'} · {s.source}</div></div>)}
      <div className="card"><div className="label">JGB 10Y</div><div className="value">Manual</div><div className="note">不確かな代理Tickerは使わず、公式/承認済み系列接続まで手動監視。</div></div>
      <div className="card"><div className="label">BOJ</div><div className="value">9/17–18</div><div className="note">政策金利・声明・総裁会見をイベント監視。</div></div>
    </div>

    <section className="section"><div className="section-title"><h2>AI Strategy Engine</h2><span className="muted">仮説は反証可能に保つ</span></div><div className="grid two">
      <div className="card">{state.theses.map(t => <div key={t.id}><div className="label">{t.id} · {t.status}</div><div className="thesis">{t.title}</div><div className="confidence"><div className="meter"><span style={{width:`${t.confidence}%`}}/></div><div className="num">{t.confidence}%</div></div><div className="meta"><div><b>NEXT TRIGGER</b><span>{t.nextTrigger}</span></div><div><b>INVALIDATION</b><span>{t.invalidation}</span></div></div><div className="btns"><button onClick={()=>changeConfidence(t.id,5)}>+5 強化</button><button onClick={()=>changeConfidence(t.id,-5)}>-5 弱化</button></div></div>)}</div>
      <div className="card"><div className="label">Experiment Capital</div><div className="capital"><div><div className="label">上限</div><div className="money">¥{state.capital.toLocaleString()}</div></div><div><div className="label">投下</div><div className="money">¥{invested.toLocaleString()}</div></div><div><div className="label">待機</div><div className="money">¥{cash.toLocaleString()}</div></div></div><div style={{marginTop:14}}><div className="label">実験資金</div><input type="number" value={state.capital} onChange={e=>setState(s=>({...s,capital:Math.max(0,Number(e.target.value)||0)}))}/></div></div>
    </div></section>

    <section className="section"><div className="section-title"><h2>Positions / Experiments</h2><span className="muted">seed → core → exit</span></div><div className="card"><div className="form"><input value={draft.asset} onChange={e=>setDraft(d=>({...d,asset:e.target.value}))}/><input type="number" value={draft.amount} onChange={e=>setDraft(d=>({...d,amount:e.target.value}))}/><input value={draft.entryReason} onChange={e=>setDraft(d=>({...d,entryReason:e.target.value}))}/><button onClick={addPosition}>追加</button></div><div style={{marginTop:14}}>{state.positions.length===0?<div className="muted">まだポジションなし。最初は種ポジションから。</div>:state.positions.map(p=><div className="position" key={p.id}><strong>{p.asset}</strong><span>¥{p.amount.toLocaleString()}</span><span className="muted">{p.entryReason||'—'}</span><span className="pill">{p.status}</span><button onClick={()=>cyclePosition(p.id)}>状態変更</button></div>)}</div></div></section>

    <section className="section"><div className="section-title"><h2>Latest Intelligence</h2><span className="muted">重要情報だけ残す</span></div><div className="card"><div className="form intel-form"><input value={intel.summary} onChange={e=>setIntel(d=>({...d,summary:e.target.value}))} placeholder="事実 / 変化 / 判断材料"/><input value={intel.source} onChange={e=>setIntel(d=>({...d,source:e.target.value}))} placeholder="Source"/><button onClick={addIntel}>追加</button></div><div className="feed">{state.intelligence.slice(0,12).map(i=><div className="feed-item" key={i.id}><strong>{i.summary}</strong><span>{i.source} · {new Date(i.createdAt).toLocaleString('ja-JP')}</span></div>)}</div></div></section>

    <section className="section"><div className="section-title"><h2>Automation Layer</h2><span className="muted">半自動運用の現在地</span></div><div className="grid auto"><div className="card"><div className="label">Market Data</div><div className="auto-state">LIVE</div><div className="note">主要市場を画面ロード時に取得。</div></div><div className="card"><div className="label">State Storage</div><div className="auto-state">LIVE</div><div className="note">Supabase自動保存、Local fallback。</div></div><div className="card"><div className="label">AI Analysis</div><div className="auto-state">SEMI-AUTO</div><div className="note">重要情報と確信度を人/AIで更新。</div></div><div className="card"><div className="label">Broker Orders</div><div className="auto-state">MANUAL</div><div className="note">最終判断と発注はMASA。</div></div></div></section>
  </div>;
}
