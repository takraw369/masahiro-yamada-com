import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const { POST } = await import('../src/pages/api/dashboard/calendar/sync.ts');
const { GET } = await import('../src/pages/api/dashboard/calendar.ts');
const { onRequest } = await import('../src/middleware.ts');
const { dashboardOwnerKey } = await import('../src/lib/dashboardAuth.ts');

const secret = 'test-only-calendar-sync';
const path = '/api/dashboard/calendar/sync';
const now = Date.now();
const date = (offset = 0) => new Date(now + offset).toISOString();
const event = { event_id: 'series|occurrence', start_at: date(1000), end_at: date(2000), all_day: false };
const body = { source_synced_at: date(), window_start: date(-86400000), window_end: date(86400000), events: [event] };

const context = (payload = body, { method = 'POST', suffix = '', token = secret } = {}) => ({
  locals: {},
  cookies: { get: () => undefined },
  request: new Request(`https://dashboard.example.test${path}${suffix}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
  }),
});

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    CALENDAR_SYNC_SECRET: secret,
    DASHBOARD_PASSWORD: 'test-only-owner-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('only exact Calendar sync POST skips browser session/origin and still requires its own Bearer secret', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/masa_calendar_snapshot_replace_v2'));
    assert.equal(JSON.parse(options.body).p_source_synced_at, body.source_synced_at);
    return Response.json(1);
  });

  const ctx = context();
  const response = await onRequest(ctx, () => POST(ctx));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('cache-control'), /no-store/);

  for (const token of ['', 'wrong']) {
    const rejected = context(body, { token });
    assert.equal((await onRequest(rejected, () => POST(rejected))).status, 401);
  }

  for (const options of [{ method: 'GET' }, { suffix: '/extra' }, { suffix: '/' }]) {
    const protectedContext = context(body, options);
    const protectedResponse = await onRequest(protectedContext, () => assert.fail('must be protected'));
    assert.ok([401, 403].includes(protectedResponse.status));
  }
});

test('invalid duplicate, range, boolean and stale payloads cannot reach Calendar storage', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('invalid payload must not reach storage'));
  for (const payload of [
    null,
    [],
    {},
    { ...body, events: [null] },
    { ...body, events: [event, event] },
    { ...body, events: [{ ...event, all_day: 'false' }] },
    { ...body, events: [{ ...event, end_at: event.start_at }] },
    { ...body, events: Array(501).fill(event) },
    { ...body, source_synced_at: date(11 * 60000) },
    { ...body, source_synced_at: date(-8 * 86400000) },
  ]) {
    assert.equal((await POST(context(payload))).status, 400);
  }
});

test('Calendar stale results map to 409 and private database errors are sanitized', async (t) => {
  for (const [message, status] of [['stale_calendar_snapshot', 409], ['secret schema detail', 500]]) {
    await t.test(message, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => new Response(message, { status: 400 }));
      const response = await POST(context());
      assert.equal(response.status, status);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.doesNotMatch(await response.text(), /secret schema detail/);
    });
  }
});

test('Calendar read uses owner-gated v2 RPCs, preserves source/freshness and bounds the window', async (t) => {
  const owner = await dashboardOwnerKey(env.DASHBOARD_PASSWORD);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(url);
    assert.equal(payload.p_owner_key, owner);
    if (url.endsWith('/masa_calendar_snapshot_get_v2')) return Response.json([event]);
    assert.ok(url.endsWith('/masa_calendar_sync_status_v2'));
    return Response.json([{ source_synced_at: date(), event_count: 1 }]);
  });

  const read = (query = '') => GET({ locals: {}, request: new Request(`https://dashboard.example.test/api/dashboard/calendar${query}`) });
  const response = await read();
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const result = await response.json();
  assert.equal(result.source, 'google_calendar_snapshot');
  assert.deepEqual(result.events, [event]);
  assert.equal(result.sync.source_synced_at, date());
  assert.equal((await read(`?from=${date()}&to=${date(-1)}`)).status, 400);
  assert.equal((await read(`?from=${date()}&to=${date(121 * 86400000)}`)).status, 400);
  assert.equal(calls.length, 2);
});

test('Calendar read outage is explicit; missing sync secret fails before storage', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('private database detail'); });
  const response = await GET({ locals: {}, request: new Request('https://dashboard.example.test/api/dashboard/calendar') });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'calendar_unavailable' });

  fetchMock.mock.resetCalls();
  delete env.CALENDAR_SYNC_SECRET;
  assert.equal((await POST(context())).status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
});
