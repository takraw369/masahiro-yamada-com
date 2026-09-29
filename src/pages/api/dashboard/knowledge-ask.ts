import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv } from '../../../lib/siteStorage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 12_000;
const MAX_QUESTION_LENGTH = 2_000;
const ALLOWED_MODES = new Set(['ai', 'retrieve']);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

export const POST = async ({ request, locals }: APIContext) => {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return json({ ok: false, error: 'payload_too_large' }, 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  const record = body as Record<string, unknown>;
  const question = typeof record.question === 'string' ? record.question.trim() : '';
  const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
  const answerMode = typeof record.answerMode === 'string' ? record.answerMode.toLowerCase() : 'ai';

  if (question.length < 2 || question.length > MAX_QUESTION_LENGTH) {
    return json({ ok: false, error: 'invalid_question_length' }, 400);
  }
  if (projectId && !UUID_RE.test(projectId)) {
    return json({ ok: false, error: 'invalid_project_id' }, 400);
  }
  if (!ALLOWED_MODES.has(answerMode)) {
    return json({ ok: false, error: 'invalid_answer_mode' }, 400);
  }

  const env = getSiteStorageEnv(locals);
  if (!env.SUPABASE_URL) return json({ ok: false, error: 'supabase_not_configured' }, 503);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    let response: Response;
    try {
      response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/knowledge-ask-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          owner_key: ownerKey,
          question,
          project_id: projectId || undefined,
          answer_mode: answerMode,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      console.error('knowledge_ask_v2_upstream_failed', response.status, text.slice(0, 240));
      return json({ ok: false, error: 'knowledge_ask_unavailable' }, response.status >= 500 ? 503 : response.status);
    }

    return json(payload ?? { ok: false, error: 'knowledge_ask_empty_response' }, 200);
  } catch (error) {
    console.error('knowledge_ask_v2_proxy_failed', error);
    return json({ ok: false, error: 'knowledge_ask_unavailable' }, 503);
  }
};
