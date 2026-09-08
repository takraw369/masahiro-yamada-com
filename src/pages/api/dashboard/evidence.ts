import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type EvidenceRow = {
  id: string;
  title: string;
  body: string;
  source_kind: string;
  source_url: string | null;
  sport: string | null;
  age_band: string | null;
  learning_phase: string;
  evidence_type: string;
  evidence_quality: string;
  status: string;
  ace_connection: string | null;
  review_note: string | null;
  canonical_drive_url: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  dedupe_key: string | null;
  occurred_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function toEvidence(row: EvidenceRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    sport: row.sport,
    ageBand: row.age_band,
    learningPhase: row.learning_phase,
    evidenceType: row.evidence_type,
    evidenceQuality: row.evidence_quality,
    status: row.status,
    aceConnection: row.ace_connection,
    reviewNote: row.review_note,
    canonicalDriveUrl: row.canonical_drive_url,
    tags: row.tags ?? [],
    metadata: row.metadata ?? {},
    dedupeKey: row.dedupe_key,
    occurredAt: row.occurred_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const cleanString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export const GET = async ({ locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<EvidenceRow[]>(env, 'masa_evidence_list_v1', {
      p_owner_key: ownerKey,
      p_limit: 300,
    });
    return json({ ok: true, items: (rows || []).map(toEvidence) });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const title = cleanString(body.title);
  const evidenceBody = cleanString(body.body);
  if (!title) return json({ ok: false, error: 'evidence_title_required' }, 400);
  if (!evidenceBody) return json({ ok: false, error: 'evidence_body_required' }, 400);

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 20)
    : cleanString(body.tags).split(',').map(item => item.trim()).filter(Boolean).slice(0, 20);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const result = await supabaseRpc<EvidenceRow | EvidenceRow[]>(env, 'masa_evidence_create_v1', {
      p_owner_key: ownerKey,
      p_title: title,
      p_body: evidenceBody,
      p_source_kind: cleanString(body.sourceKind) || 'manual',
      p_source_url: cleanString(body.sourceUrl) || null,
      p_sport: cleanString(body.sport) || null,
      p_age_band: cleanString(body.ageBand) || null,
      p_learning_phase: cleanString(body.learningPhase) || 'unclassified',
      p_evidence_type: cleanString(body.evidenceType) || 'observation',
      p_evidence_quality: cleanString(body.evidenceQuality) || 'raw',
      p_ace_connection: cleanString(body.aceConnection) || null,
      p_tags: tags,
      p_metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      p_dedupe_key: cleanString(body.dedupeKey) || null,
      p_occurred_at: cleanString(body.occurredAt) || null,
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (!row) return json({ ok: false, error: 'evidence_create_missing' }, 500);
    return json({ ok: true, item: toEvidence(row) }, 201);
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};

export const PATCH = async ({ request, locals }: APIContext) => {
  let body: { id?: string; patch?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const id = cleanString(body.id);
  if (!id) return json({ ok: false, error: 'evidence_id_required' }, 400);
  const sourcePatch = body.patch && typeof body.patch === 'object' ? body.patch : {};
  const patch: Record<string, unknown> = {};

  if (typeof sourcePatch.status === 'string') patch.status = sourcePatch.status;
  if (typeof sourcePatch.learningPhase === 'string') patch.learning_phase = sourcePatch.learningPhase;
  if (typeof sourcePatch.evidenceQuality === 'string') patch.evidence_quality = sourcePatch.evidenceQuality;
  if (sourcePatch.sport === null || typeof sourcePatch.sport === 'string') patch.sport = sourcePatch.sport;
  if (sourcePatch.ageBand === null || typeof sourcePatch.ageBand === 'string') patch.age_band = sourcePatch.ageBand;
  if (sourcePatch.aceConnection === null || typeof sourcePatch.aceConnection === 'string') patch.ace_connection = sourcePatch.aceConnection;
  if (sourcePatch.reviewNote === null || typeof sourcePatch.reviewNote === 'string') patch.review_note = sourcePatch.reviewNote;
  if (sourcePatch.canonicalDriveUrl === null || typeof sourcePatch.canonicalDriveUrl === 'string') patch.canonical_drive_url = sourcePatch.canonicalDriveUrl;

  if (!Object.keys(patch).length) return json({ ok: false, error: 'evidence_patch_required' }, 400);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const result = await supabaseRpc<EvidenceRow | EvidenceRow[]>(env, 'masa_evidence_update_v1', {
      p_owner_key: ownerKey,
      p_id: id,
      p_patch: patch,
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (!row) return json({ ok: false, error: 'evidence_update_missing' }, 500);
    return json({ ok: true, item: toEvidence(row) });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};
