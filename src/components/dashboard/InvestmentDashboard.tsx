import { useEffect, useMemo, useState } from 'react';

type Thesis = {
  id: string;
  title: string;
  confidence: number;
  status: 'watching' | 'active' | 'invalidated';
  nextTrigger: string;
  invalidation: string;
};

type Position = {
  id: string;
  asset: string;
  amount: number;
  entryReason: string;
  status: 'seed' | 'core' | 'exit';
  entryDate: string;
};

type Intelligence = {
  id: string;
  summary: string;
  source: string;
  createdAt: string;
};

type MarketSignal = {
  key: string;
  label: string;
  symbol: string;
  ok: boolean;
  formatted: string;
  changePct: number | null;
  observedAt: string | null;
  source: string;
};

type DashboardState = {
  version: 1;
  capital: number;
  theses: Thesis[];
  positions: Position[];
  intelligence: Intelligence[];
};

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

function isState(value: unknown): value is Partial<DashboardState> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeState(value: Partial<DashboardState>): DashboardState {
  return {
    version: 1,
    capital: typeof value.capital === 'number' ? Math.max(0, value.capital) : baseState.capital,
    theses: Array.isArray(value.theses) && value.theses.length ? value.theses : baseState.theses,
    positions: Array.isArray(value.positions) ? value.positions : [],
    intelligence: Array.isArray(value.intelligence) ? value.intelligence : baseState.intelligence,
  };
}

export default function InvestmentDashboard() {
  const [state, setState] = useState<DashboardState>(baseState);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'saved' | 'saving' | 'local' | 'error'>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketSignal[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketAsOf, setMarketAsOf] = useState<string | null>(null);
  const [draft, setDraft] = useState({ asset: '1475 TOPIX ETF', amount: '4000', entryReason: '日本資金回帰の種ポジション' });
  const [intelDraft, setIntelDraft] = useState({ summary: '', source: '' });

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      let local: DashboardState | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (isState(parsed)) local = mergeState(parsed);
        }
      } catch {}
      if (local && !cancelled) setState(local);

      try {
        const res = await fetch('/api/dashboard/investment-state', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data?.ok && isState(data.state) && Object.keys(data.state).length) {
          if (!cancelled) setState(mergeState(data.state));
        }
        if (!cancelled) setSyncStatus(res.ok ? 'saved' : local ? 'local' : 'error');
      } catch {
        if (!cancelled) setSyncStatus(local ? 'local' : 'error');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    const timer = window.setTimeout(async () => {
      setSyncStatus('saving');
      try {
        const res = await fetch('/api/dashboard/investment-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
        });
        if (!res.ok) throw new Error('save_failed');
        const data = await res.json();
        setLastSavedAt(data.savedAt || new Date().toISOString());
        setSyncStatus('saved');
      } catch {
        setSyncStatus('local');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  const loadMarket = async () => {
    setMarketLoading(true);
    try {
      const res = await fetch('/api/dashboard/investment-market', { cache: 'no-store' });
      const data = await res.json();
      setMarket(Array.isArray(data.signals) ? data.signals : []);
      setMarketAsOf(data.asOf || new Date().toISOString());
    } catch {
      setMarket([]);
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => { loadMarket(); }, []);

  const invested = useMemo(
    () => state.positions.filter(p => p.status !== 'exit').reduce((sum, p) => sum + p.amount, 0),
    [state.positions],
  );
  const cash = Math.max(state.capital - invested, 0);

  const addPosition = () => {
    const amount = Number(draft.amount);
    if (!draft.asset.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const position: Position = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      asset: draft.asset.trim(),
      amount,
      entryReason: draft.entryReason.trim(),
      status: 'seed',
      entryDate: new Date().toISOString(),
    };
    setState(s => ({ ...s, positions: [position, ...s.positions] }));
    setDraft(d => ({ ...d, amount: '', entryReason: '' }));
  };

  const cyclePosition = (id: string) => {
    setState(s => ({
      ...s,
      positions: s.positions.map(p => p.id === id
        ? { ...p, status: p.status === 'seed' ? 'core' : p.status === 'core' ? 'exit' : 'seed' }
        : p),
    }));
  };

  const changeConfidence = (id: string, delta: number) => {
    setState(s => ({
      ...s,
      theses: s.theses.map(t => t.id === id
        ? { ...t, confidence: Math.max(0, Math.min(100, t.confidence + delta)) }
        : t),
    }));
  };

  const addIntelligence = () => {
    if (!intelDraft.summary.trim()) return;
    const item: Intelligence = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      summary: intelDraft.summary.trim().slice(0, 2000),
      source: intelDraft.source.trim().slice(0, 300) || 'Manual / AI',
      createdAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, intelligence: [item, ...s.intelligence].slice(0, 100) }));
    setIntelDraft({ summary: '', source: '' });
  };

  const syncLabel = syncStatus === 'saved' ? 'Cloud Saved' : syncStatus === 'saving' ? 'Saving…' : syncStatus === 'local' ? 'Local Fallback' : syncStatus === 'error' ? 'Save Error' : 'Loading…';

  return (
    <div className="investment-dashboard">
      <style>{`
        .investment-dashboard{color:#D4C5A9;font-family:'Zen Kaku Gothic New',sans-serif;padding-bottom:48px}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:22px}.eyebrow,.label{color:#7A6F5F;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}.eyebrow{margin-bottom:6px}h1{margin:0;font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:300;color:#C9A96E}.hero p{margin:8px 0 0;color:#7A6F5F;max-width:760px;line-height:1.7;font-size:.88rem}.status{border:1px solid #2E2822;background:#1A1612;padding:10px 14px;color:#C9A96E;font-size:.72rem;white-space:nowrap}.toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}.muted{color:#7A6F5F;font-size:.76rem}.grid{display:grid;gap:12px}.signals{grid-template-columns:repeat(4,minmax(0,1fr))}.card{border:1px solid #2E2822;background:#1A1612;padding:16px}.value{font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:#D4C5A9;margin-top:6px}.change{font-size:.72rem;margin-top:5px;color:#8B7355}.note{color:#7A6F5F;font-size:.73rem;line-height:1.5;margin-top:8px}.section{margin-top:28px}.section-title{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2E2822;padding-bottom:9px;margin-bottom:14px}.section-title h2{margin:0;font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:300;color:#C9A96E;letter-spacing:.05em}.two{grid-template-columns:1.35fr .65fr}.thesis-title{font-size:1rem;margin:8px 0 12px}.confidence-row{display:flex;align-items:center;gap:12px;margin-bottom:14px}.meter{flex:1;height:6px;background:#2E2822;overflow:hidden}.meter>span{display:block;height:100%;background:#8B7355}.confidence-num{color:#C9A96E;min-width:44px;text-align:right}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px}.meta-box{border-top:1px solid #2E2822;padding-top:10px}.meta-box b{display:block;font-size:.68rem;color:#8B7355;margin-bottom:5px}.meta-box span{color:#7A6F5F;font-size:.78rem;line-height:1.55}.btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}button{background:transparent;border:1px solid #3A332B;color:#D4C5A9;padding:8px 11px;cursor:pointer;font:inherit;font-size:.76rem}button:hover{border-color:#8B7355;color:#C9A96E}.capital-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.money{font-family:'Cormorant Garamond',serif;font-size:1.35rem;color:#C9A96E}.form{display:grid;grid-template-columns:1.1fr .45fr 1.5fr auto;gap:8px;margin-top:14px}.intel-form{grid-template-columns:2fr 1fr auto}input{width:100%;background:#0D0B08;color:#D4C5A9;border:1px solid #2E2822;padding:9px 10px;font:inherit;font-size:.8rem}.position{display:grid;grid-template-columns:1.1fr .45fr 1.6fr .55fr auto;gap:10px;align-items:center;border-bottom:1px solid #2E2822;padding:10px 0;font-size:.78rem}.pill{display:inline-block;border:1px solid #3A332B;padding:3px 7px;font-size:.66rem;color:#8B7355}.automation{grid-template-columns:repeat(4,1fr)}.auto-state{font-size:.8rem;color:#C9A96E;margin-top:4px}.feed{display:grid;gap:8px}.feed-item{border-left:2px solid #5A4D3A;padding:8px 0 8px 12px}.feed-item strong{display:block;font-size:.8rem;margin-bottom:4px}.feed-item span{color:#7A6F5F;font-size:.72rem}.manual{opacity:.78}@media(max-width:1000px){.signals,.automation{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}}@media(max-width:700px){.hero{display:block}.status{display:inline-block;margin-top:14px}.signals,.automation,.capital-grid{grid-template-columns:1fr}.form,.position{grid-template-columns:1fr}.meta{grid-template-columns:1fr}.toolbar{align-items:flex-start;flex-direction:column}}
      `}</style>

      <div className="hero">
        <div>
          <div className="eyebrow">MASA OS / Capital Flow Lab</div>
          <h1>Investment Dashboard</h1>
          <p>世界のFlowを「観測 → 仮説 → 少額実験 → 検証 → 増減判断」に変換する司令盤。実注文は手動のまま、情報・仮説・記録を半自動化する。</p>
        </div>
        <div className="status">{syncLabel}</div>
      </div>

      <div className="toolbar">
        <span className="muted">市場データ: {marketLoading ? '取得中…' : marketAsOf ? new Date(marketAsOf).toLocaleString('ja-JP') : '取得不可'}</span>
        <button onClick={loadMarket} disabled={marketLoading}>{marketLoading ? '更新中…' : '市場データ更新'}</button>
      </div>

      <div className="grid signals">
        {market.map(s => (
          <div className="card" key={s.key}>
            <div className="label">{s.label}</div>
            <div className="value">{s.formatted}</div>
            <div className="change">{s.changePct == null ? '—' : `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`}</div>
            <div className="note">{s.observedAt ? new Date(s.observedAt).toLocaleString('ja-JP') : '時刻不明'} · {s.source}</div>
          </div>
        ))}
        <div className="card manual"><div className="label">JGB 10Y</div><div className="value">Manual</div><div className="note">誤った代理ティッカーは使わず、公式/信頼系列を次段階で接続。</div></div>
        <div className="card manual"><div className="label">BOJ</div><div className="value">9/17–18</div><div className="note">政策金利・声明・総裁会見をイベントとして監視。</div></div>
      </div>

      <div className="section">
        <div className="section-title"><h2>AI Strategy Engine</h2><span className="muted">仮説を事実で更新</span></div>
        <div className="grid two">
          <div className="card">
            {state.theses.map(t => (
              <div key={t.id}>
                <div className="label">{t.id} · {t.status}</div>
                <div className="thesis-title">{t.title}</div>
                <div className="confidence-row"><div className="meter"><span style={{ width: `${t.confidence}%` }} /></div><div className="confidence-num">{t.confidence}%</div></div>
                <div className="meta"><div className="meta-box"><b>NEXT TRIGGER</b><span>{t.nextTrigger}</span></div><div className="meta-box"><b>INVALIDATION</b><span>{t.invalidation}</span></div></div>
                <div className="btns"><button onClick={() => changeConfidence(t.id, 5)}>+5 強化</button><button onClick={() => changeConfidence(t.id, -5)}>-5 弱化</button></div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="label">Experiment Capital</div>
            <div className="capital-grid"><div><div className="label">上限</div><div className="money">¥{state.capital.toLocaleString()}</div></div><div><div className="label">投下</div><div className="money">¥{invested.toLocaleString()}</div></div><div><div className="label">待機</div><div className="money">¥{cash.toLocaleString()}</div></div></div>
            <div style={{ marginTop: 14 }}><div className="label">実験資金</div><input type="number" value={state.capital} onChange={e => setState(s => ({ ...s, capital: Math.max(0, Number(e.target.value) || 0) }))} /></div>
            {lastSavedAt && <div className="note">最終保存: {new Date(lastSavedAt).toLocaleString('ja-JP')}</div>}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Positions / Experiments</h2><span className="muted">seed → core → exit</span></div>
        <div className="card">
          <div className="form"><input value={draft.asset} onChange={e => setDraft(d => ({ ...d, asset: e.target.value }))} placeholder="Asset" /><input type="number" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} placeholder="金額" /><input value={draft.entryReason} onChange={e => setDraft(d => ({ ...d, entryReason: e.target.value }))} placeholder="なぜ入るか" /><button onClick={addPosition}>追加</button></div>
          <div style={{ marginTop: 16 }}>
            {state.positions.length === 0 ? <div className="muted">まだポジションなし。最初は種ポジションから。</div> : state.positions.map(p => (
              <div className="position" key={p.id}><strong>{p.asset}</strong><span>¥{p.amount.toLocaleString()}</span><span className="muted">{p.entryReason || '—'}</span><span className="pill">{p.status}</span><button onClick={() => cyclePosition(p.id)}>状態変更</button></div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Latest Intelligence</h2><span className="muted">重要情報だけ残す</span></div>
        <div className="card">
          <div className="form intel-form"><input value={intelDraft.summary} onChange={e => setIntelDraft(d => ({ ...d, summary: e.target.value }))} placeholder="事実 / 変化 / 判断材料" /><input value={intelDraft.source} onChange={e => setIntelDraft(d => ({ ...d, source: e.target.value }))} placeholder="Source" /><button onClick={addIntelligence}>追加</button></div>
          <div className="feed" style={{ marginTop: 16 }}>
            {state.intelligence.slice(0, 12).map(item => <div className="feed-item" key={item.id}><strong>{item.summary}</strong><span>{item.source} · {new Date(item.createdAt).toLocaleString('ja-JP')}</span></div>)}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Automation Layer</h2><span className="muted">半自動運用の現在地</span></div>
        <div className="grid automation">
          <div className="card"><div className="label">Market Data</div><div className="auto-state">LIVE</div><div className="note">為替・TOPIX・銀行ETF・TOPIX ETF・米10年・NASDAQ・BTCを画面ロード時に取得。</div></div>
          <div className="card"><div className="label">State Storage</div><div className="auto-state">LIVE</div><div className="note">Supabaseへ自動保存。障害時はLocalStorageへフォールバック。</div></div>
          <div className="card"><div className="label">AI Analysis</div><div className="auto-state">SEMI-AUTO</div><div className="note">AI/人間が重要情報と確信度を更新。状態は全端末で共有。</div></div>
          <div className="card"><div className="label">Broker Orders</div><div className="auto-state">MANUAL</div><div className="note">注文自動化は入れない。最終判断と発注はMASA。</div></div>
        </div>
      </div>
    </div>
  );
}
