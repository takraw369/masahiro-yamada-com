import type { APIRoute } from 'astro';
import { getSiteStorageEnv } from '../../../../lib/siteStorage';

export const prerender = false;

// Auth tokens must be verified by Supabase PostgREST. Never trust a contact_id,
// email, or visitor_id supplied by the request when deciding paid access.
const reply = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Pragma': 'no-cache',
      'Vary': 'Authorization',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });

export const GET: APIRoute = async ({ params, request, locals }) => {
  const slug = params.slug || '';
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return reply({ ok: false, error: 'not_found' }, 404);

  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);
  if (!match || match[1].length > 8192) {
    return reply({ ok: false, error: 'login_required' }, 401);
  }

  const env = getSiteStorageEnv(locals);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return reply({ ok: false, error: 'temporarily_unavailable' }, 503);
  }

  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/knowledge_shelf_content_read_v1`,
      {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${match[1]}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ p_slug: slug }),
        cache: 'no-store',
      },
    );

    if (response.status === 401 || response.status === 403) {
      return reply({ ok: false, error: 'login_required' }, 401);
    }
    if (!response.ok) {
      return reply({ ok: false, error: 'temporarily_unavailable' }, 503);
    }
    const result = (await response.json()) as {
      status?: 'ok' | 'unauthorized' | 'not_found' | 'forbidden';
      asset?: Record<string, unknown>;
    };
    if (result.status === 'unauthorized') return reply({ ok: false, error: 'login_required' }, 401);
    if (result.status === 'not_found') return reply({ ok: false, error: 'not_found' }, 404);
    if (result.status !== 'ok' || !result.asset) {
      return reply({ ok: false, error: 'membership_required' }, 403);
    }

    return reply({ ok: true, asset: result.asset }, 200);
  } catch {
    return reply({ ok: false, error: 'temporarily_unavailable' }, 503);
  }
};
