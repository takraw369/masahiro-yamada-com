import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDashboardSession, verifyDashboardSession, dashboardAuthToken, dashboardOwnerKey, DASHBOARD_IDLE_TIMEOUT_SECONDS } from '../src/lib/dashboardAuth.ts';
import { handleHarnessProxy } from '../src/lib/security/harness-proxy.ts';
import { resolveHarnessAction, validateHarnessBody } from '../src/lib/security/harness-policy.mjs';
import { isSameOriginRequest } from '../src/lib/security/request.mjs';

const secret = 'test-only-not-a-production-secret';
const origin = 'https://dashboard.example.test';
const now = Date.UTC(2026, 8, 7);

test('sessions expire on the server; rolling renewal expires independently', async () => {
  const token = await createDashboardSession(secret, origin, now);
  assert.equal(await verifyDashboardSession(token, secret, origin, now), true);
  assert.equal(await verifyDashboardSession(token, secret, origin, now + 86400000), false);
  const renewed = await createDashboardSession(secret, origin, now + 3600000);
  assert.equal(await verifyDashboardSession(renewed, secret, origin, now + 86400000), true);
  assert.equal(DASHBOARD_IDLE_TIMEOUT_SECONDS, 86400);
});

test('sessions reject tampering, missing config, old fixed tokens and other origins', async () => {
  const token = await createDashboardSession(secret, origin, now);
  for (const value of [undefined, '', '1', await dashboardAuthToken(secret), token + 'x', token.replace('v2.', 'v3.')]) {
    assert.equal(await verifyDashboardSession(value, secret, origin, now), false);
  }
  assert.equal(await verifyDashboardSession(token, '', origin, now), false);
  assert.equal(await verifyDashboardSession(token, secret + 'changed', origin, now), false);
  assert.equal(await verifyDashboardSession(token, secret, 'https://preview.example.test', now), false);
  assert.notEqual(token, await createDashboardSession(secret, origin, now));
});

test('storage ownership remains byte-for-byte compatible with master', async () => {
  const { createHmac } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update('masahiro-yamada.com:dashboard-storage-owner:v1').digest('hex');
  assert.equal(await dashboardOwnerKey(secret), expected);
});

function context({ method = 'GET', path = 'x-accounts', token, body, headers = {}, env = {}, query = '' } = {}) {
  return {
    params: { path }, cookies: { get: () => token ? { value: token } : undefined },
    locals: { runtime: { env: { DASHBOARD_PASSWORD: secret, X_HARNESS_URL: 'https://upstream.example.test', X_HARNESS_API_KEY: 'test-only-key', ...env } } },
    request: new Request(`${origin}/api/x-harness/${path}${query}`, {
      method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body,
    }),
  };
}

test('anonymous proxy traffic never reaches upstream', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected upstream'); });
  for (const provider of ['x', 'line']) {
    const response = await handleHarnessProxy(provider, context());
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('proxy rejects unknown actions, query, CSRF, invalid body and missing credentials', async (t) => {
  const token = await createDashboardSession(secret, origin);
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected upstream'); });
  for (const [options, status] of [
    [{ path: 'admin' }, 404], [{ method: 'DELETE', path: 'posts' }, 404],
    [{ query: '?target=elsewhere' }, 400],
    [{ method: 'POST', path: 'posts', headers: { Origin: 'https://evil.example.test' } }, 403],
    [{ method: 'POST', path: 'posts', body: 'null' }, 400],
    [{ method: 'POST', path: 'posts', body: '{' }, 400],
    [{ method: 'POST', path: 'posts', body: 'x'.repeat(10001) }, 413],
    [{ env: { X_HARNESS_API_KEY: '' } }, 503],
    [{ env: { X_HARNESS_URL: 'http://upstream.example.test' } }, 503],
  ]) assert.equal((await handleHarnessProxy('x', context({ token, ...options }))).status, status);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('allowed proxy request preserves contract and refuses redirect credential forwarding', async (t) => {
  const token = await createDashboardSession(secret, origin);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'https://upstream.example.test/api/posts');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    assert.deepEqual(JSON.parse(options.body), { xAccountId: 'account_1', text: 'test' });
    return Response.json({ ok: true });
  });
  const response = await handleHarnessProxy('x', context({ token, method: 'POST', path: 'posts', body: JSON.stringify({ xAccountId: 'account_1', text: 'test' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('proxy sanitizes upstream errors and oversized responses', async (t) => {
  const token = await createDashboardSession(secret, origin);
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('private upstream detail'); });
  assert.equal((await handleHarnessProxy('x', context({ token }))).status, 502);
  mock.mock.mockImplementation(async () => new Response('x'.repeat(1000001), { headers: { 'Content-Type': 'application/json' } }));
  assert.equal((await handleHarnessProxy('x', context({ token }))).status, 502);
});

test('ported PR #6 schemas reject unsafe paths and payload widening', () => {
  for (const path of ['../admin', 'posts/%2e%2e/admin', '__proto__']) assert.equal(resolveHarnessAction('x', 'GET', path), null);
  assert.equal(validateHarnessBody('xPost', { xAccountId: 'a', text: 'ok', admin: true }), false);
  assert.equal(validateHarnessBody('xSchedule', { xAccountId: 'a', text: 'ok', scheduledAt: '2020-01-01' }), false);
  assert.equal(validateHarnessBody('lineBroadcast', { lineAccountId: 'a', title: 'test', messageType: 'text', messageContent: 'test', targetType: 'all' }), true);
});

test('mutation Origin is mandatory and exact; read requests remain usable', () => {
  assert.equal(isSameOriginRequest(new Request(origin, { method: 'POST' })), false);
  assert.equal(isSameOriginRequest(new Request(origin, { method: 'POST', headers: { Origin: origin } })), true);
  assert.equal(isSameOriginRequest(new Request(origin)), true);
});

test('post-cutover mutations never create D1-only state', async () => {
  const [state, feedback, funnel] = await Promise.all([
    readFile(new URL('../src/pages/api/dashboard/state.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/api/dashboard/feedback.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/api/funnel/event.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(state, /primary_storage_unavailable/);
  assert.doesNotMatch(state, /INSERT OR REPLACE INTO ace_checked/);
  assert.doesNotMatch(state, /DELETE FROM ace_checked/);

  assert.match(feedback, /primary_storage_unavailable/);
  assert.doesNotMatch(feedback, /INSERT INTO dashboard_feedback/);

  assert.match(funnel, /stored: false/);
  assert.doesNotMatch(funnel, /INSERT INTO trinity_funnel_events/);
});
