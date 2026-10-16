import assert from 'node:assert/strict';
import test from 'node:test';
import { createDashboardSession } from '../src/lib/dashboardAuth.ts';
import { xOAuthReadFailure, xOAuthReadNotice } from '../src/lib/xOAuthReadFeedback.ts';
import { handleXOAuthStart, handleXOAuthCallback, handleXOAuthStatus, handleXOAuthConnectionAction, openOAuthCookie, sealOAuthCookie, X_OAUTH_CALLBACK_PATH, X_OAUTH_PENDING_COOKIE, X_OAUTH_RECEIPT_COOKIE } from '../src/lib/security/x-oauth-read.ts';

const secret = 'fixture-only-password';
const cookieKey = 'fixture-only-separate-cookie-key';
const origin = 'https://dashboard.example.test';
function cookies() {
  const values = new Map(); const operations = [];
  return { values, operations, get: name => values.has(name) ? { value: values.get(name) } : undefined,
    set: (name, value, options) => { values.set(name, value); operations.push({ op: 'set', name, options }); },
    delete: (name, options) => { values.delete(name); operations.push({ op: 'delete', name, options }); } };
}
const context = (jar, method, path, data, requestOrigin = origin) => ({ cookies: jar,
  request: new Request(origin + path, { method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) }) });
function service() {
  const calls = [];
  const runner = {
    xOAuthReadConfig: async () => ({ enabled: true, configured: true, redirectUri: origin + X_OAUTH_CALLBACK_PATH, enabledTargets: ['MASAHIRO_501', 'aima_no_te', 'kodomo_athlete', 'sunlovesflow'], PRIVATE_TOKEN: 'PRIVATE' }),
    xOAuthBeginRead: async input => {
      calls.push({ kind: 'begin' });
      const url = new URL('https://x.com/i/oauth2/authorize');
      url.search = new URLSearchParams({ response_type: 'code', client_id: 'fixture', redirect_uri: input.redirectUri, scope: 'users.read tweet.read', state: input.state, code_challenge: input.challenge, code_challenge_method: 'S256' }).toString();
      return { success: true, authorizeUrl: url.href };
    },
    xOAuthCompleteRead: async input => {
      calls.push({ kind: 'complete', target: input.target });
      return { success: true, provider: 'x-official', mode: 'read_only', postingEnabled: false, schedulingEnabled: false,
        data: [{ id: '123456789012345678', username: input.target, displayName: 'fixture', isActive: true }],
        target: input.target, proof: 'oauth_callback', tokenStored: false, scopes: ['users.read', 'tweet.read'], verifiedAt: new Date().toISOString(), PRIVATE_TOKEN: 'PRIVATE' };
    },
  };
  return { runner, calls };
}
async function setup() {
  const jar = cookies(); jar.values.set('ace-dash-auth', await createDashboardSession(secret, origin));
  const { runner, calls } = service();
  return { jar, runner, calls, env: { DASHBOARD_PASSWORD: secret, DASHBOARD_SESSION_SECRET: cookieKey, X_NATIVE_READ_ENABLED: 'true', FLOW_RUNNER: runner } };
}
async function start(s, target = 'aima_no_te') {
  const response = await handleXOAuthStart(context(s.jar, 'POST', '/api/dashboard/x-oauth/start', { target }), s.env);
  assert.equal(response.status, 200);
  return new URL((await response.json()).authorizeUrl);
}
const callback = (s, state, extra = '&code=PRIVATE_CODE') => handleXOAuthCallback(context(s.jar, 'GET', X_OAUTH_CALLBACK_PATH + '?state=' + state + extra), s.env);

test('OAuth cookies are encrypted, origin/purpose/owner bound, expire, and reject tampering', async () => {
  const data = { verifier: 'PRIVATE_VERIFIER', expires: Date.now() + 590000 };
  const sealed = await sealOAuthCookie(secret, origin, 'pending', data);
  assert.ok(!sealed.includes('PRIVATE'));
  assert.deepEqual(await openOAuthCookie(secret, origin, 'pending', sealed), data);
  for (const args of [[secret, origin + '.other', 'pending', sealed], [secret + 'changed', origin, 'pending', sealed], [secret, origin, 'receipt', sealed], [secret, origin, 'pending', sealed.slice(0, -4) + 'AAAA']]) assert.equal(await openOAuthCookie(...args), null);
  const expired = await sealOAuthCookie(secret, origin, 'pending', { expires: Date.now() - 1 });
  assert.equal(await openOAuthCookie(secret, origin, 'pending', expired), null);
});

test('method/session/CSRF/target/config guards block begin', async () => {
  const s = await setup();
  assert.equal((await handleXOAuthStart(context(s.jar, 'GET', '/api/dashboard/x-oauth/start'), s.env)).status, 405);
  assert.equal((await handleXOAuthStart(context(cookies(), 'POST', '/api/dashboard/x-oauth/start', { target: 'aima_no_te' }), s.env)).status, 401);
  assert.equal((await handleXOAuthStart(context(s.jar, 'POST', '/api/dashboard/x-oauth/start', { target: 'aima_no_te' }, 'https://attacker.test'), s.env)).status, 403);
  for (const data of [{ target: 'all_are_ace' }, { target: 'aima_no_te', redirectUri: 'https://attacker.test' }, { target: 'aima_no_te', scope: 'tweet.write' }]) {
    assert.equal((await handleXOAuthStart(context(s.jar, 'POST', '/api/dashboard/x-oauth/start', data), s.env)).status, 400);
  }
  assert.equal((await handleXOAuthStart(context(s.jar, 'POST', '/api/dashboard/x-oauth/start', { target: 'aima_no_te' }), { ...s.env, X_NATIVE_READ_ENABLED: undefined })).status, 503);
  assert.equal(s.calls.length, 0);
});

test('S256 start exposes only authorization URL; verifier stays in protected short-lived cookie', async () => {
  const s = await setup(); const url = await start(s);
  const pending = await openOAuthCookie(cookieKey, origin, 'pending', s.jar.values.get(X_OAUTH_PENDING_COOKIE));
  assert.equal(pending.target, 'aima_no_te');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier));
  const challenge = Buffer.from(digest).toString('base64url');
  assert.equal(url.searchParams.get('code_challenge'), challenge);
  assert.equal(url.searchParams.get('scope'), 'users.read tweet.read');
  assert.ok(!url.href.includes(pending.verifier));
  const cookie = s.jar.operations.find(item => item.op === 'set' && item.name === X_OAUTH_PENDING_COOKIE);
  assert.deepEqual(cookie.options, { path: '/api/dashboard/x-oauth', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
});

test('provider callback verifies account and redirects cleanly with sanitized historical receipt', async () => {
  const s = await setup(); const url = await start(s);
  // Dashboard middleware renews its session cookie between requests.
  s.jar.values.set('ace-dash-auth', await createDashboardSession(secret, origin));
  const response = await callback(s, url.searchParams.get('state'));
  assert.equal(response.status, 303); assert.match(response.headers.get('location'), /x_oauth=verified/);
  assert.doesNotMatch(response.headers.get('location'), /PRIVATE|code=|state=/);
  assert.equal(s.jar.values.has(X_OAUTH_PENDING_COOKIE), false);
  const status = await handleXOAuthStatus(context(s.jar, 'GET', '/api/dashboard/x-oauth/status'), s.env);
  assert.match(status.headers.get('cache-control'), /no-store/);
  const raw = await status.json();
  assert.equal(raw.receipt.data[0].id, '123456789012345678'); assert.equal(raw.receipt.tokenStored, false);
  assert.ok(!JSON.stringify(raw).includes('PRIVATE'));
  assert.deepEqual(s.calls, [{ kind: 'begin' }, { kind: 'complete', target: 'aima_no_te' }]);
  const replay = await callback(s, url.searchParams.get('state'));
  assert.match(replay.headers.get('location'), /x_oauth=expired/);
  assert.equal(s.calls.length, 2);
});

test('wrong/duplicate state, absent pending cookie and denial do not exchange code', async () => {
  for (const mode of ['wrong', 'duplicate', 'missing', 'denied']) {
    const s = await setup(); const url = await start(s); const state = url.searchParams.get('state');
    if (mode === 'missing') s.jar.values.delete(X_OAUTH_PENDING_COOKIE);
    await callback(s, mode === 'wrong' ? 'wrong' : state, mode === 'duplicate' ? '&state='+state+'&code=PRIVATE' : mode === 'denied' ? '&error=PRIVATE_PROVIDER_ERROR' : '&code=PRIVATE');
    assert.equal(s.calls.length, 1); assert.equal(s.jar.values.has(X_OAUTH_RECEIPT_COOKIE), false);
  }
});

test('unknown callback identity or write-capable proof never records success', async () => {
  for (const mode of ['wrong_handle', 'writes', 'stored_token', 'wrong_scope', 'mismatch_code']) {
    const s = await setup(); const url = await start(s); const original = s.runner.xOAuthCompleteRead;
    s.runner.xOAuthCompleteRead = async input => {
      const raw = await original(input);
      if (mode === 'wrong_handle') raw.data[0].username = 'MASAHIRO_501';
      if (mode === 'writes') raw.postingEnabled = true;
      if (mode === 'stored_token') raw.tokenStored = true;
      if (mode === 'wrong_scope') raw.scopes.push('tweet.write');
      return mode === 'mismatch_code' ? { success: false, error: 'x_oauth_identity_mismatch' } : raw;
    };
    const response = await callback(s, url.searchParams.get('state'));
    assert.doesNotMatch(response.headers.get('location'), /verified/);
    assert.equal(s.jar.values.has(X_OAUTH_RECEIPT_COOKIE), false);
  }
});

test('a changed callback setting and malicious begin URL cannot forward credentials', async () => {
  const s = await setup(); const url = await start(s);
  s.runner.xOAuthReadConfig = async () => ({ enabled: true, configured: true, redirectUri: 'https://attacker.test/api/dashboard/x-oauth/callback' });
  assert.match((await callback(s, url.searchParams.get('state'))).headers.get('location'), /x_oauth=configuration_required/);
  assert.equal(s.calls.length, 1);
  const other = await setup(); other.runner.xOAuthBeginRead = async () => ({ success: true, authorizeUrl: 'https://attacker.test/steal' });
  assert.equal((await handleXOAuthStart(context(other.jar, 'POST', '/api/dashboard/x-oauth/start', { target: 'aima_no_te' }), other.env)).status, 502);
  assert.equal(other.jar.values.has(X_OAUTH_PENDING_COOKIE), false);
});

function persistent(s) {
  let rows = [];
  const oldConfig = s.runner.xOAuthReadConfig;
  s.runner.xOAuthReadConfig = async () => ({ ...await oldConfig(), persistenceConfigured: true });
  s.runner.xOAuthConnectionsRead = async () => ({ success: true, data: rows, postingEnabled: false, schedulingEnabled: false, PRIVATE_TOKEN: 'PRIVATE' });
  const oldComplete = s.runner.xOAuthCompleteRead;
  s.runner.xOAuthCompleteRead = async input => {
    assert.equal(input.persist, true);
    const result = await oldComplete(input);
    if (input.expectedUserId) assert.equal(input.expectedUserId, result.data[0].id);
    rows = [{ target: input.target, userId: result.data[0].id, username: input.target, connectedAt: result.verifiedAt, verifiedAt: result.verifiedAt, expiresAt: new Date(Date.now() + 7200000).toISOString(), status: 'connected', accessToken: 'PRIVATE' }];
    return { ...result, tokenStored: true };
  };
  s.runner.xOAuthConnectionRecheckRead = async input => {
    assert.equal(input.expectedUserId, rows[0].userId);
    return { success: true, postingEnabled: false, schedulingEnabled: false, PRIVATE_TOKEN: 'PRIVATE' };
  };
  s.runner.xOAuthDisconnectRead = async input => {
    assert.equal(input.expectedUserId, rows[0].userId); rows = [];
    return { success: true, postingEnabled: false, schedulingEnabled: false, PRIVATE_TOKEN: 'PRIVATE' };
  };
}

test('stored connection callback verifies readback; list and mutation responses never expose service tokens', async () => {
  const s = await setup(); persistent(s);
  const url = await start(s, 'MASAHIRO_501');
  assert.match((await callback(s, url.searchParams.get('state'))).headers.get('location'), /x_oauth=connected/);
  assert.equal(s.jar.values.has(X_OAUTH_RECEIPT_COOKIE), false);
  const raw = await (await handleXOAuthStatus(context(s.jar, 'GET', '/api/dashboard/x-oauth/status'), s.env)).json();
  assert.equal(raw.connections[0].target, 'MASAHIRO_501');
  assert.equal(raw.connections[0].userId, '123456789012345678');
  assert.ok(!JSON.stringify(raw).includes('PRIVATE'));
  for (const action of ['recheck', 'disconnect']) {
    const response = await handleXOAuthConnectionAction(context(s.jar, 'POST', `/api/dashboard/x-oauth/${action}`, { target: 'MASAHIRO_501' }), s.env, action);
    assert.equal(response.status, 200); assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE'));
  }
  const empty = await (await handleXOAuthStatus(context(s.jar, 'GET', '/api/dashboard/x-oauth/status'), s.env)).json();
  assert.deepEqual(empty.connections, []);
});

test('new mutations enforce session, same-origin, target-only body and server numeric identity', async () => {
  const s = await setup(); persistent(s);
  const url = await start(s, 'MASAHIRO_501'); await callback(s, url.searchParams.get('state'));
  for (const action of ['recheck', 'disconnect']) {
    const path = `/api/dashboard/x-oauth/${action}`;
    assert.equal((await handleXOAuthConnectionAction(context(s.jar, 'GET', path), s.env, action)).status, 405);
    assert.equal((await handleXOAuthConnectionAction(context(cookies(), 'POST', path, { target: 'MASAHIRO_501' }), s.env, action)).status, 401);
    assert.equal((await handleXOAuthConnectionAction(context(s.jar, 'POST', path, { target: 'MASAHIRO_501' }, 'https://evil.test'), s.env, action)).status, 403);
    for (const body of [{ target: 'MASAHIRO_501', expectedUserId: '111' }, { target: 'MASAHIRO_501', persist: true }, { target: 'other' }]) {
      assert.equal((await handleXOAuthConnectionAction(context(s.jar, 'POST', path, body), s.env, action)).status, 400);
    }
    assert.equal((await handleXOAuthConnectionAction(context(s.jar, 'POST', path, { target: 'sunlovesflow' }), s.env, action)).status, 404);
  }
});

test('default rollout permits only MASA and malformed metadata fails closed without echoing tokens', async () => {
  const s = await setup();
  s.runner.xOAuthReadConfig = async () => ({ enabled: true, configured: true, redirectUri: origin + X_OAUTH_CALLBACK_PATH });
  assert.equal((await handleXOAuthStart(context(s.jar, 'POST', '/api/dashboard/x-oauth/start', { target: 'aima_no_te' }), s.env)).status, 403);
  await start(s, 'MASAHIRO_501');
  s.runner.xOAuthConnectionsRead = async () => ({ success: true, postingEnabled: false, schedulingEnabled: false, data: [{ target: 'MASAHIRO_501', userId: 'PRIVATE' }] });
  const raw = await (await handleXOAuthStatus(context(s.jar, 'GET', '/api/dashboard/x-oauth/status'), s.env)).json();
  assert.equal(raw.available, false); assert.ok(!JSON.stringify(raw).includes('PRIVATE'));
});

test('reconnect sends stored user ID and refuses unexpected account numeric ID', async () => {
  const s = await setup(); persistent(s);
  const first = await start(s, 'MASAHIRO_501'); await callback(s, first.searchParams.get('state'));
  const second = await start(s, 'MASAHIRO_501');
  const pending = await openOAuthCookie(cookieKey, origin, 'pending', s.jar.values.get(X_OAUTH_PENDING_COOKIE));
  assert.equal(pending.expectedUserId, '123456789012345678');
  const original = s.runner.xOAuthCompleteRead;
  s.runner.xOAuthCompleteRead = async input => { const raw = await original(input); raw.data[0].id = '999'; return raw; };
  assert.match((await callback(s, second.searchParams.get('state'))).headers.get('location'), /x_oauth=verification_failed/);
});

test('callback failures retain only fixed, actionable stages and never reflect service secrets', async () => {
  const cases = [
    ['x_oauth_exchange_failed', 'exchange_failed'], ['x_oauth_exchange_unavailable', 'exchange_unavailable'],
    ['x_oauth_exchange_timeout', 'exchange_timeout'], ['x_oauth_token_invalid', 'token_invalid'],
    ['x_401', 'account_unauthorized'], ['x_402', 'account_payment_required'], ['x_403', 'account_forbidden'],
    ['x_429', 'rate_limited'], ['x_timeout', 'account_timeout'], ['x_oauth_account_read_failed', 'account_read_failed'],
    ['x_oauth_storage_failed', 'storage_failed'], ['x_oauth_connection_conflict', 'storage_failed'],
    ['x_oauth_scope_mismatch', 'scope_mismatch'], ['x_oauth_identity_mismatch', 'identity_mismatch'],
    ['PRIVATE_PROVIDER_ERROR', 'failed'], ['__proto__', 'failed'], ['constructor', 'failed'],
  ];
  for (const [error, expected] of cases) {
    const s = await setup(); const url = await start(s);
    s.runner.xOAuthCompleteRead = async () => ({ success: false, error, token: 'PRIVATE_ACCESS_TOKEN', message: 'PRIVATE_EXCEPTION' });
    const response = await callback(s, url.searchParams.get('state'));
    assert.equal(response.headers.get('location'), `/dashboard/post?x_oauth=${expected}#x-oauth-read`);
    assert.ok(xOAuthReadNotice(expected));
    assert.ok(!xOAuthReadNotice(expected).includes('PRIVATE'));
    assert.equal(s.jar.values.has(X_OAUTH_RECEIPT_COOKIE), false);
    assert.equal(s.jar.values.has(X_OAUTH_PENDING_COOKIE), false);
  }
  for (const value of ['PRIVATE_PROVIDER_ERROR', '__proto__', 'constructor', '<script>']) assert.equal(xOAuthReadNotice(value), '');
  assert.equal(xOAuthReadFailure({ success: true, error: 'x_403' }), 'failed');
});

test('RPC and persistence readback exceptions have distinct fixed outcomes', async () => {
  const rpc = await setup(); const url = await start(rpc);
  rpc.runner.xOAuthCompleteRead = async () => { throw new Error('PRIVATE_RPC_DETAILS'); };
  assert.match((await callback(rpc, url.searchParams.get('state'))).headers.get('location'), /x_oauth=service_unavailable/);
  const store = await setup(); persistent(store); const started = await start(store);
  const complete = store.runner.xOAuthCompleteRead;
  store.runner.xOAuthCompleteRead = async input => {
    const result = await complete(input);
    store.runner.xOAuthConnectionsRead = async () => { throw new Error('PRIVATE_SQL_AND_TOKEN'); };
    return result;
  };
  assert.match((await callback(store, started.searchParams.get('state'))).headers.get('location'), /x_oauth=storage_failed/);
});

test('configured persistence with unavailable credential listing never reports an empty known state', async () => {
  const s = await setup();
  const config = s.runner.xOAuthReadConfig;
  s.runner.xOAuthReadConfig = async () => ({ ...await config(), persistenceConfigured: true });
  const raw = await (await handleXOAuthStatus(context(s.jar, 'GET', '/api/dashboard/x-oauth/status'), s.env)).json();
  assert.equal(raw.available, false);
  assert.equal('connections' in raw, false);
  assert.equal((await handleXOAuthStart(context(s.jar, 'POST', '/api/dashboard/x-oauth/start', { target: 'MASAHIRO_501' }), s.env)).status, 502);
  assert.equal(s.calls.length, 0);
});
