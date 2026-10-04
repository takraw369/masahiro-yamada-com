import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';
import { getRevenueMission, RevenueMissionError, validateRevenueBoardUpdate } from '../../../lib/revenueMission';

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
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) return json({ ok: false, error: 'payload_too_large' }, 413);
    body = JSON.parse(rawBody);
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

  const expectedRevision = typeof body.expectedRevision === 'number' && Number.isSafeInteger(body.expectedRevision) && body.expectedRevision >= 0
    ? body.expectedRevision
    : null;
  if (sceneKey === 'main' && expectedRevision === null) return json({ ok: false, error: 'expected_revision_required' }, 400);
  if (body.actor !== undefined && (typeof body.actor !== 'string' || !['human', 'ai', 'system'].includes(body.actor))) {
    return json({ ok: false, error: 'invalid_actor' }, 400);
  }
  const actor = body.actor === 'ai' || body.actor === 'system' ? body.actor : 'human';

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    // Read before validating, including removal attempts. The save RPC's revision
    // check below still protects against another writer between this read and save.
    const current = sceneKey === 'main'
      ? await supabaseRpc<{ snapshot: unknown; revision: number }>(env, 'masa_flow_canvas_get_v1', {
        p_owner_key: ownerKey, p_scene_key: sceneKey,
      })
      : { snapshot: { nodes: [], edges: [] }, revision: 0 };
    if (sceneKey === 'main' && (!current || !Number.isSafeInteger(current.revision) || current.revision < 0)) {
      throw new Error('invalid_board_read');
    }
    if (sceneKey === 'main') {
      const stored = current.snapshot as Record<string, unknown> | null;
      if (!stored || !Array.isArray(stored.nodes) || !Array.isArray(stored.edges)) throw new Error('invalid_board_read');
      try { getRevenueMission(stored); } catch { throw new Error('invalid_stored_mission'); }
    }
    if (sceneKey === 'main' && current.revision !== expectedRevision) return json({ ok: false, error: 'revision_conflict' }, 409);
    validateRevenueBoardUpdate(current.snapshot, snapshot, { sceneKey, actor: body.actor });
    const data = await supabaseRpc(env, 'masa_flow_canvas_save_v1', {
      p_owner_key: ownerKey,
      p_scene_key: sceneKey,
      p_snapshot: snapshot,
      p_expected_revision: expectedRevision,
      p_actor: actor,
    });
    return json({ ok: true, data });
  } catch (error) {
    if (error instanceof RevenueMissionError) return json({ ok: false, error: error.message }, 400);
    const message = String(error);
    if (message.includes('revision_conflict')) {
      return json({ ok: false, error: 'revision_conflict' }, 409);
    }
    console.error('flow_canvas_save_failed', error);
    return json({ ok: false, error: 'board_write_unavailable' }, 503);
  }
};
