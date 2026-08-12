import { hasPermission } from './auth.mjs';
import {
  harnessProxyEnabled,
  harnessSideEffectsEnabled,
  resolveHarnessAction,
  resolveHarnessApiKey,
  resolveHarnessBaseUrl,
  validateHarnessBody,
} from './harness-policy.mjs';
import { jsonResponse } from './request.mjs';
import { consumeRateLimit } from './rate-limit.mjs';

const MAX_REQUEST_BYTES = 10_000;
const MAX_UPSTREAM_RESPONSE_BYTES = 1_000_000;

export async function handleHarnessProxy(provider, context) {
  const env = context.locals.securityEnv;
  if (!harnessProxyEnabled(env)) {
    return jsonResponse({ error: 'proxy_disabled' }, 503);
  }

  const action = resolveHarnessAction(provider, context.request.method, context.params.path);
  if (!action) return jsonResponse({ error: 'action_not_allowed' }, 404);

  const session = context.locals.securitySession;
  if (!session || !hasPermission(session, action.permission)) {
    return jsonResponse({ error: 'authorization_required' }, 403);
  }
  if (action.sideEffect && !harnessSideEffectsEnabled(env)) {
    return jsonResponse({ error: 'side_effects_disabled' }, 503);
  }

  const requestUrl = new URL(context.request.url);
  if (requestUrl.search) return jsonResponse({ error: 'query_not_allowed' }, 400);

  const rateLimitBinding = action.sideEffect
    ? env?.HARNESS_WRITE_RATE_LIMITER
    : env?.HARNESS_READ_RATE_LIMITER;
  const rateLimit = await consumeRateLimit(
    rateLimitBinding,
    `harness:${session.sub}:${provider}:${action.path}`,
    {
      limit: action.sideEffect ? 3 : 30,
      windowMs: 60_000,
      retryAfterSeconds: 60,
      allowLocalFallback: env?.APP_ENV === 'development' || env?.APP_ENV === 'test',
    },
  );
  if (rateLimit.unavailable) {
    return jsonResponse({ error: 'rate_limit_unavailable' }, 503);
  }
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: 'rate_limited' },
      429,
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  let body;
  if (action.body) {
    const contentType = context.request.headers.get('Content-Type') ?? '';
    const declaredLength = Number(context.request.headers.get('Content-Length') ?? 0);
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return jsonResponse({ error: 'json_required' }, 415);
    }
    if (declaredLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'request_too_large' }, 413);
    }
    try {
      const rawBody = await context.request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
        return jsonResponse({ error: 'request_too_large' }, 413);
      }
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }
    if (!validateHarnessBody(action.body, body)) {
      return jsonResponse({ error: 'invalid_input' }, 400);
    }
  }

  const baseUrl = resolveHarnessBaseUrl(env, provider);
  const apiKey = resolveHarnessApiKey(env, provider);
  if (!baseUrl || !apiKey) return jsonResponse({ error: 'upstream_unavailable' }, 503);

  const target = new URL(`/api/${action.path}`, baseUrl);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);
  try {
    const upstream = await fetch(target, {
      method: action.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: abortController.signal,
    });
    const contentType = upstream.headers.get('Content-Type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return jsonResponse({ error: 'invalid_upstream_response' }, 502);
    }
    const declaredLength = Number(upstream.headers.get('Content-Length') ?? 0);
    if (declaredLength > MAX_UPSTREAM_RESPONSE_BYTES) {
      return jsonResponse({ error: 'upstream_response_too_large' }, 502);
    }
    const payload = await upstream.arrayBuffer();
    if (payload.byteLength > MAX_UPSTREAM_RESPONSE_BYTES) {
      return jsonResponse({ error: 'upstream_response_too_large' }, 502);
    }
    return new Response(payload, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch {
    return jsonResponse({ error: 'upstream_request_failed' }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
