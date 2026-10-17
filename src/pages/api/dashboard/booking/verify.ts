import type { APIContext } from 'astro';
import { getSiteStorageEnv } from '../../../../lib/siteStorage';
import { getLiveBusy, getTransitEstimate, slotIsFree, stationForArea, type BookingConnections, type PublicArea } from '../../../../lib/smartBookingIntegrations';
import { evaluateTravelAroundAppointment } from '../../../../lib/smartBookingAdjacentEvents';

/**
 * Owner-authenticated by existing /api/dashboard middleware.
 * This endpoint only verifies conditions. It never books, charges or exposes private events.
 */
export const POST = async ({ request, locals }: APIContext) => {
  const respond = (data: object, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
  if (Number(request.headers.get('content-length') || 0) > 2048) return respond({ ok: false, reason: 'invalid_body' }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2048) return respond({ ok: false, reason: 'invalid_body' }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch {
    return respond({ ok: false, reason: 'invalid_body' }, 400);
  }
  const start = typeof body.start === 'string' ? body.start : '';
  const end = typeof body.end === 'string' ? body.end : '';
  const from = typeof body.fromArea === 'string' ? body.fromArea : '';
  const to = typeof body.toArea === 'string' ? body.toArea : '';
  const venueArea = typeof body.venueArea === 'string' ? body.venueArea : '';
  const hasRoute = Boolean(from || to);
  if (!start || !end || (hasRoute && (!stationForArea(from) || !stationForArea(to)))
    || (venueArea && !stationForArea(venueArea))) {
    return respond({ ok: false, reason: 'invalid_fields' }, 400);
  }
  const env = getSiteStorageEnv(locals) as unknown as BookingConnections;
  try {
    const snapshot = await getLiveBusy(env, start, end);
    const free = slotIsFree(snapshot.busy, start, end, 20);
    let trip: Awaited<ReturnType<typeof getTransitEstimate>> = null;
    try {
      if (hasRoute) trip = await getTransitEstimate(env, from as PublicArea, to as PublicArea, start);
    } catch {
      // No travel information is not zero travel: keep route verification pending.
    }
    let ownerTravel = null;
    if (venueArea) {
      try { ownerTravel = await evaluateTravelAroundAppointment(env, start, end, venueArea as PublicArea); }
      catch { /* Missing detail-read scope or route API -> owner travel not verified. */ }
    }
    return respond({
      ok: true, free, allCalendarsChecked: true, calendarCount: snapshot.calendarCount, ownerTravel,
      checkedAt: snapshot.checkedAt, transit: trip,
      venueVerified: false, bookable: false, required: [
        ...(!free ? ['日程が重複しています'] : []),
        ...(hasRoute && trip === null ? ['クライアント側の移動時間が未確認'] : []),
        ...(venueArea && (!ownerTravel || ownerTravel.feasible === null) ? ['MASAの前後予定からの移動時間が未検証'] : []),
        ...(ownerTravel?.feasible === false ? ['MASAの前後予定との移動時間不足'] : []),
        '会場・オンライン個室の利用条件と空席を確定',
        '決済と仮押さえの確認',
      ],
    });
  } catch {
    // Fail closed and avoid leaking provider error details or customer locations.
    return respond({ ok: false, free: false, bookable: false, reason: 'live_verification_unavailable' }, 503);
  }
};
