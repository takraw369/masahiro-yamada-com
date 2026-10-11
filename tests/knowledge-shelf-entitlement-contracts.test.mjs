import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sqlPath = 'migrations/20261011_knowledge_shelf_private_entitlement_gate.sql';
const routePath = 'src/pages/api/library/content/[slug].ts';

test('no public browser can query the private Knowledge Shelf source table', async () => {
  const sql = await read(sqlPath);
  assert.match(sql, /create table if not exists public\.knowledge_shelf_protected_assets/);
  assert.match(sql, /publication_status text not null default 'draft'/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.knowledge_shelf_protected_assets from public, anon, authenticated/);
  assert.doesNotMatch(sql, /create policy/i);
});

test('only live assets can be returned, with JWT identity instead of a caller-provided user', async () => {
  const sql = await read(sqlPath);
  assert.match(sql, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(sql, /publication_status = 'live'/);
  assert.match(sql, /where c\.auth_user_id = v_user_id/);
  assert.match(sql, /pe\.status = 'active'/);
  assert.match(sql, /pe\.revoked_at is null/);
  assert.match(sql, /pe\.expires_at is null or pe\.expires_at > now\(\)/);
  assert.match(sql, /ed\.status = 'active'/);
  assert.match(sql, /knowledge_shelf_item/);
  assert.match(sql, /knowledge_shelf_tier/);
  assert.match(sql, /p\.status = 'paid'/);
});

test('private RPC refuses anonymous role; signed-in readers cannot read table directly', async () => {
  const sql = await read(sqlPath);
  assert.match(sql, /revoke all on function public\.knowledge_shelf_content_read_v1\(text\) from public, anon/);
  assert.match(sql, /grant execute on function public\.knowledge_shelf_content_read_v1\(text\) to authenticated, service_role/);
});

test('content route requires bearer token and forwards it for Supabase JWT validation', async () => {
  const api = await read(routePath);
  assert.ok(api.includes('const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);'));
  assert.match(api, /Authorization: `Bearer \$\{match\[1\]\}`/);
  assert.match(api, /rpc\/knowledge_shelf_content_read_v1/);
  assert.doesNotMatch(api, /request\.json\(\)/);
  assert.doesNotMatch(api, /p_contact_id|p_email|p_visitor_id/);
});

test('paid content is never publicly cacheable', async () => {
  const api = await read(routePath);
  assert.match(api, /private, no-store/);
  assert.match(api, /Vary': 'Authorization'/);
  assert.match(api, /membership_required/);
  assert.match(api, /temporarily_unavailable/);
});

test('public catalog remains preview-only until separate human approval', async () => {
  const catalog = await read('src/lib/libraryCatalog.ts');
  assert.match(catalog, /status: 'preview'/);
  const detail = await read('src/pages/library/[slug].astro');
  assert.match(detail, /item\.status === 'live' && Boolean\(item\.checkoutUrl\)/);
});


test('verified-email claim links only an existing unique and email-confirmed Contact', async () => {
  const sql = await read('migrations/20261011_knowledge_shelf_verified_email_claim_v1.sql');
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /auth\.users/);
  assert.match(sql, /email_confirmed_at is not null/);
  assert.match(sql, /v_matches <> 1/);
  assert.match(sql, /v_linked_uid <> v_uid/);
  assert.match(sql, /auth_user_id = v_uid/);
  assert.doesNotMatch(sql, /insert into public\.contacts|insert into public\.person_entitlements/i);
  assert.match(sql, /revoke all on function public\.knowledge_shelf_claim_verified_email_v1\(\) from public, anon/);
  assert.match(sql, /grant execute on function public\.knowledge_shelf_claim_verified_email_v1\(\) to authenticated, service_role/);
});

test('buyer portal has passwordless verified-code login and no dashboard secret dependency', async () => {
  const portal = await read('src/pages/library/account.astro');
  const config = await read('src/pages/api/library/auth/config.ts');
  for (const expected of ['auth/v1/', "'otp'", "'verify'", "'email'", 'create_user: true',
    'knowledge_shelf_claim_verified_email_v1', '/api/library/content/', 'logout', 'sessionStorage']) {
    assert.ok(portal.includes(expected), `missing buyer auth flow step: ${expected}`);
  }
  assert.match(portal, /textContent/);
  assert.match(portal, /createTextNode|markdownAsText/);
  assert.doesNotMatch(portal, /innerHTML|DASHBOARD_PASSWORD|service_role/);
  assert.match(config, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(config, /SUPABASE_SERVICE_ROLE|DASHBOARD_PASSWORD/);
});

test('buyer portal never leaks premium text into public static HTML or enables checkout', async () => {
  const portal = await read('src/pages/library/account.astro');
  const catalog = await read('src/lib/libraryCatalog.ts');
  assert.match(portal, /PREVIEW \/ ACCESS TEST/);
  assert.match(portal, /cache: 'no-store'/);
  assert.doesNotMatch(portal, /body_markdown\s*:\s*['`]/);
  assert.match(catalog, /status: 'preview'/);
});


test('buyer-only route is not misclassified as an asset and completed purchase events are server-only', async () => {
  const client = await read('src/lib/knowledgeJourneyClient.ts');
  const endpoint = await read('src/pages/api/library/journey.ts');
  const account = await read('src/pages/library/account.astro');
  assert.match(client, /path === '\/library\/account'/);
  assert.match(client, /assetSlugOverride/);
  assert.match(account, /trackKnowledgeJourney\('ks_item_view'/);
  assert.doesNotMatch(endpoint, /^\s*'ks_purchase',/m);
  assert.match(endpoint, /verified payment webhook/);
});
