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

test('Distribution reads the owner-gated Drive/Supabase projection with the current candidate IDs', async (t) => {
  const owner = await dashboardOwnerKey(secret);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(String(url).endsWith('/masa_distribution_content_get_v1'));
    const body = JSON.parse(options.body);
    assert.equal(body.p_owner_key, owner);
    assert.deepEqual(body.p_asset_ids, ['C034', 'C033', 'C035']);
    return Response.json([{ asset_id: 'C034', current_title: 'Canonical title' }]);
  });

  const response = await GET({ locals: {} });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.storage, 'drive-supabase-read-model');
  assert.equal(result.content[0].asset_id, 'C034');
});

test('Distribution never disguises an upstream outage as static success', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private database detail'); });
  const response = await GET({ locals: {} });
  assert.equal(response.status, 503);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const text = await response.text();
  assert.doesNotMatch(text, /private database detail/);
  assert.deepEqual(JSON.parse(text), {
    ok: false,
    storage: 'unavailable',
    content: [],
    error: 'distribution_unavailable',
  });
});

test('Distribution missing storage config fails closed before upstream access', async (t) => {
  delete env.SUPABASE_URL;
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('must not fetch without storage config'));
  const response = await GET({ locals: {} });
  assert.equal(response.status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal((await response.json()).storage, 'unavailable');
});

test('Distribution UI remains read-only and contains no static account/content fallback store', async () => {
  const board = await readFile(new URL('../src/components/dashboard/DistributionBoard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(board, /localStorage|sessionStorage/);
  assert.doesNotMatch(board, /@kodomo_athlete|@sunlovesflow|@MASAHIRO_501/);
  assert.doesNotMatch(board, /const\s+DEFAULT_QUEUE|const\s+MEDIA\s*=/);
  assert.match(board, /静的データには切り替えていません/);
  assert.match(board, /SNS_ACCOUNT_REGISTRY = まだ未接続/);
});

test('repository records the already-applied owner-gated Distribution migration', async () => {
  const sql = await readFile(new URL('../migrations/20260908014031_distribution_dashboard_read_model_v1.sql', import.meta.url), 'utf8');
  assert.match(sql, /masa_distribution_content_get_v1/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /unknown_dashboard_owner/);
  assert.match(sql, /Drive remains canonical/);
  assert.match(sql, /revoke all on function/);
});

test('Distribution route stays separate from Content Schedule and exposes only the read board', async () => {
  const [distribution, contentSchedule] = await Promise.all([
    readFile(new URL('../src/pages/dashboard/distribution.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/dashboard/content-schedule.astro', import.meta.url), 'utf8'),
  ]);
  assert.match(distribution, /DistributionBoard/);
  assert.doesNotMatch(distribution, /ContentScheduler/);
  assert.match(contentSchedule, /ContentScheduler/);
  assert.doesNotMatch(contentSchedule, /DistributionBoard/);
});
