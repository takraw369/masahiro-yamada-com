import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const { POST } = await import('../src/pages/api/internal/ace-drive-ingest.ts');
const { dashboardOwnerKey } = await import('../src/lib/dashboardAuth.ts');

const secret = 'test-only-ace-drive-ingest';
const folderId = '1fQgmupO4w7oZfhKSFEselFzc651gkqE4';
const fileId = '1abcDEFghiJKLmnopQRstuVWXyz_12345';
const payload = {
  folderId,
  fileId,
  title: '睡眠と呼吸から観察する',
  summary: '身体の状態を観察するための短い教材',
  assetType: 'slide',
  assetUrl: `https://docs.google.com/presentation/d/${fileId}/edit`,
  mimeType: 'application/vnd.google-apps.presentation',
  createdTime: '2026-09-17T12:00:00.000Z',
  modifiedTime: '2026-09-17T12:05:00.000Z',
  tags: ['body'],
};

const context = (body = payload, token = secret) => ({
  locals: {},
  request: new Request('https://masahiroyamada.com/api/internal/ace-drive-ingest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }),
});

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    ACE_DRIVE_INGEST_SECRET: secret,
    DASHBOARD_PASSWORD: 'test-only-owner-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('Drive ingest requires its dedicated Bearer secret before storage access', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('unauthorized request must not reach storage'));

  assert.equal((await POST(context(payload, 'wrong'))).status, 401);
  assert.equal(fetchMock.mock.callCount(), 0);

  delete env.ACE_DRIVE_INGEST_SECRET;
  assert.equal((await POST(context())).status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Drive ingest is owner-gated, idempotent by Drive file ID, and always Draft', async (t) => {
  const owner = await dashboardOwnerKey(env.DASHBOARD_PASSWORD);

  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/masa_ace_asset_upsert_v1'));
    const rpc = JSON.parse(options.body);
    assert.equal(rpc.p_owner_key, owner);
    assert.equal(rpc.p_source_system, 'drive');
    assert.equal(rpc.p_source_ref, fileId);
    assert.equal(rpc.p_status, 'draft');
    assert.equal(rpc.p_title, payload.title);
    assert.equal(rpc.p_asset_type, 'slide');
    assert.equal(rpc.p_metadata.registered_from, 'google_drive_apps_script');
    assert.equal(rpc.p_metadata.drive_folder_id, folderId);
    return Response.json({ asset_id: 'asset-1', theme_slug: 'body', status: 'draft' });
  });

  const response = await POST(context({ ...payload, status: 'live', sourceSystem: 'youtube' }));
  assert.equal(response.status, 201);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.deepEqual(await response.json(), {
    ok: true,
    data: { asset_id: 'asset-1', theme_slug: 'body', status: 'draft' },
  });
});

test('Drive ingest rejects files outside the exact inbox and non-Drive URLs', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('invalid request must not reach storage'));

  const invalidCases = [
    { ...payload, folderId: 'another-folder' },
    { ...payload, fileId: 'bad id' },
    { ...payload, assetUrl: 'https://example.com/file.pdf' },
    { ...payload, assetType: 'binary' },
    { ...payload, themeSlug: 'unknown-theme' },
  ];

  for (const invalid of invalidCases) {
    assert.equal((await POST(context(invalid))).status, 400);
  }
});
