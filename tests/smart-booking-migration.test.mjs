import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../migrations/20261014_smart_booking_holds.sql', import.meta.url), 'utf8');

test('new reservations are private and cannot be inserted by browser roles', () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.ace_booking_holds from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on public\.ace_booking_holds to service_role/i);
});
test('holds exclude overlapping times and have explicit expiry and paid states', () => {
  assert.match(sql, /constraint ace_booking_no_overlap exclude using gist/i);
  assert.match(sql, /tsrange\(\(start_at at time zone 'UTC'\) - interval '20 minutes'/i);
  assert.match(sql, /expires_at timestamptz not null default \(now\(\) \+ interval '35 minutes'\)/i);
  assert.match(sql, /ace_booking_hold_create_v1/i);
  assert.match(sql, /ace_booking_attach_checkout_v1/i);
  assert.match(sql, /ace_booking_paid_v1/i);
  assert.match(sql, /ace_booking_confirm_v1/i);
  assert.match(sql, /ace_booking_review_v1/i);
});
