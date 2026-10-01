import { useEffect, useMemo, useState } from 'react';

type IntelligenceItem = {
  id: string;
  title: string;
  url?: string;
  sourceKind?: string;
  provenance?: string;
  excerpt?: string;
  topic?: string;
  lenses?: string[];
  whyItMatters?: string;
  status: string;
  outputTargets?: string[];
  contentSeed?: string;
  updatedAt?: string | null;
  createdAt?: string | null;
};

type IntelligenceResponse = {
  ok: boolean;
  error?: string;
  item?: IntelligenceItem;
  items?: IntelligenceItem[];
};

type Reaction = 'release' | 'keep' | 'park' | 'drop';

type CaptureState = {
  title: string;
  url: string;
  excerpt: string;
  whyItMatters: string;
  topic: string;
  collectionType: string;
};

const TOPICS = [
  'General',
  'Athlete / Education',
  'AI / Build',
  'Business / Revenue',
  'Health / Human',
  'Capital / Market',
  'Society / Culture',
  'Creativity / Media',
  'Life / Place',
];

const COLLECTION_TYPES = ['Insight', 'Experience', 'Place', 'Question', 'Connection', 'Idea', 'Source'];

const EMPTY_CAPTURE: CaptureState = {
  title: '',
  url: '',
  excerpt: '',
  whyItMatters: '',
  topic: 'General',
  collectionType: 'Insight',
};

function shortText(value = '', max = 900) {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function collectionType(item: IntelligenceItem) {
  const lens = item.lenses?.find((value) => value.startsWith('collector:'));
  return lens?.slice('collector:'.length) || item.sourceKind || 'Insight';
}

function reactionFor(item: IntelligenceItem): Exclude<Reaction, 'drop'> | 'new' {
  if (item.contentSeed || item.status === 'content_seed') return 'release';
  if (item.status === 'review') return 'park';
  if (['saved', 'verified', 'evidence', 'asset', 'project'].includes(item.status)) return 'keep';
  return 'new';
}

export default function PrivatePlayground() {
  const [items, setItems] = useState<IntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [reaction, setReaction] = useState('all');
  const [showCapture, setShowCapture] = useState(false);
  const [capture, setCapture] = useState<CaptureState>(EMPTY_CAPTURE);

  useEffect(() => {
    void load();
  }, []);

  async function readResponse(res: Response): Promise<IntelligenceResponse> {
    return await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/intelligence', { headers: { Accept: 'application/json' } });
      const data = await readResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setItems(data.items || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }

  async function patchItem(id: string, patch: Record<string, unknown>) {
    const res = await fetch('/api/dashboard/intelligence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch }),
    });
    const data = await readResponse(res);
    if (!res.ok || !data.ok || !data.item) throw new Error(data.error || `HTTP ${res.status}`);
    setItems((rows) => rows.map((item) => item.id === id ? data.item! : item));
    return data.item;
  }

  async function makeDrafts(id: string) {
    const res = await fetch('/api/dashboard/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'content_seed' }),
    });
    const data = await readResponse(res);
    if (!res.ok || !data.ok || !data.item) throw new Error(data.error || `HTTP ${res.status}`);
    setItems((rows) => rows.map((item) => item.id === id ? data.item! : item));
    return data.item;
  }

  async function react(item: IntelligenceItem, next: Reaction) {
    setBusyId(item.id);
    setError('');
    try {
      if (next === 'release') await makeDrafts(item.id);
      if (next === 'keep') await patchItem(item.id, { status: 'saved' });
      if (next === 'park') await patchItem(item.id, { status: 'review' });
      if (next === 'drop') await patchItem(item.id, { status: 'archived' });
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusyId('');
    }
  }

  async function createCapture(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const lenses = [
        ...(capture.topic === 'General' ? [] : [capture.topic]),
        `collector:${capture.collectionType}`,
      ];
      const res = await fetch('/api/dashboard/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...capture, lenses }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error || `HTTP ${res.status}`);
      setItems((rows) => [data.item!, ...rows]);
      setCapture(EMPTY_CAPTURE);
      setShowCapture(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  function handoff(item: IntelligenceItem, target: 'x' | 'line') {
    const text = item.contentSeed || item.excerpt || item.whyItMatters || item.title;
    const key = target === 'x' ? 'masa:x-draft' : 'masa:line-seed';
    sessionStorage.setItem(key, JSON.stringify({
      text,
      title: item.title,
      sourceId: item.id,
      topic: item.topic || 'General',
    }));
    window.location.href = target === 'x' ? '/dashboard/post' : '/dashboard/line';
  }

  async function copy(item: IntelligenceItem) {
    const text = item.contentSeed || item.excerpt || item.whyItMatters || item.title;
    await navigator.clipboard.writeText(text);
  }

  const topics = useMemo(
    () => Array.from(new Set(items.map((item) => item.topic || 'General'))).sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => item.status !== 'archived')
      .filter((item) => topic === 'all' || (item.topic || 'General') === topic)
      .filter((item) => reaction === 'all' || reactionFor(item) === reaction)
      .filter((item) => !q || [
        item.title,
        item.excerpt,
        item.whyItMatters,
        item.topic,
        item.provenance,
        collectionType(item),
      ].join(' ').toLowerCase().includes(q));
  }, [items, query, topic, reaction]);

  const counts = useMemo(() => ({
    total: items.filter((item) => item.status !== 'archived').length,
    release: items.filter((item) => item.status !== 'archived' && reactionFor(item) === 'release').length,
    keep: items.filter((item) => item.status !== 'archived' && reactionFor(item) === 'keep').length,
    park: items.filter((item) => item.status !== 'archived' && reactionFor(item) === 'park').length,
  }), [items]);

  return (
    <div className="pp-shell">
      <header className="pp-hero">
        <div>
          <span className="pp-kicker">PRIVATE FIRST → RELEASE WHEN IT CLICKS</span>
          <h1>AIが流す。MASAは眺めて、反応する。</h1>
          <p>ここは公開SNSではなく、無形資産を遊びながら集める私設Feed。アカウントを育てる前に、面白いものを拾う。外へ出したくなった時だけ水門を開く。</p>
        </div>
        <div className="pp-hero-actions">
          <button onClick={() => setShowCapture((value) => !value)}>＋ 拾う</button>
          <a href="/dashboard/intelligence">Intelligence Board</a>
        </div>
      </header>

      <section className="pp-metrics" aria-label="Private Playground summary">
        <button className={reaction === 'all' ? 'active' : ''} onClick={() => setReaction('all')}><b>{counts.total}</b><span>PLAY</span></button>
        <button className={reaction === 'release' ? 'active' : ''} onClick={() => setReaction('release')}><b>{counts.release}</b><span>RELEASE</span></button>
        <button className={reaction === 'keep' ? 'active' : ''} onClick={() => setReaction('keep')}><b>{counts.keep}</b><span>KEEP</span></button>
        <button className={reaction === 'park' ? 'active' : ''} onClick={() => setReaction('park')}><b>{counts.park}</b><span>PARK</span></button>
      </section>

      {showCapture && (
        <form className="pp-capture" onSubmit={createCapture}>
          <input required value={capture.title} onChange={(e) => setCapture({ ...capture, title: e.target.value })} placeholder="何を拾った？" />
          <input value={capture.url} onChange={(e) => setCapture({ ...capture, url: e.target.value })} placeholder="URL（任意）" type="url" />
          <select value={capture.collectionType} onChange={(e) => setCapture({ ...capture, collectionType: e.target.value })}>
            {COLLECTION_TYPES.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={capture.topic} onChange={(e) => setCapture({ ...capture, topic: e.target.value })}>
            {TOPICS.map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea value={capture.excerpt} onChange={(e) => setCapture({ ...capture, excerpt: e.target.value })} placeholder="要点 / 体験 / 気づき" />
          <textarea value={capture.whyItMatters} onChange={(e) => setCapture({ ...capture, whyItMatters: e.target.value })} placeholder="なぜ気になった？" />
          <button type="submit">PRIVATE FEEDへ</button>
        </form>
      )}

      {error && <div className="pp-error">{error}</div>}

      <div className="pp-toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="検索：テーマ・言葉・体験・問い" />
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">すべての水路</option>
          {topics.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button onClick={() => void load()}>更新</button>
      </div>

      {loading ? <div className="pp-empty">Feedを読み込み中…</div> : (
        <section className="pp-feed" aria-label="MASA Private Playground feed">
          {visible.map((item) => {
            const current = reactionFor(item);
            const released = current === 'release';
            return (
              <article className="pp-card" key={item.id}>
                <div className="pp-tags">
                  <span>{collectionType(item)}</span>
                  <span>{item.topic || 'General'}</span>
                  <span className={`state state-${current}`}>{current.toUpperCase()}</span>
                </div>
                <h2>{item.title}</h2>
                {item.whyItMatters && <p className="pp-why"><b>WHY</b> {shortText(item.whyItMatters, 320)}</p>}
                {released && item.contentSeed
                  ? <div className="pp-draft"><span>AI OUTPUT</span><p>{shortText(item.contentSeed, 1200)}</p></div>
                  : item.excerpt && <p className="pp-body">{shortText(item.excerpt)}</p>}
                <div className="pp-meta">
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer">SOURCE ↗</a> : <span>OWN / NO URL</span>}
                  {item.provenance && <span>{shortText(item.provenance, 100)}</span>}
                </div>

                <div className="pp-reactions" aria-label="Playground reaction">
                  <button className={current === 'release' ? 'selected release' : 'release'} disabled={busyId === item.id} onClick={() => void react(item, 'release')}>RELEASE</button>
                  <button className={current === 'keep' ? 'selected' : ''} disabled={busyId === item.id} onClick={() => void react(item, 'keep')}>KEEP</button>
                  <button className={current === 'park' ? 'selected' : ''} disabled={busyId === item.id} onClick={() => void react(item, 'park')}>PARK</button>
                  <button className="drop" disabled={busyId === item.id} onClick={() => void react(item, 'drop')}>DROP</button>
                </div>

                {released && (
                  <div className="pp-waterways">
                    <div>
                      <b>WORLD WATERWAYS</b>
                      <span>X / Threads / Instagram / note のdraftは publish_queue に準備済み。公開はMASA Review後。</span>
                    </div>
                    <button onClick={() => handoff(item, 'x')}>Xへ</button>
                    <button onClick={() => handoff(item, 'line')}>LINEへ</button>
                    <button onClick={() => void copy(item)}>COPY</button>
                  </div>
                )}
              </article>
            );
          })}
          {!visible.length && <div className="pp-empty">今ここに流れているカードはありません。</div>}
        </section>
      )}

      <style>{`
        .pp-shell{max-width:920px;margin:0 auto;padding-bottom:84px;color:#20252b}.pp-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;margin-bottom:18px}.pp-kicker{font-size:.74rem;font-weight:900;letter-spacing:.1em;color:#8b5b2c}.pp-hero h1{font-size:clamp(1.9rem,5vw,3.2rem);line-height:1.15;margin:7px 0 10px}.pp-hero p{max-width:700px;color:#59636e;line-height:1.8}.pp-hero-actions{display:flex;gap:8px;flex-wrap:wrap}.pp-hero-actions button,.pp-hero-actions a,.pp-toolbar button{min-height:42px;display:inline-flex;align-items:center;padding:0 13px;border:1px solid #d2cbc1;background:#fff;color:#5a5043;text-decoration:none;font:inherit;font-size:.84rem;cursor:pointer}.pp-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.pp-metrics button{border:1px solid #ddd7ce;background:#fff;padding:12px 14px;display:flex;align-items:baseline;justify-content:space-between;cursor:pointer;color:#20252b}.pp-metrics button.active{border-color:#9e7443;background:#fff8ed}.pp-metrics b{font-size:1.45rem}.pp-metrics span{font-size:.72rem;font-weight:900;color:#756c61}.pp-capture{display:grid;grid-template-columns:2fr 2fr 1fr 1fr;gap:8px;padding:14px;margin-bottom:14px;background:#fff;border:1px solid #d8d1c8}.pp-capture input,.pp-capture select,.pp-capture textarea,.pp-toolbar input,.pp-toolbar select{min-height:44px;border:1px solid #d5cec5;background:#fff;padding:9px 11px;font:inherit;color:#20252b}.pp-capture textarea{grid-column:span 2;min-height:88px;resize:vertical}.pp-capture button{grid-column:1/-1;min-height:44px;border:1px solid #c7a46d;background:#f6ead8;color:#704817;font:inherit;font-weight:900;cursor:pointer}.pp-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) 220px auto;gap:8px;margin-bottom:14px}.pp-error{padding:12px 14px;margin-bottom:12px;border:1px solid #ddb8b0;background:#fff4f1;color:#914d45}.pp-feed{display:grid;gap:12px}.pp-card{background:#fff;border:1px solid #d9d3ca;padding:18px;box-shadow:0 3px 14px rgba(45,38,30,.035)}.pp-tags{display:flex;flex-wrap:wrap;gap:6px}.pp-tags span{font-size:.72rem;padding:4px 7px;border:1px solid #ddd7cf;background:#fbfaf8;color:#656d75}.pp-tags .state-release{border-color:#c7a46d;background:#fff5e5;color:#7a4d18}.pp-card h2{font-size:1.12rem;line-height:1.55;margin:10px 0 0}.pp-why,.pp-body{font-size:.92rem;line-height:1.8;margin-top:10px;color:#59636e}.pp-why{padding:10px 11px;border-left:3px solid #c7a46d;background:#fbf7f0;color:#343a40}.pp-why b{font-size:.74rem;color:#8b5b2c;margin-right:6px}.pp-draft{margin-top:12px;padding:13px;border:1px solid #d8c29e;border-left:4px solid #b4863b;background:#fffaf2}.pp-draft>span{font-size:.72rem;font-weight:900;letter-spacing:.08em;color:#8b5b2c}.pp-draft p{white-space:pre-wrap;font-size:.92rem;line-height:1.78;margin-top:6px}.pp-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:.74rem;color:#717982}.pp-meta a{color:#82571f}.pp-reactions{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:14px;padding-top:12px;border-top:1px solid #ece7e0}.pp-reactions button,.pp-waterways button{min-height:39px;border:1px solid #d5cec5;background:#fff;color:#59636e;font:inherit;font-size:.8rem;font-weight:800;cursor:pointer}.pp-reactions button.selected{border-color:#91816d;background:#f3efe9;color:#3d352d}.pp-reactions button.release{border-color:#c7a46d;color:#744b18}.pp-reactions button.release.selected{background:#f7e8cf}.pp-reactions button.drop{color:#8e615e}.pp-reactions button:disabled{opacity:.5}.pp-waterways{display:grid;grid-template-columns:1fr auto auto auto;gap:7px;align-items:center;margin-top:10px;padding:11px;border:1px solid #ddd2c2;background:#fbf8f2}.pp-waterways div{display:grid;gap:3px}.pp-waterways b{font-size:.74rem;letter-spacing:.08em;color:#7a5324}.pp-waterways span{font-size:.76rem;color:#6b7278;line-height:1.5}.pp-waterways button{padding:0 10px}.pp-empty{padding:34px;text-align:center;color:#737b83;border:1px dashed #d8d1c8;background:rgba(255,255,255,.5)}@media(max-width:760px){.pp-hero{align-items:flex-start;flex-direction:column}.pp-hero-actions{width:100%}.pp-hero-actions>*{flex:1;justify-content:center}.pp-metrics{grid-template-columns:repeat(2,1fr)}.pp-capture{grid-template-columns:1fr 1fr}.pp-capture textarea{grid-column:1/-1}.pp-toolbar{grid-template-columns:1fr 1fr}.pp-toolbar button{grid-column:1/-1;justify-content:center}.pp-waterways{grid-template-columns:1fr 1fr 1fr 1fr}.pp-waterways div{grid-column:1/-1}}@media(max-width:520px){.pp-capture,.pp-toolbar{grid-template-columns:1fr}.pp-capture textarea{grid-column:auto}.pp-reactions{grid-template-columns:repeat(2,1fr)}.pp-waterways{grid-template-columns:repeat(3,1fr)}.pp-card{padding:15px}}
      `}</style>
    </div>
  );
}
