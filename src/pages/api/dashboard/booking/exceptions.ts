import type { APIContext } from 'astro';
import { getSiteStorageEnv } from '../../../../lib/siteStorage';
import type { BookingPaymentEnv } from '../../../../lib/smartBookingPayments';

/** Existing dashboard middleware restricts this route to the owner. */
export const GET = async ({ locals }: APIContext) => {
  const response = (data: object, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
  const env = getSiteStorageEnv(locals) as BookingPaymentEnv;
  if (!env.BOOKING_SUPABASE_SERVICE_KEY || !env.SUPABASE_URL) return response({ ok: false, error:'booking_storage_unavailable' },503);
  const url = env.SUPABASE_URL.replace(/\/$/,'') +
    '/rest/v1/ace_booking_holds?state=in.(paid,needs_review,refund_required)&select=id,start_at,mode,location_id,state,failure_reason,updated_at&order=updated_at.desc&limit=25';
  try {
    const result = await fetch(url, {
      headers: {
        apikey: env.BOOKING_SUPABASE_SERVICE_KEY,
        Authorization: 'Bearer ' + env.BOOKING_SUPABASE_SERVICE_KEY,
      },
    });
    if (!result.ok) throw new Error('booking_review_load_failure');
    const items: unknown = await result.json();
    if (!Array.isArray(items) || items.length > 25) throw new Error('booking_review_invalid_data');
    return response({ ok: true, items });
  } catch {
    return response({ ok:false, error:'booking_review_unavailable' },503);
  }
};
