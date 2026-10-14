import { verifyStripeSignature } from './smartBookingPayments';

export type CompletedBookingPayment = {
  bookingId: string;
  sessionId: string;
  requestKey: string;
  paymentIntentId: string;
  customerEmail: string | null;
};

export async function parseBookingPayment(
  raw: string, header: string | null, secret: string | string[],
): Promise<CompletedBookingPayment | null> {
  const secrets = typeof secret === 'string' ? [secret] : secret;
  let valid = false;
  for (const candidate of secrets.filter(Boolean)) {
    if (await verifyStripeSignature(raw, header, candidate)) { valid = true; break; }
  }
  if (!valid) throw new Error('invalid_signature');
  const event = JSON.parse(raw) as { type?: string; data?: { object?: Record<string, any> } };
  if (event?.type !== 'checkout.session.completed' && event?.type !== 'checkout.session.async_payment_succeeded') return null;
  const session = event.data?.object;
  if (!session?.metadata || !['booking_id', 'booking_request_key', 'booking_flow'].some(key => key in session.metadata)) return null;
  if (session.mode !== 'payment' || session.payment_status !== 'paid'
      || session.currency !== 'jpy' || session.amount_total !== 19800
      || typeof session.payment_intent !== 'string' || typeof session.id !== 'string'
      || session.metadata.booking_flow !== 'smart_booking_v1'
      || typeof session.metadata?.booking_request_key !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.metadata.booking_request_key)) throw new Error('invalid_booking_payment');
  const bookingId = session.metadata.booking_id;
  if (typeof bookingId !== 'string' || !/^[a-f0-9-]{36}$/i.test(bookingId)) throw new Error('invalid_booking_id');
  return {
    bookingId, sessionId: session.id, requestKey: session.metadata.booking_request_key,
    paymentIntentId: session.payment_intent, customerEmail: typeof session.customer_details?.email === 'string' ? session.customer_details.email : null,
  };
}
