import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/worker-runtime.mjs';
const { parseBookingPayment } = await import('../src/lib/smartBookingWebhook.ts');

const secret = 'whsec_test_only';
const bookingId = '550e8400-e29b-41d4-a716-446655440000';
const requestKey = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const session = {
  id: 'cs_test_001', payment_intent: 'pi_test_001',
  mode: 'payment', payment_status: 'paid', amount_total: 19800, currency: 'jpy',
  customer_details: { email: 'client@example.com' },
  metadata: { booking_flow: 'smart_booking_v1', booking_id: bookingId, booking_request_key: requestKey },
};
async function signed(payload) {
  const raw = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + raw));
  const sig = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { raw, header: 't=' + timestamp + ',v1=' + sig };
}
test('a signed and fully paid checkout event produces strict booking binding', async () => {
  const { raw, header } = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: session } });
  const result = await parseBookingPayment(raw, header, secret);
  assert.deepEqual(result, {
    bookingId, requestKey, sessionId: session.id, paymentIntentId: session.payment_intent, customerEmail: 'client@example.com',
  });
});
test('delayed payment success is supported but unpaid completed checkout is rejected', async () => {
  const delayed = await signed({ livemode: true, type: 'checkout.session.async_payment_succeeded', data: { object: session } });
  assert.equal((await parseBookingPayment(delayed.raw, delayed.header, secret))?.bookingId, bookingId);
  const unpaid = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: { ...session, payment_status: 'unpaid' } } });
  await assert.rejects(() => parseBookingPayment(unpaid.raw, unpaid.header, secret), /invalid_booking_payment/);
});
test('unrelated signed Stripe events never touch bookings', async () => {
  const unrelated = await signed({ type: 'payment_intent.succeeded', data: { object: session } });
  assert.equal(await parseBookingPayment(unrelated.raw, unrelated.header, secret), null);
  const existingLink = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: { ...session, metadata: {} } } });
  assert.equal(await parseBookingPayment(existingLink.raw, existingLink.header, secret), null);
});
test('tampering, wrong amount, wrong currency and old signature fail', async () => {
  const valid = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: session } });
  await assert.rejects(() => parseBookingPayment(valid.raw + ' ', valid.header, secret), /invalid_signature/);
  await assert.rejects(() => parseBookingPayment(valid.raw, valid.header, 'another-secret'), /invalid_signature/);
  const wrongAmount = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: { ...session, amount_total: 9800 } } });
  await assert.rejects(() => parseBookingPayment(wrongAmount.raw, wrongAmount.header, secret), /invalid_booking_payment/);
  const wrongCurrency = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: { ...session, currency: 'usd' } } });
  await assert.rejects(() => parseBookingPayment(wrongCurrency.raw, wrongCurrency.header, secret), /invalid_booking_payment/);
});
test('a genuine paid event without email keeps evidence for review', async () => {
  const missingEmail = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: { ...session, customer_details: {} } } });
  assert.equal((await parseBookingPayment(missingEmail.raw, missingEmail.header, secret))?.customerEmail, null);
});
test('partial booking metadata and unmarked booking payments fail closed', async () => {
  for (const metadata of [{ booking_id: bookingId, booking_request_key: requestKey }, { booking_request_key: requestKey }, { ...session.metadata, booking_flow: 'another_flow' }]) {
    const signedEvent = await signed({ livemode: true, type: 'checkout.session.completed', data: { object: { ...session, metadata } } });
    await assert.rejects(() => parseBookingPayment(signedEvent.raw, signedEvent.header, secret), /invalid_booking_payment/);
  }
});
