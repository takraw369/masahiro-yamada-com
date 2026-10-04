import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const MAX_BODY_BYTES = 220_000;
const SCENE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

function sceneKeyFrom(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get('scene') || 'main').trim().toLowerCase();
}

export const GET = async ({ request, locals }: APIContext) => {
  const sceneKey = sceneKeyFrom(request);
  if (!SCENE_RE.test(sceneKey)) return json({ ok: false, error: 'invalid_scene_key' }, 400);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc(env, 'masa_flow_canvas_get_v1', {
      p_owner_key: ownerKey,
      p_scene_key: sceneKey,
    });
    return json({ ok: true, data });
  } catch (error) {
    console.error('flow_canvas_get_failed', error);
    return json({ ok: false, error: 'board_read_unavailable' }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return json({ ok: false, error: 'payload_too_large' }, 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const sceneKey = typeof body.sceneKey === 'string' ? body.sceneKey.trim().toLowerCase() : 'main';
  if (!SCENE_RE.test(sceneKey)) return json({ ok: false, error: 'invalid_scene_key' }, 400);

  const snapshot = body.snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return json({ ok: false, error: 'invalid_snapshot' }, 400);
  }

  const snapshotRecord = snapshot as Record<string, unknown>;
  if (!Array.isArray(snapshotRecord.nodes) || !Array.isArray(snapshotRecord.edges)) {
    return json({ ok: false, error: 'invalid_snapshot_shape' }, 400);
  }
  if (snapshotRecord.nodes.length > 500 || snapshotRecord.edges.length > 1500) {
    return json({ ok: false, error: 'snapshot_too_large' }, 413);
  }

  const expectedRevision = typeof body.expectedRevision === 'number' && Number.isFinite(body.expectedRevision)
    ? Math.max(0, Math.trunc(body.expectedRevision))
    : null;
  const actor = body.actor === 'ai' || body.actor === 'system' ? body.actor : 'human';

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc(env, 'masa_flow_canvas_save_v1', {
      p_owner_key: ownerKey,
      p_scene_key: sceneKey,
      p_snapshot: snapshot,
      p_expected_revision: expectedRevision,
      p_actor: actor,
    });
    return json({ ok: true, data });
  } catch (error) {
    const message = String(error);
    if (message.includes('revision_conflict')) {
      return json({ ok: false, error: 'revision_conflict' }, 409);
    }
    console.error('flow_canvas_save_failed', error);
    return json({ ok: false, error: 'board_write_unavailable' }, 503);
  }
};
