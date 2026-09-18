import { useEffect, useState } from 'react';
import {
  findXAccountPlaybook,
  LAST_X_ACCOUNT_KEY,
  type XAccountPlaybook,
} from '../../lib/xAccountPlaybook';

type Item = {
  id: string;
  title: string;
  url?: string;
  topic?: string;
  factType?: string;
  whyItMatters?: string;
  contentSeed?: string;
  excerpt?: string;
  status: string;
};
type Handoff = { text?:string; title?:string; sourceId?:string; topic?:string };
type XDraft = {
  text?: string;
  accountRef?: string | null;
  queueStatus?: string;
  factCheckRequired?: boolean;
  factCheckStatus?: string;
  humanApproved?: boolean;
  readyForPublish?: boolean;
  reviewGate?: string;
  provider?: string;
  draftVersion?: string;
};
type PreparedDraft = { draft: XDraft; mode: 'ai' | 'fallback'; account: XAccountPlaybook };

const INTERNAL_SEED_MARKERS = [
  'TITLE:', 'TOPIC:', 'FACT TYPE:', 'SOURCE:', 'TRUST / SIGNAL:', 'SOURCE CLAIM:',
  'WHY IT MATTERS:', 'MASA INTERPRETATION:', 'ONE THING:', 'ANGLE:', 'HOOK:', 'TRUST GATE:',
];

function looksLikeInternalSeed(text: string) {
  const matches = INTERNAL_SEED_MARKERS.filter((marker) => text.includes(marker)).length;
  return matches >= 2;
}

function selectedAccount() {
  try {
    return findXAccountPlaybook(window.localStorage.getItem(LAST_X_ACCOUNT_KEY));
  } catch {
    return findXAccountPlaybook();
  }
}

function sendToComposer(text: string, username?: string) {
  if (!text.trim() || looksLikeInternalSeed(text)) {
    throw new Error('internal_seed_blocked');
  }
  window.dispatchEvent(new CustomEvent('masa:x-compose', {
    detail: { text, ...(username ? { username } : {}) },
  }));
}

async function intelligenceAction(action: string, id: string) {
  const res = await fetch('/api/dashboard/intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action, id }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function actionError(result: Awaited<ReturnType<typeof intelligenceAction>>) {
  return String(result.data?.error || `HTTP ${result.res.status}`);
}

async function getReviewDraft(id: string): Promise<XDraft> {
  let result = await intelligenceAction('x_draft', id);
  if (!result.res.ok) {
    const firstError = actionError(result);
    // Refresh only when the active Intelligence row exists but has no queue draft yet.
    // Archived/missing rows and other failures must not be retried through content_seed.
    if (!firstError.includes('x_draft_not_found')) throw new Error(firstError);
    const refreshed = await intelligenceAction('content_seed', id);
    if (!refreshed.res.ok) throw new Error(actionError(refreshed));
    result = await intelligenceAction('x_draft', id);
  }
  if (!result.res.ok || !result.data?.draft) throw new Error(actionError(result));
  return result.data.draft as XDraft;
}

async function getAiDraft(item: Item, account: XAccountPlaybook): Promise<XDraft> {
  const res = await fetch('/api/dashboard/automation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      action: 'x.postDraft',
      input: {
        source: {
          title: item.title,
          excerpt: item.excerpt || '',
          topic: item.topic || 'General',
          factType: item.factType || '',
          whyItMatters: item.whyItMatters || '',
          sourceUrl: item.url || '',
        },
        account: {
          username: account.username,
          name: account.name,
          profile: account.profile,
          concept: account.concept,
          worldview: account.worldview,
          audience: account.audience,
          tone: account.tone,
          pillars: account.pillars,
          boundary: account.boundary,
        },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.text) {
    throw new Error(String(data?.error || `HTTP ${res.status}`));
  }
  return data.data as XDraft;
}

async function prepareDraft(item: Item): Promise<PreparedDraft> {
  const account = selectedAccount();
  try {
    const draft = await getAiDraft(item, account);
    return { draft, mode: 'ai', account };
  } catch {
    const draft = await getReviewDraft(item.id);
    return { draft, mode: 'fallback', account };
  }
}

export default function PostDraftShelf() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function loadDraft(id: string, title: string) {
    setBusyId(id);
    setError('');
    try {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        const draft = await getReviewDraft(id);
        const text = String(draft.text || '').trim();
        if (!text) throw new Error('x_draft_empty');
        if (text.length > 280) throw new Error('x_draft_over_280');
        const account = selectedAccount();
        sendToComposer(text, account.username);
        setNotice(`「${title}」からX投稿案を本文へ入れました。事実確認とMASA Human Gateを通してから投稿してください。`);
        return;
      }

      const prepared = await prepareDraft(item);
      const text = String(prepared.draft.text || '').trim();
      if (!text) throw new Error('x_draft_empty');
      if (text.length > 280) throw new Error('x_draft_over_280');
      sendToComposer(text, prepared.account.username);
      const gate = prepared.draft.factCheckRequired || !prepared.draft.humanApproved || !prepared.draft.readyForPublish
        ? '事実確認とMASA Human Gateを通してから投稿してください。'
        : 'Human Gate確認済みです。';
      const mode = prepared.mode === 'ai'
        ? `@${prepared.account.username} の世界観でAI投稿案を作成しました。`
        : `AIが利用できなかったため、安全なv2レビュー稿へフォールバックしました。`;
      setNotice(`「${title}」→ ${mode}${gate}`);
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      const archivedOrMissing = message.includes('intelligence_archived') || message.includes('intelligence_not_found');
      setError(message === 'internal_seed_blocked'
        ? '内部メタデータを投稿本文へ入れる処理を停止しました。投稿案を生成し直してください。'
        : archivedOrMissing
          ? 'この素材はアーカイブ済み、または現在の投稿対象外です。Intelligenceで現役素材を選んでください。'
          : `投稿案を読み込めませんでした: ${message}`);
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('masa:x-draft');
      if (raw) {
        const handoff = JSON.parse(raw) as Handoff;
        sessionStorage.removeItem('masa:x-draft');
        if (handoff.sourceId) {
          void loadDraft(handoff.sourceId, handoff.title || 'Intelligence Draft');
        } else if (handoff.text && !looksLikeInternalSeed(handoff.text)) {
          const account = selectedAccount();
          sendToComposer(handoff.text, account.username);
          setNotice(`「${handoff.title || 'Intelligence Draft'}」を本文へ入れました。`);
        } else if (handoff.text) {
          setError('旧形式の内部メタデータは本文へ入れません。Intelligenceから投稿案を作り直してください。');
        }
      }
    } catch {}

    void fetch('/api/dashboard/intelligence', { headers: { Accept: 'application/json' } })
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.items) ? data.items : [];
        setItems(rows.filter((item: Item) => item.status !== 'archived' && (item.contentSeed || item.status === 'content_seed')).slice(0, 8));
      })
      .catch(() => {});
  }, []);

  if (!open && !notice && !error) {
    return <button className="pds-reopen" onClick={() => setOpen(true)}>AI Draft Shelfを開く</button>;
  }

  return (
    <section className="pds-shell" aria-label="AI Draft Shelf">
      <header>
        <div><span>AI DRAFT SHELF</span><h2>素材と投稿文を分ける。最後はMASAが決める。</h2></div>
        <button className="pds-close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
      </header>
      {notice && <div className="pds-notice">✓ {notice}</div>}
      {error && <div className="pds-error">⚠ {error}</div>}
      {open && (
        <>
          <p className="pds-lead">下はIntelligenceの内部素材で、そのまま投稿する文章ではありません。「この素材から投稿案を作る」で、選択中アカウントの世界観を使ってAIが下書きを作成します。AIが使えない時だけ安全なv2レビュー稿へ戻ります。</p>
          <div className="pds-list">
            {items.length ? items.map((item) => {
              const source = item.contentSeed || item.excerpt || '';
              return (
                <article key={item.id}>
                  <div className="pds-meta"><span>{item.topic || 'General'}</span><span>INTERNAL MATERIAL</span><span>投稿不可</span></div>
                  <h3>{item.title}</h3>
                  <p>{source.slice(0, 300)}{source.length > 300 ? '…' : ''}</p>
                  <div className="pds-actions">
                    <button className="primary" disabled={busyId === item.id} onClick={() => void loadDraft(item.id, item.title)}>
                      {busyId === item.id ? 'AI投稿案を生成中…' : 'この素材から投稿案を作る'}
                    </button>
                    <button onClick={() => void navigator.clipboard.writeText(source || item.title)}>素材Copy</button>
                  </div>
                </article>
              );
            }) : <div className="pds-empty">素材はまだありません。Intelligenceで「AI投稿化」すると、投稿案と内部素材が分離してここへ流れます。</div>}
          </div>
        </>
      )}
      <style>{`
        .pds-shell{margin-bottom:14px;border:1px solid #d7c8b2;background:#fffaf2;padding:14px 15px;color:#25211d}.pds-shell>header{display:flex;justify-content:space-between;gap:16px;align-items:start}.pds-shell header span{font-size:.75rem;color:#8b5b2c;font-weight:800;letter-spacing:.08em}.pds-shell h2{font-size:1.05rem;line-height:1.45;margin-top:2px}.pds-close{border:0;background:transparent;font:inherit;font-size:1.2rem;cursor:pointer;color:#736b61}.pds-lead{font-size:.86rem;line-height:1.7;color:#59636e;margin:7px 0 11px}.pds-notice,.pds-error{margin:8px 0;padding:8px 10px;font-size:.84rem}.pds-notice{border:1px solid #bfd1b9;background:#f4faf2;color:#43613e}.pds-error{border:1px solid #ddb8b0;background:#fff4f1;color:#914d45}.pds-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:340px;overflow:auto}.pds-list article{background:#fff;border:1px solid #ddd7cf;padding:11px}.pds-meta{display:flex;gap:5px;flex-wrap:wrap}.pds-meta span{font-size:.72rem;border:1px solid #ddd7cf;padding:2px 5px;color:#6b6359}.pds-list h3{font-size:.92rem;line-height:1.5;margin-top:7px}.pds-list p{font-size:.84rem;line-height:1.7;color:#59636e;margin-top:6px;white-space:pre-wrap}.pds-actions{display:flex;gap:5px;margin-top:9px}.pds-actions button,.pds-reopen{min-height:36px;border:1px solid #d2cbc1;background:#fff;color:#59636e;font:inherit;font-size:.8rem;padding:6px 9px;cursor:pointer}.pds-actions button:disabled{opacity:.55;cursor:wait}.pds-actions .primary{border-color:#c7a46d;background:#f6ead8;color:#704817;font-weight:800}.pds-empty{grid-column:1/-1;padding:18px;border:1px dashed #d2cbc1;color:#6c747c;font-size:.84rem}.pds-reopen{margin-bottom:12px}@media(max-width:900px){.pds-list{grid-template-columns:1fr 1fr}}@media(max-width:560px){.pds-list{grid-template-columns:1fr;max-height:420px}}
      `}</style>
    </section>
  );
}
