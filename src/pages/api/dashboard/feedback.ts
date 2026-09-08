import type { APIContext } from 'astro';
import type { SiteStorageEnv } from '../../../lib/siteStorage';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  migrateLegacyD1,
  supabaseRpc,
} from '../../../lib/siteStorage';

async function ensureD1Table(db: NonNullable<SiteStorageEnv['DB']>) {
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
  const env = getSiteStorageEnv(locals);

  try {
    await migrateLegacyD1(env);
  } catch {
    // Best-effort legacy import; the read path below still has D1 fallback.
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<Array<{
      id: string;
      page: string;
      message: string;
      context: string | null;
      status: string;
      created_at: string;
    }>>(env, 'masa_dashboard_feedback_list_v2', {
      p_owner_key: ownerKey,
      p_limit: 20,
    });

    const items = (rows || []).map((row) => ({
      ...row,
      status: row.status === 'pending' ? 'new' : row.status,
    }));

    return new Response(JSON.stringify({ ok: true, items, storage: 'supabase' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    if (!env.DB) {
      return new Response(JSON.stringify({ ok: true, items: [], storage: 'unavailable' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await ensureD1Table(env.DB);
      const rows = await env.DB.prepare(
        `SELECT id, page, message, context, status, created_at
         FROM dashboard_feedback
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 20`
      ).bind('masa').all();

      return new Response(JSON.stringify({
        ok: true,
        items: rows.results,
        storage: 'd1-fallback',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, items: [], error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const body = (await request.json()) as { page?: unknown; message?: unknown; context?: unknown };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const page = typeof body.page === 'string' && body.page.trim() ? body.page.trim() : '/dashboard';
  const context = typeof body.context === 'string' ? body.context : null;

  if (!message) {
    return new Response(JSON.stringify({ ok: false, error: 'message_required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const id = await supabaseRpc<string>(env, 'masa_dashboard_feedback_add_v2', {
      p_owner_key: ownerKey,
      p_page: page,
      p_message: message,
      p_context: context,
    });

    return new Response(JSON.stringify({ ok: true, stored: true, id, storage: 'supabase' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Supabase is the only write authority after cutover. Do not create new
    // D1-only feedback after the one-time import marker has completed.
    return new Response(JSON.stringify({
      ok: false,
      stored: false,
      error: 'primary_storage_unavailable',
      storage: 'unavailable',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
