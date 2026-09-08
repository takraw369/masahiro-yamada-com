import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const { createDashboardSession, verifyDashboardSession, dashboardAuthToken, dashboardCookieOptions } = await import('../src/lib/dashboardAuth.ts');
const { dashboardBearerToken, getDashboardGoogleAdmin } = await import('../src/lib/dashboardGoogleAuth.ts');
const { POST: googleLogin } = await import('../src/pages/api/dashboard/google-login.ts');
const { POST: resetPassword } = await import('../src/pages/api/dashboard/reset-password.ts');
const { onRequest } = await import('../src/middleware.ts');
const { GET: logout } = await import('../src/pages/dashboard/logout.ts');

const origin = 'https://dashboard.example.test';
const secret = 'test-only-signing-and-owner-secret';
const accessToken = 'test-only-admin-token';
const password = 'test-only-new-password';
const fakeEnv = {
  DASHBOARD_PASSWORD: secret,
  SUPABASE_URL: 'https://supabase.example.test/',
  SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key',
};

test.beforeEach(() => {
  for (const name of Object.keys(env)) delete env[name];
  Object.assign(env, fakeEnv);
});

function context(path, { method = 'POST', token = accessToken, body, session, headers = {} } = {}) {
  const writes = [];
  return {
    writes,
    // Poisoned obsolete runtime bindings ensure production adapters use Workers env.
    locals: { runtime: { env: { DASHBOARD_PASSWORD: 'obsolete-locals-secret' } } },
    request: new Request(`${origin}${path}`, {
      method,
      headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body,
    }),
    cookies: {
      get: () => session ? { value: session } : undefined,
      set: (...args) => writes.push(args),
    },
  };
}

function fakeSupabase(t, { user = { id: 'test-admin' }, admin = true, reset = true, userStatus = 200, adminStatus = 200, resetStatus = 200 } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    assert.equal(new URL(url).origin, 'https://supabase.example.test');
    assert.equal(options.headers.apikey, fakeEnv.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    if (url.endsWith('/auth/v1/user')) return Response.json(user, { status: userStatus });
    assert.equal(options.method, 'POST');
    if (url.endsWith('/rpc/is_dashboard_admin')) {
      assert.equal(options.body, '{}');
      return Response.json(admin, { status: adminStatus });
    }
    assert.ok(url.endsWith('/rpc/reset_dashboard_login_password'), url);
    assert.deepEqual(JSON.parse(options.body), { p_new_password: password });
    return Response.json(reset, { status: resetStatus });
  });
  return calls;
}

async function assertSessionCookie(ctx) {
  assert.equal(ctx.writes.length, 1);
  const [name, token, options] = ctx.writes[0];
  assert.equal(name, 'ace-dash-auth');
  assert.deepEqual(options, dashboardCookieOptions);
  assert.equal(await verifyDashboardSession(token, secret, origin), true);
  assert.equal(await verifyDashboardSession(token, password, origin), false);
}

test('Bearer extraction accepts its scheme only; bootstrap without Bearer cannot reach Supabase', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected live request'); });
  for (const authorization of ['', 'Basic abc', 'Bearer', 'Bearer ']) {
    const ctx = context('/api/dashboard/google-login', { token: '', headers: { Authorization: authorization } });
    assert.equal(dashboardBearerToken(ctx.request), '');
    for (const handler of [googleLogin, resetPassword]) {
      assert.equal((await handler(ctx)).status, 401);
      assert.equal(ctx.writes.length, 0);
    }
  }
  assert.equal(dashboardBearerToken(new Request(origin, { headers: { Authorization: `bEaReR  ${accessToken} ` } })), accessToken);
  assert.equal(upstream.mock.callCount(), 0);
});

test('Google bootstrap validates the remote user AND registered admin role before issuing a v2 cookie', async (t) => {
  const calls = fakeSupabase(t);
  const ctx = context('/api/dashboard/google-login');
  const response = await googleLogin(ctx);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 2);
  await assertSessionCookie(ctx);
});

test('remote invalid users and non-admins fail closed without cookies or reset calls', async (t) => {
  for (const options of [{ userStatus: 401 }, { adminStatus: 403 }, { admin: false }]) {
    await t.test(JSON.stringify(options), async (t) => {
      const calls = fakeSupabase(t, options);
      for (const handler of [googleLogin, resetPassword]) {
        const ctx = context('/api/dashboard/reset-password', { body: JSON.stringify({ password }) });
        assert.equal((await handler(ctx)).status, 403);
        assert.equal(ctx.writes.length, 0);
      }
      assert.ok(calls.every(({ url }) => !url.endsWith('/rpc/reset_dashboard_login_password')));
    });
  }
});

test('an admin check authorizes only literal true, never a truthy schema mismatch', async (t) => {
  for (const admin of ['false', 1, {}, [true], null]) {
    await t.test(JSON.stringify(admin), async (t) => {
      fakeSupabase(t, { admin });
      assert.equal(await getDashboardGoogleAdmin(env, accessToken), null);
    });
  }
});

test('bootstrap dependency failures are sanitized and never set a cookie', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private upstream detail'); });
  for (const handler of [googleLogin, resetPassword]) {
    const ctx = context('/api/dashboard/reset-password', { body: JSON.stringify({ password }) });
    const response = await handler(ctx);
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /private upstream detail|test-only/);
    assert.equal(ctx.writes.length, 0);
  }
});

test('password recovery rejects malformed/non-object/non-string and out-of-range input without network calls', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected live request'); });
  for (const body of ['{', 'null', '[]', '"password"', '{}', '{"password":123456789012}', JSON.stringify({ password: 'short' }), JSON.stringify({ password: 'x'.repeat(129) })]) {
    const ctx = context('/api/dashboard/reset-password', { body });
    assert.equal((await resetPassword(ctx)).status, 400, body);
    assert.equal(ctx.writes.length, 0);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test('recovery preflights signing configuration before any password mutation', async (t) => {
  const calls = fakeSupabase(t);
  env.DASHBOARD_PASSWORD = '';
  const ctx = context('/api/dashboard/reset-password', { body: JSON.stringify({ password }) });
  assert.equal((await resetPassword(ctx)).status, 500);
  assert.ok(calls.every(({ url }) => !url.endsWith('/rpc/reset_dashboard_login_password')));
  assert.equal(ctx.writes.length, 0);
});

test('recovery updates credentials only after admin verification and signs with unchanged owner secret', async (t) => {
  const calls = fakeSupabase(t);
  const ctx = context('/api/dashboard/reset-password', { body: JSON.stringify({ password }) });
  assert.deepEqual(await (await resetPassword(ctx)).json(), { ok: true });
  assert.equal(calls.length, 3);
  assert.ok(calls[2].url.endsWith('/rpc/reset_dashboard_login_password'));
  assert.equal(env.DASHBOARD_PASSWORD, secret);
  await assertSessionCookie(ctx);
});

test('recovery does not issue a session for failed or non-boolean reset results', async (t) => {
  for (const options of [{ reset: false }, { reset: 'false' }, { reset: {} }, { resetStatus: 403 }]) {
    await t.test(JSON.stringify(options), async (t) => {
      fakeSupabase(t, options);
      const ctx = context('/api/dashboard/reset-password', { body: JSON.stringify({ password }) });
      assert.equal((await resetPassword(ctx)).status, 500);
      assert.equal(ctx.writes.length, 0);
    });
  }
});

test('middleware exempts only exact auth bootstrap paths and still requires same-origin mutations', async () => {
  for (const path of ['/api/dashboard/google-login', '/api/dashboard/reset-password']) {
    const ctx = context(path, { token: '' });
    const response = await onRequest(ctx, async () => new Response('bootstrap'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    for (const headers of [{ Origin: 'https://evil.example.test' }, { Origin: '' }]) {
      const rejected = await onRequest(context(path, { headers }), () => { throw new Error('must not execute handler'); });
      assert.equal(rejected.status, 403);
    }
    assert.equal((await onRequest(context(`${path}/extra`), () => { throw new Error('must not execute handler'); })).status, 401);
  }
});

test('middleware rejects old/expired/missing sessions and renews a valid origin-bound cookie', async () => {
  const expired = await createDashboardSession(secret, origin, Date.now() - 86400001);
  const legacy = await dashboardAuthToken(secret);
  const foreign = await createDashboardSession(secret, 'https://other.example.test');
  for (const session of [undefined, expired, legacy, foreign]) {
    for (const path of ['/dashboard', '/api/dashboard/state', '/api/x-harness/x-accounts', '/api/line-harness/line-accounts']) {
      const response = await onRequest(context(path, { session, method: 'GET' }), () => { throw new Error('must not execute handler'); });
      assert.equal(response.status, path === '/dashboard' ? 302 : 401);
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
  }
  const session = await createDashboardSession(secret, origin);
  const ctx = context('/dashboard', { session, method: 'GET' });
  assert.equal((await onRequest(ctx, async () => new Response('private content'))).status, 200);
  await assertSessionCookie(ctx);
  assert.notEqual(ctx.writes[0][1], session);
});

test('canonical redirects preserve path/query and logout expires the browser cookie', async () => {
  const ctx = context('/dashboard/login', { method: 'GET' });
  ctx.request = new Request('https://www.masahiro-yamada.com/dashboard/login?from=calendar');
  const redirect = await onRequest(ctx, () => { throw new Error('must redirect first'); });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), 'https://masahiroyamada.com/dashboard/login?from=calendar');
  const response = await onRequest(context('/dashboard/logout', { method: 'GET' }), logout);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/dashboard/login');
  assert.match(response.headers.get('set-cookie'), /^ace-dash-auth=;.*Max-Age=0; HttpOnly; Secure; SameSite=Lax/);
  assert.match(response.headers.get('cache-control'), /no-store/);
});
