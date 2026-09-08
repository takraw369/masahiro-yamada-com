import type { APIContext } from 'astro';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  migrateLegacyD1,
  supabaseRpc,
} from '../../../lib/siteStorage';

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  try {
    await migrateLegacyD1(env);
  } catch {
    // Migration is best-effort during the cutover and must not block the dashboard.
  }

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
    if (!env.DB) {
      return new Response(JSON.stringify({ checked: {}, storage: 'unavailable' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const rows = await env.DB.prepare(
        'SELECT slot_id FROM ace_checked WHERE user_id = ?'
      )
        .bind('masa')
        .all<{ slot_id: string }>();

      const checked: Record<string, boolean> = {};
      for (const row of rows.results || []) checked[row.slot_id] = true;

      return new Response(JSON.stringify({ checked, storage: 'd1-fallback' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ checked: {}, storage: 'unavailable' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const body = (await request.json()) as { slotId?: unknown; checked?: unknown; xp?: unknown };
  const slotId = typeof body.slotId === 'string' ? body.slotId.trim().slice(0, 180) : '';
  const checked = Boolean(body.checked);
  const rawXp = typeof body.xp === 'number' ? body.xp : Number.NaN;
  const xp = Number.isFinite(rawXp) ? Math.max(0, Math.round(rawXp)) : 0;

  if (!slotId) {
    return new Response(JSON.stringify({ ok: false, error: 'slot_id_required' }), {
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
    // Supabase is the only write authority after cutover. Writing new state to
    // D1 here would create data that the completed one-time migration will not
    // automatically replay after Supabase recovers.
    return new Response(JSON.stringify({
      ok: false,
      error: 'primary_storage_unavailable',
      storage: 'unavailable',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
