import type { APIContext } from 'astro';
import { getSiteStorageEnv, migrateLegacyD1, supabaseRpc } from '../../../lib/siteStorage';

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  try {
    await migrateLegacyD1(env);
  } catch {
    // Migration is best-effort during the cutover and must not block the dashboard.
  }

  try {
    const rows = await supabaseRpc<Array<{ slot_id: string }>>(
      env,
      'masa_dashboard_state_get',
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
  const body = await request.json<{ slotId: string; checked: boolean; xp: number }>();
  const slotId = typeof body.slotId === 'string' ? body.slotId.trim().slice(0, 180) : '';
  const checked = Boolean(body.checked);
  const xp = Number.isFinite(body.xp) ? Math.max(0, Math.round(body.xp)) : 0;

  if (!slotId) {
    return new Response(JSON.stringify({ ok: false, error: 'slot_id_required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await supabaseRpc<boolean>(env, 'masa_dashboard_state_set', {
      p_slot_id: slotId,
      p_checked: checked,
      p_xp: xp,
    });

    return new Response(JSON.stringify({ ok: true, storage: 'supabase' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (supabaseError) {
    if (!env.DB) {
      return new Response(JSON.stringify({ ok: false, error: String(supabaseError) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      if (checked) {
        await env.DB.prepare(
          'INSERT OR REPLACE INTO ace_checked (user_id, slot_id, xp, checked_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
        )
          .bind('masa', slotId, xp)
          .run();
      } else {
        await env.DB.prepare(
          'DELETE FROM ace_checked WHERE user_id = ? AND slot_id = ?'
        )
          .bind('masa', slotId)
          .run();
      }

      return new Response(JSON.stringify({ ok: true, storage: 'd1-fallback' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (d1Error) {
      return new Response(JSON.stringify({
        ok: false,
        error: `supabase=${String(supabaseError)};d1=${String(d1Error)}`,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};
