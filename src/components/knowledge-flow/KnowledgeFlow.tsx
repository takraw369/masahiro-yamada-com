import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent, ReactNode } from 'react';
import { captureItem, isInbox, normalizeUrl, selectItems, statusLabels } from '../../lib/knowledge-flow/model';
import type { KnowledgeItem, KnowledgeQuery, Snapshot, Status, View } from '../../lib/knowledge-flow/model';
import { localKnowledgeRepository } from '../../lib/knowledge-flow/repository';
import type { KnowledgeRepository } from '../../lib/knowledge-flow/repository';
import './knowledge-flow.css';

const viewLabels = { inbox: 'Inbox', library: 'Library', flow: 'Flow' };
const viewDescriptions = { inbox: '出会った情報を、次の可能性へ。', library: '意味を見つけた情報を、いつでも使える資産に。', flow: 'ひとつの情報が、何につながり、どこへ向かうか。' };
const sourceLabels = { web: 'ARTICLE', youtube: 'VIDEO', research: 'RESEARCH', pdf: 'PDF', x: 'X POST' };
const initialQuery: KnowledgeQuery = { text: '', view: 'inbox', project_id: '', attention: 'all', status: '' };
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    inbox: <><path d="m4 4-2 10v6h20v-6L20 4Z"/><path d="M2 14h6l2 3h4l2-3h6"/></>,
    library: <><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="m17 4 4 1 1 14-4 1Z"/></>,
    flow: <><rect x="2" y="8" width="5" height="8" rx="1"/><rect x="17" y="3" width="5" height="6" rx="1"/><rect x="17" y="15" width="5" height="6" rx="1"/><path d="M7 12h5V6h5m-5 6v6h5"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    link: <><path d="m10 7 2-2a5 5 0 0 1 7 7l-2 2m-3 3-2 2a5 5 0 0 1-7-7l2-2m2 5 6-6"/></>,
    external: <><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    back: <path d="M20 12H4m6-6-6 6 6 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.link}</svg>;
}
function Thumbnail({ item }: { item: KnowledgeItem }) {
  const [failed, setFailed] = useState(false);
  if (item.thumbnail_url && !failed) return <img className="kf-thumbnail" src={item.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  return <div className={`kf-thumbnail kf-art kf-art-${item.theme_id || 'knowledge'}`} aria-label="サムネイル未取得・テーマの代替画像" role="img"><span/><span/><span/><b>{item.source_type === 'youtube' ? '▷' : item.theme_id === 'food' ? '季' : item.theme_id === 'psychology' ? '心' : item.theme_id === 'flow' ? '流' : '知'}</b></div>;
}
function Badge({ item }: { item: KnowledgeItem }) { return <span className={`kf-badge kf-status-${item.status}`}><span/> {statusLabels[item.status]}</span>; }
function Score({ value }: { value: number | null }) { return <span className={`kf-score ${value !== null && value >= 80 ? 'is-high' : ''}`} title="資産スコア：手動評価（デモは例示）">{value === null ? '未評価' : <><span>↗</span> {value}<small>/100</small></>}</span>; }
function ProjectPill({ id, snapshot }: { id: string; snapshot: Snapshot }) {
  const project = snapshot.projects.find(p => p.id === id);
  return project ? <span className="kf-project-pill"><i style={{ background: project.color }}/>{project.name}</span> : null;
}
function KnowledgeCard({ item, snapshot, onOpen }: { item: KnowledgeItem; snapshot: Snapshot; onOpen: (item: KnowledgeItem) => void }) {
  return <article className="kf-item">
    <Thumbnail item={item}/>
    <div className="kf-item-body">
      <div className="kf-item-meta"><span>{sourceLabels[item.source_type]}</span><a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>{new URL(item.url).hostname}<Icon name="external" size={11}/></a><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} 保存</time></div>
      <button className="kf-title-button" onClick={() => onOpen(item)}><h3>{item.title}</h3></button>
      <p className={`kf-summary ${!item.summary ? 'kf-muted' : ''}`}>{item.summary || 'まだ意味づけされていません。気になった理由を、ひとこと残しましょう。'}</p>
      <div className="kf-tags">{item.tag_ids.map(id => <span key={id}>#{snapshot.tags.find(t => t.id === id)?.name}</span>)}</div>
      <div className="kf-item-bottom"><div className="kf-item-connections">{item.project_ids.length ? item.project_ids.map(id => <ProjectPill key={id} id={id} snapshot={snapshot}/>) : <button className="kf-connect" onClick={() => onOpen(item)}><Icon name="plus" size={13}/> Projectにつなぐ</button>}<Badge item={item}/></div><Score value={item.asset_score}/></div>
      <button className="kf-next-action" onClick={() => onOpen(item)}><Icon name="arrow" size={14}/><span>{item.next_action || '次の一歩を決める'}</span></button>
    </div>
  </article>;
}
function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    ref.current?.showModal(); document.body.style.overflow = 'hidden';
    return () => { ref.current?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`kf-dialog ${wide ? 'kf-dialog-wide' : ''}`} aria-labelledby="kf-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <div className="kf-dialog-head"><div><span className="kf-eyebrow">KNOWLEDGE FLOW</span><h2 id="kf-dialog-title">{title}</h2></div><button className="kf-icon-button" onClick={onClose} aria-label="閉じる"><Icon name="close"/></button></div>{children}
  </dialog>;
}
function Capture({ onSave, onClose }: { onSave: (url: string, title: string) => Promise<void>; onClose: () => void }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await onSave(String(form.get('url')), String(form.get('title'))); } catch (e) { setError(e instanceof Error ? e.message : '保存できませんでした。'); } finally { setBusy(false); }
  }
  return <Modal title="気になったら、まず残す。" onClose={onClose}><form className="kf-form" onSubmit={submit}>
    <p className="kf-muted">分類はあとから。URLひとつで、次の流れが始まります。</p>
    <label>URL <span>必須</span><input autoFocus name="url" type="url" inputMode="url" placeholder="https://…" required maxLength={4000} autoComplete="off"/></label>
    <label>タイトル <span>任意</span><input name="title" placeholder="何が気になった？" maxLength={240}/></label>
    <p className="kf-form-note">この端末のデモに保存します。要約・画像・スコアは自動取得されません。</p>
    {error && <p role="alert" className="kf-error">{error}</p>}
    <button className="kf-primary" disabled={busy} type="submit"><Icon name="plus"/>{busy ? '保存中…' : 'Inboxに保存'}</button>
  </form></Modal>;
}
function ItemEditor({ item, snapshot, onSave, onClose }: { item: KnowledgeItem; snapshot: Snapshot; onSave: (item: KnowledgeItem, tagNames: string[]) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(item); const [tags, setTags] = useState(snapshot.tags.filter(t => item.tag_ids.includes(t.id)).map(t => t.name).join(', '));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const update = (patch: Partial<KnowledgeItem>) => setDraft(d => ({ ...d, ...patch }));
  async function submit(event: SubmitEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (['connected', 'developing', 'ready'].includes(draft.status) && !draft.project_ids.length) throw new Error('このステータスには、接続先のProjectを選んでください。');
      if (draft.status === 'ready' && !draft.output.trim()) throw new Error('公開準備には、出力先を記入してください。');
      await onSave({ ...draft, title: draft.title.trim(), summary: draft.summary.trim() }, tags.split(/[,、]/).map(t => t.trim()).filter(Boolean));
    } catch (e) { setError(e instanceof Error ? e.message : '保存できませんでした。'); } finally { setBusy(false); }
  }
  return <Modal title="意味を見つけて、つなぐ。" onClose={onClose} wide><form className="kf-form" onSubmit={submit}>
    <a className="kf-source-link" href={item.url} target="_blank" rel="noopener noreferrer">{item.url}<Icon name="external" size={15}/></a>
    <label>タイトル<input autoFocus required value={draft.title} onChange={e => update({ title: e.target.value })} maxLength={240}/></label>
    <label>この情報の意味<textarea value={draft.summary} onChange={e => update({ summary: e.target.value })} rows={3} maxLength={1600} placeholder="自分にとって、なぜ大切？"/></label>
    <div className="kf-form-grid"><label>Theme<select value={draft.theme_id ?? ''} onChange={e => update({ theme_id: e.target.value || null })}><option value="">まだ決めない</option>{snapshot.themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>ステータス<select value={draft.status} onChange={e => update({ status: e.target.value as Status })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <fieldset className="kf-project-choices"><legend>つなぐProject <span>複数選択可</span></legend>{snapshot.projects.map(p => <label key={p.id}><input type="checkbox" checked={draft.project_ids.includes(p.id)} onChange={e => update({ project_ids: e.target.checked ? [...draft.project_ids, p.id] : draft.project_ids.filter(id => id !== p.id) })}/><span><strong>{p.name}</strong><small>{p.description}</small></span></label>)}</fieldset>
    <label>出力先・育てるもの<input value={draft.output} onChange={e => update({ output: e.target.value })} placeholder="例：ACE / 導入セッションの草稿" maxLength={240}/></label>
    <label>次の一歩<input value={draft.next_action} onChange={e => update({ next_action: e.target.value })} placeholder="次に何をすると、この情報が活きる？" maxLength={240}/></label>
    <div className="kf-form-grid"><label>タグ <span>カンマ区切り</span><input value={tags} onChange={e => setTags(e.target.value)} maxLength={500}/></label><label>資産スコア <span>手動・0〜100</span><input type="number" min="0" max="100" step="1" value={draft.asset_score ?? ''} placeholder="未評価" onChange={e => update({ asset_score: e.target.value === '' ? null : Number(e.target.value) })}/></label></div>
    <p className="kf-form-note">「公開準備OK」は候補の整理です。外部公開やCanonicalへの書き込みは行いません。</p>
    {error && <p role="alert" className="kf-error">{error}</p>}
    <div className="kf-form-footer"><button type="button" className="kf-secondary" onClick={onClose}>キャンセル</button><button className="kf-primary" type="submit" disabled={busy}><Icon name="check"/>{busy ? '保存中…' : '変更を保存'}</button></div>
  </form></Modal>;
}
function FlowView({ items, snapshot, onOpen }: { items: KnowledgeItem[]; snapshot: Snapshot; onOpen: (item: KnowledgeItem) => void }) {
  return <div className="kf-flow"><div className="kf-flow-labels"><span>01 / Source</span><span>02 / Theme</span><span>03 / Project</span><span>04 / Output</span></div>{items.map(item => <article className="kf-flow-row" key={item.id}>
    <button className="kf-flow-source" onClick={() => onOpen(item)}><span className="kf-mobile-label">Source</span><span className="kf-eyebrow">{sourceLabels[item.source_type]}</span><strong>{item.title}</strong><Badge item={item}/></button>
    <button className={`kf-flow-cell ${item.theme_id ? '' : 'is-empty'}`} onClick={() => onOpen(item)}><span className="kf-mobile-label">Theme</span><Icon name="arrow" size={14}/><span>{snapshot.themes.find(t => t.id === item.theme_id)?.name || 'テーマを選ぶ'}</span></button>
    <button className={`kf-flow-cell ${item.project_ids.length ? '' : 'is-empty'}`} onClick={() => onOpen(item)}><span className="kf-mobile-label">Project</span><Icon name="arrow" size={14}/><span>{item.project_ids.length ? item.project_ids.map(id => <ProjectPill key={id} id={id} snapshot={snapshot}/>) : '接続先を選ぶ'}</span></button>
    <button className={`kf-flow-cell ${item.output ? '' : 'is-empty'}`} onClick={() => onOpen(item)}><span className="kf-mobile-label">Output</span><Icon name="arrow" size={14}/><span>{item.output || '何に育てる？'}{item.output && <small>草稿・候補</small>}</span></button>
  </article>)}</div>;
}
export default function KnowledgeFlow() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const repo = useRef<KnowledgeRepository | null>(null);
  const [query, setQuery] = useState<KnowledgeQuery>(initialQuery); const [view, setView] = useState<View>('inbox');
  const [capture, setCapture] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { repo.current = localKnowledgeRepository(window.localStorage); void repo.current.load().then(setSnapshot).catch(e => setError(e.message)); }
    catch { setError('ブラウザの保存領域を利用できません。保存設定を確認して再読み込みしてください。'); }
    function shortcut(e: KeyboardEvent) {
      if (e.isComposing || e.repeat || document.querySelector('dialog[open]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.current?.focus(); }
    }
    document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 6000); return () => clearTimeout(id); }, [notice]);
  function navigate(next: View) { setView(next); setQuery({ ...initialQuery, view: next }); }
  function attention(value: KnowledgeQuery['attention']) { setQuery({ ...initialQuery, view: 'all', attention: value }); }
  async function persist(next: Snapshot) {
    if (!snapshot || !repo.current) throw new Error('データの準備ができていません。');
    const saved = await repo.current.save(next, snapshot.revision); setSnapshot(saved); return saved;
  }
  async function saveCapture(url: string, title: string) {
    if (!snapshot) return;
    let normalized: string;
    try { normalized = normalizeUrl(url); } catch { throw new Error('有効なHTTP / HTTPSのURLを入力してください。'); }
    const duplicate = snapshot.items.find(item => normalizeUrl(item.url) === normalized);
    if (duplicate) { setCapture(false); setSelected(duplicate.id); setNotice('このURLは保存済みです。既存の情報を開きました。'); return; }
    const item = captureItem(normalized, title);
    await persist({ ...snapshot, items: [item, ...snapshot.items] }); navigate('inbox'); setCapture(false); setSelected(item.id); setNotice('Inboxに保存しました。このまま意味づけできます。');
  }
  async function saveItem(item: KnowledgeItem, tagNames: string[]) {
    if (!snapshot) return;
    if (!item.title) throw new Error('タイトルを入力してください。');
    const tags = [...snapshot.tags];
    const ids = [...new Set(tagNames)].map(name => { const found = tags.find(t => t.name === name); if (found) return found.id; const tag = { id: crypto.randomUUID(), name }; tags.push(tag); return tag.id; });
    const old = snapshot.items.find(i => i.id === item.id)!;
    const changedProjects = [...old.project_ids].sort().join() !== [...item.project_ids].sort().join();
    const now = new Date().toISOString();
    await persist({ ...snapshot, tags, items: snapshot.items.map(i => i.id === item.id ? { ...item, tag_ids: ids, updated_at: now, connected_at: changedProjects ? (item.project_ids.length ? now : null) : old.connected_at } : i) });
    setSelected(null); setNotice(isInbox(item) ? '意味と接続を保存しました。' : 'Libraryに保存しました。Flowでつながりを確認できます。');
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'knowledge-flow-demo.json'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!snapshot) return <div className="kf-loading"><h1>Knowledge Flow</h1><p role={error ? 'alert' : 'status'}>{error || 'ワークスペースを準備しています…'}</p>{error && <button className="kf-secondary" onClick={() => location.reload()}>再読み込み</button>}</div>;
  const items = selectItems(snapshot, query); const active = snapshot.items.find(i => i.id === selected);
  const inboxCount = snapshot.items.filter(isInbox).length;
  const connected = [...snapshot.items].filter(i => i.connected_at).sort((a, b) => b.connected_at!.localeCompare(a.connected_at!)).slice(0, 3);
  const continuing = snapshot.items.filter(i => i.status === 'developing' || i.status === 'ready').sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 2);
  const filtered = query.attention !== 'all' || query.project_id || query.text || query.status;
  const attentionLabels = { all: '', review: 'Needs Review', high: 'High Value', ready: 'Ready to Publish', unconnected: '未接続の情報', dormant: '半年眠っている高価値情報' };
  return <div className="kf-app">
    <aside className="kf-sidebar"><a className="kf-brand" href="/dashboard/knowledge"><span className="kf-brand-mark"><Icon name="flow" size={23}/></span><span>Knowledge Flow<small>MASA'S WORKSPACE</small></span></a>
      <button className="kf-primary kf-sidebar-capture" onClick={() => setCapture(true)}><Icon name="plus"/>Quick Capture</button>
      <p className="kf-nav-label">WORKSPACE</p><nav className="kf-nav" aria-label="Knowledge views">{Object.entries(viewLabels).map(([key, label]) => <button key={key} className={view === key ? 'is-active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key as View)}><Icon name={key}/>{label}<span>{key === 'inbox' ? inboxCount : key === 'library' ? snapshot.items.length - inboxCount : <Icon name="arrow" size={14}/>}</span></button>)}</nav>
      <p className="kf-nav-label">PROJECTS</p><div className="kf-project-nav">{snapshot.projects.map(p => <button key={p.id} className={query.project_id === p.id ? 'is-active' : ''} onClick={() => setQuery({ ...initialQuery, view: 'all', project_id: p.id })}><i style={{ background: p.color }}/><span>{p.name}</span><small>{snapshot.items.filter(i => i.project_ids.includes(p.id)).length}</small></button>)}</div>
      <div className="kf-sidebar-note"><Icon name="flow"/><p>Collect less.<br/>Connect more.</p><small>情報を、次の可能性へ。</small></div>
      <div className="kf-sidebar-foot"><a href="/dashboard"><Icon name="back" size={15}/> MASA OS に戻る</a><a href="/mind">FLOW MIND を開く <Icon name="external" size={12}/></a><div className="kf-profile"><span>M</span><div>MASA<small>Personal workspace</small></div><a href="/dashboard/logout" aria-label="ログアウト">↗</a></div></div>
    </aside>
    <div className="kf-workspace"><header className="kf-topbar"><span className="kf-breadcrumb">Workspace <span>/</span> <strong>Knowledge Flow</strong></span><div className="kf-topbar-right"><span className="kf-demo-dot"/> ローカルデモ<button className="kf-text-button" onClick={exportData}>JSONを書き出す</button></div></header>
      <div className="kf-mobile-brand"><strong><Icon name="flow"/> Knowledge Flow</strong><a href="/dashboard" aria-label="MASA OSに戻る"><Icon name="back"/></a></div>
      <div className="kf-content"><section className="kf-today" aria-labelledby="kf-today-title"><div className="kf-section-heading"><div><span className="kf-eyebrow"><Icon name="sun" size={14}/> A LITTLE PROGRESS, EVERY DAY</span><h1 id="kf-today-title">今日、何につなげよう。</h1><p>集めた情報が、あなたの視点で動き出す。</p></div><span className="kf-today-date">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span></div>
        <div className="kf-stats">{[{ label: 'Inbox', value: inboxCount, note: '意味を見つける', action: () => navigate('inbox'), color: 'green' }, { label: 'Needs Review', value: snapshot.items.filter(i => i.status === 'review').length, note: 'もう一度、目を向ける', action: () => attention('review'), color: 'amber' }, { label: 'High Value', value: snapshot.items.filter(i => (i.asset_score ?? 0) >= 80).length, note: '育てたい情報 · 80以上', action: () => attention('high'), color: 'blue' }, { label: 'Ready to Publish', value: snapshot.items.filter(i => i.status === 'ready').length, note: '届ける準備をする', action: () => attention('ready'), color: 'rose' }].map(stat => <button key={stat.label} className={`kf-stat ${stat.color}`} onClick={stat.action}><span><i/>{stat.label}</span><strong>{String(stat.value).padStart(2, '0')}</strong><small>{stat.note}<Icon name="arrow" size={14}/></small></button>)}</div>
      </section>
      <div className="kf-columns"><section className="kf-collection" aria-labelledby="kf-view-title"><div className="kf-collection-heading"><div><h2 id="kf-view-title">{filtered ? query.project_id ? snapshot.projects.find(p => p.id === query.project_id)?.name : attentionLabels[query.attention] || 'Search results' : viewLabels[view]}<span>{items.length}</span></h2><p>{filtered ? 'すべての情報から、今見るべきものを。' : viewDescriptions[view]}</p></div><button className="kf-secondary kf-desktop-capture" onClick={() => setCapture(true)}><Icon name="plus" size={16}/> 保存</button></div>
        <div className="kf-search"><Icon name="search"/><input ref={search} aria-label="Knowledgeを検索" placeholder="タイトル、タグ、Projectを検索…" value={query.text} onChange={e => setQuery(q => ({ ...q, view: e.target.value ? 'all' : view, text: e.target.value }))}/><kbd>⌘ K</kbd></div>
        <div className="kf-filters"><button aria-pressed={query.attention === 'unconnected'} onClick={() => attention('unconnected')}><Icon name="link" size={13}/>未接続</button><button aria-pressed={query.attention === 'dormant'} onClick={() => attention('dormant')}>半年眠る高価値</button><select aria-label="Projectで絞り込み" value={query.project_id} onChange={e => setQuery(q => ({ ...q, view: 'all', project_id: e.target.value }))}><option value="">すべてのProject</option>{snapshot.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="ステータスで絞り込み" value={query.status} onChange={e => setQuery(q => ({ ...q, view: 'all', status: e.target.value as Status | '' }))}><option value="">すべての状態</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>{filtered && <button className="kf-clear" onClick={() => navigate(view)}>解除 ×</button>}</div>
        <div className="kf-results-meta"><span>{filtered ? '絞り込み結果' : view === 'flow' ? '情報から出力までの道筋' : '最近保存した情報'}</span><span>{view === 'flow' ? '各ステップから編集できます' : '新しい順'}</span></div>
        {items.length === 0 ? <div className="kf-empty"><Icon name="check" size={30}/><h3>{filtered ? '条件に合う情報はありません' : view === 'inbox' ? 'Inboxが整いました' : 'ここから、知識を育てよう'}</h3><p>{filtered ? '検索語や絞り込みを変えてみてください。' : '保存した情報に意味とつながりを添えていきましょう。'}</p><button className="kf-secondary" onClick={() => filtered ? navigate(view) : setCapture(true)}>{filtered ? '絞り込みを解除' : 'URLを保存する'}</button></div> : view === 'flow' ? <FlowView items={items} snapshot={snapshot} onOpen={i => setSelected(i.id)}/> : <div className="kf-items">{items.map(item => <KnowledgeCard key={item.id} item={item} snapshot={snapshot} onOpen={i => setSelected(i.id)}/>)}</div>}
        <p className="kf-list-foot">{items.length}件の情報 · デモの要約・スコアは体験用の編集例です</p>
      </section>
      <aside className="kf-context"><section className="kf-connected"><div className="kf-rail-heading"><Icon name="link" size={16}/><h2>Recently Connected</h2></div><p className="kf-rail-sub">知識が、動きはじめた場所。</p>{connected.length ? connected.map(item => <button key={item.id} className="kf-recent-item" onClick={() => setSelected(item.id)}><span>{item.project_ids.map(id => <ProjectPill key={id} id={id} snapshot={snapshot}/>)}<small>←</small></span><strong>{snapshot.themes.find(t => t.id === item.theme_id)?.name || item.title}</strong><p>{item.next_action}</p></button>) : <p className="kf-muted">Projectにつなぐと、ここに表示されます。</p>}</section>
        <section className="kf-continue"><div className="kf-rail-heading"><Icon name="arrow" size={17}/><h2>Continue</h2></div><p className="kf-rail-sub">考えていた、その先へ。</p>{continuing.length ? continuing.map(item => <button key={item.id} className="kf-continue-item" onClick={() => setSelected(item.id)}><span className="kf-eyebrow">{item.status === 'ready' ? 'READY TO PUBLISH' : 'IN DEVELOPMENT'}</span><strong>{item.output || item.title}</strong><p>{item.next_action}</p><span className="kf-continue-link">続きを考える <Icon name="arrow" size={14}/></span></button>) : <p className="kf-muted">情報の状態を「育てる」にすると、ここから再開できます。</p>}</section>
        <section className="kf-path-note"><span className="kf-eyebrow">YOUR KNOWLEDGE, IN MOTION</span><div>Capture <span>→</span> Understand<br/>Connect <span>→</span> Develop<br/>Publish <span>→</span> Canonicalize</div><p>小さな気づきを、<br/>何度も使える知恵に。</p><small>公開・正本化はPhase 2で接続予定</small></section>
      </aside></div>
      <footer className="kf-footer"><span><i/>LOCAL DEMO</span>保存先はこのブラウザのみです。共有端末に個人情報を保存しないでください。</footer>
    </div></div>
    <nav className="kf-mobile-nav" aria-label="モバイル Knowledge views">{Object.entries(viewLabels).map(([key, label]) => <button key={key} className={view === key ? 'is-active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key as View)}><Icon name={key}/><span>{label}</span></button>)}<button className="kf-mobile-save" onClick={() => setCapture(true)}><Icon name="plus"/><span>保存</span></button></nav>
    {notice && <div className="kf-toast" role="status"><Icon name="check"/>{notice}</div>}
    {capture && <Capture onSave={saveCapture} onClose={() => setCapture(false)}/>}
    {active && !capture && <ItemEditor key={active.id} item={active} snapshot={snapshot} onSave={saveItem} onClose={() => setSelected(null)}/>}
  </div>;
}
