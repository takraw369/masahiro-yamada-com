import assert from 'node:assert/strict';
import test from 'node:test';

import {
  harnessProxyEnabled,
  harnessSideEffectsEnabled,
  resolveHarnessAction,
  resolveHarnessApiKey,
  resolveHarnessBaseUrl,
  validateHarnessBody,
} from '../src/lib/security/harness-policy.mjs';
import { handleHarnessProxy } from '../src/lib/security/harness-proxy.mjs';

const rateLimiter = Object.freeze({
  async limit() {
    return { success: true };
  },
});

function context({
  provider = 'x',
  method = 'GET',
  path = 'x-accounts',
  body,
  session,
  env = {},
  origin = 'https://example.test',
} = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers.set('Origin', origin);
  return {
    provider,
    params: { path },
    request: new Request(`https://example.test/api/${provider}-harness/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    locals: {
      securityEnv: {
          APP_ENV: 'test',
          HARNESS_PROXY_ENABLED: 'true',
          HARNESS_SIDE_EFFECTS_ENABLED: 'false',
          X_HARNESS_URL: 'https://x-upstream.example.test',
          LINE_HARNESS_URL: 'https://line-upstream.example.test',
          X_HARNESS_API_KEY: 'fake-x-key',
          LINE_HARNESS_API_KEY: 'fake-line-key',
          HARNESS_READ_RATE_LIMITER: rateLimiter,
          HARNESS_WRITE_RATE_LIMITER: rateLimiter,
          ...env,
      },
      securitySession: session,
    },
  };
}

const reader = Object.freeze({ sub: 'masa', permissions: ['dashboard:read', 'harness:read'] });
const operator = Object.freeze({
  sub: 'masa',
  permissions: ['dashboard:read', 'dashboard:write', 'harness:read', 'harness:write'],
});

test('only enumerated provider, method, and path combinations are allowed', () => {
  assert.equal(resolveHarnessAction('x', 'GET', 'x-accounts').permission, 'harness:read');
  assert.equal(resolveHarnessAction('x', 'POST', 'posts').permission, 'harness:write');
  assert.equal(resolveHarnessAction('line', 'POST', 'broadcasts').sideEffect, true);
  assert.equal(resolveHarnessAction('line', 'GET', 'friends'), null);
  assert.equal(resolveHarnessAction('x', 'DELETE', 'posts'), null);
  assert.equal(resolveHarnessAction('x', 'GET', '../admin'), null);
  assert.equal(resolveHarnessAction('unknown', 'GET', 'x-accounts'), null);
});

test('request schemas reject extra fields, invalid IDs, oversized text, and unsafe schedules', () => {
  const nowMs = Date.UTC(2026, 7, 12, 0, 0, 0);
  assert.equal(validateHarnessBody('xPost', {
    xAccountId: 'account_1',
    text: 'safe test post',
  }), true);
  assert.equal(validateHarnessBody('xPost', {
    xAccountId: 'account_1',
    text: 'safe test post',
    unexpected: true,
  }), false);
  assert.equal(validateHarnessBody('xPost', {
    xAccountId: '../admin',
    text: 'safe test post',
  }), false);
  assert.equal(validateHarnessBody('xPost', {
    xAccountId: 'account_1',
    text: 'x'.repeat(281),
  }), false);
  assert.equal(validateHarnessBody('xSchedule', {
    xAccountId: 'account_1',
    text: 'safe test post',
    scheduledAt: '2026-08-13T00:00:00Z',
  }, { nowMs }), true);
  assert.equal(validateHarnessBody('xSchedule', {
    xAccountId: 'account_1',
    text: 'safe test post',
    scheduledAt: '2026-08-11T00:00:00Z',
  }, { nowMs }), false);
});

test('proxy switches default off and upstream settings reject unsafe values', () => {
  assert.equal(harnessProxyEnabled({}), false);
  assert.equal(harnessSideEffectsEnabled({}), false);
  assert.equal(harnessProxyEnabled({ HARNESS_PROXY_ENABLED: 'true' }), true);
  assert.equal(resolveHarnessBaseUrl({ X_HARNESS_URL: 'http://upstream.invalid' }, 'x'), null);
  assert.equal(resolveHarnessBaseUrl({ X_HARNESS_URL: 'https://user@upstream.invalid' }, 'x'), null);
  assert.equal(resolveHarnessBaseUrl({ X_HARNESS_URL: 'https://upstream.test?x=1' }, 'x'), null);
  assert.equal(resolveHarnessBaseUrl({ X_HARNESS_URL: 'https://upstream.test' }, 'x'), 'https://upstream.test');
  assert.equal(resolveHarnessApiKey({ X_HARNESS_API_KEY: '' }, 'x'), null);
});

test('disabled, unauthenticated, and unauthorized requests fail before upstream fetch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('must not fetch');
  };
  try {
    const disabled = context({ env: { HARNESS_PROXY_ENABLED: 'false' }, session: reader });
    assert.equal((await handleHarnessProxy('x', disabled)).status, 503);

    const unauthenticated = context();
    assert.equal((await handleHarnessProxy('x', unauthenticated)).status, 403);

    const unauthorizedWrite = context({
      method: 'POST',
      path: 'posts',
      body: { xAccountId: 'account_1', text: 'safe test post' },
      session: reader,
    });
    assert.equal((await handleHarnessProxy('x', unauthorizedWrite)).status, 403);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('side effects require both operator permission and an explicit production switch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('must not fetch');
  };
  try {
    const request = context({
      method: 'POST',
      path: 'posts',
      body: { xAccountId: 'account_1', text: 'safe test post' },
      session: operator,
    });
    assert.equal((await handleHarnessProxy('x', request)).status, 503);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid methods and bodies are rejected without forwarding', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('must not fetch');
  };
  try {
    const method = context({ method: 'DELETE', path: 'posts', session: operator });
    assert.equal((await handleHarnessProxy('x', method)).status, 404);

    const invalidBody = context({
      method: 'POST',
      path: 'posts',
      body: { xAccountId: '../admin', text: 'safe test post' },
      session: operator,
      env: { HARNESS_SIDE_EFFECTS_ENABLED: 'true' },
    });
    assert.equal((await handleHarnessProxy('x', invalidBody)).status, 400);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('authorized reads forward only to the allowlisted upstream path and return no CORS grant', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl;
  let capturedRequest;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedRequest = init;
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const response = await handleHarnessProxy('x', context({ session: reader }));
    assert.equal(response.status, 200);
    assert.equal(capturedUrl, 'https://x-upstream.example.test/api/x-accounts');
    assert.equal(capturedRequest.method, 'GET');
    assert.match(capturedRequest.headers.Authorization, /^Bearer /u);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('production proxy fails closed when the rate limiter is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('must not fetch');
  };
  try {
    const request = context({
      session: reader,
      env: {
        APP_ENV: 'production',
        HARNESS_READ_RATE_LIMITER: undefined,
      },
    });
    assert.equal((await handleHarnessProxy('x', request)).status, 503);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
