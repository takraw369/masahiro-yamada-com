import { useEffect, useMemo, useRef, useState } from 'react';

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
  driveUrl?: string;
  evidenceId?: string | null;
  publishedAt?: string | null;
  lastSeenAt?: string | null;
  detectedAt?: string | null;
  thumbnailUrl?: string;
  thumbnailSource?: string;
  reading?: {
    titleJa: string;
    summaryJa: string;
    whyJa: string;
    evidenceScope: 'title_excerpt';
    model: string;
    generatedAt: string;
    inputHash: string;
  } | null;
  readingCurrent?: boolean;
};

type IntelligenceResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  item?: IntelligenceItem;
  items?: IntelligenceItem[];
  cached?: boolean;
};

type ColumnId = 'inbox' | 'ready' | 'draft';
type View = 'feed' | 'board';

const COLUMNS: Array<{ id: ColumnId; label: string; hint: string }> = [
  { id: 'inbox', label: '新着・確認待ち', hint: '気になる情報を保存し、原文を確認する' },
  { id: 'ready', label: '確認済み・活用候補', hint: '自分で確認した情報や資料を残す' },
  { id: 'draft', label: '投稿素材', hint: '定型の素材を編集して、自分の言葉にする' },
];

const STATUS_LABEL: Record<string, string> = {
  new: '未確認', saved: '保存済み', review: '要確認', verified: '確認済みの記録',
  content_seed: '投稿素材', evidence: '資料に登録済み', asset: '資産候補',
  project: 'プロジェクト候補', archived: '保管済み',
};

const TOPIC_LABEL: Record<string, string> = {
  General: 'その他', 'Athlete / Education': 'スポーツ・教育', 'AI / Build': 'AI・開発',
  'Business / Revenue': '仕事・収益', 'Health / Human': '健康・人間',
  'Capital / Market': '資本・市場', 'Society / Culture': '社会・文化',
  'Creativity / Media': '創作・メディア', 'Life / Place': '暮らし・場所',
};

const FACT_LABEL: Record<string, string> = {
  fact: '事実として収集', hypothesis: '仮説', opinion: '意見',
  source: '情報源', observation: '観察', experience: '体験', unverified: '未確認',
};

const ORDER_KEY = 'masa:intelligence-board-order:v1';

function columnFor(item: IntelligenceItem): ColumnId | 'archive' {
  if (item.status === 'archived') return 'archive';
  if (item.status === 'content_seed') return 'draft';
  if (['verified', 'evidence', 'asset', 'project'].includes(item.status)) return 'ready';
  if (['new', 'saved', 'review'].includes(item.status)) return 'inbox';
  if (item.contentSeed) return 'draft';
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

function safeUrl(value: string | undefined, image = false) {
  try {
    const url = new URL(value || '');
    return (image ? url.protocol === 'https:' : ['https:', 'http:'].includes(url.protocol))
      && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function sourceName(item: IntelligenceItem) {
  const url = safeUrl(item.url);
  if (url) return new URL(url).hostname.replace(/^www\./, '');
  return item.sourceKind === 'manual' ? '自分のメモ' : '収集情報';
}

function displayDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
  }).format(date);
}

function currentReading(item: IntelligenceItem) {
  const reading = item.reading;
  return item.readingCurrent && reading?.evidenceScope === 'title_excerpt'
    && reading.titleJa?.trim() && reading.summaryJa?.trim() ? reading : null;
}

export default function IntelligenceBoard() {
  const [items, setItems] = useState<IntelligenceItem[]>([]);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [stage, setStage] = useState('all');
  const [view, setView] = useState<View>('feed');
  const [busyId, setBusyId] = useState('');
  const [readingId, setReadingId] = useState('');
  const readingInFlight = useRef(false);
  const [readingErrors, setReadingErrors] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragId, setDragId] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const [showCapture, setShowCapture] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [capture, setCapture] = useState({ title: '', url: '', excerpt: '', whyItMatters: '', topic: 'General' });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
      if (Array.isArray(saved)) setOrder(saved.filter((id): id is string => typeof id === 'string'));
    } catch {}
    void load();
  }, []);

  async function readResponse(res: Response): Promise<IntelligenceResponse> {
    return await res.json().catch(() => ({ ok: false }));
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/intelligence', { headers: { Accept: 'application/json' } });
      const data = await readResponse(res);
      if (!res.ok || !data.ok) throw new Error();
      setItems(data.items || []);
    } catch {
      setError('情報を読み込めませんでした。接続を確認して更新してください。');
    } finally {
      setLoading(false);
    }
  }

  async function mutateItem(id: string, payload: Record<string, unknown>, method: 'PATCH' | 'POST') {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/dashboard/intelligence', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...payload }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) throw new Error();
      setItems((rows) => rows.map((item) => item.id === id ? data.item! : item));
      return data.item;
    } catch {
      setError('情報の変更を保存できませんでした。もう一度お試しください。');
      return null;
    } finally {
      setBusyId('');
    }
  }

  function patchItem(id: string, patch: Record<string, unknown>) {
    return mutateItem(id, { patch }, 'PATCH');
  }

  function actionItem(id: string, action: string) {
    return mutateItem(id, { action }, 'POST');
  }

  async function readJapanese(item: IntelligenceItem) {
    if (currentReading(item) || readingInFlight.current) return;
    readingInFlight.current = true;
    setReadingId(item.id);
    setReadingErrors((errors) => ({ ...errors, [item.id]: '' }));
    let failureMessage = '日本語を作成できませんでした。接続を確認してお試しください。';
    try {
      const res = await fetch('/api/dashboard/intelligence-reader', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) {
        const fallback = res.status === 429 || res.status === 503
          ? '日本語の読み補助は今利用できません。時間をおいてお試しください。原文は開けます。'
          : '日本語を作成できませんでした。もう一度お試しいただくか、原文をご確認ください。';
        failureMessage = data.message || fallback;
        throw new Error();
      }
      if (!currentReading(data.item)) {
        failureMessage = '情報が更新されたため、読み補助を表示できませんでした。更新してからお試しください。';
        throw new Error();
      }
      setItems((rows) => rows.map((row) => row.id === item.id ? data.item! : row));
    } catch {
      setReadingErrors((errors) => ({ ...errors, [item.id]: failureMessage }));
    } finally {
      readingInFlight.current = false;
      setReadingId('');
    }
  }

  function saveOrder(next: string[]) {
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch {}
  }

  function reorder(id: string, beforeId?: string) {
    const known = [...new Set([...order, ...items.map((item) => item.id)])];
    const next = known.filter((itemId) => itemId !== id);
    const index = beforeId ? next.indexOf(beforeId) : -1;
    if (index >= 0) next.splice(index, 0, id); else next.push(id);
    saveOrder(next);
  }

  async function moveTo(id: string, column: ColumnId, beforeId?: string) {
    if (busyId || readingId) return;
    const item = items.find((row) => row.id === id);
    if (!item) return;
    reorder(id, beforeId);
    if (columnFor(item) === column) return;
    if (column === 'draft') {
      const material = item.contentSeed ? item : await actionItem(id, 'content_seed');
      if (material && material.status !== 'content_seed') await patchItem(id, { status: 'content_seed' });
    } else await patchItem(id, { status: column === 'ready' ? 'verified' : 'saved' });
  }

  const topics = useMemo(() => Array.from(new Set(items.map((item) => item.topic || 'General'))).sort(), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pos = new Map(order.map((id, index) => [id, index]));
    return items
      .filter((item) => item.status !== 'archived')
      .filter((item) => topic === 'all' || (item.topic || 'General') === topic)
      .filter((item) => stage === 'all' || columnFor(item) === stage)
      .filter((item) => {
        const reading = currentReading(item);
        return !q || [item.title, item.excerpt, item.whyItMatters, item.topic, TOPIC_LABEL[item.topic || 'General'],
          item.provenance, reading?.titleJa, reading?.summaryJa, reading?.whyJa].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => (pos.get(a.id) ?? 999999) - (pos.get(b.id) ?? 999999));
  }, [items, query, topic, stage, order]);

  const metrics = {
    inbox: items.filter((item) => columnFor(item) === 'inbox').length,
    ready: items.filter((item) => columnFor(item) === 'ready').length,
    draft: items.filter((item) => columnFor(item) === 'draft').length,
    japanese: items.filter((item) => item.status !== 'archived' && currentReading(item)).length,
  };

  async function createCapture(event: React.FormEvent) {
    event.preventDefault();
    setCaptureBusy(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/intelligence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          ...capture, lenses: capture.topic === 'General' ? [] : [capture.topic],
        }),
      });
      const data = await readResponse(res);
      if (!res.ok || !data.ok || !data.item) throw new Error();
      setItems((rows) => [data.item!, ...rows]);
      setCapture({ title: '', url: '', excerpt: '', whyItMatters: '', topic: 'General' });
      setShowCapture(false);
    } catch {
      setError('メモを保存できませんでした。入力内容を確認してお試しください。');
    } finally {
      setCaptureBusy(false);
    }
  }

  function handoff(item: IntelligenceItem, target: 'x' | 'line') {
    const text = item.contentSeed || item.excerpt || item.whyItMatters || item.title;
    const key = target === 'x' ? 'masa:x-draft' : 'masa:line-seed';
    try {
      sessionStorage.setItem(key, JSON.stringify({ text, title: item.title, sourceId: item.id, topic: item.topic || 'General' }));
      window.location.href = target === 'x' ? '/dashboard/post' : '/dashboard/line';
    } catch {
      setError('投稿素材を引き継げませんでした。コピーして投稿画面へ移してください。');
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('投稿素材をコピーしました。');
    } catch { setError('コピーできませんでした。投稿素材の文章を選択してコピーしてください。'); }
  }

  function renderCard(item: IntelligenceItem) {
    const column = columnFor(item);
    const reading = currentReading(item);
    const imageUrl = safeUrl(item.thumbnailUrl, true);
    const showImage = imageUrl && !brokenImages.includes(imageUrl);
    const url = safeUrl(item.url);
    const publishedDate = displayDate(item.publishedAt);
    const date = publishedDate || displayDate(item.detectedAt || item.lastSeenAt);
    const savedUrl = safeUrl(item.driveUrl);
    const disabled = Boolean(busyId || readingId);
    return (
      <article className={`ib-card ib-card-${column}${showImage ? ' ib-has-image' : ''}`} key={item.id}
        aria-busy={busyId === item.id || readingId === item.id} draggable={view === 'board' && !disabled}
        onDragStart={() => setDragId(item.id)} onDragEnd={() => setDragId('')}
        onDragOver={view === 'board' ? (e) => e.preventDefault() : undefined}
        onDrop={view === 'board' ? (e) => {
          e.preventDefault(); e.stopPropagation();
          if (dragId && dragId !== item.id && column !== 'archive') void moveTo(dragId, column, item.id);
          setDragId('');
        } : undefined}>
        {showImage && <div className="ib-thumbnail">
          <img src={imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
            onError={() => setBrokenImages((images) => [...images, imageUrl])} />
        </div>}
        <div className="ib-card-content">
          <div className="ib-tags">
            <span>{TOPIC_LABEL[item.topic || 'General'] || item.topic}</span>
            <span className="ib-status">{STATUS_LABEL[item.status] || '未分類'}</span>
          </div>
          <h3>{reading ? reading.titleJa : shortText(item.title, 260)}</h3>
          <div className="ib-meta">
            <span>{sourceName(item)}</span>
            {date && <time dateTime={publishedDate ? item.publishedAt || undefined : item.detectedAt || item.lastSeenAt || undefined}>{publishedDate ? '公開' : '収集'} {date}</time>}
            {url ? <a href={url} target="_blank" rel="noreferrer noopener">原文を開く ↗</a> : <span>リンクなし</span>}
          </div>
          {reading ? <div className="ib-reading">
            <span className="ib-reading-label">日本語の読み補助</span>
            <p className="ib-excerpt">{shortText(reading.summaryJa, 650)}</p>
            {reading.whyJa && <p className="ib-why"><b>MASAとの接点（AIの提案）</b>{shortText(reading.whyJa, 360)}</p>}
            <p className="ib-scope">見出し・抜粋からAIが作成。全文の要約や事実確認ではありません。</p>
            <details className="ib-original">
              <summary>原文の見出し・抜粋を見る</summary>
              <p className="ib-original-title">{item.title}</p>
              {item.excerpt && <p>{item.excerpt}</p>}
            </details>
          </div> : <>
            {item.excerpt && <p className="ib-excerpt">{shortText(item.excerpt, 420)}</p>}
            <div className="ib-reader-action">
              <button className="primary" disabled={disabled} onClick={() => void readJapanese(item)}>
                {readingId === item.id ? '日本語を作成中…' : item.reading ? '日本語を更新' : '日本語で読む'}
              </button>
              <span>選んだ記事の見出し・抜粋だけをAIで読みやすくします。</span>
            </div>
          </>}
          {readingErrors[item.id] && <p className="ib-reader-error" role="alert">{readingErrors[item.id]}</p>}
          {item.whyItMatters && !reading && <p className="ib-why"><b>収集時のメモ</b>{shortText(item.whyItMatters, 240)}</p>}
          {item.contentSeed && <details className="ib-draft">
            <summary>投稿素材を見る</summary>
            <p className="ib-scope">定型処理で作成した素材です。原文を確認し、自分の言葉で編集してください。</p>
            <p>{item.contentSeed}</p>
          </details>}
          <div className="ib-actions">
            <button disabled={disabled || item.status === 'saved'} onClick={() => void patchItem(item.id, { status: 'saved' })}>{item.status === 'saved' ? '保存済み' : '保存'}</button>
            {!item.contentSeed && <button disabled={disabled} onClick={() => void actionItem(item.id, 'content_seed')}>投稿素材を作る</button>}
            {item.contentSeed && <button className="primary" disabled={disabled} onClick={() => handoff(item, 'x')}>Xで編集</button>}
            {item.contentSeed && <button disabled={disabled} onClick={() => handoff(item, 'line')}>LINEで編集</button>}
            <details className="ib-more">
              <summary>整理・確認</summary>
              <div className="ib-more-content">
                <p>「確認済み」は自分で原文を確認した記録です。収集や翻訳で真偽が保証されるわけではありません。</p>
                <div className="ib-secondary-actions">
                  <button disabled={disabled || item.status === 'review'} onClick={() => void patchItem(item.id, { status: 'review' })}>要確認にする</button>
                  <button disabled={disabled || item.status === 'verified'} onClick={() => void patchItem(item.id, { status: 'verified' })}>確認済みにする</button>
                  <button disabled={disabled || item.status === 'evidence'} onClick={() => void actionItem(item.id, 'promote_evidence')}>資料に登録</button>
                  {item.contentSeed && <button disabled={disabled} onClick={() => void copy(item.contentSeed!)}>素材をコピー</button>}
                  <button disabled={disabled} onClick={() => void patchItem(item.id, { status: 'archived' })}>保管する</button>
                </div>
                <div className="ib-source-details">
                  {savedUrl && <p><a href={savedUrl} target="_blank" rel="noreferrer noopener">保存先の資料を開く ↗</a></p>}
                  {item.evidenceId && <p><a href="/dashboard/evidence">登録済みの資料棚を開く</a></p>}
                  {item.provenance && <p>収集元：{shortText(item.provenance, 180)}</p>}
                  {item.factType && <p>収集時の分類：{FACT_LABEL[item.factType] || item.factType}（自動分類は要確認）</p>}
                  <p>参考スコア：{signal(item)}（真偽の保証ではありません）</p>
                  {showImage && <p>画像：{item.thumbnailSource === 'rss' ? '配信元RSS' : item.thumbnailSource === 'og' ? '配信元の記事サムネイル' : '配信元'}から取得</p>}
                </div>
              </div>
            </details>
          </div>
          {busyId === item.id && <p className="ib-item-notice" role="status">変更を保存中…</p>}
        </div>
      </article>
    );
  }

  return (
    <div className={`ib-shell ib-view-${view}`}>
      <header className="ib-hero">
        <div><span className="ib-kicker">MASAの情報フィード</span><h1>気になる情報を、日本語で読む。</h1>
          <p>画像と原文を見ながら、読みたい記事だけ「日本語で読む」。気づきは保存し、投稿素材に育てられます。</p></div>
        <div className="ib-hero-actions">
          <button aria-expanded={showCapture} onClick={() => setShowCapture((value) => !value)}>メモを追加</button>
          <a href="/mind?view=inbox">思考メモへ</a>
        </div>
      </header>
      <section className="ib-metrics" aria-label="情報の件数">
        <div><b>{metrics.inbox}</b><span>新着・確認待ち</span></div><div><b>{metrics.ready}</b><span>活用候補</span></div>
        <div><b>{metrics.draft}</b><span>投稿素材</span></div><div><b>{metrics.japanese}</b><span>日本語あり</span></div>
      </section>
      {showCapture && <form className="ib-capture" onSubmit={createCapture}>
        <label>タイトル<input required value={capture.title} onChange={(e) => setCapture({ ...capture, title: e.target.value })} placeholder="気づき・見出し" /></label>
        <label>記事URL（任意）<input value={capture.url} onChange={(e) => setCapture({ ...capture, url: e.target.value })} placeholder="https://" type="url" /></label>
        <label>ジャンル<select value={capture.topic} onChange={(e) => setCapture({ ...capture, topic: e.target.value })}>
          {Object.entries(TOPIC_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>要点<textarea value={capture.excerpt} onChange={(e) => setCapture({ ...capture, excerpt: e.target.value })} placeholder="自分の言葉で要点" /></label>
        <label>気になる理由<textarea value={capture.whyItMatters} onChange={(e) => setCapture({ ...capture, whyItMatters: e.target.value })} placeholder="なぜ今これが気になる？" /></label>
        <button type="submit" disabled={captureBusy}>{captureBusy ? '保存中…' : '新着に追加'}</button>
      </form>}
      {error && <div className="ib-error" role="alert">{error}</div>}
      {notice && <p className="ib-notice" role="status">{notice}</p>}
      <div className="ib-toolbar">
        <input aria-label="情報を検索" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="日本語・原文・収集元で検索" />
        <select aria-label="ジャンルを選ぶ" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">全ジャンル</option>{topics.map((value) => <option key={value} value={value}>{TOPIC_LABEL[value] || value}</option>)}
        </select>
        <button disabled={loading || Boolean(readingId || busyId)} onClick={() => void load()}>更新</button>
      </div>
      <div className="ib-viewbar">
        <div className="ib-stage-filters" role="group" aria-label="情報の状態で絞り込む">
          <button aria-pressed={stage === 'all'} onClick={() => setStage('all')}>すべて</button>
          {COLUMNS.map((column) => <button key={column.id} aria-pressed={stage === column.id} onClick={() => setStage(column.id)}>{column.id === 'inbox' ? '新着・確認待ち' : column.id === 'ready' ? '活用候補' : '投稿素材'}</button>)}
        </div>
        <div className="ib-view-switch" role="group" aria-label="表示方法">
          <button aria-pressed={view === 'feed'} onClick={() => setView('feed')}>読む</button><button aria-pressed={view === 'board'} onClick={() => setView('board')}>作業ボード</button>
        </div>
      </div>
      <p className="ib-guide">{view === 'board' ? 'ドラッグで整理できます。「活用候補」へ移すと確認済み、「投稿素材」へ移すと定型の素材を作ります。'
        : `${visible.length}件。日本語の読み補助はクリックした記事だけ作成し、保存済みの結果を再利用します。`}</p>
      {loading ? <div className="ib-loading" role="status">情報を読み込み中…</div> : view === 'feed' ? <section className="ib-feed" aria-label="読む情報フィード">
        {visible.map(renderCard)}{!visible.length && <div className="ib-empty">表示する情報がありません。検索やジャンルの条件を変えるか、メモを追加してください。</div>}
      </section> : <section className="ib-board" aria-label="情報の作業ボード">
        {COLUMNS.map((column) => {
          const rows = visible.filter((item) => columnFor(item) === column.id);
          return <div className={`ib-column ib-${column.id}`} key={column.id} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragId) void moveTo(dragId, column.id); setDragId(''); }}>
            <header><div><h2>{column.label}</h2><p>{column.hint}</p></div><b>{rows.length}</b></header>
            <div className="ib-stack">{rows.map(renderCard)}{!rows.length && <div className="ib-empty">ここへドラッグできます。各記事の「整理・確認」からも変更できます。</div>}</div>
          </div>;
        })}
      </section>}
    </div>
  );
}
