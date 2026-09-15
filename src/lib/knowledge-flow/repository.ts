import {
  destinationTypeLabels,
  normalizeUrl,
  statusLabels,
} from "./model.ts";
import type { KnowledgeItem, Snapshot } from "./model.ts";
import { createFixture } from "./fixtures.ts";

export const STORAGE_KEY = "masa:knowledge-flow:demo:v1";
export interface KnowledgeRepository {
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot, expectedRevision: number): Promise<Snapshot>;
}
const invalid = () =>
  new Error("保存データを読み込めません。既存データは上書きしていません。");
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));

function migrateSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object") throw invalid();
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 && raw.version !== 2) throw invalid();
  if (!Array.isArray(raw.items)) throw invalid();
  const items = raw.items.map((candidate) => {
    if (!candidate || typeof candidate !== "object") throw invalid();
    const item = candidate as Record<string, unknown>;
    return {
      ...item,
      why_saved: typeof item.why_saved === "string" ? item.why_saved : "",
      connection_reason:
        typeof item.connection_reason === "string" ? item.connection_reason : "",
      destination_type:
        typeof item.destination_type === "string" &&
        Object.hasOwn(destinationTypeLabels, item.destination_type)
          ? item.destination_type
          : typeof item.output === "string" && item.output.trim()
            ? "content"
            : "hold",
    } as KnowledgeItem;
  });
  return { ...raw, version: 2, items } as Snapshot;
}

export function validateSnapshot(value: unknown): Snapshot {
  const s = migrateSnapshot(value);
  if (
    s.version !== 2 ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    !Array.isArray(s.items)
  )
    throw invalid();
  for (const records of [s.projects, s.tags, s.themes]) {
    if (
      !Array.isArray(records) ||
      records.some(
        (x) => !x || typeof x.id !== "string" || typeof x.name !== "string",
      ) ||
      new Set(records.map((x) => x.id)).size !== records.length
    )
      throw invalid();
  }
  if (
    s.projects.some(
      (p) =>
        typeof p.description !== "string" || !/^#[0-9a-f]{6}$/i.test(p.color),
    )
  )
    throw invalid();
  if (new Set(s.items.map((x) => x?.id)).size !== s.items.length)
    throw invalid();
  for (const i of s.items) {
    if (
      !i ||
      typeof i.id !== "string" ||
      ![
        "title",
        "url",
        "summary",
        "why_saved",
        "connection_reason",
        "output",
        "next_action",
      ].every((k) => typeof i[k as keyof typeof i] === "string") ||
      !Object.hasOwn(statusLabels, i.status) ||
      !Object.hasOwn(destinationTypeLabels, i.destination_type) ||
      !["web", "youtube", "research", "pdf", "x"].includes(i.source_type) ||
      !(
        i.asset_score === null ||
        (Number.isInteger(i.asset_score) &&
          i.asset_score >= 0 &&
          i.asset_score <= 100)
      ) ||
      !strings(i.tag_ids) ||
      !strings(i.project_ids) ||
      !date(i.created_at) ||
      !date(i.updated_at) ||
      !(i.connected_at === null || date(i.connected_at)) ||
      !(i.raw_content === null || typeof i.raw_content === "string") ||
      !(i.thumbnail_url === null || typeof i.thumbnail_url === "string")
    )
      throw invalid();
    try {
      normalizeUrl(i.url);
      if (i.thumbnail_url) normalizeUrl(i.thumbnail_url);
    } catch {
      throw invalid();
    }
    if (
      i.project_ids.some((id) => !s.projects.some((p) => p.id === id)) ||
      i.tag_ids.some((id) => !s.tags.some((t) => t.id === id)) ||
      (i.theme_id !== null && !s.themes.some((t) => t.id === i.theme_id))
    )
      throw invalid();
  }
  return s;
}
/** No network, credentials or live API fallback. Failed writes never report success. */
export function localKnowledgeRepository(
  storage: Pick<Storage, "getItem" | "setItem">,
): KnowledgeRepository {
  let initial: Snapshot | undefined;
  const read = () => {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return (initial ??= createFixture());
    try {
      return validateSnapshot(JSON.parse(raw));
    } catch {
      throw invalid();
    }
  };
  return {
    async load() {
      return structuredClone(read());
    },
    async save(snapshot, expectedRevision) {
      // Check immediately before the synchronous write; detects stale edits in other tabs.
      if (read().revision !== expectedRevision)
        throw new Error(
          "別のタブで更新されました。再読み込みしてからもう一度お試しください。",
        );
      const next = validateSnapshot({
        ...snapshot,
        version: 2,
        revision: expectedRevision + 1,
      });
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          "端末に保存できませんでした。空き容量やブラウザの保存設定を確認してください。",
        );
      }
      return structuredClone(next);
    },
  };
}
