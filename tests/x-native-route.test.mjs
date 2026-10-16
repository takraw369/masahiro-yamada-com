import assert from 'node:assert/strict';
import test from 'node:test';
import { createDashboardSession } from '../src/lib/dashboardAuth.ts';
import { handleNativeXRead } from '../src/lib/security/native-x-read.ts';

const origin = 'https://dashboard.example.test';
const password = 'fixture-only-local';
const identity = { success: true, provider: 'x-official', mode: 'read_only', postingEnabled: false, schedulingEnabled: false,
  data: [{ id: '123456789012345678', username: 'aima_no_te', displayName: 'fixture', isActive: true }] };
const ctx = (token, method = 'GET') => ({ request: new Request(`${origin}/api/dashboard/x-native-accounts`, { method }), cookies: { get: () => token ? { value: token } : undefined } });

test('actual handler blocks method, session, disabled flag and missing binding before RPC', async () => {
  let calls = 0;
  const token = await createDashboardSession(password, origin);
  const env = { DASHBOARD_PASSWORD: password, X_NATIVE_READ_ENABLED: 'true', FLOW_RUNNER: { xNativeAccountsReadOnly: async () => { calls++; return identity; } } };
  assert.equal((await handleNativeXRead(ctx(token, 'POST'), env)).status, 405);
  assert.equal((await handleNativeXRead(ctx(), env)).status, 401);
  assert.equal((await handleNativeXRead(ctx(token), { ...env, X_NATIVE_READ_ENABLED: undefined })).status, 423);
  assert.equal((await handleNativeXRead(ctx(token), { ...env, FLOW_RUNNER: undefined })).status, 503);
  assert.equal(calls, 0);
});

test('actual private binding call returns sanitized identity with no-store and unchanged ID', async () => {
  const token = await createDashboardSession(password, origin);
  let calls = 0;
  const response = await handleNativeXRead(ctx(token), { DASHBOARD_PASSWORD: password, X_NATIVE_READ_ENABLED: 'true', FLOW_RUNNER: { xNativeAccountsReadOnly: async () => {
    calls++; return { ...identity, PRIVATE_TOKEN: 'secret', data: [{ ...identity.data[0], PRIVATE_TOKEN: 'secret' }] };
  } } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { ...identity, enabled: true });
  assert.equal(calls, 1);
});

test('safe RPC failure codes preserve recovery states without provider text', async () => {
  const token = await createDashboardSession(password, origin);
  for (const [code, status] of [['missing_x_access_token', 503], ['x_401', 502], ['x_403', 502], ['x_429', 429], ['x_timeout', 504], ['x_native_account_invalid', 502], ['x_read_failed', 502]]) {
    const response = await handleNativeXRead(ctx(token), { DASHBOARD_PASSWORD: password, X_NATIVE_READ_ENABLED: 'true', FLOW_RUNNER: { xNativeAccountsReadOnly: async () => ({
      success: false, provider: 'x-official', mode: 'read_only', postingEnabled: false, schedulingEnabled: false, error: code, message: 'PRIVATE_TOKEN',
    }) } });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { success: false, error: code });
  }
});

test('malformed and thrown RPC failures never become a successful empty list', async () => {
  const token = await createDashboardSession(password, origin);
  for (const raw of [null, { ...identity, data: [] }, { ...identity, postingEnabled: true }, { ...identity, data: [null] }]) {
    const response = await handleNativeXRead(ctx(token), { DASHBOARD_PASSWORD: password, X_NATIVE_READ_ENABLED: 'true', FLOW_RUNNER: { xNativeAccountsReadOnly: async () => raw } });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { success: false, error: 'native_x_response_invalid' });
  }
  const response = await handleNativeXRead(ctx(token), { DASHBOARD_PASSWORD: password, X_NATIVE_READ_ENABLED: 'true', FLOW_RUNNER: { xNativeAccountsReadOnly: async () => { throw new Error('PRIVATE_TOKEN'); } } });
  assert.deepEqual(await response.json(), { success: false, error: 'native_x_read_failed' });
});
