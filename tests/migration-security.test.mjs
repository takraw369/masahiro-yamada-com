import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const siteStorage = readFileSync(new URL('../src/lib/siteStorage.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../migrations/20260908_trinity_funnel_import_owner_gate.sql', import.meta.url),
  'utf8',
);
const calendarMigration = readFileSync(
  new URL('../migrations/20260908_calendar_owner_gate_v2.sql', import.meta.url),
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

test('calendar snapshot v2 uses registered owner capability and defense-in-depth RLS', () => {
  assert.match(calendarMigration, /alter table public\.masa_calendar_events enable row level security;/i);
  assert.match(calendarMigration, /alter table public\.masa_calendar_sync_state enable row level security;/i);
  assert.match(calendarMigration, /create or replace function public\.masa_calendar_snapshot_replace_v2/i);
  assert.match(calendarMigration, /create or replace function public\.masa_calendar_snapshot_get_v2/i);
  assert.match(calendarMigration, /create or replace function public\.masa_calendar_sync_status_v2/i);

  const ownerChecks = calendarMigration.match(/from private\.masa_dashboard_owner_keys/g) || [];
  assert.ok(ownerChecks.length >= 3, 'every Calendar v2 RPC must check the registered owner allowlist');
  assert.match(calendarMigration, /where k\.owner_key = p_owner_key/i);
});

test('calendar replacement is bounded, serialized, and freshness ordered', () => {
  assert.match(calendarMigration, /jsonb_array_length\(p_events\) > 500/i);
  assert.match(calendarMigration, /pg_column_size\(p_events\) > 2097152/i);
  assert.match(calendarMigration, /duplicate_or_missing_event_id/i);
  assert.match(calendarMigration, /invalid_all_day/i);
  assert.match(calendarMigration, /event_outside_window/i);
  assert.match(calendarMigration, /pg_advisory_xact_lock\(hashtextextended\(p_owner_key, 0\)\)/i);
  assert.match(calendarMigration, /p_source_synced_at <= v_last_source_synced_at/i);
  assert.match(calendarMigration, /stale_calendar_snapshot/i);
});

test('ungated Calendar v1 RPCs lose public API execution paths', () => {
  for (const name of [
    'masa_calendar_snapshot_replace_v1',
    'masa_calendar_snapshot_get_v1',
    'masa_calendar_sync_status_v1',
  ]) {
    assert.match(
      calendarMigration,
      new RegExp(`revoke execute on function public\\.${name}\\([\\s\\S]*?\\)\\s+from public, anon, authenticated;`, 'i'),
    );
  }

  assert.match(
    calendarMigration,
    /grant execute on function public\.masa_calendar_snapshot_replace_v2\([\s\S]*?\)\s+to anon, authenticated, service_role;/i,
  );
  assert.match(
    calendarMigration,
    /grant execute on function public\.masa_calendar_snapshot_get_v2\([\s\S]*?\)\s+to anon, authenticated, service_role;/i,
  );
  assert.match(
    calendarMigration,
    /grant execute on function public\.masa_calendar_sync_status_v2\([\s\S]*?\)\s+to anon, authenticated, service_role;/i,
  );
});
