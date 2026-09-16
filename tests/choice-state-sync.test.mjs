import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const choiceState = await import('../src/pages/api/dashboard/choice-state.ts');
const origin = 'https://dashboard.example.test';

const context = (method = 'GET', body) => ({
  locals: {},
  request: new Request(`${origin}/api/dashboard/choice-state`, {
    method,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }),
});

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: 'test-choice-state-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('GET returns the owner-scoped Choice Lab draft state', async (t) => {
  const remote = {
    version: 3,
    answers: { 'focus-now': { value: 'revenue', label: '売上につながるOffer', at: '2026-09-16T08:00:00.000Z' } },
    sets: [{ questions: [{ id: 'focus-now' }], completedAt: null }],
    cursor: 0,
    updatedAt: '2026-09-16T08:00:00.000Z',
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(String(url).endsWith('/masa_choice_state_get_v1'));
    const rpc = JSON.parse(options.body);
    assert.match(rpc.p_owner_key, /^[0-9a-f]{64}$/);
    return Response.json(remote);
  });

  const response = await choiceState.GET(context());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.storage, 'supabase');
  assert.deepEqual(body.state, remote);
});

test('POST persists bounded object state through the Choice state RPC', async (t) => {
  const state = { version: 3, answers: {}, sets: [], cursor: 0, updatedAt: '2026-09-16T08:05:00.000Z' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(String(url).endsWith('/masa_choice_state_set_v1'));
    const rpc = JSON.parse(options.body);
    assert.match(rpc.p_owner_key, /^[0-9a-f]{64}$/);
    assert.deepEqual(rpc.p_state, state);
    return Response.json(true);
  });

  const response = await choiceState.POST(context('POST', { state }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.storage, 'supabase');
  assert.ok(body.savedAt);
});

test('invalid or oversized state is rejected before storage access', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', () => assert.fail('invalid state must not reach storage'));
  assert.equal((await choiceState.POST(context('POST', { state: [] }))).status, 400);
  assert.equal((await choiceState.POST(context('POST', 'null'))).status, 400);
  assert.equal((await choiceState.POST(context('POST', { state: { payload: 'x'.repeat(181000) } }))).status, 413);
  assert.equal(upstream.mock.callCount(), 0);
});

test('storage failures return a stable error without leaking upstream details', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('private database details', { status: 500 }));

  const getResponse = await choiceState.GET(context());
  assert.equal(getResponse.status, 503);
  assert.doesNotMatch(JSON.stringify(await getResponse.json()), /private database details/);

  const postResponse = await choiceState.POST(context('POST', { state: { version: 3 } }));
  assert.equal(postResponse.status, 503);
  assert.doesNotMatch(JSON.stringify(await postResponse.json()), /private database details/);
});
