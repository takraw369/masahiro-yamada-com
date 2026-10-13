import type { APIContext } from 'astro';
import { getSiteStorageEnv } from '../../../lib/siteStorage';
import { getLiveBusy, slotIsFree } from '../../../lib/smartBookingIntegrations';
import { bookingEnabled, type BookingPaymentEnv } from '../../../lib/smartBookingPayments';

const HOUR = 3600000;
export function futureOnlineSlots(now: Date, busy: Array<{ start: string; end: string }>, max = 40) {
  const results: Array<{ start: string; end: string }> = [];
  const localMidnightMs = Date.parse(new Date(now.getTime() + 9 * HOUR).toISOString().slice(0, 10) + 'T00:00:00+09:00');
  for (let day = 0; day < 14; day++) {
    const date = new Date(localMidnightMs + day * 24 * HOUR);
    for (let minuteOfDay = 10 * 60; minuteOfDay <= 16 * 60 + 30; minuteOfDay += 30) {
      const start = new Date(date.getTime() + minuteOfDay * 60000);
      const end = new Date(start.getTime() + 90 * 60000);
      if (start.getTime() < now.getTime() + 24 * HOUR || start.getTime() > now.getTime() + 14 * 24 * HOUR) continue;
      if (!slotIsFree(busy, start.toISOString(), end.toISOString(), 20)) continue;
      results.push({ start: start.toISOString(), end: end.toISOString() });
      if (results.length >= max) return results;
    }
  }
  return results;
}
export const GET = async ({ locals }: APIContext) => {
  const respond = (value: object, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  const env = getSiteStorageEnv(locals) as BookingPaymentEnv;
  if (!bookingEnabled(env)) return respond({ ok: false, error: 'booking_not_activated' }, 503);
  try {
    const now = new Date();
    const busy = await getLiveBusy(env,
      now.toISOString(), new Date(now.getTime() + 14 * 24 * HOUR + 1000).toISOString());
    return respond({ ok: true, checkedAt: busy.checkedAt, slots: futureOnlineSlots(now, busy.busy) });
  } catch { return respond({ ok: false, error: 'availability_unverified' }, 503); }
};
