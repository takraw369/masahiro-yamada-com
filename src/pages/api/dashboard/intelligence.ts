import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type IntelligenceRow = {
  id: string;
  source_id: string;
  title: string;
  url: string;
  source_kind: string;
  provenance: string;
  excerpt: string;
  published_at: string;
  detected_at: string | null;
  topic: string;
  lenses: string[] | null;
  scores: Record<string, number> | null;
  fact_type: string;
  ace_impact: string;
  why_it_matters: string;
  suggested_outputs: string[] | null;
  status: string;
  output_targets: string[] | null;
  content_seed: string;
  drive_url: string;
  evidence_id: string | null;
  ingest_source: string;
  first_seen_at: string;
  last_seen_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: IntelligenceRow) {
  return {
    id: row.id,
    sourceId: row.source_id,
    title: row.title,
    url: row.url,
    sourceKind: row.source_kind,
    provenance: row.provenance,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    detectedAt: row.detected_at,
    topic: row.topic,
    lenses: row.lenses ?? [],
    scores: row.scores ?? {},
    factType: row.fact_type,
    aceImpact: row.ace_impact,
    whyItMatters: row.why_it_matters,
    suggestedOutputs: row.suggested_outputs ?? [],
    status: row.status,
    outputTargets: row.output_targets ?? [],
    contentSeed: row.content_seed,
    driveUrl: row.drive_url,
    evidenceId: row.evidence_id,
    ingestSource: row.ingest_source,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const strings = (value: unknown, max = 20) => Array.isArray(value)
  ? value.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, max)
  : [];

export const GET = async ({ request, locals }: APIContext) => {
  try {
    const url = new URL(request.url);
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<IntelligenceRow[]>(env, 'masa_intelligence_list_v1', {
      p_owner_key: ownerKey,
      p_status: clean(url.searchParams.get('status')) || null,
      p_topic: clean(url.searchParams.get('topic')) || null,
      p_limit: Math.min(Math.max(Number(url.searchParams.get('limit') || 300), 1), 500),
    });
    return json({ ok: true, items: (rows || []).map(toItem) });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const action = clean(body.action);

    if (action === 'promote_evidence') {
      const id = clean(body.id);
      if (!id) return json({ ok: false, error: 'intelligence_id_required' }, 400);
      const result = await supabaseRpc<IntelligenceRow | IntelligenceRow[]>(env, 'masa_intelligence_promote_evidence_v1', {
        p_owner_key: ownerKey,
        p_id: id,
        p_review_note: clean(body.reviewNote) || null,
      });
      const row = Array.isArray(result) ? result[0] : result;
      return row ? json({ ok: true, item: toItem(row) }) : json({ ok: false, error: 'promotion_missing' }, 500);
    }

    if (action === 'content_seed') {
      const id = clean(body.id);
      if (!id) return json({ ok: false, error: 'intelligence_id_required' }, 400);
      const result = await supabaseRpc<IntelligenceRow | IntelligenceRow[]>(env, 'masa_intelligence_make_output_drafts_v1', {
        p_owner_key: ownerKey,
        p_id: id,
      });
      const row = Array.isArray(result) ? result[0] : result;
      return row ? json({ ok: true, item: toItem(row) }) : json({ ok: false, error: 'output_drafts_missing' }, 500);
    }

    const title = clean(body.title);
    if (!title) return json({ ok: false, error: 'intelligence_title_required' }, 400);
    const result = await supabaseRpc<IntelligenceRow | IntelligenceRow[]>(env, 'masa_intelligence_create_v1', {
      p_owner_key: ownerKey,
      p_title: title,
      p_url: clean(body.url) || null,
      p_excerpt: clean(body.excerpt) || null,
      p_topic: clean(body.topic) || 'General',
      p_lenses: strings(body.lenses),
      p_why_it_matters: clean(body.whyItMatters) || null,
    });
    const row = Array.isArray(result) ? result[0] : result;
    return row ? json({ ok: true, item: toItem(row) }, 201) : json({ ok: false, error: 'intelligence_create_missing' }, 500);
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};

export const PATCH = async ({ request, locals }: APIContext) => {
  let body: { id?: string; patch?: Record<string, unknown> } = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const id = clean(body.id);
  if (!id) return json({ ok: false, error: 'intelligence_id_required' }, 400);
  const source = body.patch && typeof body.patch === 'object' ? body.patch : {};
  const patch: Record<string, unknown> = {};
  if (typeof source.status === 'string') patch.status = source.status;
  if (typeof source.topic === 'string') patch.topic = source.topic;
  if (Array.isArray(source.lenses)) patch.lenses = strings(source.lenses);
  if (typeof source.aceImpact === 'string') patch.ace_impact = source.aceImpact;
  if (source.whyItMatters === null || typeof source.whyItMatters === 'string') patch.why_it_matters = source.whyItMatters ?? '';
  if (Array.isArray(source.outputTargets)) patch.output_targets = strings(source.outputTargets);
  if (source.contentSeed === null || typeof source.contentSeed === 'string') patch.content_seed = source.contentSeed ?? '';
  if (source.driveUrl === null || typeof source.driveUrl === 'string') patch.drive_url = source.driveUrl ?? '';
  if (!Object.keys(patch).length) return json({ ok: false, error: 'intelligence_patch_required' }, 400);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const result = await supabaseRpc<IntelligenceRow | IntelligenceRow[]>(env, 'masa_intelligence_update_v1', {
      p_owner_key: ownerKey,
      p_id: id,
      p_patch: patch,
    });
    const row = Array.isArray(result) ? result[0] : result;
    return row ? json({ ok: true, item: toItem(row) }) : json({ ok: false, error: 'intelligence_update_missing' }, 500);
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};