import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../migrations/20261005_note_harness_tracked_links.sql', import.meta.url),
  'utf8',
);
const learningMigration = readFileSync(
  new URL('../migrations/20261005_zz_note_harness_learning_bridge.sql', import.meta.url),
  'utf8',
);
const attributionMigration = readFileSync(
  new URL('../migrations/20261005_zzz_note_harness_attribution_summary.sql', import.meta.url),
  'utf8',
);
const route = readFileSync(new URL('../src/pages/go/[slug].ts', import.meta.url), 'utf8');
const adminApi = readFileSync(
  new URL('../src/pages/api/dashboard/note-harness-links.ts', import.meta.url),
  'utf8',
);
const publicationApi = readFileSync(
  new URL('../src/pages/api/dashboard/note-publications.ts', import.meta.url),
  'utf8',
);
const attributionApi = readFileSync(
  new URL('../src/pages/api/dashboard/note-attribution.ts', import.meta.url),
  'utf8',
);

test('tracked link tables are private and public access is Worker capability resolver-RPC only', () => {
  assert.match(migration, /alter table public\.tracked_links enable row level security;/i);
  assert.match(migration, /alter table public\.tracked_link_clicks enable row level security;/i);
  assert.match(migration, /revoke all on table public\.tracked_links from public, anon, authenticated;/i);
  assert.match(migration, /revoke all on table public\.tracked_link_clicks from public, anon, authenticated;/i);
  assert.match(migration, /create or replace function public\.resolve_tracked_link_v1/i);
  assert.match(migration, /security definer[\s\S]*?set search_path = public/i);
  assert.match(migration, /grant execute on function public\.resolve_tracked_link_v1\(text,text,text,text,text\) to anon, authenticated;/i);
});

test('redirect cannot become an arbitrary open redirect', () => {
  assert.match(migration, /check \(destination_url ~ '\^https:\/\/'\)/i);
  assert.match(migration, /where slug = v_slug[\s\S]*?and status = 'active'/i);
  assert.match(route, /destination\.protocol !== 'https:'/i);
  assert.doesNotMatch(route, /searchParams\.get\(['"](?:url|to|destination|redirect)/i);
});

test('click receipts avoid raw IP and raw user-agent storage', () => {
  assert.doesNotMatch(migration, /\bip_address\b|\bclient_ip\b/i);
  assert.doesNotMatch(migration, /\buser_agent\s+text\b/i);
  assert.match(migration, /user_agent_class text/i);
  assert.match(route, /classifyUserAgent/);
});

test('referrer is stripped to origin plus pathname before persistence', () => {
  assert.match(route, /parsed\.origin/);
  assert.match(route, /parsed\.pathname/);
  assert.doesNotMatch(route, /parsed\.search/);
  assert.doesNotMatch(route, /parsed\.hash/);
});

test('human tracked clicks join the existing funnel learning spine while bot hits do not', () => {
  assert.match(migration, /insert into public\.funnel_events/i);
  assert.match(migration, /'tracked_link_click'/i);
  assert.match(migration, /v_inserted > 0 and v_ua_class in \('mobile', 'desktop'\)/i);
  assert.match(migration, /'publication_id', v_link\.publication_id/i);
  assert.match(migration, /'asset_id', v_link\.asset_id/i);
  assert.match(learningMigration, /tracked_link_click_sync_publication_v1/i);
  assert.match(learningMigration, /clicks = least\(coalesce\(clicks, 0\)::bigint \+ 1, 2147483647\)::integer/i);
  assert.match(learningMigration, /new\.user_agent_class in \('mobile', 'desktop'\)/i);
});

test('public redirect is fail-closed and non-cacheable', () => {
  assert.match(route, /\^\[a-z0-9\]\[a-z0-9-\]/i);
  assert.match(route, /return notFound\(\)/);
  assert.match(route, /'Cache-Control': 'no-store, max-age=0'/);
  assert.match(route, /status: 503/);
  assert.match(route, /'X-Robots-Tag': 'noindex, nofollow'/);
});

test('owned redirects hand note attribution into the existing Knowledge Journey UTM contract only', () => {
  assert.match(route, /OWNED_HOSTS/);
  assert.match(route, /utm_source/);
  assert.match(route, /utm_medium/);
  assert.match(route, /utm_campaign/);
  assert.match(route, /utm_content/);
  assert.match(route, /resolved\.campaign_ref \|\| `nh-\$\{slug\}`/);
  assert.match(adminApi, /campaignRef = text\(body\.campaignRef, 120\) \|\| `nh-\$\{slug\}`/);
  assert.doesNotMatch(route, /document\.cookie|Set-Cookie/i);
});

test('link management reuses the registered dashboard owner gate', () => {
  assert.match(migration, /create or replace function public\.masa_tracked_link_upsert_v1/i);
  assert.match(migration, /create or replace function public\.masa_tracked_link_list_v1/i);
  const ownerChecks = migration.match(/from private\.masa_dashboard_owner_keys/g) || [];
  assert.ok(ownerChecks.length >= 2, 'both Note Harness control-plane RPCs must validate the owner registry');
  assert.match(adminApi, /getDashboardOwnerKey/);
  assert.match(adminApi, /masa_tracked_link_upsert_v1/);
  assert.match(adminApi, /masa_tracked_link_list_v1/);
});

test('owner API can pause or archive links without exposing arbitrary database access', () => {
  assert.match(adminApi, /\['active', 'paused', 'archived'\]/);
  assert.match(adminApi, /p_status: status/);
  assert.match(adminApi, /trackUrl: `https:\/\/masahiroyamada\.com\/go\//);
  assert.doesNotMatch(adminApi, /execute_sql|service_role|SUPABASE_SERVICE/);
});

test('published note URL registration is owner-gated and note-domain-bound', () => {
  assert.match(learningMigration, /create or replace function public\.masa_note_publication_register_v1/i);
  assert.match(learningMigration, /v_url !~ '\^https:\/\/note\[\.\]com\/'/i);
  assert.match(learningMigration, /from private\.masa_dashboard_owner_keys/i);
  assert.match(publicationApi, /action === 'register'/);
  assert.ok(publicationApi.includes("/^https:\\/\\/note\\.com\\//i.test(publishedUrl)"));
  assert.match(publicationApi, /masa_note_publication_register_v1/);
});

test('note metrics are snapshotted and rolled into content_publications learning fields', () => {
  assert.match(learningMigration, /create or replace function public\.masa_note_metrics_record_v1/i);
  assert.match(learningMigration, /insert into public\.content_metric_snapshots/i);
  assert.match(learningMigration, /update public\.content_publications/i);
  assert.match(learningMigration, /impressions = coalesce\(p_impressions::integer, impressions\)/i);
  assert.match(learningMigration, /engagements = coalesce\(v_engagements::integer, engagements\)/i);
  assert.match(publicationApi, /action === 'metrics'/);
  assert.match(publicationApi, /masa_note_metrics_record_v1/);
  assert.match(publicationApi, /raw_metrics_too_large/);
});

test('note publication list exposes meaningful funnel outcomes without direct table access', () => {
  assert.match(learningMigration, /create or replace function public\.masa_note_publication_list_v1/i);
  assert.match(learningMigration, /p\.line_registrations/i);
  assert.match(learningMigration, /p\.purchases/i);
  assert.match(learningMigration, /p\.revenue_yen/i);
  assert.match(publicationApi, /masa_note_publication_list_v1/);
  assert.doesNotMatch(publicationApi, /execute_sql|service_role|SUPABASE_SERVICE/);
});

test('aggregate attribution keeps direct clicks separate from first-touch assisted outcomes', () => {
  assert.match(attributionMigration, /create or replace function public\.masa_note_attribution_summary_v1/i);
  assert.match(attributionMigration, /c\.source_campaign = l\.campaign_ref/i);
  assert.match(attributionMigration, /e\.channel = 'line'/i);
  assert.match(attributionMigration, /pu\.status = 'paid'/i);
  assert.match(attributionMigration, /first_touch_paid_customers/i);
  assert.match(attributionMigration, /first_touch_revenue_yen/i);
  assert.match(attributionApi, /direct-click \+ consented-first-touch-assisted/);
  assert.match(attributionApi, /not the same as confirmed friend-add attribution/);
  assert.match(attributionApi, /not proof of a direct conversion/);
  assert.doesNotMatch(attributionApi, /email|line_user_id|external_user_id/i);
});

// Execute real routes against synthetic Worker bindings; no network/credentials.
const { env } = await import('./helpers/worker-runtime.mjs');
const { GET: redirect, HEAD: head } = await import('../src/pages/go/[slug].ts');
const { POST: saveLink } = await import('../src/pages/api/dashboard/note-harness-links.ts');
const { POST: savePublication } = await import('../src/pages/api/dashboard/note-publications.ts');
const fakeEnv = { DASHBOARD_PASSWORD: 'note-harness-test-only', SUPABASE_URL: 'https://db.example.test', SUPABASE_PUBLISHABLE_KEY: 'fixture-only' };
const resolved = { destination_url: 'https://masahiroyamada.com/library?utm_campaign=stale', link_id: 'fixture-link', campaign_ref: 'nh-test', source_channel: 'note', placement: 'article_end' };
function context(body, requestOptions = {}) {
  Object.assign(env, fakeEnv);
  return { locals: {}, params: { slug: 'test-link' }, request: new Request('https://masahiroyamada.com/go/test-link?url=https://evil.example&to=https://evil.example&redirect=https://evil.example&utm_campaign=evil', {
    method: body ? 'POST' : 'GET', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), ...requestOptions,
  }) };
}
function mockRpc(t, result = [resolved], status = 200) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, args: JSON.parse(init.body) });
    return new Response(JSON.stringify(result), { status });
  });
  t.mock.method(console, 'error', () => {});
  return calls;
}

test('runtime ignores query redirect/UTM and uses only saved owned campaign', async (t) => {
  const calls = mockRpc(t);
  const response = await redirect(context());
  assert.equal(response.status, 302);
  const url = new URL(response.headers.get('location'));
  assert.equal(url.origin, 'https://masahiroyamada.com');
  assert.equal(url.searchParams.get('utm_campaign'), 'nh-test');
  assert.equal(url.searchParams.get('utm_medium'), 'tracked_link');
  assert.equal(calls[0].args.p_slug, 'test-link');
  assert.match(calls[0].args.p_owner_key, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(calls[0].args).sort(), ['p_owner_key', 'p_referrer_path', 'p_request_id', 'p_slug', 'p_user_agent_class']);
});

test('external and alternate-port destinations receive no additional attribution', async (t) => {
  for (const destination of ['https://line.me/example?utm_campaign=stored', 'https://masahiroyamada.com:8443/library?x=1']) {
    mockRpc(t, [{ ...resolved, destination_url: destination }]);
    const response = await redirect(context());
    assert.equal(response.headers.get('location'), destination);
  }
});

test('runtime rejects invalid/unsafe destinations and unavailable/paused resolution', async (t) => {
  for (const destination of ['http://evil.example', 'javascript:alert(1)', 'https://user:pass@evil.example', 'https://']) {
    mockRpc(t, [{ ...resolved, destination_url: destination }]);
    assert.equal((await redirect(context())).status, 404);
  }
  mockRpc(t, []);assert.equal((await redirect(context())).status, 404);
  mockRpc(t, { message: 'missing migration' }, 404);
  const failed = await redirect(context());assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('location'), null);
});

test('preview, prefetch, HEAD and bot clients cannot be classified as human', async (t) => {
  for (const options of [
    { headers: { 'User-Agent': 'Mozilla/5.0', 'Sec-Purpose': 'prefetch;prerender' } },
    { headers: { 'User-Agent': 'Mozilla/5.0', Purpose: 'preview' } },
    { headers: { 'User-Agent': 'Twitterbot' } },
    { headers: { 'User-Agent': 'curl/8.0' } },
    { method: 'HEAD' },
  ]) {
    const calls = mockRpc(t);
    assert.equal((await (options.method === 'HEAD' ? head : redirect)(context(null, options))).status, 302);
    assert.equal(calls[0].args.p_user_agent_class, 'bot');
  }
});

test('receipt strips referrer secrets and ignores client identity headers', async (t) => {
  const calls = mockRpc(t);
  await redirect(context(null, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', Referer: 'https://note.com/a/n_b?email=secret#token', 'CF-Ray': '203.0.113.1', 'X-Forwarded-For': '203.0.113.2' } }));
  assert.equal(calls[0].args.p_referrer_path, 'https://note.com/a/n_b');
  assert.equal(calls[0].args.p_user_agent_class, 'mobile');
  assert.match(calls[0].args.p_request_id, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(JSON.stringify(calls[0].args), /203\.0\.113|Mozilla|email=secret|#token/);
});

test('link API validates complete HTTPS URLs and preserves lifecycle/metadata', async (t) => {
  const calls = mockRpc(t, 'fixture-id');
  for (const url of ['https://', 'http://example.test', 'https://u:p@example.test']) {
    assert.equal((await saveLink(context({ slug: 'test-link', destinationUrl: url }))).status, 400);
  }
  assert.equal(calls.length, 0);
  for (const status of ['active', 'paused', 'archived']) {
    const r = await saveLink(context({ slug: 'test-link', destinationUrl: 'https://example.test', status, campaignRef: 'a'.repeat(160), placement: 'article_end' }));
    assert.equal(r.status, 200);
    assert.equal(calls.at(-1).args.p_status, status);
    assert.equal(calls.at(-1).args.p_campaign_ref.length, 120);
    assert.equal(calls.at(-1).args.p_placement, 'article_end');
  }
});

test('note metrics API rejects integer overflow before the RPC', async (t) => {
  const calls = mockRpc(t, 'fixture-id');
  for (const metrics of [{ impressions: 2147483648 }, { likes: 2147483647, comments: 1 }]) {
    const r = await savePublication(context({ action: 'metrics', publicationId: '00000000-0000-4000-8000-000000000001', ...metrics }));
    assert.equal(r.status, 400);
  }
  assert.equal(calls.length, 0);
  const r = await savePublication(context({ action: 'metrics', publicationId: '00000000-0000-4000-8000-000000000001', impressions: 2147483647, views: 3000000000 }));
  assert.equal(r.status, 200);assert.equal(calls[0].args.p_views, 3000000000);
});

test('dashboard offers preserved-link editing and counts shared campaigns once', () => {
  const dashboard = readFileSync(new URL('../src/pages/dashboard/note-harness.astro', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
  assert.match(dashboard, /links\.map/);
  assert.match(dashboard, /data-edit-link/);
  assert.match(dashboard, /campaignRows = \[\.\.\.new Map/);
  assert.match(dashboard, /totalRevenue = campaignSum/);
  assert.doesNotMatch(dashboard, /<small>\{loadError\}<\/small>/);
  assert.match(layout, /href: '\/dashboard\/note-harness'/);
});
