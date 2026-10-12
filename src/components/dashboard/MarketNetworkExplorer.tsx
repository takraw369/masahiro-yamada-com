import { useEffect, useMemo, useState } from 'react';
import {
  JP_MARKET_SOURCE, JP_MARKET_REPO, buildRelationIndex, companyRelations,
  evidenceShardPath, networkNeighbors, nodeName, parseMarketDataset,
  relationStatus, searchMarketCompanies,
  type CompanyLink, type EvidenceRecord, type MarketDataset, type RelationRecord,
} from '../../lib/marketNetwork';

const CATEGORY: Record<string, string> = {
  capital: '資本', transaction: '取引', alliance: '提携', personnel: '人的', group: 'グループ',
};
const COLORS: Record<string, string> = {
  capital: '#85A7D1', transaction: '#D0A17A', alliance: '#7EBC9C',
  personnel: '#C19DBC', group: '#AA9ADB',
};
const WATCH_KEY = 'masa-jp-market-network-watch-v1';
let dataPromise: Promise<MarketDataset> | null = null;
const fetchData = async (name: string) => {
  const res = await fetch(JP_MARKET_SOURCE + name, { cache: 'default' });
  if (!res.ok) throw new Error('データ取得失敗: HTTP ' + res.status);
  return res.json();
};
function loadData() {
  if (!dataPromise) {
    dataPromise = Promise.all([fetchData('M4_companies.json'), fetchData('M5_company_relations.json')])
      .then(([a, b]) => parseMarketDataset(a, b))
      .catch(e => { dataPromise = null; throw e; });
  }
  return dataPromise;
}
const safeHref = (url?: string) => {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch { return null; }
};
const formatDate = (value?: string | null) => value ? value.slice(0, 10) : '不明';
const statusName = (relation: RelationRecord) => {
  const status = relationStatus(relation);
  if (status === 'historical') return '過去';
  if (status === 'needs_review') return '要確認';
  return relation.verification?.status === 'verified' ? '原本照合済み' : '自動判定';
};

export default function MarketNetworkExplorer() {
  const [loaded, setLoaded] = useState<MarketDataset | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('トヨタ');
  const [selected, setSelected] = useState('7203');
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(false);
  const [selectedRel, setSelectedRel] = useState<RelationRecord | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord[] | null>(null);
  const [detailError, setDetailError] = useState('');
  const [watch, setWatch] = useState<string[]>([]);

  useEffect(() => {
    try {
      const codes = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
      if (Array.isArray(codes)) setWatch(codes.filter((v): v is string => typeof v === 'string').slice(0, 100));
    } catch {}
  }, []);
  const index = useMemo(() => loaded ? buildRelationIndex(loaded) : new Map<string, CompanyLink[]>(), [loaded]);
  const search = useMemo(() => loaded ? searchMarketCompanies(loaded, index, query) : [], [loaded, index, query]);
  const links = useMemo(() => companyRelations(index, selected, categories, includeUnconfirmed), [index, selected, categories, includeUnconfirmed]);
  const neighbors = useMemo(() => networkNeighbors(links, 14), [links]);
  const company = loaded?.companies[selected] || null;
  const shown = useMemo(() => links.slice().sort((a, b) => {
    const aScore = a.relation.verification?.status === 'verified' ? 1 : 0;
    const bScore = b.relation.verification?.status === 'verified' ? 1 : 0;
    return bScore - aScore || a.name.localeCompare(b.name, 'ja');
  }).slice(0, 40), [links]);

  const begin = () => {
    setPhase('loading');
    setError('');
    loadData().then(data => { setLoaded(data); setPhase('done'); })
      .catch(e => { setError(e instanceof Error ? e.message : 'ネットワーク取得失敗'); setPhase('error'); });
  };
  const chooseCompany = (code: string) => {
    if (!loaded?.companies[code]) return;
    setSelected(code);
    setQuery(loaded.companies[code].name);
    setSelectedRel(null);
    setEvidence(null);
  };
  const saveWatch = () => {
    const next = watch.includes(selected) ? watch.filter(code => code !== selected) : [selected, ...watch].slice(0, 100);
    setWatch(next);
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)); } catch {}
  };
  useEffect(() => {
    if (!loaded || !selectedRel) { setEvidence(null); setDetailError(''); return; }
    let alive = true;
    const existing = selectedRel.evidence || [];
    setEvidence(null);
    setDetailError('');
    const path = evidenceShardPath(loaded, selectedRel.relation_id);
    if (!path) { setEvidence(existing); return; }
    fetchData(path).then(payload => {
      if (!alive) return;
      const item = payload?.[selectedRel.relation_id];
      if (!item || item.dataset_id !== loaded.datasetId) throw new Error('データ版が一致しません');
      setEvidence(Array.isArray(item.evidence) ? item.evidence : existing);
    }).catch(() => {
      if (alive) { setEvidence(existing); setDetailError('詳細出典を取得できませんでした。公開元でも確認できます。'); }
    });
    return () => { alive = false; };
  }, [loaded, selectedRel]);

  const top = 14;
  const positioned = neighbors.map((neighbor, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / Math.max(neighbors.length, 1);
    return { ...neighbor, x: 330 + Math.cos(angle) * 220, y: 182 + Math.sin(angle) * 132 };
  });
  return <section className="mn">
    <style>{`
      .mn{margin-top:34px;color:#D4C5A9}.mn *{box-sizing:border-box}.mn-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;border-bottom:1px solid #2E2822;padding-bottom:12px;margin-bottom:13px}.mn-eyebrow{font-size:.68rem;letter-spacing:.17em;color:#8B7355}.mn h2{font:300 1.55rem 'Cormorant Garamond',serif;color:#C9A96E;margin:5px 0}.mn h3{font:400 1.08rem 'Cormorant Garamond',serif;color:#C9A96E;margin:0 0 8px}.mn p,.mn-note{font-size:.78rem;line-height:1.7;color:#9E9080;margin:7px 0}.mn a{color:#C9A96E;text-decoration:underline;text-underline-offset:3px}.mn button{font:inherit;font-size:.76rem;color:#D4C5A9;background:transparent;border:1px solid #4A4030;padding:9px 12px;cursor:pointer}.mn button:hover,.mn button:focus-visible{border-color:#C9A96E;color:#C9A96E}.mn button:disabled{opacity:.5;cursor:not-allowed}.mn button[aria-pressed=true]{border-color:#C9A96E;background:#302719;color:#E5CE9E}.mn-panel{background:#1A1612;border:1px solid #2E2822;padding:16px;margin-top:12px}.mn-categories,.mn-actions,.mn-meta,.mn-select{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mn-meta{color:#9E9080;font-size:.71rem;margin-top:10px}.mn-input{min-width:0;flex:1;border:1px solid #4A4030;background:#0D0B08;color:#D4C5A9;padding:10px;font:inherit;font-size:.82rem}.mn-content{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);gap:12px;margin-top:12px}.mn-result{max-height:310px;overflow:auto;margin-top:8px;border:1px solid #302A24}.mn-result button{display:block;text-align:left;width:100%;border:0;border-bottom:1px solid #302A24;padding:10px}.mn-result small{display:block;color:#8B7E6E;margin-top:3px}.mn-graph{display:block;width:100%;height:auto;max-height:390px;background:#100D0A;border:1px solid #2E2822}.mn-items{max-height:450px;overflow-y:auto}.mn-item{width:100%;display:block;text-align:left;border-left:2px solid #5A4D3A!important;margin-bottom:6px}.mn-item[aria-pressed=true]{border-left-color:#C9A96E!important}.mn-item small{display:block;color:#A49382;margin-top:4px;line-height:1.5}.mn-evidence{border-top:1px solid #302A24;padding:10px 0;font-size:.74rem;line-height:1.55}.mn-evidence a{overflow-wrap:anywhere}.mn-muted{color:#9E9080;font-size:.73rem}.mn-error{color:#ECA190;font-size:.77rem}.mn-node{cursor:pointer}.mn-node:focus{outline:2px solid #C9A96E}.mn-foot{margin-top:12px;border-top:1px solid #2E2822;padding-top:12px;color:#9E9080;font-size:.73rem;line-height:1.7}
      @media(max-width:820px){.mn-content{grid-template-columns:1fr}.mn-head{align-items:flex-start;flex-direction:column}.mn-graph{max-height:none}.mn-panel{padding:12px}}
    `}</style>
    <div className="mn-head">
      <div>
        <div className="mn-eyebrow">CAPITAL FLOW LAB / JAPAN NETWORK</div>
        <h2>Market Network</h2>
        <p>日本の企業を「資本・取引・提携・人・グループ」の接続から探索する。関係の有無と、投資収益性は別に検証する。</p>
      </div>
      <a href={JP_MARKET_SOURCE} target="_blank" rel="noopener noreferrer">JP Market Vis 全体図 ↗</a>
    </div>
    {phase !== 'done' && <div className="mn-panel">
      <h3>企業関係データを読み込む</h3>
      <p>公開データ（企業約3,800社・関係約9万件）を端末に一度読み込みます。通信量とメモリ使用を抑えるため、ここを開くだけでは読み込みません。外部データのため読み込み失敗時は公開版を利用できます。</p>
      <button type="button" onClick={begin} disabled={phase === 'loading'}>{phase === 'loading' ? 'データを読み込み中…' : phase === 'error' ? '再試行' : 'ネットワークを表示する'}</button>
      {error && <p role="alert" className="mn-error">{error}　<a href={JP_MARKET_SOURCE} target="_blank" rel="noopener noreferrer">公開版を開く</a></p>}
    </div>}
    {loaded && <div>
      <div className="mn-panel">
        <div className="mn-select">
          <label htmlFor="market-network-search" className="mn-muted">企業検索</label>
          <input id="market-network-search" className="mn-input" value={query} placeholder="企業名・通称・証券コード" onChange={e => setQuery(e.target.value)} />
        </div>
        {!!query.trim() && <div className="mn-result" role="listbox" aria-label="企業検索結果">
          {search.length ? search.slice(0, 8).map(hit =>
            <button role="option" aria-selected={hit.code === selected} type="button" key={hit.code} onClick={() => chooseCompany(hit.code)}>
              {hit.company.name}　{hit.code}<small>収録関係 {hit.degree.toLocaleString()}件（全状態）</small>
            </button>) : <p className="mn-note">該当企業なし。収録対象外か、名称が異なる場合があります。</p>}
        </div>}
        <div className="mn-categories" style={{ marginTop: 12 }}>
          {Object.entries(CATEGORY).map(([key, label]) => <button type="button" key={key} aria-pressed={categories.has(key)} onClick={() => setCategories(s => {
            const next = new Set(s); next.has(key) ? next.delete(key) : next.add(key); return next;
          })}>{label}</button>)}
          <button type="button" onClick={() => setCategories(new Set())}>全カテゴリ</button>
        </div>
        <label className="mn-meta"><input type="checkbox" checked={includeUnconfirmed} onChange={e => setIncludeUnconfirmed(e.target.checked)} /> 要確認・過去の関係も表示する（初期値は判定済みのみ）</label>
        <div className="mn-meta">公開データ生成日: {formatDate(loaded.generatedAt)}　｜　スナップショット版: {loaded.datasetId.slice(0, 8)}　｜　最新の関係を保証しません</div>
      </div>
      {company && <div className="mn-content">
        <div className="mn-panel">
          <div className="mn-head">
            <div><h3>{company.name} <span className="mn-muted">{selected}</span></h3><p>{company.industry_33 || '業種不明'}　/　{company.market_segment || '市場区分未確認'}</p></div>
            <button type="button" onClick={saveWatch}>{watch.includes(selected) ? '監視リストから外す' : '監視リストへ追加'}</button>
          </div>
          <div className="mn-meta">表示対象の関係 {links.length.toLocaleString()} 件　｜　図は接続先上位 {Math.min(neighbors.length, top)} 組織のみ（関係数順）</div>
          <svg className="mn-graph" viewBox="0 0 660 370" role="img" aria-label={company.name + 'の企業関係図。接続先は下の関係一覧からも選択できます'}>
            {positioned.map(n => <line key={n.key} x1="330" y1="182" x2={n.x} y2={n.y} stroke={COLORS[n.category] || '#8B7355'} strokeWidth={Math.min(3, 1 + n.count * 0.25)} opacity=".8" />)}
            <circle cx="330" cy="182" r="41" fill="#302719" stroke="#C9A96E" strokeWidth="2" />
            <text x="330" y="178" fill="#E5CE9E" fontSize="12" textAnchor="middle">{selected}</text>
            <text x="330" y="193" fill="#D4C5A9" fontSize="10" textAnchor="middle">中心企業</text>
            {positioned.map(n => <g key={n.key} className="mn-node" tabIndex={n.code ? 0 : -1} role={n.code ? 'button' : undefined}
              aria-label={n.code ? n.name + 'へ移動' : n.name} onClick={() => n.code && chooseCompany(n.code)}
              onKeyDown={e => { if (n.code && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chooseCompany(n.code); } }}>
              <circle cx={n.x} cy={n.y} r="17" fill="#241F1A" stroke={COLORS[n.category] || '#8B7355'} strokeWidth="2" />
              <text x={n.x} y={n.y + 4} fill="#F0D9B5" textAnchor="middle" fontSize="9">{n.count}</text>
              <text x={n.x} y={n.y + (n.y > 182 ? 33 : -26)} fill="#D4C5A9" textAnchor="middle" fontSize="11">{n.name.length > 10 ? n.name.slice(0, 10) + '…' : n.name}</text>
            </g>)}
          </svg>
          <p className="mn-note">線の色は関係カテゴリ、円の数字は同一相手との関係件数。配置は見やすさのためのもので、距離・強度・業績を意味しません。</p>
          {watch.length > 0 && <div className="mn-meta">監視リスト（このブラウザ内）:
            {watch.slice(0, 15).map(code => <button type="button" key={code} onClick={() => chooseCompany(code)} disabled={!loaded.companies[code]}>{loaded.companies[code]?.name || code}</button>)}
          </div>}
        </div>
        <div className="mn-panel">
          <h3>接続エビデンス</h3>
          <p>関係を選んで根拠の状態・基準日・原本リンクを確認。初期表示は原本照合済みを優先。</p>
          <div className="mn-items">
            {shown.length ? shown.map(link => <button type="button" className="mn-item" key={link.relation.relation_id} aria-pressed={selectedRel?.relation_id === link.relation.relation_id} onClick={() => setSelectedRel(link.relation)}>
              {link.name}<small>{CATEGORY[link.relation.category] || link.relation.category} ／ {link.relation.relation_type} ／ {statusName(link.relation)}</small>
            </button>) : <p className="mn-note">この条件で確認できる関係はありません。「未収録」と「関係なし」は異なります。</p>}
          </div>
          {links.length > shown.length && <p className="mn-note">一覧は先頭40件まで表示。全件は公開元の関係一覧で確認してください。</p>}
          {selectedRel && <div style={{ marginTop: 16 }} role="region" aria-label="関係の根拠">
            <h3>{nodeName(loaded, selectedRel.source)} → {nodeName(loaded, selectedRel.target)}</h3>
            <div className="mn-meta">{CATEGORY[selectedRel.category] || selectedRel.category}　／　{statusName(selectedRel)}　／　関係ID: {selectedRel.relation_id}</div>
            {detailError && <p role="alert" className="mn-error">{detailError}</p>}
            {evidence === null ? <p className="mn-note">出典の詳細を確認中…</p> : evidence.length ? evidence.slice(0, 12).map((ev, i) => <div className="mn-evidence" key={i}>
              <div>{ev.source || '出典未分類'}　<span className="mn-muted">{ev.tier || '出所種別不明'} / {ev.verification === 'verified' ? '原本確認' : '個別照合不明'}</span></div>
              <div className="mn-muted">基準日: {formatDate(ev.as_of)}　公表日: {formatDate(ev.published)}　{ev.doc_id || ''}</div>
              {safeHref(ev.url) ? <a href={safeHref(ev.url)!} target="_blank" rel="noopener noreferrer">公表資料を開く ↗</a> : <span className="mn-muted">原本URL未収録。公開元で確認してください。</span>}
            </div>) : <p className="mn-note">個別の原本リンクは取得できませんでした。公開元の詳細パネルで確認してください。</p>}
          </div>}
        </div>
      </div>}
      <div className="mn-foot">出所：<a href={JP_MARKET_REPO} target="_blank" rel="noopener noreferrer">JP Market Vis</a>（EDINET・企業IR・Wikidata等）。自動判定は検証済みを意味しません。データには誤抽出・名寄せ誤り・過去情報があり得ます。関係件数の増加率や投資スコアは、比較可能な時系列が確認できるまで算出しません。商用再配布にあたっては各原データの利用条件を別途確認してください。</div>
    </div>}
  </section>;
}
