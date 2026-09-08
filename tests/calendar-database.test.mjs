import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// Disposable embedded PostgreSQL. Never connects to Supabase or reads credentials.
// Exercises actual PL/pgSQL/ACL/RLS. Multi-connection contention is not simulated.
test('Calendar migration enforces owner capabilities, ACLs, atomicity and freshness', async () => {
  const db = new PGlite();
  const owner = 'a'.repeat(64), foreign = 'b'.repeat(64);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private;
      create table private.masa_dashboard_owner_keys(owner_key text primary key);
      insert into private.masa_dashboard_owner_keys values ('${owner}');`);
    for (const file of ['20260906_calendar_snapshot.sql', '20260908_calendar_owner_gate_v2.sql']) {
      await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
    const { rows: tables } = await db.query("select relrowsecurity from pg_class where relname in ('masa_calendar_events','masa_calendar_sync_state')");
    assert.equal(tables.length, 2);
    assert.ok(tables.every(row => row.relrowsecurity));
    const now = Date.now(), from = new Date(now - 86400000).toISOString(), to = new Date(now + 86400000).toISOString();
    const timestamp = (offset) => new Date(now + offset).toISOString();
    const event = { event_id: 'recurring-series|first-occurrence', title: 'test', start_at: timestamp(1000), end_at: timestamp(2000), all_day: false };
    const replace = (events, offset = 0, key = owner) => db.query('select public.masa_calendar_snapshot_replace_v2($1,$2::jsonb,$3,$4,$5) as count', [key, JSON.stringify(events), from, to, timestamp(offset)]);
    const read = (key = owner) => db.query('select * from public.masa_calendar_snapshot_get_v2($1,$2,$3)', [key, from, to]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of ['masa_calendar_events', 'masa_calendar_sync_state']) {
        await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
      }
      const { rows: acl } = await db.query("select proname, has_function_privilege(current_user, oid, 'EXECUTE') as allowed from pg_proc where proname in ('masa_calendar_snapshot_get_v1', 'masa_calendar_snapshot_replace_v1', 'masa_calendar_sync_status_v1')");
      assert.equal(acl.length, 3);
      assert.ok(acl.every(row => !row.allowed));
      await assert.rejects(db.query('select public.masa_calendar_sync_status_v1($1)', [owner]), /permission denied/);
      await assert.rejects(read(foreign), /dashboard_owner_required/);
      await assert.rejects(db.query('select public.masa_calendar_sync_status_v2($1)', [foreign]), /dashboard_owner_required/);
      await assert.rejects(replace([], 0, foreign), /dashboard_owner_required/);
      assert.equal((await read()).rows.length, 0);
      await db.exec('reset role');
    }
    await db.exec('set role anon');
    assert.equal((await replace([event])).rows[0].count, 1);
    assert.equal((await read()).rows[0].event_id, event.event_id);
    await assert.rejects(replace([], 0), /stale_calendar_snapshot/);
    await assert.rejects(replace([], -1000), /stale_calendar_snapshot/);
    for (const [events, error] of [
      [[event, event], /duplicate_or_missing_event_id/],
      [[null], /invalid_event_shape/],
      [[{ ...event, all_day: 'false' }], /invalid_all_day/],
      [[{ ...event, end_at: event.start_at }], /invalid_event_range/],
      [[{ ...event, start_at: null }], /invalid_event_range/],
      [[{ ...event, start_at: 'not-a-date' }], /invalid_event_time/],
      [[{ ...event, start_at: timestamp(172800000), end_at: timestamp(172801000) }], /event_outside_window/],
    ]) {
      await assert.rejects(replace(events, 1000), error);
      assert.equal((await read()).rows[0].event_id, event.event_id, 'failed replacement preserves the previous snapshot');
    }
    const secondOccurrence = { ...event, event_id: 'recurring-series|second-occurrence', start_at: timestamp(3000), end_at: timestamp(4000) };
    assert.equal((await replace([event, secondOccurrence], 1000)).rows[0].count, 2);
    assert.equal((await replace([], 2000)).rows[0].count, 0);
    assert.equal((await read()).rows.length, 0, 'newer empty snapshot removes canceled events');
  } finally {
    await db.close();
  }
});
