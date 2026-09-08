import type { APIContext } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const ALLOWED_EVENTS = new Set([
  'trinity_view',
  'trinity_start',
  'trinity_complete',
  'trinity_line_click',
  'trinity_trial_click',
  'trinity_share_x',
  'trinity_copy_link',
]);

const clean = (value: unknown, max = 120) =>
  typeof value === 'string' ? value.trim().slice(0, max) : null;

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  let body: Record<string, unknown>;
  try {
    body = await request.json<Record<string, unknown>>();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventName = clean(body.event, 64);
  const sessionId = clean(body.sessionId, 80);
  const source = clean(body.source, 80);
  const medium = clean(body.medium, 80);
  const campaign = clean(body.campaign, 120);
  const path = clean(body.path, 200) || '/trinity';

  if (!eventName || !ALLOWED_EVENTS.has(eventName) || !sessionId) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_event' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const id = await supabaseRpc<number>(env, 'trinity_funnel_event_add', {
      p_session_id: sessionId,
      p_event_name: eventName,
      p_source: source,
      p_medium: medium,
      p_campaign: campaign,
      p_path: path,
    });

    return new Response(JSON.stringify({ ok: true, stored: true, id, storage: 'supabase' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Analytics loss must not break the diagnosis or create a divergent D1 write.
    return new Response(JSON.stringify({ ok: true, stored: false, storage: 'unavailable' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
