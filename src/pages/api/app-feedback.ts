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

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const appKeyPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export const POST: APIRoute = async ({ request, locals, url }) => {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'invalid_content_type' }, 415);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const clientEventId = clean(payload.clientEventId, 120);
  const appKey = clean(payload.appKey, 80).toLowerCase();
  const contextKey = clean(payload.contextKey, 200);
  const message = clean(payload.message, 4000);
  const actorRef = clean(payload.actorRef, 320);
  const sourceRef = clean(payload.sourceRef, 500) || url.pathname;
  const website = clean(payload.website, 200);
  const consent = payload.consent === true;
  const meta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
    ? payload.meta as Record<string, unknown>
    : {};

  if (website) return json({ ok: true, data: { accepted: true } }, 201);
  if (clientEventId.length < 8 || !appKeyPattern.test(appKey) || !message) {
    return json({ ok: false, error: 'invalid_feedback' }, 400);
  }
  if (actorRef && !consent) {
    return json({ ok: false, error: 'consent_required' }, 400);
  }
  if (JSON.stringify(meta).length > 12000) {
    return json({ ok: false, error: 'metadata_too_large' }, 400);
  }

  try {
    const env = getSiteStorageEnv(locals);
    const data = await supabaseRpc<Record<string, unknown>>(env, 'submit_app_feedback_v1', {
      p_client_event_id: clientEventId,
      p_app_key: appKey,
      p_context_key: contextKey || null,
      p_message: message,
      p_actor_ref: actorRef || null,
      p_source_ref: sourceRef || null,
      p_meta: meta,
    });
    return json({ ok: true, data }, 201);
  } catch (error) {
    console.error('app_feedback_submit_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, error: 'submit_failed' }, 500);
  }
};
