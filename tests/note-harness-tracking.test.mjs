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
const route = readFileSync(new URL('../src/pages/go/[slug].ts', import.meta.url), 'utf8');
const adminApi = readFileSync(
  new URL('../src/pages/api/dashboard/note-harness-links.ts', import.meta.url),
  'utf8',
);
const publicationApi = readFileSync(
  new URL('../src/pages/api/dashboard/note-publications.ts', import.meta.url),
  'utf8',
);

test('tracked link tables are private and public access is resolver-RPC only', () => {
  assert.match(migration, /alter table public\.tracked_links enable row level security;/i);
  assert.match(migration, /alter table public\.tracked_link_clicks enable row level security;/i);
  assert.match(migration, /revoke all on table public\.tracked_links from public, anon, authenticated;/i);
  assert.match(migration, /revoke all on table public\.tracked_link_clicks from public, anon, authenticated;/i);
  assert.match(migration, /create or replace function public\.resolve_tracked_link_v1/i);
  assert.match(migration, /security definer[\s\S]*?set search_path = public/i);
  assert.match(migration, /grant execute on function public\.resolve_tracked_link_v1\(text,text,text,text\) to anon, authenticated;/i);
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
  assert.match(migration, /v_inserted > 0 and v_ua_class <> 'bot'/i);
  assert.match(migration, /'publication_id', v_link\.publication_id/i);
  assert.match(migration, /'asset_id', v_link\.asset_id/i);
  assert.match(learningMigration, /tracked_link_click_sync_publication_v1/i);
  assert.match(learningMigration, /clicks = coalesce\(clicks, 0\) \+ 1/i);
  assert.match(learningMigration, /coalesce\(new\.user_agent_class, 'unknown'\) <> 'bot'/i);
});

test('public redirect is fail-closed and non-cacheable', () => {
  assert.match(route, /\^\[a-z0-9\]\[a-z0-9-\]/i);
  assert.match(route, /return notFound\(\)/);
  assert.match(route, /'Cache-Control': 'no-store, max-age=0'/);
  assert.match(route, /status: 503/);
  assert.match(route, /'X-Robots-Tag': 'noindex, nofollow'/);
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
  assert.match(publicationApi, /\^https:\\/\\/note\\\.com\\\//i);
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
