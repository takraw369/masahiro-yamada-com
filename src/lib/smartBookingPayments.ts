/**
 * Server-only booking payment support. No new Stripe product or Payment Link.
 * Cannot run without explicitly configured verified Stripe account/price and
 * server-side Supabase service key. Never import this module in client code.
 */
import type { BookingConnections } from './smartBookingIntegrations';
export interface BookingPaymentEnv extends BookingConnections {
  SUPABASE_URL?: string;
  BOOKING_SUPABASE_SERVICE_KEY?: string;
  BOOKING_STRIPE_SECRET_KEY?: string;
  BOOKING_STRIPE_ACCOUNT_ID?: string;
  BOOKING_STRIPE_PRICE_ID?: string;
  BOOKING_STRIPE_WEBHOOK_SECRET?: string;
  /** Must remain off until the signed webhook is installed and test-delivered. */
  BOOKING_PAYMENT_WEBHOOK_READY?: string;
  BOOKING_PUBLIC_ENABLED?: string;
  BOOKING_ONLINE_VENUE_CONFIRMED?: string;
  BOOKING_ONLINE_VENUE_AREA?: string;
  BOOKING_TURNSTILE_SECRET?: string;
  BOOKING_CONFIRM_CALENDAR_ID?: string;
}
type Http = typeof fetch;
export type BookingRecord = {
  id: string;
  request_key: string;
  start_at: string;
  end_at: string;
  state: string;
  mode: string;
  location_id: string;
  client_area: string;
  expires_at: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  calendar_event_id: string | null;
};

export function bookingEnabled(env: BookingPaymentEnv): boolean {
  return env.BOOKING_PUBLIC_ENABLED === 'true'
    && env.BOOKING_PAYMENT_WEBHOOK_READY === 'true'
    && env.BOOKING_ONLINE_VENUE_CONFIRMED === 'true'
    && ['kunitachi','tachikawa','shinjuku','yokohama'].includes(env.BOOKING_ONLINE_VENUE_AREA || '')
    && Boolean(env.BOOKING_TURNSTILE_SECRET && env.BOOKING_GOOGLE_CALENDAR_IDS
      && env.BOOKING_GOOGLE_REFRESH_TOKEN && env.BOOKING_GOOGLE_CLIENT_ID && env.BOOKING_GOOGLE_CLIENT_SECRET
      && env.BOOKING_MAPS_ROUTES_KEY
      && env.BOOKING_SUPABASE_SERVICE_KEY && env.SUPABASE_URL
      && env.BOOKING_STRIPE_SECRET_KEY && env.BOOKING_STRIPE_ACCOUNT_ID
      && env.BOOKING_STRIPE_PRICE_ID && env.BOOKING_STRIPE_WEBHOOK_SECRET
      && env.BOOKING_CONFIRM_CALENDAR_ID);
}
export async function bookingDb<T>(env: BookingPaymentEnv, action: string, input: Record<string, unknown>, http: Http = fetch): Promise<T> {
  const whitelist = new Set([
    'ace_booking_hold_create_v1', 'ace_booking_attach_checkout_v1',
    'ace_booking_paid_v1', 'ace_booking_confirm_v1', 'ace_booking_review_v1',
  ]);
  if (!whitelist.has(action)) throw new Error('booking_db_action_denied');
  if (!env.SUPABASE_URL || !env.BOOKING_SUPABASE_SERVICE_KEY) throw new Error('booking_db_not_configured');
  const response = await http(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + action, {
    method: 'POST',
    headers: {
      apikey: env.BOOKING_SUPABASE_SERVICE_KEY,
      authorization: 'Bearer ' + env.BOOKING_SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('booking_db_unavailable');
  return await response.json() as T;
}
export async function readBooking(env: BookingPaymentEnv, id: string, http: Http = fetch): Promise<BookingRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !env.SUPABASE_URL || !env.BOOKING_SUPABASE_SERVICE_KEY) return null;
  const response = await http(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/ace_booking_holds?id=eq.' + encodeURIComponent(id) + '&select=*', {
    headers: { apikey: env.BOOKING_SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.BOOKING_SUPABASE_SERVICE_KEY },
  });
  if (!response.ok) throw new Error('booking_db_unavailable');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('booking_db_invalid_response');
  return rows.length === 1 ? rows[0] as BookingRecord : null;
}
export async function verifyHuman(token: string, secret: string, ip: string | null, http: Http = fetch): Promise<boolean> {
  if (!token || token.length > 2048 || !secret) return false;
  const response = await http('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  if (!response.ok) return false;
  const result: unknown = await response.json();
  return Boolean(result && typeof result === 'object' && 'success' in result && result.success === true);
}
export function validJstSession(start: string, end: string, now = new Date()): boolean {
  const a = Date.parse(start), b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b - a !== 90 * 60000 || a < now.getTime() + 24 * 3600000 || a > now.getTime() + 14 * 86400000) return false;
  const localStart = new Date(a + 9 * 3600000);
  const localEnd = new Date(b + 9 * 3600000);
  const hour = localStart.getUTCHours(), minute = localStart.getUTCMinutes();
  return localStart.toISOString().slice(0, 10) === localEnd.toISOString().slice(0, 10)
    && (minute === 0 || minute === 30) && hour >= 10
    && localEnd.getUTCHours() <= 18 && (localEnd.getUTCHours() !== 18 || localEnd.getUTCMinutes() === 0);
}
async function stripeFetch(env: BookingPaymentEnv, path: string, http: Http, init: RequestInit = {}) {
  if (!env.BOOKING_STRIPE_SECRET_KEY || !path.startsWith('/v1/')) throw new Error('stripe_unconfigured');
  return http('https://api.stripe.com' + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + env.BOOKING_STRIPE_SECRET_KEY,
      ...init.headers },
  });
}
export async function createVerifiedStripeCheckout(
  env: BookingPaymentEnv, bookingId: string, requestKey: string, http: Http = fetch,
): Promise<{ sessionId: string; url: string }> {
  if (!env.BOOKING_STRIPE_ACCOUNT_ID || !env.BOOKING_STRIPE_PRICE_ID || !/^[0-9a-f-]{36}$/i.test(bookingId)) throw new Error('stripe_not_verified');
  // Prevent silently using the unrelated connected Stripe account.
  const accountResult = await stripeFetch(env, '/v1/account', http);
  if (!accountResult.ok) throw new Error('stripe_account_unavailable');
  const account: unknown = await accountResult.json();
  if (!account || typeof account !== 'object' || !('id' in account) || account.id !== env.BOOKING_STRIPE_ACCOUNT_ID) throw new Error('stripe_account_mismatch');
  const priceResult = await stripeFetch(env, '/v1/prices/' + encodeURIComponent(env.BOOKING_STRIPE_PRICE_ID), http);
  if (!priceResult.ok) throw new Error('stripe_price_unavailable');
  const price: unknown = await priceResult.json();
  if (!price || typeof price !== 'object' || !('unit_amount' in price) || price.unit_amount !== 19800
    || !('currency' in price) || price.currency !== 'jpy'
    || !('active' in price) || price.active !== true
    || !('recurring' in price) || price.recurring !== null) throw new Error('stripe_price_mismatch');
  const expiry = Math.floor(Date.now() / 1000) + 30 * 60; // Hosted Checkout minimum is 30 minutes.
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': env.BOOKING_STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    'payment_method_types[0]': 'card',
    client_reference_id: bookingId,
    'metadata[booking_id]': bookingId,
    'metadata[booking_request_key]': requestKey,
    success_url: 'https://masahiroyamada.com/booking?payment=pending',
    cancel_url: 'https://masahiroyamada.com/booking?cancelled=1',
    expires_at: String(expiry),
  });
  const res = await stripeFetch(env, '/v1/checkout/sessions', http, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': 'masa-booking-' + bookingId,
    },
    body: form,
  });
  if (!res.ok) throw new Error('stripe_checkout_failed');
  const session: unknown = await res.json();
  if (!session || typeof session !== 'object' || !('id' in session) || typeof session.id !== 'string'
    || !('url' in session) || typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/')) {
    throw new Error('stripe_invalid_checkout');
  }
  return { sessionId: session.id, url: session.url };
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyStripeSignature(raw: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header || !secret) return false;
  const fields = header.split(',').map(x => x.trim().split('='));
  const t = fields.find(x => x[0] === 't')?.[1], sigs = fields.filter(x => x[0] === 'v1').map(x => x[1]);
  if (!t || !/^\d{10,12}$/.test(t) || Math.abs(nowSeconds - Number(t)) > 300 || !sigs.length) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + raw)));
  return sigs.some(sig => {
    if (!/^[0-9a-f]{64}$/.test(sig)) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  });
}
