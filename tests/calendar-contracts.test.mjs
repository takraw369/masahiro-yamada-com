import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';
const { POST } = await import('../src/pages/api/dashboard/calendar/sync.ts');
const { onRequest } = await import('../src/middleware.ts');
const secret = 'test-only-calendar-sync';
const path = '/api/dashboard/calendar/sync';
const now = Date.now();
const date = (offset = 0) => new Date(now + offset).toISOString();
const event = { event_id: 'series|occurrence', start_at: date(1000), end_at: date(2000), all_day: false };
const body = { source_synced_at: date(), window_start: date(-86400000), window_end: date(86400000), events: [event] };
const context = (payload = body, { method = 'POST', suffix = '', token = secret } = {}) => ({
  locals: {}, cookies: { get: () => undefined },
  request: new Request(`https://dashboard.example.test${path}${suffix}`, {
    method, headers: { Authorization: `Bearer ${token}` },
    ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
  }),
});
test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, { CALENDAR_SYNC_SECRET: secret, DASHBOARD_PASSWORD: 'test-only-owner-secret', SUPABASE_URL: 'https://supabase.example.test', SUPABASE_PUBLISHABLE_KEY: 'test-only-key' });
});
test('only exact Calendar sync POST skips session/Origin and still requires its own Bearer secret', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/masa_calendar_snapshot_replace_v2'));
    assert.equal(JSON.parse(options.body).p_source_synced_at, body.source_synced_at);
    return Response.json(1);
  });
  const ctx = context();
  assert.equal((await onRequest(ctx, () => POST(ctx))).status, 200);
  for (const token of ['', 'wrong']) {
    const ctx = context(body, { token });
    assert.equal((await onRequest(ctx, () => POST(ctx))).status, 401);
  }
  for (const options of [{ method: 'GET' }, { suffix: '/extra' }, { suffix: '/' }]) {
    const ctx = context(body, options);
    assert.ok([401, 403].includes((await onRequest(ctx, () => assert.fail('must be protected'))).status));
  }
});
test('invalid/null/duplicate/range/boolean payloads cannot reach the Calendar RPC', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('invalid payload must not reach storage'));
  for (const payload of [null, [], {}, { ...body, events: [null] }, { ...body, events: [event, event] }, { ...body, events: [{ ...event, all_day: 'false' }] }, { ...body, events: [{ ...event, end_at: event.start_at }] }, { ...body, events: Array(501).fill(event) }]) {
    assert.equal((await POST(context(payload))).status, 400);
  }
});
test('Calendar stale results map to 409 and private database errors are sanitized', async (t) => {
  for (const [message, status] of [['stale_calendar_snapshot', 409], ['secret schema detail', 500]]) {
    await t.test(message, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => new Response(message, { status: 400 }));
      const res = await POST(context());
      assert.equal(res.status, status);
      assert.match(res.headers.get('cache-control'), /no-store/);
      assert.doesNotMatch(await res.text(), /secret schema detail/);
    });
  }
});

test('undeclared oversized streaming body is canceled before buffering beyond the limit', async (t) => {
  let canceled = false;
  t.mock.method(globalThis, 'fetch', () => assert.fail('oversize must not reach storage'));
  const ctx = context();
  ctx.request = new Request(`https://dashboard.example.test${path}`, {
    method: 'POST', duplex: 'half', headers: { Authorization: `Bearer ${secret}` },
    body: new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1_000_000)); }, cancel() { canceled = true; } }),
  });
  assert.equal((await POST(ctx)).status, 413);
  assert.equal(canceled, true);
});
