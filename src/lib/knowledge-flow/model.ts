import type { KnowledgeSourceType } from '../knowledge/contracts';

export type SourceType = Extract<KnowledgeSourceType, 'web' | 'youtube' | 'research' | 'pdf'> | 'x';
export const statusLabels = { inbox: '未整理', review: '要確認', understood: '整理済み', connected: '接続済み', developing: '育てる', ready: '公開準備OK' } as const;
export type Status = keyof typeof statusLabels;
export interface Project { id: string; name: string; description: string; color: string }
export interface Theme { id: string; name: string }
export interface Tag { id: string; name: string }
/** Joined read model. Production relations are normalized; see docs/knowledge-flow.md. */
export interface KnowledgeItem {
  id: string;
  url: string;
  title: string;
  source_type: SourceType;
  thumbnail_url: string | null;
  raw_content: string | null;
  summary: string;
  status: Status;
  asset_score: number | null;
  tag_ids: string[];
  project_ids: string[];
  theme_id: string | null;
  output: string;
  next_action: string;
  created_at: string;
  updated_at: string;
  connected_at: string | null;
}
export interface Snapshot {
  version: 1;
  revision: number;
  items: KnowledgeItem[];
  projects: Project[];
  themes: Theme[];
  tags: Tag[];
}
export type View = 'inbox' | 'library' | 'flow';
export interface KnowledgeQuery {
  text: string;
  view: View | 'all';
  project_id: string;
  attention: 'all' | 'review' | 'high' | 'ready' | 'unconnected' | 'dormant';
  status: Status | '';
}
export const isInbox = (item: KnowledgeItem) => item.status === 'inbox' || item.status === 'review';
export function normalizeUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('HTTP / HTTPS のURLを入力してください。');
  url.hash = '';
  return url.href;
}
export function sourceType(url: string): SourceType {
  const { hostname, pathname } = new URL(url);
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(hostname)) return 'youtube';
  if (/(^|\.)(x\.com|twitter\.com)$/.test(hostname)) return 'x';
  if (pathname.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'web';
}
export function captureItem(url: string, title: string, now = new Date().toISOString()): KnowledgeItem {
  const normalized = normalizeUrl(url);
  return { id: crypto.randomUUID(), url: normalized, title: title.trim() || new URL(normalized).hostname,
    source_type: sourceType(normalized), thumbnail_url: null, raw_content: null, summary: '', status: 'inbox',
    asset_score: null, tag_ids: [], project_ids: [], theme_id: null, output: '', next_action: '意味をひとこと添える',
    created_at: now, updated_at: now, connected_at: null };
}
export function selectItems(snapshot: Snapshot, query: KnowledgeQuery, now = Date.now()): KnowledgeItem[] {
  const dormantBefore = new Date(now);
  dormantBefore.setMonth(dormantBefore.getMonth() - 6);
  const tokens = query.text.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return snapshot.items.filter(item => {
    if (query.view === 'inbox' && !isInbox(item)) return false;
    if (query.view === 'library' && isInbox(item)) return false;
    if (query.project_id && !item.project_ids.includes(query.project_id)) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.attention === 'review' && item.status !== 'review') return false;
    if (query.attention === 'high' && (item.asset_score ?? -1) < 80) return false;
    if (query.attention === 'ready' && item.status !== 'ready') return false;
    if (query.attention === 'unconnected' && item.project_ids.length) return false;
    if (query.attention === 'dormant' && ((item.asset_score ?? -1) < 80 || Date.parse(item.updated_at) > dormantBefore.getTime())) return false;
    const haystack = [item.title, item.url, item.summary, item.output, item.next_action, statusLabels[item.status],
      ...snapshot.projects.filter(p => item.project_ids.includes(p.id)).map(p => p.name),
      ...snapshot.tags.filter(t => item.tag_ids.includes(t.id)).map(t => t.name),
      snapshot.themes.find(t => t.id === item.theme_id)?.name ?? ''].join(' ').toLocaleLowerCase();
    return tokens.every(token => haystack.includes(token));
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
