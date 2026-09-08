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
    return new Response(JSON.stringify({ ok: false, items: [], storage: 'unavailable', error: 'primary_storage_unavailable' }), {
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
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const page = typeof body.page === 'string' ? body.page.trim() || '/dashboard' : '/dashboard';
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
    return new Response(JSON.stringify({ ok: false, stored: false, storage: 'unavailable', error: 'primary_storage_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
