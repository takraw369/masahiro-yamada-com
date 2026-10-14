import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { nativeXReadEnabled, parseNativeXReadResponse } from '../src/lib/xNativeReadPolicy.ts';

const account = { id: '123456789012345678', username: 'masa_501', displayName: 'MASA', isActive: true };
const fixture = {
  success: true, provider: 'x-official', mode: 'read_only',
  postingEnabled: false, schedulingEnabled: false, data: [account],
};

test('Native X is opt-in and defaults disabled even with an undefined or unexpected flag', () => {
  for (const env of [null, undefined, {}, { X_NATIVE_READ_ENABLED: 'TRUE' }, { X_NATIVE_READ_ENABLED: '1' }]) {
    assert.equal(nativeXReadEnabled(env), false);
  }
  assert.equal(nativeXReadEnabled({ X_NATIVE_READ_ENABLED: 'true' }), true);
});

test('Browser receives a minimal sanitized single read-only identity', () => {
  assert.deepEqual(parseNativeXReadResponse({ ...fixture, extraSecret: 'should-not-leak', data: [{ ...account, extraSecret: 'do-not-leak' }] }), fixture);
});

test('Rejects write-enabled, multi-account, missing-identity and malformed upstream responses', () => {
  for (const value of [null, [], {}, { ...fixture, postingEnabled: true },
    { ...fixture, schedulingEnabled: true }, { ...fixture, mode: 'publish' },
    { ...fixture, data: [] }, { ...fixture, data: [account, account] },
    { ...fixture, data: [{ ...account, username: 'bad@name' }] },
    { ...fixture, data: [{ ...account, isActive: false }] }]) {
    assert.equal(parseNativeXReadResponse(value), null);
  }
});

test('Read-only route checks Dashboard session then flag and private binding', async () => {
  const route = await readFile(new URL('../src/pages/api/dashboard/x-native-accounts.ts', import.meta.url), 'utf8');
  const indexAuth = route.indexOf('verifyDashboardSession(');
  const indexFlag = route.indexOf('nativeXReadEnabled(env)');
  const indexRunner = route.indexOf('xNativeAccountsReadOnly()');
  assert.ok(indexAuth >= 0 && indexAuth < indexFlag && indexFlag < indexRunner);
  assert.match(route, /error: 'native_x_read_disabled'/);
  assert.match(route, /error: 'native_x_runner_unavailable'/);
  assert.match(route, /export const GET/);
  assert.doesNotMatch(route, /export const (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /x-harness|POST \/2\/tweets|Bearer /i);
});

test('Health-tab diagnostics cannot select X composer posting account', async () => {
  const ops = await readFile(new URL('../src/components/dashboard/XOperationsCenter.tsx', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/components/dashboard/XNativeConnectionPanel.tsx', import.meta.url), 'utf8');
  const composer = await readFile(new URL('../src/components/dashboard/XCommandCenter.tsx', import.meta.url), 'utf8');
  assert.match(ops, /tab === 'health'.*XNativeConnectionPanel/s);
  assert.match(panel, /fetch\('\/api\/dashboard\/x-native-accounts'/);
  assert.match(panel, /投稿・予約は未接続です/);
  assert.doesNotMatch(panel, /POST|fetch\('\/api\/x-harness/);
  assert.match(composer, /fetch\('\/api\/x-harness\/x-accounts'\)/);
});
