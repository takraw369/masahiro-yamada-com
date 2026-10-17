import type { APIContext } from 'astro';
import { getSiteStorageEnv } from '../../../lib/siteStorage';
import { getLiveBusy, slotIsFree } from '../../../lib/smartBookingIntegrations';
import { findBookingEvent, upsertBookingCalendarEvent } from '../../../lib/smartBookingCalendarWrite';
import { bookingDb, readBooking, type BookingPaymentEnv } from '../../../lib/smartBookingPayments';
import { parseBookingPayment } from '../../../lib/smartBookingWebhook';

const reply = (value: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
);

/** Booking-only Stripe endpoint. Disabled until a verified endpoint secret is set. */
export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals) as BookingPaymentEnv;
  const signingSecrets = [env.BOOKING_STRIPE_WEBHOOK_SECRET, env.BOOKING_LEGACY_STRIPE_WEBHOOK_SECRET].filter((value): value is string => Boolean(value));
  if (!signingSecrets.length) return reply({ ok: false }, 503);
  if (Number(request.headers.get('content-length') || 0) > 128000) return reply({ ok: false }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 128000) return reply({ ok: false }, 413);
  let payment: Awaited<ReturnType<typeof parseBookingPayment>>;
  try {
    payment = await parseBookingPayment(raw, request.headers.get('stripe-signature'), signingSecrets);
  } catch {
    return reply({ ok: false, reason: 'invalid_event' }, 400);
  }
  if (!payment) return reply({ ok: true, ignored: true });
  try {
    const booking = await readBooking(env, payment.bookingId);
    if (!booking || booking.request_key !== payment.requestKey || booking.stripe_session_id !== payment.sessionId
      || booking.mode !== 'online' || booking.location_id !== 'online-private') {
      return reply({ ok: false, reason: 'booking_reference_mismatch' }, 503);
    }
    if (booking.stripe_payment_intent_id && booking.stripe_payment_intent_id !== payment.paymentIntentId) {
      return reply({ ok: false, reason: 'payment_reference_mismatch' }, 503);
    }
    // Even confirmed retries must prove the same canonical purchase before ACK.
    // This RPC records money received and the booking state atomically.
    const paid = await bookingDb<{ state?: string; purchaseId?: string; error?: string }>(env, 'ace_booking_purchase_v1', {
      p_booking_id: booking.id, p_stripe_session_id: payment.sessionId,
      p_request_key: payment.requestKey, p_payment_intent_id: payment.paymentIntentId,
      p_livemode: true,
    });
    if (paid.error || !paid.purchaseId) return reply({ ok: false, reason: 'payment_state_conflict' }, 503);
    if (paid.state === 'confirmed') return reply({ ok: true, duplicate: true });
    if (paid.state === 'refund_required') {
      console.error('booking_paid_expired_refund_review');
      return reply({ ok: true, needsReview: true });
    }
    if (paid.state !== 'paid' && paid.state !== 'needs_review') {
      return reply({ ok: false, reason: 'payment_state_unexpected' }, 503);
    }
    if (!payment.customerEmail) {
      await bookingDb(env, 'ace_booking_review_v1', {
        p_booking_id: booking.id, p_reason: 'customer_email_missing',
      });
      console.error('booking_missing_email_requires_manual_attention');
      return reply({ ok: true, needsReview: true });
    }
    let event = await findBookingEvent(env, booking.id);
    if (!event) {
      const checked = await getLiveBusy(
        env,
        new Date(Date.parse(booking.start_at) - 20 * 60000).toISOString(),
        new Date(Date.parse(booking.end_at) + 20 * 60000).toISOString(),
      );
      if (!slotIsFree(checked.busy, booking.start_at, booking.end_at, 20)) {
        await bookingDb(env, 'ace_booking_review_v1', {
          p_booking_id: booking.id, p_reason: 'calendar_conflict_after_payment',
        });
        console.error('booking_conflict_requires_manual_attention');
        return reply({ ok: true, needsReview: true });
      }
      event = await upsertBookingCalendarEvent(env, { ...booking, state: 'paid' }, payment.customerEmail);
    }
    // A Calendar event without a working Meet URL is not a delivered web session.
    // Stripe will retry after Google's asynchronous conference creation finishes.
    if (!event.meetingUrl) throw new Error('meet_link_pending');
    const confirmed = await bookingDb<{ state?: string; error?: string }>(env, 'ace_booking_confirm_v1', {
      p_booking_id: booking.id, p_calendar_event_id: event.eventId,
    });
    if (confirmed.error || confirmed.state !== 'confirmed') throw new Error('booking_unconfirmed');
    return reply({ ok: true, confirmed: true });
  } catch {
    console.error('booking_webhook_retry_required');
    return reply({ ok: false, reason: 'booking_fulfillment_retry' }, 503);
  }
};
