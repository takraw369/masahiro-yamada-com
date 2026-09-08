import type { APIContext } from 'astro';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  supabaseRpc,
} from '../../../lib/siteStorage';

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<Array<{ slot_id: string }>>(
      env,
      'masa_dashboard_state_get_v2',
      { p_owner_key: ownerKey },
    );
    const checked: Record<string, boolean> = {};
    for (const row of rows || []) checked[row.slot_id] = true;

    return new Response(JSON.stringify({ checked, storage: 'supabase' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, checked: {}, storage: 'unavailable', error: 'storage_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const slotId = typeof body.slotId === 'string' ? body.slotId.trim().slice(0, 180) : '';
  const checked = body.checked;
  const xp = typeof body.xp === 'number' && Number.isFinite(body.xp) ? Math.max(0, Math.round(body.xp)) : 0;

  if (!slotId || typeof checked !== 'boolean') {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    await supabaseRpc<boolean>(env, 'masa_dashboard_state_set_v2', {
      p_owner_key: ownerKey,
      p_slot_id: slotId,
      p_checked: checked,
      p_xp: xp,
    });

    return new Response(JSON.stringify({ ok: true, storage: 'supabase' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Never acknowledge a write to an unreconciled secondary store.
    return new Response(JSON.stringify({ ok: false, storage: 'unavailable', error: 'storage_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
