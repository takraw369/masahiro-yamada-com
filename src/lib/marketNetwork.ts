// Read-only adapter for JP Market Vis. Never infer financial performance from edge counts.
export const JP_MARKET_SOURCE = 'https://mattyamonaca.github.io/JP_Market_Vis/';
export const JP_MARKET_REPO = 'https://github.com/mattyamonaca/JP_Market_Vis';

export type CompanyRecord = {
  name: string;
  name_en?: string;
  name_kana?: string;
  name_edinet?: string;
  aliases?: string[];
  market_segment?: string;
  industry_33?: string;
  securities_code?: string;
};
export type NodeRef = { type: 'listed' | 'entity'; key: string };
export type EvidenceRecord = {
  source?: string;
  url?: string;
  tier?: string;
  as_of?: string;
  published?: string;
  verification?: string;
  doc_id?: string;
  facts?: Record<string, unknown>;
};
export type RelationRecord = {
  relation_id: string;
  source: NodeRef;
  target: NodeRef;
  category: string;
  relation_type: string;
  status?: 'confirmed' | 'needs_review' | 'historical';
  directed?: boolean;
  verification?: { status?: string; on?: string };
  evidence?: EvidenceRecord[];
  attributes?: Record<string, unknown>;
};
export type MarketDataset = {
  datasetId: string;
  generatedAt: string | null;
  companies: Record<string, CompanyRecord>;
  entities: Record<string, { name: string }>;
  relations: RelationRecord[];
  evidenceShards?: { size: number; path: string } | null;
};
export type CompanyLink = { relation: RelationRecord; other: NodeRef; name: string; code: string | null };
export type RelationIndex = Map<string, CompanyLink[]>;

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseMarketDataset(m4: unknown, m5: unknown): MarketDataset {
  if (!object(m4) || !object(m5) || typeof m4.dataset_id !== 'string' ||
    !m4.dataset_id || m4.dataset_id !== m5.dataset_id || !object(m4.companies) ||
    !object(m5.entities) || !Array.isArray(m5.relations)) {
    throw new Error('企業・関係データの版が一致しません。公開元の更新を確認してください。');
  }
  return {
    datasetId: m4.dataset_id,
    generatedAt: typeof m5.generated_at === 'string' ? m5.generated_at : null,
    companies: m4.companies,
    entities: m5.entities,
    relations: m5.relations,
    evidenceShards: object(m5.evidence_shards) &&
      Number.isInteger(m5.evidence_shards.size) && m5.evidence_shards.size > 0 &&
      typeof m5.evidence_shards.path === 'string'
        ? { size: m5.evidence_shards.size, path: m5.evidence_shards.path }
        : null,
  };
}
export const relationStatus = (r: RelationRecord) => r.status ?? 'confirmed';
export function nodeName(dataset: MarketDataset, ref: NodeRef): string {
  return (ref.type === 'listed' ? dataset.companies[ref.key]?.name : dataset.entities[ref.key]?.name) || ref.key;
}
export function buildRelationIndex(dataset: MarketDataset): RelationIndex {
  const index: RelationIndex = new Map();
  for (const relation of dataset.relations) {
    if (!relation || !relation.source || !relation.target ||
      typeof relation.relation_id !== 'string') continue;
    for (const [ref, other] of [[relation.source, relation.target], [relation.target, relation.source]]) {
      if (ref.type !== 'listed' || !dataset.companies[ref.key]) continue;
      const key = ref.key;
      const list = index.get(key) ?? [];
      list.push({ relation, other, name: nodeName(dataset, other), code: other.type === 'listed' ? other.key : null });
      index.set(key, list);
    }
  }
  return index;
}
const normalize = (v: string) => v.normalize('NFKC').toLowerCase()
  .replace(/[\s　・･\-－—–]+/g, '').replace(/[ァ-ヶ]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60));
export function searchMarketCompanies(dataset: MarketDataset, index: RelationIndex, query: string, limit = 20) {
  const q = normalize(query.trim());
  if (!q) return [];
  return Object.entries(dataset.companies).filter(([code, company]) =>
    [code, company.name, company.name_en, company.name_kana, company.name_edinet, ...(company.aliases ?? [])]
      .filter((value): value is string => typeof value === 'string')
      .some(value => normalize(value).includes(q))
  ).sort((a, b) => (index.get(b[0])?.length ?? 0) - (index.get(a[0])?.length ?? 0))
    .slice(0, limit).map(([code, company]) => ({ code, company, degree: index.get(code)?.length ?? 0 }));
}
export function companyRelations(index: RelationIndex, code: string, categories: Set<string>, includeUnconfirmed = false): CompanyLink[] {
  return (index.get(code) ?? []).filter(({ relation }) =>
    (categories.size === 0 || categories.has(relation.category)) &&
    (includeUnconfirmed || relationStatus(relation) === 'confirmed'));
}
export function networkNeighbors(links: CompanyLink[], max = 14) {
  const map = new Map<string, { key: string; name: string; code: string | null; count: number; category: string }>();
  for (const { relation, other, name, code } of links) {
    const key = other.type + ':' + other.key;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { key, name, code, count: 1, category: relation.category });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja')).slice(0, max);
}
export function evidenceShardPath(dataset: MarketDataset, relationId: string): string | null {
  const shards = dataset.evidenceShards;
  if (!shards || !/^r\d+$/i.test(relationId) || !shards.path.includes('{shard}')) return null;
  const num = Number(relationId.slice(1));
  if (!Number.isSafeInteger(num)) return null;
  const shard = String(Math.floor(num / shards.size)).padStart(4, '0');
  const path = shards.path.replace('{shard}', shard);
  // Only permit assets under this public project's own root, never arbitrary remote URLs.
  return path.startsWith('data/') && !path.includes('..') && !path.includes('://') ? path : null;
}
