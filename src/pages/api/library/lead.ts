import type { APIRoute } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export const POST: APIRoute = async ({ request, locals, url }) => {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'invalid_content_type' }, 415);
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  const productSlug = String(payload?.productSlug || '').trim().toLowerCase();
  const website = String(payload?.website || '').trim();
  const consent = payload?.consent === true;

  if (!consent) return json({ ok: false, error: 'consent_required' }, 400);
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }
  if (!/^[a-z0-9-]{2,80}$/.test(productSlug)) {
    return json({ ok: false, error: 'invalid_product_slug' }, 400);
  }

  const env = getSiteStorageEnv(locals);

  try {
    const id = await supabaseRpc<string | null>(env, 'submit_library_lead_v1', {
      p_email: email,
      p_product_slug: productSlug,
      p_source: 'masahiro-yamada-com',
      p_path: url.pathname,
      p_website: website || null,
    });

    return json({ ok: true, id: id || undefined });
  } catch (error) {
    console.error('library_lead_submit_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, error: 'submit_failed' }, 500);
  }
};
