import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const siteStorage = readFileSync(new URL('../src/lib/siteStorage.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../migrations/20260908_trinity_funnel_import_owner_gate.sql', import.meta.url),
  'utf8',
);

test('legacy D1 funnel import uses the registered-owner v2 RPC', () => {
  assert.match(siteStorage, /'trinity_funnel_event_import_v2'/);
  assert.match(siteStorage, /p_owner_key:\s*ownerKey/);
  assert.doesNotMatch(siteStorage, /'trinity_funnel_event_import'\s*,/);

  assert.match(migration, /create or replace function public\.trinity_funnel_event_import_v2/i);
  assert.match(migration, /from private\.masa_dashboard_owner_keys/i);
  assert.match(migration, /where k\.owner_key = p_owner_key/i);
  assert.match(migration, /'owner_key',\s*p_owner_key/i);
});

test('ungated legacy import RPC loses every public API execution path', () => {
  assert.match(
    migration,
    /revoke execute on function public\.trinity_funnel_event_import\([\s\S]*?\) from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.trinity_funnel_event_import_v2\([\s\S]*?\) from public;/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.trinity_funnel_event_import_v2\([\s\S]*?\) to anon, authenticated, service_role;/i,
  );
});
