import { useEffect, useMemo, useState } from 'react';

type Signal = {
  key: string;
  label: string;
  value: string;
  state: 'bullish' | 'neutral' | 'risk';
  note: string;
};

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
};

const STORAGE_KEY = 'masa-investment-dashboard-v1';

const baseSignals: Signal[] = [
  { key: 'usdjpy', label: 'USD / JPY', value: 'LIVE連携予定', state: 'neutral', note: '155 → 150 → 145 の流れを監視' },
  { key: 'jgb10', label: 'JGB 10Y', value: 'LIVE連携予定', state: 'neutral', note: '国内金利上昇＝資金回帰の中核' },
  { key: 'boj', label: 'BOJ', value: '9/17–18', state: 'neutral', note: '利上げ・ガイダンスを監視' },
  { key: 'topix', label: 'TOPIX', value: 'LIVE連携予定', state: 'bullish', note: '日本回帰の広い受け皿' },
  { key: 'banks', label: 'Banks', value: 'LIVE連携予定', state: 'bullish', note: '金利正常化の直接恩恵' },
  { key: 'ust10', label: 'US 10Y', value: 'LIVE連携予定', state: 'risk', note: '日本勢の米債売却圧力を確認' },
  { key: 'nasdaq', label: 'NASDAQ', value: 'LIVE連携予定', state: 'neutral', note: 'キャリー巻き戻し波及を監視' },
  { key: 'btc', label: 'BTC', value: 'LIVE連携予定', state: 'neutral', note: 'リスク資産の流動性変化を確認' },
];

const baseTheses: Thesis[] = [
  {
    id: 'THESIS-001',
    title: '日本マネー逆流｜Japan Capital Repatriation',
    confidence: 64,
    status: 'active',
    nextTrigger: '日銀利上げ + 円高定着 + 日本勢の海外証券売り越し',
    invalidation: '日銀が正常化を後退 / 円安再加速 / 国内金利低下',
  },
];

const basePositions: Position[] = [];

export default function InvestmentDashboard() {
  const [theses, setTheses] = useState<Thesis[]>(baseTheses);
  const [positions, setPositions] = useState<Position[]>(basePositions);
  const [capital, setCapital] = useState(30000);
  const [draft, setDraft] = useState({ asset: '1475 TOPIX ETF', amount: '4000', entryReason: '日本資金回帰の種ポジション' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.theses)) setTheses(parsed.theses);
      if (Array.isArray(parsed.positions)) setPositions(parsed.positions);
      if (typeof parsed.capital === 'number') setCapital(parsed.capital);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theses, positions, capital }));
    } catch {}
  }, [theses, positions, capital]);

  const invested = useMemo(() => positions.filter(p => p.status !== 'exit').reduce((sum, p) => sum + p.amount, 0), [positions]);
  const cash = Math.max(capital - invested, 0);

  const addPosition = () => {
    const amount = Number(draft.amount);
    if (!draft.asset.trim() || !amount || amount <= 0) return;
    setPositions(prev => [{
      id: Math.random().toString(36).slice(2, 9),
      asset: draft.asset.trim(),
      amount,
      entryReason: draft.entryReason.trim(),
      status: 'seed',
    }, ...prev]);
    setDraft(d => ({ ...d, amount: '', entryReason: '' }));
  };

  const changeConfidence = (id: string, delta: number) => {
    setTheses(prev => prev.map(t => t.id === id ? { ...t, confidence: Math.max(0, Math.min(100, t.confidence + delta)) } : t));
  };

  const stateLabel = (state: Signal['state']) => state === 'bullish' ? '追い風' : state === 'risk' ? '警戒' : '観察';

  return (
    <div className="investment-dashboard">
      <style>{`
        .investment-dashboard { color:#D4C5A9; font-family:'Zen Kaku Gothic New',sans-serif; padding-bottom:48px; }
        .hero { display:flex; justify-content:space-between; gap:24px; align-items:flex-end; margin-bottom:28px; }
        .eyebrow { color:#8B7355; font-size:.72rem; letter-spacing:.16em; text-transform:uppercase; margin-bottom:6px; }
        h1 { margin:0; font-family:'Cormorant Garamond',serif; font-size:2rem; font-weight:300; color:#C9A96E; }
        .hero p { margin:8px 0 0; color:#7A6F5F; max-width:760px; line-height:1.7; font-size:.9rem; }
        .status { border:1px solid #2E2822; background:#1A1612; padding:10px 14px; color:#C9A96E; font-size:.75rem; white-space:nowrap; }
        .grid { display:grid; gap:14px; }
        .signals { grid-template-columns:repeat(4,minmax(0,1fr)); margin-bottom:28px; }
        .card { border:1px solid #2E2822; background:#1A1612; padding:16px; }
        .label { color:#7A6F5F; font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px; }
        .value { font-family:'Cormorant Garamond',serif; font-size:1.28rem; color:#D4C5A9; }
        .note { color:#7A6F5F; font-size:.75rem; line-height:1.5; margin-top:8px; }
        .pill { display:inline-block; margin-top:10px; border:1px solid #3A332B; padding:3px 7px; font-size:.67rem; color:#8B7355; }
        .section { margin-top:28px; }
        .section-title { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #2E2822; padding-bottom:9px; margin-bottom:14px; }
        .section-title h2 { margin:0; font-family:'Cormorant Garamond',serif; font-size:1.15rem; font-weight:300; color:#C9A96E; letter-spacing:.05em; }
        .two { grid-template-columns:1.35fr .65fr; }
        .thesis-title { font-size:1rem; color:#D4C5A9; margin-bottom:12px; }
        .confidence-row { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .meter { flex:1; height:6px; background:#2E2822; overflow:hidden; }
        .meter > span { display:block; height:100%; background:#8B7355; }
        .confidence-num { color:#C9A96E; min-width:44px; text-align:right; }
        .meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .meta-box { border-top:1px solid #2E2822; padding-top:10px; }
        .meta-box b { display:block; font-size:.68rem; color:#8B7355; letter-spacing:.08em; margin-bottom:5px; }
        .meta-box span { color:#7A6F5F; font-size:.78rem; line-height:1.55; }
        .btns { display:flex; gap:8px; margin-top:14px; }
        button { background:transparent; border:1px solid #3A332B; color:#D4C5A9; padding:8px 11px; cursor:pointer; font:inherit; font-size:.78rem; }
        button:hover { border-color:#8B7355; color:#C9A96E; }
        .capital-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .money { font-family:'Cormorant Garamond',serif; font-size:1.35rem; color:#C9A96E; }
        .form { display:grid; grid-template-columns:1.2fr .5fr 1.5fr auto; gap:8px; margin-top:14px; }
        input { width:100%; background:#0D0B08; color:#D4C5A9; border:1px solid #2E2822; padding:9px 10px; font:inherit; font-size:.8rem; }
        .position { display:grid; grid-template-columns:1.2fr .5fr 1.7fr auto; gap:10px; align-items:center; border-bottom:1px solid #2E2822; padding:10px 0; font-size:.8rem; }
        .muted { color:#7A6F5F; }
        .automation { grid-template-columns:repeat(4,1fr); }
        .auto-state { font-size:.8rem; color:#C9A96E; margin-top:4px; }
        .feed { display:grid; gap:8px; }
        .feed-item { border-left:2px solid #5A4D3A; padding:8px 0 8px 12px; }
        .feed-item strong { display:block; font-size:.82rem; color:#D4C5A9; margin-bottom:4px; }
        .feed-item span { color:#7A6F5F; font-size:.74rem; }
        @media (max-width:1000px) { .signals,.automation { grid-template-columns:repeat(2,1fr); } .two { grid-template-columns:1fr; } }
        @media (max-width:700px) { .hero { display:block; } .status { display:inline-block; margin-top:14px; } .signals,.automation,.capital-grid { grid-template-columns:1fr; } .form,.position { grid-template-columns:1fr; } .meta { grid-template-columns:1fr; } }
      `}</style>

      <div className="hero">
        <div>
          <div className="eyebrow">MASA OS / Capital Flow Lab</div>
          <h1>Investment Dashboard</h1>
          <p>情報を読む場所ではなく、世界のFlowを「仮説 → 少額実験 → 検証 → 増減判断」に変換する司令盤。戦略はAI側で更新し、人は重要な意思決定だけを見る。</p>
        </div>
        <div className="status">MVP · AI連携準備中</div>
      </div>

      <div className="grid signals">
        {baseSignals.map(s => (
          <div className="card" key={s.key}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            <div className="note">{s.note}</div>
            <span className="pill">{stateLabel(s.state)}</span>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title"><h2>AI Strategy Engine</h2><span className="muted">仮説の確信度を更新</span></div>
        <div className="grid two">
          <div className="card">
            {theses.map(t => (
              <div key={t.id}>
                <div className="label">{t.id} · {t.status}</div>
                <div className="thesis-title">{t.title}</div>
                <div className="confidence-row">
                  <div className="meter"><span style={{ width: `${t.confidence}%` }} /></div>
                  <div className="confidence-num">{t.confidence}%</div>
                </div>
                <div className="meta">
                  <div className="meta-box"><b>NEXT TRIGGER</b><span>{t.nextTrigger}</span></div>
                  <div className="meta-box"><b>INVALIDATION</b><span>{t.invalidation}</span></div>
                </div>
                <div className="btns">
                  <button onClick={() => changeConfidence(t.id, 5)}>+5 強化</button>
                  <button onClick={() => changeConfidence(t.id, -5)}>-5 弱化</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="label">Experiment Capital</div>
            <div className="capital-grid">
              <div><div className="label">上限</div><div className="money">¥{capital.toLocaleString()}</div></div>
              <div><div className="label">投下</div><div className="money">¥{invested.toLocaleString()}</div></div>
              <div><div className="label">待機</div><div className="money">¥{cash.toLocaleString()}</div></div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="label">実験資金を変更</div>
              <input type="number" value={capital} onChange={e => setCapital(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Positions / Experiments</h2><span className="muted">少額で市場に参加して仮説を学習</span></div>
        <div className="card">
          <div className="form">
            <input value={draft.asset} onChange={e => setDraft(d => ({ ...d, asset: e.target.value }))} placeholder="Asset" />
            <input type="number" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} placeholder="金額" />
            <input value={draft.entryReason} onChange={e => setDraft(d => ({ ...d, entryReason: e.target.value }))} placeholder="なぜ入るか" />
            <button onClick={addPosition}>追加</button>
          </div>
          <div style={{ marginTop: 16 }}>
            {positions.length === 0 ? <div className="muted">まだポジションなし。最初は「種ポジション」だけでOK。</div> : positions.map(p => (
              <div className="position" key={p.id}>
                <strong>{p.asset}</strong>
                <span>¥{p.amount.toLocaleString()}</span>
                <span className="muted">{p.entryReason || '—'}</span>
                <span className="pill">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Automation Layer</h2><span className="muted">人間が毎回集めない仕組み</span></div>
        <div className="grid automation">
          <div className="card"><div className="label">Market Data</div><div className="auto-state">NEXT</div><div className="note">USD/JPY・JGB・TOPIX・銀行・米10年・NASDAQ・BTC</div></div>
          <div className="card"><div className="label">News Intake</div><div className="auto-state">NEXT</div><div className="note">介入・BOJ・Fed・資金フローの重要情報だけ集約</div></div>
          <div className="card"><div className="label">AI Analysis</div><div className="auto-state">DESIGNED</div><div className="note">事実 / 仮説 / 反証 / 次の一手に自動分類</div></div>
          <div className="card"><div className="label">Alerts</div><div className="auto-state">NEXT</div><div className="note">条件成立時だけ通知。常時ノイズは出さない</div></div>
        </div>
      </div>

      <div className="section">
        <div className="section-title"><h2>Latest Intelligence</h2><span className="muted">AIがここへ要点だけ流す</span></div>
        <div className="card feed">
          <div className="feed-item"><strong>THESIS-001：日本マネー逆流</strong><span>日銀正常化 → 円高 → 国内金利上昇 → 資金回帰、という連鎖を継続監視。</span></div>
          <div className="feed-item"><strong>重要なのはニュースではなくFlow</strong><span>単発見出しより、金利・為替・機関投資家フロー・株価の順序を重視。</span></div>
          <div className="feed-item"><strong>売買判断は半自動</strong><span>AIは候補・確信度・反証条件を更新。実注文は当面MASAが最終判断。</span></div>
        </div>
      </div>
    </div>
  );
}
