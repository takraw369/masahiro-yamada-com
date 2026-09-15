import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const { createDashboardSession } = await import('../src/lib/dashboardAuth.ts');
const { onRequest } = await import('../src/middleware.ts');

const origin = 'https://dashboard.example.test';
const secret = 'test-only-signing-secret';

test.beforeEach(() => {
  for (const name of Object.keys(env)) delete env[name];
  env.DASHBOARD_PASSWORD = secret;
});

function context(path, { method = 'GET', session, headers = {} } = {}) {
  const writes = [];
  return {
    writes,
    locals: { runtime: { env: { DASHBOARD_PASSWORD: 'obsolete-locals-secret' } } },
    request: new Request(`${origin}${path}`, { method, headers }),
    cookies: {
      get: () => session ? { value: session } : undefined,
      set: (...args) => writes.push(args),
    },
  };
}

test('FLOW MIND canonical, trailing-slash and nested paths share the private auth boundary', async () => {
  const expired = await createDashboardSession(secret, origin, Date.now() - 86400001);

  for (const path of ['/mind', '/mind/', '/mind/anything']) {
    for (const session of [undefined, expired]) {
      const response = await onRequest(context(path, { session }), () => {
        throw new Error('private handler must not execute');
      });
      assert.equal(response.status, 302, `${path} should redirect when unauthenticated`);
      assert.equal(response.headers.get('location'), '/dashboard/login');
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    }
  }
});

test('FLOW MIND trailing-slash path serves only with a valid origin-bound session and remains private', async () => {
  const session = await createDashboardSession(secret, origin);
  const ctx = context('/mind/', { session });
  const response = await onRequest(ctx, async () => new Response('private mind'));

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'private mind');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(ctx.writes.length, 1, 'valid private access should renew the rolling session');
});

test('FLOW MIND rejects cross-origin mutating requests before private content executes', async () => {
  const session = await createDashboardSession(secret, origin);
  const response = await onRequest(
    context('/mind/', {
      method: 'POST',
      session,
      headers: { Origin: 'https://evil.example.test' },
    }),
    () => { throw new Error('private handler must not execute'); },
  );

  assert.equal(response.status, 403);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

// Keep this file as the focused regression gate for private FLOW MIND routing.
