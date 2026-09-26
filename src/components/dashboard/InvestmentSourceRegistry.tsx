import { useMemo, useState } from 'react';
import {
  createInvestmentResearchBrief,
  investmentResearchPacks,
  investmentResearchSources,
  type SourceKind,
} from '../../data/investmentResearchSources';

type Scope = 'pack' | 'all';
type KindFilter = 'all' | SourceKind;

const kindLabel: Record<SourceKind, string> = {
  primary: 'Primary',
  structured: 'Structured',
  research: 'Research',
  context: 'Context',
};

const integrationLabel = {
  adapter: 'Adapter候補',
  manual: 'Web / Manual',
  restricted: '制限あり',
};

export default function InvestmentSourceRegistry() {
  const [packId, setPackId] = useState(investmentResearchPacks[0].id);
  const [scope, setScope] = useState<Scope>('pack');
  const [kind, setKind] = useState<KindFilter>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const pack = investmentResearchPacks.find(item => item.id === packId) ?? investmentResearchPacks[0];
  const packIds = useMemo(() => new Set(pack.sourceIds), [pack]);
  const originalCount = investmentResearchSources.filter(source => source.original50).length;
  const primaryCount = investmentResearchSources.filter(source => source.kind === 'primary').length;
  const adapterCount = investmentResearchSources.filter(source => source.integration === 'adapter').length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return investmentResearchSources.filter(source => {
      if (scope === 'pack' && !packIds.has(source.id)) return false;
      if (kind !== 'all' && source.kind !== kind) return false;
      if (!needle) return true;
      return [source.name, source.purpose, source.region, ...source.uses].join(' ').toLowerCase().includes(needle);
    });
  }, [kind, packIds, query, scope]);

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(createInvestmentResearchBrief(pack.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return <section className="source-layer">
    <style>{`
      .source-layer{margin-top:34px;color:#D4C5A9}.sr-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;border-bottom:1px solid #2E2822;padding-bottom:10px;margin-bottom:14px}.sr-head h2{margin:4px 0 0;font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:300;color:#C9A96E}.sr-head p{margin:7px 0 0;color:#7A6F5F;font-size:.78rem;line-height:1.7;max-width:800px}.sr-eyebrow,.sr-label{color:#7A6F5F;font-size:.67rem;letter-spacing:.1em;text-transform:uppercase}.sr-flow{color:#8B7355;font-size:.72rem;white-space:nowrap}.sr-grid{display:grid;gap:10px}.sr-stats{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:12px}.sr-card{border:1px solid #2E2822;background:#1A1612;padding:14px}.sr-stat strong{display:block;margin-top:4px;font-family:'Cormorant Garamond',serif;font-size:1.35rem;font-weight:300;color:#C9A96E}.sr-tools{display:grid;grid-template-columns:1.25fr .75fr;gap:12px}.sr-pack-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.sr-btn,.sr-select,.sr-input{background:#0D0B08;border:1px solid #3A332B;color:#D4C5A9;font:inherit;font-size:.73rem}.sr-btn{padding:8px 10px;cursor:pointer}.sr-btn:hover,.sr-btn.on{border-color:#8B7355;color:#C9A96E}.sr-copy{margin-top:12px;border-color:#8B7355;color:#C9A96E}.sr-description{color:#7A6F5F;font-size:.75rem;line-height:1.65;margin-top:9px}.sr-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.sr-input,.sr-select{box-sizing:border-box;width:100%;padding:9px 10px}.sr-input{grid-column:1/-1}.sr-note{margin-top:10px;color:#7A6F5F;font-size:.69rem;line-height:1.6}.sr-list-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:16px;padding-bottom:8px;border-bottom:1px solid #2E2822}.sr-list-head h3{margin:0;font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-weight:300;color:#C9A96E}.sr-table{display:grid;gap:7px;margin-top:9px}.sr-row{display:grid;grid-template-columns:1.05fr .72fr 2fr auto;gap:10px;align-items:center;border:1px solid #2E2822;background:#15110E;padding:10px 12px}.sr-name{font-size:.79rem}.sr-name strong{font-weight:400;color:#D4C5A9}.sr-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.sr-tag{border:1px solid #3A332B;color:#8B7355;padding:2px 5px;font-size:.6rem}.sr-tag.primary{border-color:#6E5A3E;color:#C9A96E}.sr-purpose{color:#7A6F5F;font-size:.72rem;line-height:1.5}.sr-uses{color:#5F5548;font-size:.66rem;margin-top:4px}.sr-link{color:#C9A96E;text-decoration:none;border:1px solid #3A332B;padding:6px 8px;font-size:.68rem;white-space:nowrap}.sr-link:hover{border-color:#8B7355}.sr-empty{padding:20px 0;color:#7A6F5F;font-size:.74rem}.sr-warning{margin-top:12px;border-left:2px solid #5A4D3A;padding:8px 0 8px 11px;color:#8B7355;font-size:.72rem;line-height:1.65}@media(max-width:1000px){.sr-stats{grid-template-columns:repeat(2,1fr)}.sr-tools{grid-template-columns:1fr}.sr-row{grid-template-columns:1fr 1fr}.sr-purpose{grid-column:1/-1}.sr-link{justify-self:start}}@media(max-width:700px){.sr-head{display:block}.sr-flow{display:block;margin-top:9px;white-space:normal}.sr-stats,.sr-filters,.sr-row{grid-template-columns:1fr}.sr-input,.sr-purpose{grid-column:auto}.sr-list-head{align-items:flex-start;flex-direction:column}}
    `}</style>

    <div className="sr-head">
      <div>
        <div className="sr-eyebrow">Capital Flow Lab / Research Source Layer</div>
        <h2>Investment Source Registry</h2>
        <p>元投稿の50サイトを保存するだけでなく、公式一次情報と日本市場の情報源を上流に追加。Research Packで必要な情報源だけを束ね、AI調査 → 反証 → Signal Labへ渡す。</p>
      </div>
      <div className="sr-flow">Sources → Evidence → Signal → Human Gate</div>
    </div>

    <div className="sr-grid sr-stats">
      <div className="sr-card sr-stat"><div className="sr-label">Original list</div><strong>{originalCount}</strong><div className="sr-description">Mert Metin投稿の50サイト</div></div>
      <div className="sr-card sr-stat"><div className="sr-label">Total registry</div><strong>{investmentResearchSources.length}</strong><div className="sr-description">不足カテゴリを補完済み</div></div>
      <div className="sr-card sr-stat"><div className="sr-label">Primary</div><strong>{primaryCount}</strong><div className="sr-description">公式・一次情報を優先</div></div>
      <div className="sr-card sr-stat"><div className="sr-label">Adapter candidates</div><strong>{adapterCount}</strong><div className="sr-description">将来自動取得の優先候補</div></div>
    </div>

    <div className="sr-tools">
      <div className="sr-card">
        <div className="sr-label">Research Packs</div>
        <div className="sr-pack-list">
          {investmentResearchPacks.map(item => <button key={item.id} className={`sr-btn ${item.id === pack.id ? 'on' : ''}`} onClick={() => { setPackId(item.id); setScope('pack'); }}>{item.label}</button>)}
        </div>
        <div className="sr-description"><strong style={{color:'#D4C5A9',fontWeight:400}}>{pack.label}</strong><br />{pack.description}</div>
        <button className="sr-btn sr-copy" onClick={copyBrief}>{copied ? 'Research Briefをコピー済み' : 'このPackをAI調査ブリーフとしてコピー'}</button>
        <div className="sr-warning">AIは「一次情報 → 構造化サイト → Research/Context」の順に確認。13F・議員取引など開示遅延のある情報はリアルタイム売買シグナルとして扱わない。</div>
      </div>

      <div className="sr-card">
        <div className="sr-label">Registry Filter</div>
        <div className="sr-filters">
          <select className="sr-select" value={scope} onChange={e => setScope(e.target.value as Scope)}><option value="pack">選択Packのみ</option><option value="all">全情報源</option></select>
          <select className="sr-select" value={kind} onChange={e => setKind(e.target.value as KindFilter)}><option value="all">全レイヤー</option><option value="primary">Primary</option><option value="structured">Structured</option><option value="research">Research</option><option value="context">Context</option></select>
          <input className="sr-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="SEC / Japan / insider / macro / patent…" />
        </div>
        <div className="sr-note">Adapter候補 = 自動取得に向く公式/構造化ソース。まだ全ソースを自動クロールしている意味ではない。有料・ログイン・利用規約制限は無理に取得しない。</div>
      </div>
    </div>

    <div className="sr-list-head"><h3>{scope === 'pack' ? pack.label : 'All Sources'}</h3><span className="sr-label">{visible.length} sources</span></div>
    <div className="sr-table">
      {visible.length === 0 ? <div className="sr-empty">該当する情報源がありません。</div> : visible.map(source => <div className="sr-row" key={source.id}>
        <div className="sr-name"><strong>{source.name}</strong><div className="sr-tags"><span className={`sr-tag ${source.kind}`}>{kindLabel[source.kind]}</span><span className="sr-tag">{source.region.toUpperCase()}</span>{source.original50 && <span className="sr-tag">Original 50</span>}{source.priority === 'core' && <span className="sr-tag">Core</span>}</div></div>
        <div><div className="sr-label">{integrationLabel[source.integration]}</div><div className="sr-uses">{source.uses.join(' · ')}</div></div>
        <div className="sr-purpose">{source.purpose}</div>
        <a className="sr-link" href={source.url} target="_blank" rel="noreferrer">OPEN ↗</a>
      </div>)}
    </div>
  </section>;
}
