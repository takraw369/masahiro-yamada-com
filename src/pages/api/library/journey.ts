import type { APIRoute } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

export const prerender = false;

const ALLOWED_EVENTS = new Set([
  'ks_shelf_view',
  'ks_asset_click',
  'ks_item_view',
  'ks_engaged_30s',
  'ks_engaged_120s',
  'ks_scroll_50',
  'ks_scroll_90',
  'ks_cta_click',
  'ks_lead_submit',
  'ks_video_start',
  'ks_quest_start',
  'ks_quest_clear',
  'ks_checkout_start',
  'ks_purchase',
]);

const RESERVED_META_KEYS = new Set([
  'visitor_id', 'session_id', 'asset_slug', 'path', 'source', 'medium', 'campaign',
  'referrer', 'stage', 'origin', 'tracking', 'contact_id',
]);

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : null;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return json({ ok: false, error: 'invalid_content_type' }, 415);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const eventName = clean(body.event, 64);
  const visitorId = clean(body.visitorId, 80);
  const sessionId = clean(body.sessionId, 80);
  const assetSlug = clean(body.assetSlug, 100);
  const path = clean(body.path, 300) || '/library';
  const source = clean(body.source, 80);
  const medium = clean(body.medium, 80);
  const campaign = clean(body.campaign, 120);
  const referrer = clean(body.referrer, 500);

  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    return json({ ok: false, error: 'invalid_event' }, 400);
  }
  if (!visitorId || !/^[A-Za-z0-9_-]{8,80}$/.test(visitorId)) {
    return json({ ok: false, error: 'invalid_visitor_id' }, 400);
  }
  if (!sessionId || !/^[A-Za-z0-9_-]{8,80}$/.test(sessionId)) {
    return json({ ok: false, error: 'invalid_session_id' }, 400);
  }
  if (assetSlug && !/^[a-z0-9-]{2,100}$/.test(assetSlug)) {
    return json({ ok: false, error: 'invalid_asset_slug' }, 400);
  }

  let meta: Record<string, string | number | boolean | null> = {};
  if (body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
    for (const [key, value] of Object.entries(body.meta as Record<string, unknown>).slice(0, 8)) {
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(key) || RESERVED_META_KEYS.has(key)) continue;
      if (typeof value === 'string') meta[key] = value.slice(0, 200);
      else if (typeof value === 'number' && Number.isFinite(value)) meta[key] = value;
      else if (typeof value === 'boolean' || value === null) meta[key] = value;
    }
  }
  if (JSON.stringify(meta).length > 1800) meta = {};

  try {
    const env = getSiteStorageEnv(locals);
    const id = await supabaseRpc<number>(env, 'knowledge_journey_event_add_v1', {
      p_visitor_id: visitorId,
      p_session_id: sessionId,
      p_event_name: eventName,
      p_asset_slug: assetSlug,
      p_path: path,
      p_source: source,
      p_medium: medium,
      p_campaign: campaign,
      p_referrer: referrer,
      p_meta: meta,
    });
    return json({ ok: true, stored: true, id });
  } catch (error) {
    console.error('knowledge_journey_event_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: true, stored: false });
  }
};
