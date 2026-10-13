import type { APIContext } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

// Public conversion signal only. Neither answers nor contact details enter event payloads.
const ALLOWED = new Set(['mental_check_line_click', 'mental_check_toolkit_click']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export const POST = async ({ request, locals }: APIContext) => {
  // Cross-origin websites cannot fabricate conversion events on behalf of a browser.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'origin_not_allowed' }, 403);
  }
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json({ ok: false, error: 'invalid_content_type' }, 415);
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const payload = body as Record<string, unknown>;
  const sessionKey = payload.sessionKey;
  const eventName = payload.event;
  if (typeof sessionKey !== 'string' || !UUID.test(sessionKey)
      || typeof eventName !== 'string' || !ALLOWED.has(eventName)) {
    return json({ ok: false, error: 'invalid_event' }, 400);
  }

  try {
    const eventId = await supabaseRpc<number | null>(getSiteStorageEnv(locals), 'mental_check_funnel_event_add_v1', {
      p_session_key: sessionKey,
      p_event_name: eventName,
    });
    if (eventId === null) return json({ ok: false, error: 'session_not_found' }, 404);
    return json({ ok: true, stored: true });
  } catch (error) {
    console.error('mental_check_funnel_event_failed',
      error instanceof Error ? error.message.slice(0, 120) : 'unknown');
    return json({ ok: false, error: 'storage_unavailable' }, 503);
  }
};
