import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type VoiceRow = {
  id: string;
  target_type: string;
  target_key: string;
  feedback_type: string;
  body: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  person_id: string | null;
  client_event_id: string | null;
  public_consent: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  priority: string;
  workflow_bucket: string;
  theme: string | null;
  cluster_key: string | null;
  review_note: string | null;
  reviewed_at: string | null;
};

function toVoice(row: VoiceRow) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetKey: row.target_key,
    feedbackType: row.feedback_type,
    body: row.body,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    personId: row.person_id,
    clientEventId: row.client_event_id,
    publicConsent: row.public_consent,
    metadata: row.metadata ?? {},
    occurredAt: row.occurred_at,
    priority: row.priority,
    workflowBucket: row.workflow_bucket,
    theme: row.theme,
    clusterKey: row.cluster_key,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
  };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET = async ({ locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<VoiceRow[]>(env, 'masa_voice_inbox_list_v1', {
      p_owner_key: ownerKey,
      p_limit: 250,
    });
    return json({ ok: true, items: (rows || []).map(toVoice) });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  let body: { id?: string; patch?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const sourcePatch = body.patch && typeof body.patch === 'object' ? body.patch : {};
  if (!id) return json({ ok: false, error: 'voice_id_required' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof sourcePatch.status === 'string') patch.status = sourcePatch.status;
  if (typeof sourcePatch.priority === 'string') patch.priority = sourcePatch.priority;
  if (typeof sourcePatch.workflowBucket === 'string') patch.workflow_bucket = sourcePatch.workflowBucket;
  if (sourcePatch.theme === null || typeof sourcePatch.theme === 'string') patch.theme = sourcePatch.theme;
  if (sourcePatch.clusterKey === null || typeof sourcePatch.clusterKey === 'string') patch.cluster_key = sourcePatch.clusterKey;
  if (sourcePatch.reviewNote === null || typeof sourcePatch.reviewNote === 'string') patch.review_note = sourcePatch.reviewNote;

  if (!Object.keys(patch).length) return json({ ok: false, error: 'voice_patch_required' }, 400);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const result = await supabaseRpc<VoiceRow | VoiceRow[]>(env, 'masa_voice_inbox_update_v1', {
      p_owner_key: ownerKey,
      p_id: id,
      p_patch: patch,
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (!row) return json({ ok: false, error: 'voice_update_missing' }, 500);
    return json({ ok: true, item: toVoice(row) });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};
