import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../migrations/20261005_note_harness_tracked_links.sql', import.meta.url),
  'utf8',
);
const route = readFileSync(new URL('../src/pages/go/[slug].ts', import.meta.url), 'utf8');

test('tracked link tables are private and public access is RPC-only', () => {
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
  assert.match(route, /return `\$\{parsed\.origin\}\$\{parsed\.pathname\}`\.slice\(0, 500\)/);
  assert.doesNotMatch(route, /parsed\.search/);
  assert.doesNotMatch(route, /parsed\.hash/);
});

test('tracked clicks join the existing funnel learning spine', () => {
  assert.match(migration, /insert into public\.funnel_events/i);
  assert.match(migration, /'tracked_link_click'/i);
  assert.match(migration, /'publication_id', v_link\.publication_id/i);
  assert.match(migration, /'asset_id', v_link\.asset_id/i);
});

test('public redirect is fail-closed and non-cacheable', () => {
  assert.match(route, /if \(!\/\^\[a-z0-9\]/i);
  assert.match(route, /return notFound\(\)/);
  assert.match(route, /'Cache-Control': 'no-store, max-age=0'/);
  assert.match(route, /status: 503/);
  assert.match(route, /'X-Robots-Tag': 'noindex, nofollow'/);
});
