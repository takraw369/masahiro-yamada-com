import type { APIContext } from 'astro';
import { getSiteStorageEnv } from '../../../lib/siteStorage';
import { getLiveBusy, slotIsFree } from '../../../lib/smartBookingIntegrations';
import {
  bookingEnabled, bookingDb, createVerifiedStripeCheckout, readBooking, validJstSession,
  verifyHuman, type BookingPaymentEnv,
} from '../../../lib/smartBookingPayments';

function json(value: object, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals) as BookingPaymentEnv;
  if (!bookingEnabled(env)) return json({ ok: false, error: 'booking_not_activated' }, 503);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ ok: false, error: 'invalid_content_type' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 4000) return json({ ok: false, error: 'payload_too_large' }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4000) return json({ ok: false, error: 'payload_too_large' }, 413);
    body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
  } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const start = typeof body.start === 'string' ? body.start : '';
  const end = typeof body.end === 'string' ? body.end : '';
  const requestKey = typeof body.requestKey === 'string' ? body.requestKey : '';
  const turnstile = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  const clientArea = typeof body.clientArea === 'string' ? body.clientArea : '';
  if (!validJstSession(start, end) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey)
      || !['kunitachi','tachikawa','shinjuku','yokohama','other'].includes(clientArea)) {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }
  const human = await verifyHuman(turnstile, env.BOOKING_TURNSTILE_SECRET || '', request.headers.get('cf-connecting-ip'));
  if (!human) return json({ ok: false, error: 'anti_bot_verification_failed' }, 403);
  try {
    // Client never chooses the price or unverified hotel/venue. Online only initially.
    const prior = await readBookingByRequestKey(env, requestKey);
    if (prior) return json({ ok: false, error: 'request_key_already_used', bookingState: prior.state }, 409);
    const snap = await getLiveBusy(env,
      new Date(Date.parse(start) - 20 * 60000).toISOString(),
      new Date(Date.parse(end) + 20 * 60000).toISOString());
    if (!slotIsFree(snap.busy, start, end, 20)) return json({ ok: false, error: 'slot_no_longer_available' }, 409);

    const hold = await bookingDb<{ id?: string; state?: string; error?: string }>(env, 'ace_booking_hold_create_v1', {
      p_request_key: requestKey, p_start_at: start, p_end_at: end,
      p_mode: 'online', p_location_id: 'online-private', p_client_area: clientArea,
    });
    if (!hold.id || hold.error) return json({ ok: false, error: 'slot_unavailable' }, 409);
    if (hold.state !== 'held') return json({ ok: false, error: 'request_not_active' }, 409);
    // Recheck busy windows immediately before opening payment.
    const again = await getLiveBusy(env,
      new Date(Date.parse(start) - 20 * 60000).toISOString(),
      new Date(Date.parse(end) + 20 * 60000).toISOString());
    if (!slotIsFree(again.busy, start, end, 20)) return json({ ok: false, error: 'slot_changed_before_checkout' }, 409);
    const session = await createVerifiedStripeCheckout(env, hold.id, requestKey);
    const attached = await bookingDb<{ id?: string; error?: string }>(env, 'ace_booking_attach_checkout_v1', {
      p_booking_id: hold.id, p_stripe_session_id: session.sessionId,
    });
    if (attached.error) return json({ ok: false, error: 'checkout_hold_mismatch' }, 409);
    // Stripe-hosted payment only; redirect from the browser after a successful hold.
    return json({ ok: true, checkoutUrl: session.url });
  } catch {
    return json({ ok: false, error: 'booking_temporarily_unavailable' }, 503);
  }
};

/** No replays; a new Turnstile + UUID is required if a checkout is interrupted. */
async function readBookingByRequestKey(env: BookingPaymentEnv, requestKey: string) {
  if (!env.SUPABASE_URL || !env.BOOKING_SUPABASE_SERVICE_KEY) return null;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/ace_booking_holds?request_key=eq.' + encodeURIComponent(requestKey) + '&select=id,state&limit=1', {
    headers: { apikey: env.BOOKING_SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.BOOKING_SUPABASE_SERVICE_KEY },
  });
  if (!response.ok) throw new Error('booking_db_unavailable');
  const rows: unknown = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] as { id: string; state: string } : null;
}
