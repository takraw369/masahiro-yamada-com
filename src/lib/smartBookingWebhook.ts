import { verifyStripeSignature } from './smartBookingPayments';

export type CompletedBookingPayment = {
  bookingId: string;
  sessionId: string;
  requestKey: string;
  paymentIntentId: string;
  customerEmail: string | null;
};

export async function parseBookingPayment(
  raw: string, header: string | null, secret: string,
): Promise<CompletedBookingPayment | null> {
  if (!await verifyStripeSignature(raw, header, secret)) throw new Error('invalid_signature');
  const event = JSON.parse(raw) as { type?: string; data?: { object?: Record<string, any> } };
  if (event?.type !== 'checkout.session.completed' && event?.type !== 'checkout.session.async_payment_succeeded') return null;
  const session = event.data?.object;
  if (!session?.metadata?.booking_id) return null;
  if (session.mode !== 'payment' || session.payment_status !== 'paid'
      || session.currency !== 'jpy' || session.amount_total !== 19800
      || typeof session.payment_intent !== 'string' || typeof session.id !== 'string'
      || typeof session.metadata?.booking_request_key !== 'string') throw new Error('invalid_booking_payment');
  const bookingId = session.metadata.booking_id;
  if (typeof bookingId !== 'string' || !/^[a-f0-9-]{36}$/i.test(bookingId)) throw new Error('invalid_booking_id');
  return {
    bookingId, sessionId: session.id, requestKey: session.metadata.booking_request_key,
    paymentIntentId: session.payment_intent, customerEmail: typeof session.customer_details?.email === 'string' ? session.customer_details.email : null,
  };
}
