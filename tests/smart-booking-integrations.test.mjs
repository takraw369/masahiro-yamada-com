import assert from 'node:assert/strict';
import test from 'node:test';
import { getLiveBusy, getTransitEstimate, slotIsFree, validateWindow, stationForArea } from '../src/lib/smartBookingIntegrations.ts';
import { bookingEnabled, validJstSession, createVerifiedStripeCheckout } from '../src/lib/smartBookingPayments.ts';

const now = '2026-10-14T07:00:00+09:00';
const begin = '2026-10-16T10:00:00+09:00';
const end = '2026-10-16T11:30:00+09:00';
const googleEnv = {
  BOOKING_GOOGLE_CALENDAR_IDS: 'primary,family,coaching',
  BOOKING_GOOGLE_CLIENT_ID: 'test-client',
  BOOKING_GOOGLE_CLIENT_SECRET: 'test-only-secret',
  BOOKING_GOOGLE_REFRESH_TOKEN: 'test-only-refresh',
};

test('Calendar query fails closed when calendars or OAuth are not configured', async () => {
  await assert.rejects(() => getLiveBusy({}, begin, end, { now: () => new Date(now) }), /booking_calendars_not_verified/);
  await assert.rejects(() => getLiveBusy({ BOOKING_GOOGLE_CALENDAR_IDS: 'primary' }, begin, end, { now: () => new Date(now) }), /google_calendar_oauth_unconfigured/);
  assert.throws(() => validateWindow('nonsense', end), /invalid_calendar_window/);
});

test('Calendar includes all configured busy intervals but never exposes event titles', async () => {
  let calls = 0;
  const http = async (url, init) => {
    calls++;
    if (url.includes('oauth2')) return Response.json({ access_token: 'test-access' });
    assert.equal(init.method, 'POST');
    const params = JSON.parse(init.body);
    assert.deepEqual(params.items.map(x => x.id), ['primary','family','coaching']);
    return Response.json({ calendars: {
      primary: { busy: [{ start: '2026-10-16T10:00:00+09:00', end: '2026-10-16T11:00:00+09:00' }] },
      family: { busy: [{ start: '2026-10-16T17:00:00+09:00', end: '2026-10-16T18:00:00+09:00' }] },
      coaching: { busy: [] },
    } });
  };
  const result = await getLiveBusy(googleEnv, begin, end, { http, now: () => new Date(now) });
  assert.equal(calls, 2);
  assert.equal(result.calendarCount, 3);
  assert.equal(result.busy.length, 2);
  assert.equal('title' in result.busy[0], false);
  assert.equal(slotIsFree(result.busy, begin, end), false);
});

test('partial FreeBusy errors block availability even when other calendars work', async () => {
  const http = async url => url.includes('oauth2') ? Response.json({ access_token: 'token' }) : Response.json({
    calendars: { primary: { busy: [] }, family: { busy: [], errors: [{ reason: 'notFound' }] }, coaching: { busy: [] } },
  });
  await assert.rejects(() => getLiveBusy(googleEnv, begin, end, { http, now: () => new Date(now) }), /google_calendar_incomplete/);
});

test('occupied slots and 20-minute buffers cannot be offered', () => {
  const busy = [{ start: '2026-10-16T09:30:00+09:00', end: '2026-10-16T10:00:00+09:00' }];
  assert.equal(slotIsFree(busy, begin, end, 20), false);
  assert.equal(slotIsFree(busy, '2026-10-16T10:20:00+09:00', '2026-10-16T11:50:00+09:00', 20), true);
  assert.equal(slotIsFree([{ start: 'invalid', end }], begin, end), false);
});

test('Routes adapter never fabricates a transit time', async () => {
  assert.equal(stationForArea('unrecognized'), null);
  assert.equal(await getTransitEstimate({}, 'shinjuku', 'kunitachi', begin, { now: () => new Date(now) }), null);
  const http = async (_url, opts) => {
    assert.equal(opts.headers['X-Goog-FieldMask'], 'originIndex,destinationIndex,status,condition,duration');
    assert.equal(JSON.parse(opts.body).travelMode, 'TRANSIT');
    return Response.json([{ originIndex: 0, destinationIndex: 0, condition: 'ROUTE_EXISTS', duration: '3840s', status: {} }]);
  };
  const result = await getTransitEstimate({ BOOKING_MAPS_ROUTES_KEY: 'test-only-key' }, 'shinjuku', 'kunitachi', begin, { http, now: () => new Date(now) });
  assert.equal(result.durationMinutes, 64);
});

test('checkout requires configured verified account and existing ¥19800 one-time Stripe price', async () => {
  assert.equal(bookingEnabled({}), false);
  assert.equal(validJstSession(begin, end, new Date(now)), true);
  assert.equal(validJstSession(begin, '2026-10-16T11:00:00+09:00', new Date(now)), false);
  const env = { BOOKING_STRIPE_SECRET_KEY: 'test-only', BOOKING_STRIPE_ACCOUNT_ID: 'acct_verified', BOOKING_STRIPE_PRICE_ID: 'price_abc' };
  const http = async (url, opts) => {
    if (url.endsWith('/v1/account')) return Response.json({ id: 'acct_other' });
    throw new Error('must_not_create_charge');
  };
  await assert.rejects(() => createVerifiedStripeCheckout(env,'550e8400-e29b-41d4-a716-446655440000','request',http), /stripe_account_mismatch/);
});
