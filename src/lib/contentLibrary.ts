// Shared with the existing Content Scheduler. This remains browser-local data.
export const CONTENT_LIBRARY_KEY = 'ace-content-lib';
export type ContentPost = {
  id: string;
  platform: 'x' | 'line';
  category: string | null;
  text: string;
  title: string;
  scheduledHour: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'sending';
  createdAt: string;
  xAccountId?: string;
  lineAccountId?: string;
  order: number;
};
type LibraryStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isPost(value: unknown): value is ContentPost {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && p.id.length > 0
    && (p.platform === 'x' || p.platform === 'line')
    && (p.category === null || typeof p.category === 'string')
    && typeof p.text === 'string' && typeof p.title === 'string'
    && (p.scheduledHour === null || typeof p.scheduledHour === 'string')
    && ['draft', 'scheduled', 'sent', 'sending'].includes(String(p.status))
    && typeof p.createdAt === 'string' && typeof p.order === 'number' && Number.isFinite(p.order)
    && (p.xAccountId === undefined || typeof p.xAccountId === 'string')
    && (p.lineAccountId === undefined || typeof p.lineAccountId === 'string');
}

function validate(posts: unknown): asserts posts is ContentPost[] {
  if (!Array.isArray(posts) || !posts.every(isPost) || new Set(posts.map(p => p.id)).size !== posts.length) {
    throw new Error('content_library_invalid');
  }
}

export function readContentLibrary(storage: Pick<Storage, 'getItem'>): ContentPost[] {
  const raw = storage.getItem(CONTENT_LIBRARY_KEY);
  if (raw === null) return [];
  let posts: unknown;
  try { posts = JSON.parse(raw); } catch { throw new Error('content_library_invalid'); }
  validate(posts);
  return posts;
}

const same = (a: ContentPost | undefined, b: ContentPost | undefined) => JSON.stringify(a) === JSON.stringify(b);

// Apply only this editor's changes. An unrelated newly saved row is never lost.
// Conflicting edits/deletions fail closed instead of replacing the latest record.
export function mergeContentLibrary(storage: LibraryStorage, base: ContentPost[], next: ContentPost[]): ContentPost[] {
  validate(base); validate(next);
  const current = readContentLibrary(storage);
  const before = new Map(base.map(p => [p.id, p])), after = new Map(next.map(p => [p.id, p]));
  const latest = new Map(current.map(p => [p.id, p]));
  const changed = new Set([...before.keys(), ...after.keys()].filter(id => !same(before.get(id), after.get(id))));
  for (const id of changed) {
    if (!same(before.get(id), latest.get(id))) throw new Error('content_library_conflict');
  }
  const additions = next.filter(p => !before.has(p.id));
  const merged = [...additions, ...current.flatMap(p => changed.has(p.id) ? (after.has(p.id) ? [after.get(p.id)!] : []) : [p])];
  storage.setItem(CONTENT_LIBRARY_KEY, JSON.stringify(merged));
  return merged;
}

export function isResumableXDraft(p: ContentPost) {
  return p.platform === 'x' && p.status === 'draft' && p.scheduledHour === null && Boolean(p.text.trim());
}

export function isUnscheduledContentDraft(p: ContentPost) {
  return p.status === 'draft' && p.scheduledHour === null;
}

// Storage events do not fire in the document that changed the library.
// Recheck the backing row before leaving, including deletion/blocked storage.
export function isXTextDraftSaved(storage: Pick<Storage, 'getItem'>, text: string, previous: ContentPost | null): boolean {
  if (!previous || previous.text !== text) return false;
  try { return same(readContentLibrary(storage).find(p => p.id === previous.id), previous); }
  catch { return false; }
}

export function saveXTextDraft(storage: LibraryStorage, text: string, accountId: string, previous: ContentPost | null = null): ContentPost {
  if (!text.trim() || text.length > 280) throw new Error('x_draft_text_invalid');
  if (previous && !isResumableXDraft(previous)) throw new Error('x_draft_not_editable');
  if (previous && !same(readContentLibrary(storage).find(p => p.id === previous.id), previous)) throw new Error('content_library_conflict');
  const item: ContentPost = previous ? { ...previous, text, ...(accountId ? { xAccountId: accountId } : {}) } : {
    id: crypto.randomUUID(), platform: 'x', category: null, text, title: text.replace(/\s+/g, ' ').slice(0, 40),
    scheduledHour: null, status: 'draft', createdAt: new Date().toISOString(), order: 0,
    ...(accountId ? { xAccountId: accountId } : {}),
  };
  mergeContentLibrary(storage, previous ? [previous] : [], [item]);
  return item;
}

export function contentLibraryError(error: unknown, surface: 'composer' | 'scheduler' = 'composer') {
  if (error instanceof Error && error.message === 'content_library_conflict') return surface === 'scheduler'
    ? '別の画面で原稿が更新されました。操作は反映していません。編集中の本文をコピーして残し、このページを再読み込みしてください。'
    : '別の画面で下書きが更新されました。本文をコピーして残し、保存した下書きを読み直すか、新しい下書きとして保存してください。';
  if (error instanceof Error && error.message === 'content_library_invalid') return '保存データを読み取れません。既存データは変更していません。本文をコピーして保管してください。';
  return 'このブラウザでは保存・読み込みができません。本文をコピーして保管し、保存設定を確認してください。';
}
