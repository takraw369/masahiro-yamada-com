import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const state = await import('../src/pages/api/dashboard/state.ts');
const feedback = await import('../src/pages/api/dashboard/feedback.ts');
const funnel = await import('../src/pages/api/funnel/event.ts');
const { dashboardOwnerKey } = await import('../src/lib/dashboardAuth.ts');
const origin = 'https://dashboard.example.test';
const secret = 'test-only-storage-secret';
const ctx = (body) => ({ locals: {}, request: new Request(origin, {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
}) });

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: secret,
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
    DB: { prepare() { assert.fail('request must never read, import, create or write D1'); } },
  });
});

test('Dashboard reads call only the primary read RPC, with unchanged owner derivation', async (t) => {
  const owner = await dashboardOwnerKey(secret);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(JSON.parse(options.body).p_owner_key, owner);
    if (url.endsWith('/masa_dashboard_state_get_v2')) return Response.json([{ slot_id: 'one' }]);
    assert.ok(url.endsWith('/masa_dashboard_feedback_list_v2'));
    return Response.json([{ id: 'one', status: 'pending' }]);
  });
  assert.deepEqual(await (await state.GET({ locals: {} })).json(), { checked: { one: true }, storage: 'supabase' });
  assert.equal((await (await feedback.GET({ locals: {} })).json()).items[0].status, 'new');
  assert.equal(calls.length, 2, 'no hidden migration or marker mutation on GET');
});

test('successful writes retain existing Supabase RPC payload contracts', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json(url.endsWith('/masa_dashboard_state_set_v2') ? true : 'test-id');
  });
  for (const [handler, body] of [
    [state.POST, { slotId: ' one ', checked: false, xp: 5.8 }],
    [feedback.POST, { message: ' hello ', page: '/dashboard', context: 'test' }],
    [funnel.POST, { event: 'trinity_view', sessionId: 'test-session' }],
  ]) {
    const response = await handler(ctx(body));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).storage, 'supabase');
  }
  assert.equal(calls[0].body.p_checked, false);
  assert.equal(calls[0].body.p_xp, 6);
  assert.equal(calls[1].body.p_message, 'hello');
  assert.equal(calls[2].body.p_event_name, 'trinity_view');
});

test('storage outages never acknowledge secondary writes or leak upstream details', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('private schema details', { status: 500 }));
  for (const [handler, body] of [
    [state.GET, {}], [feedback.GET, {}],
    [state.POST, { slotId: 'one', checked: true }],
    [feedback.POST, { message: 'do not lose silently' }],
  ]) {
    const response = await handler(ctx(body));
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.ok, false);
    assert.equal(result.error, 'primary_storage_unavailable');
    assert.equal(result.storage, 'unavailable');
    assert.doesNotMatch(JSON.stringify(result), /private schema/);
  }
  const response = await funnel.POST(ctx({ event: 'trinity_view', sessionId: 'test' }));
  assert.equal(response.status, 200, 'analytics outage must not break public diagnosis');
  assert.deepEqual(await response.json(), { ok: true, stored: false, storage: 'unavailable' });
});

test('malformed request bodies are rejected without storage access', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', () => assert.fail('invalid body must not reach storage'));
  for (const handler of [state.POST, feedback.POST, funnel.POST]) {
    for (const body of ['null', '[]', '"text"', '{']) assert.equal((await handler(ctx(body))).status, 400);
  }
  assert.equal((await state.POST(ctx({ slotId: 'one', checked: 'false' }))).status, 400);
  assert.equal(upstream.mock.callCount(), 0);
});
