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
  scores?: Record<string, number>;
  factType?: string;
  aceImpact?: string;
  whyItMatters?: string;
  suggestedOutputs?: string[];
  status: string;
  outputTargets?: string[];
  contentSeed?: string;
  lastSeenAt?: string | null;
  detectedAt?: string | null;
};

type IntelligenceResponse = {
  ok: boolean;
  error?: string;
  item?: IntelligenceItem;
  items?: IntelligenceItem[];
};

type ColumnId = 'inbox' | 'ready' | 'draft';

const COLUMNS: Array<{ id: ColumnId; label: string; hint: string }> = [
  { id: 'inbox', label: 'INBOX', hint: 'まだ素材。見る・残す・捨てる' },
  { id: 'ready', label: 'READY', hint: '使える。検証済み・資産候補' },
  { id: 'draft', label: 'DRAFT', hint: 'AIが加工済み。MASAが味付け' },
];

const STATUS_LABEL: Record<string, string> = {
  new: 'NEW', saved: 'SAVE', review: 'REVIEW', verified: 'VERIFIED', content_seed: 'DRAFT',
  evidence: 'EVIDENCE', asset: 'ASSET', project: 'PROJECT', archived: 'ARCHIVE',
};

const ORDER_KEY = 'masa:intelligence-board-order:v1';

function columnFor(item: IntelligenceItem): ColumnId | 'archive' {
  if (item.status === 'archived') return 'archive';
  if (item.status === 'content_seed' || item.contentSeed) return 'draft';
  if (['verified', 'evidence', 'asset', 'project'].includes(item.status)) return 'ready';
  return 'inbox';
}

function score(item: IntelligenceItem, key: string) {
  const value = item.scores?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function signal(item: IntelligenceItem) {
  const direct = score(item, 'signal');
  if (direct) return direct.toFixed(1);
  const values = ['interest', 'strategic', 'trust', 'reuse'].map((key) => score(item, key)).filter(Boolean);
  if (!values.length) return '—';
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

function shortText(value = '', max = 320) {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function IntelligenceBoard() {
  const [items, setItems] = useState<IntelligenceItem[]>([]);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const [showCapture, setShowCapture] = useState(false);
  const [capture, setCapture] = useState({ title: '', url: '', excerpt: '', whyItMatters: '', topic: 'General' });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
      if (Array.isArray(saved)) setOrder(saved.filter((id): id is string => typeof id === 'string'));
    } catch {}
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
    setBusyId(id);
    try {
      const res = await fetch('/api/dashboard/intelligence', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, patch }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error || `HTTP ${res.status}`);
      setItems((rows) => rows.map((item) => item.id === id ? data.item! : item));
      return data.item;
    } finally {
      setBusyId('');
    }
  }

  async function actionItem(id: string, action: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/dashboard/intelligence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error || `HTTP ${res.status}`);
      setItems((rows) => rows.map((item) => item.id === id ? data.item! : item));
      return data.item;
    } finally {
      setBusyId('');
    }
  }

  function saveOrder(next: string[]) {
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch {}
  }

  function reorder(id: string, beforeId?: string) {
    const known = order.length ? order : items.map((item) => item.id);
    const next = known.filter((itemId) => itemId !== id);
    const index = beforeId ? next.indexOf(beforeId) : -1;
    if (index >= 0) next.splice(index, 0, id); else next.push(id);
    saveOrder(next);
  }

  async function moveTo(id: string, column: ColumnId, beforeId?: string) {
    const item = items.find((row) => row.id === id);
    if (!item) return;
    reorder(id, beforeId);
    if (columnFor(item) === column) return;
    try {
      if (column === 'draft') await actionItem(id, 'content_seed');
      else await patchItem(id, { status: column === 'ready' ? 'verified' : 'saved' });
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  const topics = useMemo(() => Array.from(new Set(items.map((item) => item.topic || 'General'))).sort(), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pos = new Map(order.map((id, index) => [id, index]));
    return items
      .filter((item) => item.status !== 'archived')
      .filter((item) => topic === 'all' || (item.topic || 'General') === topic)
      .filter((item) => !q || [item.title, item.excerpt, item.whyItMatters, item.topic, item.provenance].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (pos.get(a.id) ?? 999999) - (pos.get(b.id) ?? 999999));
  }, [items, query, topic, order]);

  const metrics = {
    inbox: items.filter((item) => columnFor(item) === 'inbox').length,
    ready: items.filter((item) => columnFor(item) === 'ready').length,
    draft: items.filter((item) => columnFor(item) === 'draft').length,
    high: items.filter((item) => Number(signal(item)) >= 4).length,
  };

  async function createCapture(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/dashboard/intelligence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          ...capture,
          lenses: capture.topic === 'General' ? [] : [capture.topic],
        }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) throw new Error(data.error || `HTTP ${res.status}`);
      setItems((rows) => [data.item!, ...rows]);
      setCapture({ title: '', url: '', excerpt: '', whyItMatters: '', topic: 'General' });
      setShowCapture(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  function handoff(item: IntelligenceItem, target: 'x' | 'line') {
    const text = item.contentSeed || item.excerpt || item.whyItMatters || item.title;
    const key = target === 'x' ? 'masa:x-draft' : 'masa:line-seed';
    sessionStorage.setItem(key, JSON.stringify({ text, title: item.title, sourceId: item.id, topic: item.topic || 'General' }));
    window.location.href = target === 'x' ? '/dashboard/post' : '/dashboard/line';
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="ib-shell">
      <header className="ib-hero">
        <div>
          <span className="ib-kicker">INTELLIGENCE → OUTPUT</span>
          <h1>AIが先に整える。MASAは選んで、味付けする。</h1>
          <p>Sourceを読み直す場所ではなく、使える資産を前へ流す作業盤。左右ドラッグで状態、上下ドラッグで自分の優先順を変えられます。</p>
        </div>
        <div className="ib-hero-actions">
          <button onClick={() => setShowCapture((value) => !value)}>＋ メモ / Source</button>
          <a href="/mind?view=inbox">FLOW MIND Inbox</a>
        </div>
      </header>

      <section className="ib-metrics" aria-label="Intelligence summary">
        <div><b>{metrics.inbox}</b><span>INBOX</span></div>
        <div><b>{metrics.ready}</b><span>READY</span></div>
        <div><b>{metrics.draft}</b><span>AI DRAFT</span></div>
        <div><b>{metrics.high}</b><span>HIGH SIGNAL</span></div>
      </section>

      {showCapture && (
        <form className="ib-capture" onSubmit={createCapture}>
          <input required value={capture.title} onChange={(e) => setCapture({ ...capture, title: e.target.value })} placeholder="気づき / タイトル" />
          <input value={capture.url} onChange={(e) => setCapture({ ...capture, url: e.target.value })} placeholder="URL（任意）" type="url" />
          <select value={capture.topic} onChange={(e) => setCapture({ ...capture, topic: e.target.value })}>
            {['General','Athlete / Education','AI / Build','Business / Revenue','Health / Human','Capital / Market','Society / Culture','Creativity / Media','Life / Place'].map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea value={capture.excerpt} onChange={(e) => setCapture({ ...capture, excerpt: e.target.value })} placeholder="自分の言葉で要点" />
          <textarea value={capture.whyItMatters} onChange={(e) => setCapture({ ...capture, whyItMatters: e.target.value })} placeholder="なぜ今これが気になる？" />
          <button type="submit">INBOXへ追加</button>
        </form>
      )}

      {error && <div className="ib-error">{error}</div>}

      <div className="ib-toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="検索：テーマ・言葉・Source" />
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">全ジャンル</option>
          {topics.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button onClick={() => void load()}>更新</button>
      </div>

      {loading ? <div className="ib-loading">Intelligenceを読み込み中…</div> : (
        <section className="ib-board" aria-label="Intelligence board">
          {COLUMNS.map((column) => {
            const rows = visible.filter((item) => columnFor(item) === column.id);
            return (
              <div
                className={`ib-column ib-${column.id}`}
                key={column.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragId) void moveTo(dragId, column.id); setDragId(''); }}
              >
                <header><div><h2>{column.label}</h2><p>{column.hint}</p></div><b>{rows.length}</b></header>
                <div className="ib-stack">
                  {rows.map((item) => (
                    <article
                      className="ib-card"
                      key={item.id}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => setDragId('')}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== item.id) void moveTo(dragId, column.id, item.id); setDragId(''); }}
                    >
                      <div className="ib-tags">
                        <span>{item.topic || 'General'}</span>
                        <span>{STATUS_LABEL[item.status] || item.status}</span>
                        {item.factType && <span>{item.factType}</span>}
                      </div>
                      <div className="ib-title-row">
                        <h3>{item.title}</h3>
                        <div className="ib-score"><b>{signal(item)}</b><small>SIGNAL</small></div>
                      </div>
                      {item.whyItMatters && <p className="ib-why"><b>WHY</b> {shortText(item.whyItMatters, 220)}</p>}
                      {column.id === 'draft' && item.contentSeed ? (
                        <div className="ib-draft"><span>AI DRAFT</span><p>{shortText(item.contentSeed, 900)}</p></div>
                      ) : item.excerpt ? <p className="ib-excerpt">{shortText(item.excerpt)}</p> : null}
                      <div className="ib-meta">
                        {item.url ? <a href={item.url} target="_blank" rel="noreferrer">SOURCE ↗</a> : <span>NO URL</span>}
                        {item.provenance && <span>{shortText(item.provenance, 80)}</span>}
                      </div>
                      <div className="ib-actions">
                        {column.id !== 'draft' && <button disabled={busyId === item.id} onClick={() => void actionItem(item.id, 'content_seed')}>AI投稿化</button>}
                        {column.id === 'inbox' && <button disabled={busyId === item.id} onClick={() => void patchItem(item.id, { status: 'verified' })}>使える</button>}
                        {column.id === 'ready' && <button disabled={busyId === item.id} onClick={() => void actionItem(item.id, 'promote_evidence')}>Evidence</button>}
                        {column.id === 'draft' && <button className="primary" onClick={() => handoff(item, 'x')}>Xで味付け</button>}
                        {column.id === 'draft' && <button className="primary" onClick={() => handoff(item, 'line')}>LINEへ</button>}
                        {item.contentSeed && <button onClick={() => void copy(item.contentSeed!)}>Copy</button>}
                        <button disabled={busyId === item.id} onClick={() => void patchItem(item.id, { status: 'archived' })}>Archive</button>
                      </div>
                    </article>
                  ))}
                  {!rows.length && <div className="ib-empty">ここへドラッグ</div>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <style>{`
        .ib-shell{max-width:1440px;margin:0 auto;padding-bottom:70px;color:#20252b}.ib-hero{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;margin-bottom:18px}.ib-kicker{font-size:.78rem;font-weight:800;letter-spacing:.08em;color:#8b5b2c}.ib-hero h1{font-size:clamp(1.75rem,3.3vw,2.8rem);line-height:1.2;margin:6px 0 8px}.ib-hero p{max-width:780px;color:#59636e;font-size:.95rem;line-height:1.75}.ib-hero-actions{display:flex;gap:8px;flex-wrap:wrap}.ib-hero-actions button,.ib-hero-actions a,.ib-toolbar button{min-height:42px;display:inline-flex;align-items:center;padding:0 13px;border:1px solid #d2cbc1;background:#fff;color:#5a5043;text-decoration:none;font:inherit;font-size:.84rem;cursor:pointer}.ib-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.ib-metrics div{background:#fff;border:1px solid #ddd7ce;padding:12px 14px;display:flex;align-items:baseline;justify-content:space-between}.ib-metrics b{font-size:1.55rem}.ib-metrics span{font-size:.76rem;font-weight:800;color:#756c61}.ib-capture{display:grid;grid-template-columns:2fr 2fr 1fr auto;gap:8px;padding:14px;margin-bottom:14px;background:#fff;border:1px solid #d8d1c8}.ib-capture input,.ib-capture select,.ib-capture textarea,.ib-toolbar input,.ib-toolbar select{min-height:44px;border:1px solid #d5cec5;background:#fff;padding:9px 11px;font:inherit;font-size:.94rem;color:#20252b}.ib-capture textarea{grid-column:span 2;min-height:76px;resize:vertical}.ib-capture button{border:1px solid #c7a46d;background:#f6ead8;color:#704817;font:inherit;font-weight:800;padding:0 15px;cursor:pointer}.ib-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) 220px auto;gap:8px;margin-bottom:12px}.ib-error{padding:12px 14px;margin-bottom:12px;border:1px solid #ddb8b0;background:#fff4f1;color:#914d45}.ib-loading,.ib-empty{padding:28px;text-align:center;color:#737b83;border:1px dashed #d8d1c8;background:rgba(255,255,255,.5)}.ib-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}.ib-column{min-width:0;background:#eeeae3;border:1px solid #d8d1c8;padding:10px;min-height:360px}.ib-column>header{display:flex;justify-content:space-between;gap:10px;padding:5px 5px 11px}.ib-column h2{font-size:.9rem;letter-spacing:.08em}.ib-column header p{font-size:.78rem;color:#6c747c;line-height:1.5;margin-top:3px}.ib-column header>b{font-size:1.2rem;color:#8b5b2c}.ib-stack{display:grid;gap:9px}.ib-card{background:#fff;border:1px solid #d6d0c8;padding:14px;cursor:grab;box-shadow:0 2px 8px rgba(45,38,30,.025)}.ib-card:active{cursor:grabbing}.ib-card:hover{border-color:#bfae96}.ib-tags{display:flex;flex-wrap:wrap;gap:5px}.ib-tags span{font-size:.75rem;padding:3px 6px;border:1px solid #ddd7cf;color:#656d75;background:#fbfaf8}.ib-title-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start;margin-top:9px}.ib-title-row h3{font-size:1rem;line-height:1.55}.ib-score{text-align:right;color:#80551d;min-width:52px}.ib-score b{display:block;font-size:1.4rem;line-height:1}.ib-score small{font-size:.7rem;color:#737b83}.ib-why,.ib-excerpt{font-size:.88rem;line-height:1.72;margin-top:9px;color:#59636e}.ib-why{padding:9px 10px;border-left:3px solid #c7a46d;background:#fbf7f0;color:#343a40}.ib-why b{font-size:.75rem;color:#8b5b2c;margin-right:5px}.ib-draft{margin-top:10px;padding:11px;border:1px solid #d8c29e;background:#fffaf2}.ib-draft>span{font-size:.74rem;font-weight:800;color:#8b5b2c;letter-spacing:.08em}.ib-draft p{white-space:pre-wrap;font-size:.9rem;line-height:1.72;color:#343a40;margin-top:5px}.ib-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;font-size:.76rem;color:#717982}.ib-meta a{color:#82571f}.ib-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid #ece7e0}.ib-actions button{min-height:36px;border:1px solid #d5cec5;background:#fff;color:#59636e;font:inherit;font-size:.8rem;padding:6px 9px;cursor:pointer}.ib-actions button.primary{border-color:#c7a46d;background:#f7eddd;color:#744b18;font-weight:800}.ib-actions button:disabled{opacity:.5}.ib-draft{border-left:4px solid #b4863b}.ib-ready .ib-card{border-left:3px solid #9ba98f}.ib-inbox .ib-card{border-left:3px solid #b9b1a5}@media(max-width:980px){.ib-board{grid-template-columns:1fr;}.ib-column{min-height:160px}.ib-hero{align-items:flex-start;flex-direction:column}.ib-metrics{grid-template-columns:repeat(2,1fr)}.ib-capture{grid-template-columns:1fr 1fr}.ib-capture textarea{grid-column:span 2}.ib-toolbar{grid-template-columns:1fr 1fr}.ib-toolbar button{grid-column:1/-1;justify-content:center}}@media(max-width:560px){.ib-metrics{grid-template-columns:repeat(2,1fr)}.ib-capture,.ib-toolbar{grid-template-columns:1fr}.ib-capture textarea{grid-column:auto}.ib-hero-actions{width:100%}.ib-hero-actions>*{flex:1;justify-content:center}.ib-card{padding:13px}.ib-title-row{grid-template-columns:1fr}.ib-score{text-align:left;display:flex;gap:5px;align-items:baseline}.ib-score b{display:inline}.ib-actions{display:grid;grid-template-columns:repeat(2,1fr)}.ib-actions button{width:100%}}
      `}</style>
    </div>
  );
}
