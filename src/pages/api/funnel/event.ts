import type { APIContext } from 'astro';

interface Env {
  DB: D1Database;
}

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
  const env = locals.runtime?.env as Env | undefined;

  let body: Record<string, unknown>;
  try {
    body = await request.json<Record<string, unknown>>();
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

  // Tracking must never block the diagnosis UX. Before the migration is applied,
  // accept the event but report that it was not stored.
  if (!env?.DB) {
    return new Response(JSON.stringify({ ok: true, stored: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO trinity_funnel_events
        (session_id, event_name, source, medium, campaign, path)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(sessionId, eventName, source, medium, campaign, path)
      .run();

    return new Response(JSON.stringify({ ok: true, stored: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // A missing migration should not make the public diagnosis fail.
    return new Response(JSON.stringify({ ok: true, stored: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
