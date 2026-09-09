import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const { GET } = await import('../src/pages/api/dashboard/distribution.ts');
const { dashboardOwnerKey } = await import('../src/lib/dashboardAuth.ts');
const secret = 'test-only-distribution-owner';

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: secret,
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('Distribution read uses the owner-gated canonical RPC and fixed content IDs', async (t) => {
  const owner = await dashboardOwnerKey(secret);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(String(url).endsWith('/masa_distribution_content_get_v1'));
    const body = JSON.parse(options.body);
    assert.equal(body.p_owner_key, owner);
    assert.deepEqual(body.p_asset_ids, ['C034', 'C033', 'C035']);
    return Response.json([{ asset_id: 'C034', current_title: 'Test' }]);
  });
  const response = await GET({ locals: {} });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.storage, 'drive-supabase-read-model');
  assert.equal(result.content[0].asset_id, 'C034');
});

test('Distribution upstream failures return a sanitized explicit fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private database detail'); });
  const response = await GET({ locals: {} });
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.doesNotMatch(text, /private database detail/);
  assert.deepEqual(JSON.parse(text), {
    ok: false,
    storage: 'static-fallback',
    content: [],
    error: 'distribution_unavailable',
  });
});

test('Distribution missing storage config fails before upstream and remains sanitized', async (t) => {
  delete env.SUPABASE_URL;
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('missing storage config must not fetch'));
  const response = await GET({ locals: {} });
  assert.equal(response.status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(await response.json(), {
    ok: false,
    storage: 'static-fallback',
    content: [],
    error: 'distribution_unavailable',
  });
});

test('Dashboard navigation keeps Calendar, Content Schedule, and Distribution together', async () => {
  const layout = await readFile(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
  const calendar = layout.indexOf("href: '/dashboard/schedule'");
  const contentSchedule = layout.indexOf("href: '/dashboard/content-schedule'");
  const distribution = layout.indexOf("href: '/dashboard/distribution'");
  assert.ok(calendar >= 0);
  assert.ok(contentSchedule > calendar);
  assert.ok(distribution > contentSchedule);
});

test('Content Schedule and Distribution remain distinct Dashboard surfaces', async () => {
  const [contentSchedule, distribution] = await Promise.all([
    readFile(new URL('../src/pages/dashboard/content-schedule.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/dashboard/distribution.astro', import.meta.url), 'utf8'),
  ]);
  assert.match(contentSchedule, /ContentScheduler/);
  assert.doesNotMatch(contentSchedule, /DistributionBoard/);
  assert.match(distribution, /DistributionBoard/);
  assert.doesNotMatch(distribution, /ContentScheduler/);
});

test('Distribution board exits loading state on malformed successful responses', async () => {
  const board = await readFile(new URL('../src/components/dashboard/DistributionBoard.tsx', import.meta.url), 'utf8');
  assert.match(board, /if \(cancelled\) return;/);
  assert.match(board, /if \(!payload\.ok \|\| !Array\.isArray\(payload\.content\)\) \{\s*setSyncState\('fallback'\);\s*return;\s*\}/);
});
