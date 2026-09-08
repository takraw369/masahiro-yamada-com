import type { APIContext } from 'astro';
import { verifyDashboardSession } from '../dashboardAuth.ts';
import { resolveHarnessAction, resolveHarnessBaseUrl, resolveHarnessApiKey, validateHarnessBody } from './harness-policy.mjs';
import { isSameOriginRequest, jsonResponse } from './request.mjs';

async function readLimited(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) return '';
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('payload_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

// Port the narrow action contract from PR #6, retaining master's admin login.
// Production callers pass Cloudflare's direct env binding. The locals fallback is
// retained only for the Node-native regression harness, where Astro runtime locals
// are represented by a plain test object rather than the removed Astro v6 API.
export async function handleHarnessProxy(
  provider: 'x' | 'line',
  context: APIContext,
  runtimeEnv?: Record<string, string>,
) {
  const env = runtimeEnv ?? ((context.locals as any)?.runtime?.env as Record<string, string> | undefined);
  const url = new URL(context.request.url);
  if (!await verifyDashboardSession(context.cookies.get('ace-dash-auth')?.value, env?.DASHBOARD_PASSWORD || '', url.origin)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  if (!isSameOriginRequest(context.request)) return jsonResponse({ error: 'same_origin_required' }, 403);
  const action = resolveHarnessAction(provider, context.request.method, context.params.path);
  if (!action) return jsonResponse({ error: 'action_not_allowed' }, 404);
  if (url.search) return jsonResponse({ error: 'query_not_allowed' }, 400);
  const base = resolveHarnessBaseUrl(env, provider);
  const key = resolveHarnessApiKey(env, provider);
  if (!base || !key) return jsonResponse({ error: 'upstream_unavailable' }, 503);

  let body;
  if (action.body) {
    if (!context.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return jsonResponse({ error: 'json_required' }, 415);
    }
    try {
      body = JSON.parse(await readLimited(context.request.body, 10_000));
    } catch (error) {
      return jsonResponse({ error: 'invalid_body' }, error instanceof Error && error.message === 'payload_too_large' ? 413 : 400);
    }
    if (!validateHarnessBody(action.body, body)) return jsonResponse({ error: 'invalid_input' }, 400);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(new URL(`/api/${action.path}`, base), {
      method: action.method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: controller.signal,
    });
    if (!upstream.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      await upstream.body?.cancel();
      return jsonResponse({ error: 'invalid_upstream_response' }, 502);
    }
    const payload = await readLimited(upstream.body, 1_000_000);
    return jsonResponse(JSON.parse(payload), upstream.status);
  } catch {
    return jsonResponse({ error: 'upstream_request_failed' }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
