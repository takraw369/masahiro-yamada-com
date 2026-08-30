import type { APIContext } from 'astro';

interface Env {
  DB: D1Database;
}

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dashboard_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'masa',
      page TEXT NOT NULL DEFAULT '/dashboard',
      message TEXT NOT NULL,
      context TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export const GET = async ({ locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) {
    return new Response(JSON.stringify({ ok: true, items: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureTable(env.DB);
    const rows = await env.DB.prepare(
      `SELECT id, page, message, context, status, created_at
       FROM dashboard_feedback
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 20`
    ).bind('masa').all();

    return new Response(JSON.stringify({ ok: true, items: rows.results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, items: [], error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  const body = await request.json<{ page?: string; message?: string; context?: string }>();
  const message = body.message?.trim();

  if (!message) {
    return new Response(JSON.stringify({ ok: false, error: 'message_required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env?.DB) {
    return new Response(JSON.stringify({ ok: true, stored: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureTable(env.DB);
    const result = await env.DB.prepare(
      `INSERT INTO dashboard_feedback (user_id, page, message, context)
       VALUES (?, ?, ?, ?)`
    ).bind('masa', body.page || '/dashboard', message, body.context || null).run();

    return new Response(JSON.stringify({ ok: true, stored: true, id: result.meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
