import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarReady, suggestBookingCandidates } from '../src/lib/smartBooking.ts';

const now = '2026-10-14T08:00:00+09:00';
const sync = {
  synced_at: now,
  source_synced_at: now,
  window_start: '2026-10-14T00:00:00+09:00',
  window_end: '2026-11-01T00:00:00+09:00',
};
const input = {
  now, sync, events: [], mode: 'online',
  clientArea: 'kunitachi', days: 7, maxResults: 120,
};
const ms = (time) => new Date(time).getTime();

test('unverified or stale calendar never returns publicly sellable slots', () => {
  for (const badSync of [null, { ...sync, source_synced_at: '2026-10-13T06:00:00+09:00' }, { ...sync, window_end: '2026-10-15T00:00:00+09:00' }]) {
    const out = suggestBookingCandidates({ ...input, sync: badSync });
    assert.deepEqual(out.candidates, []);
    assert.equal(out.reason, 'calendar_not_fresh_or_incomplete');
  }
  assert.equal(calendarReady(sync, ms('2026-10-14T00:00:00+09:00'), ms('2026-10-21T00:00:00+09:00'), ms(now)), true);
});

test('events and protective setup buffers exclude conflicting candidates', () => {
  const events = [{
    start_at: '2026-10-15T11:00:00+09:00',
    end_at: '2026-10-15T13:00:00+09:00',
    location: 'private event',
  }];
  const out = suggestBookingCandidates({ ...input, events });
  assert.equal(out.reason, null);
  assert.ok(out.candidates.length > 0);
  for (const item of out.candidates) {
    assert.equal(item.status, 'needs_review');
    assert.ok(!(ms(item.startsAt) < ms(events[0].end_at) + 20 * 60_000
      && ms(item.endsAt) > ms(events[0].start_at) - 20 * 60_000));
  }
});

test('full-day blocks prevent selling any slots for that date', () => {
  const out = suggestBookingCandidates({
    ...input,
    events: [{ start_at: '2026-10-16T00:00:00+09:00', end_at: '2026-10-17T00:00:00+09:00', all_day: true }],
  });
  assert.ok(out.candidates.every(item => item.day !== '2026-10-16'));
});

test('client area influences location priority without fabricating venue availability', () => {
  const out = suggestBookingCandidates({ ...input, mode: 'premium', clientArea: 'shinjuku', maxResults: 10 });
  assert.ok(out.candidates.length > 0);
  assert.equal(out.candidates[0].locationId, 'hotel-shinjuku');
  assert.ok(out.candidates[0].checks.some(x => x.includes('会場')));
  assert.ok(out.candidates.every(x => x.status === 'needs_review'));
});

test('missing travel evidence is flagged, not converted to a guessed route', () => {
  const out = suggestBookingCandidates({
    ...input,
    events: [{
      start_at: '2026-10-15T08:00:00+09:00',
      end_at: '2026-10-15T09:00:00+09:00',
      areaKey: 'shinjuku',
    }],
  });
  const firstDay = out.candidates.find(x => x.day === '2026-10-15' && x.startsAt === '2026-10-15T01:00:00.000Z');
  assert.ok(firstDay);
  assert.equal(firstDay.estimatedTravelMinutes, null);
  assert.ok(firstDay.checks.some(x => x.includes('移動時間')));
});

test('verified transit duration removes physically impossible transitions', () => {
  const out = suggestBookingCandidates({
    ...input, mode: 'in_person', clientArea: 'kunitachi',
    events: [{
      start_at: '2026-10-15T08:00:00+09:00',
      end_at: '2026-10-15T09:30:00+09:00',
      areaKey: 'shinjuku',
    }],
    travelMinutes: (from, to) => from === 'shinjuku' && to === 'kunitachi' ? 70 : null,
  });
  assert.ok(!out.candidates.some(x => x.day === '2026-10-15' && x.locationId === 'meeting-kunitachi' && x.startsAt === '2026-10-15T01:00:00.000Z'));
  assert.ok(out.candidates.some(x => x.day === '2026-10-15' && x.locationId === 'meeting-kunitachi' && x.startsAt === '2026-10-15T02:00:00.000Z'));
});

test('malformed upstream event blocks results rather than silently allowing availability', () => {
  const out = suggestBookingCandidates({ ...input, events: [{ start_at: 'bad-date', end_at: 'bad-date' }] });
  assert.deepEqual(out.candidates, []);
  assert.equal(out.reason, 'invalid_calendar_events');
});
