import type { APIContext } from 'astro';

interface Env {
  DB: D1Database;
}

export const GET = async ({ locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;

  if (!env?.DB) {
    return new Response(JSON.stringify({ checked: {} }), {
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
    for (const row of rows.results) {
      checked[row.slot_id] = true;
    }

    return new Response(JSON.stringify({ checked }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ checked: {} }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;

  if (!env?.DB) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json<{ slotId: string; checked: boolean; xp: number }>();
  const { slotId, checked, xp } = body;

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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
