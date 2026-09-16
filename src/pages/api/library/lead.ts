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

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : null;

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
  const visitorId = clean(payload?.visitorId, 80);
  const sessionId = clean(payload?.sessionId, 80);
  const source = clean(payload?.source, 80) || 'masahiro-yamada-com';
  const medium = clean(payload?.medium, 80);
  const campaign = clean(payload?.campaign, 120);
  const referrer = clean(payload?.referrer, 500);

  if (!consent) return json({ ok: false, error: 'consent_required' }, 400);
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }
  if (!/^[a-z0-9-]{2,80}$/.test(productSlug)) {
    return json({ ok: false, error: 'invalid_product_slug' }, 400);
  }
  if (visitorId && !/^[A-Za-z0-9_-]{8,80}$/.test(visitorId)) {
    return json({ ok: false, error: 'invalid_visitor_id' }, 400);
  }
  if (sessionId && !/^[A-Za-z0-9_-]{8,80}$/.test(sessionId)) {
    return json({ ok: false, error: 'invalid_session_id' }, 400);
  }

  const env = getSiteStorageEnv(locals);

  try {
    const id = await supabaseRpc<string | null>(env, 'submit_library_lead_v2', {
      p_email: email,
      p_product_slug: productSlug,
      p_source: source,
      p_path: url.pathname,
      p_website: website || null,
      p_visitor_id: visitorId,
      p_session_id: sessionId,
      p_medium: medium,
      p_campaign: campaign,
      p_referrer: referrer,
    });

    return json({ ok: true, id: id || undefined });
  } catch (error) {
    console.error('library_lead_submit_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, error: 'submit_failed' }, 500);
  }
};
