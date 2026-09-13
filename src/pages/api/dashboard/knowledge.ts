import type { APIContext } from 'astro';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  supabaseRpc,
} from '../../../lib/siteStorage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_ONLY_RE = /^https?:\/\/\S+$/i;
const MAX_CAPTURE_LENGTH = 12_000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
});

export const GET = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 240);
  const itemId = (url.searchParams.get('id') || '').trim();
  const relatedId = (url.searchParams.get('related') || '').trim();
  const view = (url.searchParams.get('view') || '').trim();
  const date = (url.searchParams.get('date') || '').trim();
  const rawLimit = Number(url.searchParams.get('limit') || '20');
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.round(rawLimit), 50)) : 20;

  try {
    const ownerKey = await getDashboardOwnerKey(env);

    if (view === 'today') {
      if (date && !DATE_RE.test(date)) return json({ ok: false, error: 'invalid_date' }, 400);
      const data = await supabaseRpc(env, 'masa_flow_mind_today_v1', {
        p_owner_key: ownerKey,
        p_date: date || null,
      });
      return json({ ok: true, mode: 'today', data });
    }

    if (itemId) {
      if (!UUID_RE.test(itemId)) return json({ ok: false, error: 'invalid_item_id' }, 400);
      const data = await supabaseRpc(env, 'masa_flow_mind_item_v1', {
        p_owner_key: ownerKey,
        p_knowledge_id: itemId,
      });
      return json({ ok: true, mode: 'item', data });
    }

    if (relatedId) {
      if (!UUID_RE.test(relatedId)) return json({ ok: false, error: 'invalid_related_id' }, 400);
      const data = await supabaseRpc(env, 'masa_flow_mind_related_v1', {
        p_owner_key: ownerKey,
        p_knowledge_id: relatedId,
        p_limit: limit,
      });
      return json({ ok: true, mode: 'related', data });
    }

    const data = await supabaseRpc(env, 'masa_flow_mind_search_v1', {
      p_owner_key: ownerKey,
      p_query: query || null,
      p_limit: limit,
    });
    return json({ ok: true, mode: 'search', data });
  } catch (error) {
    console.error('flow_mind_read_failed', error);
    return json({ ok: false, error: 'knowledge_read_unavailable' }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 32_000) return json({ ok: false, error: 'payload_too_large' }, 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  const rawText = (body as Record<string, unknown>).text;
  if (typeof rawText !== 'string') return json({ ok: false, error: 'text_required' }, 400);

  const text = rawText.trim();
  if (!text || text.length > MAX_CAPTURE_LENGTH) {
    return json({ ok: false, error: 'invalid_capture_length' }, 400);
  }

  if (URL_ONLY_RE.test(text)) {
    return json({ ok: false, error: 'source_intake_required' }, 409);
  }

  const env = getSiteStorageEnv(locals);
  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc(env, 'masa_flow_mind_capture_v1', {
      p_owner_key: ownerKey,
      p_text: text,
    });
    return json({ ok: true, mode: 'capture', data }, 201);
  } catch (error) {
    console.error('flow_mind_capture_failed', error);
    return json({ ok: false, error: 'knowledge_capture_unavailable' }, 503);
  }
};
