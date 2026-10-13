export const INTELLIGENCE_READING_VERSION = 'intelligence-reading-ja-v1';

export type IntelligenceReading = {
  version: string;
  titleJa: string;
  summaryJa: string;
  whyJa: string;
  inputHash: string;
  evidenceScope: 'title_excerpt';
  model: string;
  generatedAt: string;
};

export type IntelligenceRow = {
  id: string; source_id: string; title: string; url: string;
  source_kind: string; provenance: string; excerpt: string; published_at: string;
  detected_at: string | null; topic: string; lenses: string[] | null;
  scores: Record<string, number> | null; fact_type: string; ace_impact: string;
  why_it_matters: string; suggested_outputs: string[] | null; status: string;
  output_targets: string[] | null; content_seed: string; drive_url: string;
  evidence_id: string | null; ingest_source: string; first_seen_at: string;
  last_seen_at: string; reviewed_at: string | null; created_at: string; updated_at: string;
  thumbnail_url?: string; thumbnail_source?: string; thumbnail_checked_at?: string | null;
  reading?: unknown;
};

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function readingSourceSnapshot(row: IntelligenceRow): string[] {
  return [row.source_id, row.title, row.excerpt, row.topic, row.fact_type, row.url].map((value) => value ?? '');
}

export async function readingInput(row: IntelligenceRow) {
  const values = [
    text(row.source_id, 120), text(row.title, 500), text(row.excerpt, 3000),
    text(row.topic, 120), text(row.fact_type, 80), text(row.url, 2000),
  ];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values)));
  const inputHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { sourceId: values[0], title: values[1], excerpt: values[2], topic: values[3], factType: values[4], sourceUrl: values[5], inputHash };
}

export function publicThumbnail(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2000) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return '';
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) return '';
    return url.href;
  } catch { return ''; }
}

export function validReading(value: unknown): IntelligenceReading | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== INTELLIGENCE_READING_VERSION || row.evidenceScope !== 'title_excerpt') return null;
  if (typeof row.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.inputHash)) return null;
  if (row.model !== '@cf/meta/llama-3.3-70b-instruct-fp8-fast') return null;
  if (typeof row.generatedAt !== 'string' || !Number.isFinite(Date.parse(row.generatedAt))) return null;
  const result = {
    version: INTELLIGENCE_READING_VERSION, titleJa: text(row.titleJa, 250),
    summaryJa: text(row.summaryJa, 1400), whyJa: text(row.whyJa, 700),
    inputHash: row.inputHash, evidenceScope: 'title_excerpt' as const,
    model: text(row.model, 200), generatedAt: row.generatedAt,
  };
  if (result.titleJa.length < 3 || result.summaryJa.length < 20 || result.whyJa.length < 15) return null;
  return [result.titleJa, result.summaryJa, result.whyJa].every((part) => /[\u3040-\u30ff\u3400-\u9fff]/u.test(part)) ? result : null;
}

export async function toIntelligenceItem(row: IntelligenceRow) {
  const reading = validReading(row.reading);
  const readingCurrent = Boolean(reading && reading.inputHash === (await readingInput(row)).inputHash);
  return {
    id: row.id, sourceId: row.source_id, title: row.title, url: row.url,
    sourceKind: row.source_kind, provenance: row.provenance, excerpt: row.excerpt,
    publishedAt: row.published_at, detectedAt: row.detected_at, topic: row.topic,
    lenses: row.lenses ?? [], scores: row.scores ?? {}, factType: row.fact_type,
    aceImpact: row.ace_impact, whyItMatters: row.why_it_matters,
    suggestedOutputs: row.suggested_outputs ?? [], status: row.status,
    outputTargets: row.output_targets ?? [], contentSeed: row.content_seed,
    driveUrl: row.drive_url, evidenceId: row.evidence_id, ingestSource: row.ingest_source,
    firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, reviewedAt: row.reviewed_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    thumbnailUrl: publicThumbnail(row.thumbnail_url), thumbnailSource: row.thumbnail_source ?? '',
    reading, readingCurrent,
  };
}
