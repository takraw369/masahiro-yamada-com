import type { APIRoute } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../lib/siteStorage';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const allowedCategories = new Set(['service', 'payment', 'technical', 'business', 'privacy', 'other']);

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

  const category = String(payload?.category || '').trim().toLowerCase();
  const name = String(payload?.name || '').trim();
  const email = String(payload?.email || '').trim();
  const message = String(payload?.message || '').trim();
  const website = String(payload?.website || '').trim();
  const consent = payload?.consent === true;

  if (!allowedCategories.has(category)) {
    return json({ ok: false, error: 'category_required' }, 400);
  }
  if (!consent) {
    return json({ ok: false, error: 'consent_required' }, 400);
  }
  if (name.length > 100 || email.length > 254 || message.length < 10 || message.length > 5000) {
    return json({ ok: false, error: 'invalid_fields' }, 400);
  }

  const env = getSiteStorageEnv(locals);

  try {
    const inquiryId = await supabaseRpc<string | null>(env, 'submit_contact_inquiry_v1', {
      p_category: category,
      p_name: name || null,
      p_email: email,
      p_message: message,
      p_source: 'masahiro-yamada-com',
      p_path: url.pathname,
      p_website: website || null,
    });

    // A null id is the expected silent result for the honeypot path.
    return json({ ok: true, id: inquiryId || undefined });
  } catch (error) {
    console.error('contact_submit_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, error: 'submit_failed' }, 500);
  }
};
