import { useEffect, useMemo, useState } from 'react';

type Stage = 'inbox' | 'verify' | 'watch' | 'reject';
type Candidate = {
  id: string;
  ticker: string;
  company: string;
  thesis: string;
  counterEvidence: string;
  source: string;
  stage: Stage;
  checks: Record<CheckKey, boolean>;
  createdAt: string;
};
type CheckKey = 'marketCap' | 'grossMargin' | 'roic' | 'leverage' | 'insider';

const STORAGE_KEY = 'masa-tenbagger-signal-lab-v1';
const makeId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

const checks: Array<{ key: CheckKey; label: string; rule: string; why: string }> = [
  { key: 'marketCap', label: 'Market Cap', rule: '$0.5B–$3B', why: '機関カバレッジが薄い帯域を優先' },
  { key: 'grossMargin', label: 'Gross Margin', rule: '40%+ & improving', why: '水準だけでなく四半期方向を見る' },
  { key: 'roic', label: 'ROIC × Reinvestment', rule: 'ROIC > WACC', why: '高ROICを再投資できる複利構造' },
  { key: 'leverage', label: 'Debt / EBITDA', rule: '≤ 3×', why: '資金調達環境悪化への耐性' },
  { key: 'insider', label: 'Insider Ownership', rule: '≥ 10%', why: '経営者と株主の利害一致を確認' },
];

const defaultPrompt = `米国株のテンバガー候補を「予兆ベース」で探索してください。売買推奨ではなく、検証対象の候補抽出が目的です。

【固定条件】
1. 時価総額 5〜30億ドル
2. 粗利率 40%以上、かつ直近四半期で改善傾向
3. ROIC > WACC、かつ再投資余地が大きい
4. 有利子負債 / EBITDA 3倍以下
5. 経営陣・インサイダー持株比率 10%以上を優先

【先行シグナル】
- 粗利率の1〜2pt改善
- 営業CFの黒字化接近
- SG&A比率低下 / R&D効率改善
- 決算説明会での経営陣の語彙・トーン変化
- 採用増減、提携、規制変更、競合トラブルなど財務外の変化
- セクター内相対強度と出来高・流動性

【必須出力】
- 候補ティッカーと企業名
- 5条件それぞれの Pass / Fail / Unknown
- 数字の出所と対象四半期
- 直近4四半期の粗利率・営業CFトレンド
- 経営陣トーン変化の具体例と一次情報リンク
- 強気仮説ではなく、最初に反証すべき点
- 一過性要因・季節性・会計処理の注意
- 平均出来高とポジション構築上の流動性注意
- 最後に「次に読むべき一次情報」を3つ以内

SEC/IRなど一次情報を優先し、確認できない数字は推測せず Unknown としてください。`;

const blankChecks = (): Record<CheckKey, boolean> => ({
  marketCap: false,
  grossMargin: false,
  roic: false,
  leverage: false,
  insider: false,
});

export default function TenbaggerSignalLab() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [copied, setCopied] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState({ ticker: '', company: '', thesis: '', source: '', counterEvidence: '' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.candidates)) setCandidates(parsed.candidates);
        if (typeof parsed?.prompt === 'string' && parsed.prompt.trim()) setPrompt(parsed.prompt);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, prompt, candidates })); } catch {}
  }, [prompt, candidates, hydrated]);

  const active = useMemo(() => candidates.filter(c => c.stage !== 'reject'), [candidates]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const addCandidate = () => {
    const ticker = draft.ticker.trim().toUpperCase();
    if (!ticker) return;
    const item: Candidate = {
      id: makeId(),
      ticker,
      company: draft.company.trim(),
      thesis: draft.thesis.trim(),
      counterEvidence: draft.counterEvidence.trim(),
      source: draft.source.trim(),
      stage: 'inbox',
      checks: blankChecks(),
      createdAt: new Date().toISOString(),
    };
    setCandidates(list => [item, ...list]);
    setDraft({ ticker: '', company: '', thesis: '', source: '', counterEvidence: '' });
  };

  const patchCandidate = (id: string, patch: Partial<Candidate>) => {
    setCandidates(list => list.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const toggleCheck = (id: string, key: CheckKey) => {
    setCandidates(list => list.map(c => c.id === id ? { ...c, checks: { ...c.checks, [key]: !c.checks[key] } } : c));
  };

  const removeCandidate = (id: string) => setCandidates(list => list.filter(c => c.id !== id));

  return <section className="tb-lab">
    <style>{`
      .tb-lab{margin-top:34px;color:#D4C5A9}.tb-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;border-bottom:1px solid #2E2822;padding-bottom:10px;margin-bottom:14px}.tb-head h2{margin:4px 0 0;font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:300;color:#C9A96E}.tb-head p{margin:7px 0 0;color:#7A6F5F;font-size:.78rem;line-height:1.6;max-width:780px}.tb-eyebrow,.tb-label{color:#7A6F5F;font-size:.67rem;letter-spacing:.1em;text-transform:uppercase}.tb-badge{border:1px solid #3A332B;padding:7px 10px;color:#C9A96E;font-size:.68rem;white-space:nowrap}.tb-grid{display:grid;gap:12px}.tb-criteria{grid-template-columns:repeat(5,minmax(0,1fr))}.tb-card{border:1px solid #2E2822;background:#1A1612;padding:14px}.tb-rule{font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:#D4C5A9;margin-top:6px}.tb-note{color:#7A6F5F;font-size:.71rem;line-height:1.55;margin-top:6px}.tb-split{grid-template-columns:1.1fr .9fr;margin-top:12px}.tb-card h3{font-family:'Cormorant Garamond',serif;font-weight:300;color:#C9A96E;margin:0 0 9px;font-size:1.08rem}.tb-textarea,.tb-input,.tb-select{width:100%;box-sizing:border-box;background:#0D0B08;color:#D4C5A9;border:1px solid #2E2822;padding:9px 10px;font:inherit;font-size:.77rem}.tb-textarea{min-height:240px;resize:vertical;line-height:1.55}.tb-input{min-height:36px}.tb-btns{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.tb-btn{background:transparent;border:1px solid #3A332B;color:#D4C5A9;padding:8px 11px;cursor:pointer;font:inherit;font-size:.73rem}.tb-btn:hover{border-color:#8B7355;color:#C9A96E}.tb-form{display:grid;grid-template-columns:.55fr 1fr;gap:8px}.tb-form .wide{grid-column:1/-1}.tb-stats{display:flex;gap:14px;margin:10px 0 0;color:#7A6F5F;font-size:.72rem}.tb-stats b{color:#C9A96E;font-weight:400}.tb-list{display:grid;gap:10px;margin-top:14px}.tb-candidate{border:1px solid #2E2822;background:#15110E;padding:14px}.tb-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.tb-name{font-size:.9rem}.tb-name strong{color:#C9A96E;margin-right:8px}.tb-stage{background:#0D0B08;color:#C9A96E;border:1px solid #3A332B;padding:5px 7px;font-size:.68rem}.tb-copy{color:#8B7355;font-size:.71rem;margin-top:5px}.tb-thesis{margin:10px 0 0;color:#D4C5A9;font-size:.77rem;line-height:1.55}.tb-counter{margin:7px 0 0;color:#9C8060;font-size:.73rem;line-height:1.5}.tb-checks{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:11px}.tb-check{border:1px solid #2E2822;background:#0D0B08;color:#7A6F5F;padding:7px;cursor:pointer;font-size:.66rem;text-align:left}.tb-check.on{border-color:#6E5A3E;color:#C9A96E}.tb-source{margin-top:8px;color:#7A6F5F;font-size:.68rem;overflow-wrap:anywhere}.tb-actions{display:flex;justify-content:space-between;gap:8px;margin-top:10px}.tb-score{color:#8B7355;font-size:.7rem}.tb-empty{color:#7A6F5F;font-size:.75rem;padding:16px 0}.tb-flow{margin-top:12px;border-left:2px solid #5A4D3A;padding:8px 0 8px 11px;color:#8B7355;font-size:.75rem;line-height:1.6}@media(max-width:1050px){.tb-criteria{grid-template-columns:repeat(2,1fr)}.tb-split{grid-template-columns:1fr}.tb-checks{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.tb-head{display:block}.tb-badge{display:inline-block;margin-top:10px}.tb-criteria,.tb-form,.tb-checks{grid-template-columns:1fr}.tb-form .wide{grid-column:auto}.tb-row,.tb-actions{display:block}.tb-stage{margin-top:8px}.tb-actions .tb-btns{margin-top:8px}}
    `}</style>

    <div className="tb-head">
      <div>
        <div className="tb-eyebrow">Capital Flow Lab / Signal Layer</div>
        <h2>Tenbagger Signal Lab</h2>
        <p>AIに答えを外注するのではなく、数千銘柄から「人間が検証する価値のある静かな兆し」を拾う。固定条件 → 一次情報 → 反証 → Watch の順で残す。</p>
      </div>
      <div className="tb-badge">Research, not execution</div>
    </div>

    <div className="tb-grid tb-criteria">
      {checks.map(c => <div className="tb-card" key={c.key}><div className="tb-label">{c.label}</div><div className="tb-rule">{c.rule}</div><div className="tb-note">{c.why}</div></div>)}
    </div>

    <div className="tb-grid tb-split">
      <div className="tb-card">
        <h3>ChatGPT Research Brief</h3>
        <div className="tb-note">このブリーフをこのチャットへ投げて候補抽出。SEC / IR / 決算資料など一次情報を優先し、Unknownを許容する。</div>
        <textarea className="tb-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} />
        <div className="tb-btns"><button className="tb-btn" onClick={copyPrompt}>{copied ? 'コピー済み' : '調査ブリーフをコピー'}</button><button className="tb-btn" onClick={() => setPrompt(defaultPrompt)}>標準に戻す</button></div>
      </div>

      <div className="tb-card">
        <h3>Research Inbox</h3>
        <div className="tb-note">AIが返した候補を保存し、条件充足より先に「反証すべき点」を残す。</div>
        <div className="tb-form" style={{marginTop:10}}>
          <input className="tb-input" value={draft.ticker} onChange={e => setDraft(d => ({...d, ticker:e.target.value}))} placeholder="Ticker" />
          <input className="tb-input" value={draft.company} onChange={e => setDraft(d => ({...d, company:e.target.value}))} placeholder="Company" />
          <input className="tb-input wide" value={draft.thesis} onChange={e => setDraft(d => ({...d, thesis:e.target.value}))} placeholder="何が変わり始めているか / 予兆" />
          <input className="tb-input wide" value={draft.counterEvidence} onChange={e => setDraft(d => ({...d, counterEvidence:e.target.value}))} placeholder="最初に反証すべき点" />
          <input className="tb-input wide" value={draft.source} onChange={e => setDraft(d => ({...d, source:e.target.value}))} placeholder="SEC / IR / transcript / URL / source" />
        </div>
        <div className="tb-btns"><button className="tb-btn" onClick={addCandidate}>候補を追加</button></div>
        <div className="tb-stats"><span>Active <b>{active.length}</b></span><span>Total <b>{candidates.length}</b></span></div>
        <div className="tb-flow">Flow: Scan → Evidence → Counter-evidence → Verify → Watch / Reject → Position は既存Experiment層で別判断</div>
      </div>
    </div>

    <div className="tb-list">
      {candidates.length === 0 ? <div className="tb-empty">まだ候補なし。ChatGPTで調査 → 候補だけここへ残す。</div> : candidates.map(c => {
        const score = checks.reduce((n, x) => n + (c.checks?.[x.key] ? 1 : 0), 0);
        return <div className="tb-candidate" key={c.id}>
          <div className="tb-row"><div><div className="tb-name"><strong>{c.ticker}</strong>{c.company || 'Company未入力'}</div><div className="tb-copy">{new Date(c.createdAt).toLocaleString('ja-JP')}</div></div><select className="tb-stage" value={c.stage} onChange={e => patchCandidate(c.id, { stage:e.target.value as Stage })}><option value="inbox">INBOX</option><option value="verify">VERIFY</option><option value="watch">WATCH</option><option value="reject">REJECT</option></select></div>
          {c.thesis && <div className="tb-thesis">兆し: {c.thesis}</div>}
          {c.counterEvidence && <div className="tb-counter">反証: {c.counterEvidence}</div>}
          <div className="tb-checks">{checks.map(x => <button key={x.key} className={`tb-check ${c.checks?.[x.key] ? 'on' : ''}`} onClick={() => toggleCheck(c.id, x.key)}>{c.checks?.[x.key] ? '✓ ' : '○ '}{x.label}</button>)}</div>
          {c.source && <div className="tb-source">Source: {c.source}</div>}
          <div className="tb-actions"><div className="tb-score">Evidence coverage {score}/5 — 未確認はFailではなくUnknownとして扱う</div><div className="tb-btns"><button className="tb-btn" onClick={() => removeCandidate(c.id)}>削除</button></div></div>
        </div>;
      })}
    </div>
  </section>;
}
