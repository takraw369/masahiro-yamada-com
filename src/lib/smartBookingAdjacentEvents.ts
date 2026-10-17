import { getTransitEstimate, type BookingConnections, type PublicArea } from './smartBookingIntegrations';

type Http = typeof fetch;
type AdjacentEvent = { start: number; end: number; area: PublicArea | null };
const HOUR = 3600000;
const MIN = 60000;
const AREA_MATCHES: Array<[PublicArea, RegExp]> = [
  ['kunitachi', /矢川駅|国立駅|谷保駅|国立市/],
  ['tachikawa', /立川駅|立川市/],
  ['shinjuku', /新宿駅|渋谷駅|新宿区|渋谷区/],
  ['yokohama', /横浜駅|川崎駅|横浜市|川崎市/],
];
export function identifyArea(location: unknown): PublicArea | null {
  if (typeof location !== 'string' || location.length > 500) return null;
  const hits = AREA_MATCHES.filter(([, pattern]) => pattern.test(location));
  // Ambiguous location descriptions cannot be used to prove safe transit.
  return hits.length === 1 ? hits[0][0] : null;
}
export type AdjacencyCheck = {
  complete: boolean;
  feasible: boolean | null;
  priorTransitMinutes: number | null;
  nextTransitMinutes: number | null;
  reasons: string[];
  calendarsChecked: number;
};

/** Reads minimal event details privately; never returns titles or exact locations. */
export async function evaluateTravelAroundAppointment(
  env: BookingConnections, start: string, end: string, venueArea: PublicArea,
  dependencies: { http?: Http; now?: () => Date } = {},
): Promise<AdjacencyCheck> {
  const a = Date.parse(start), b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) throw new Error('invalid_booking_window');
  const ids = (env.BOOKING_GOOGLE_CALENDAR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length || ids.length > 20 || !env.BOOKING_GOOGLE_CLIENT_ID || !env.BOOKING_GOOGLE_CLIENT_SECRET
    || !env.BOOKING_GOOGLE_REFRESH_TOKEN) throw new Error('missing_calendar_approval');
  const http = dependencies.http || fetch;
  const tokenRes = await http('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.BOOKING_GOOGLE_CLIENT_ID,
      client_secret: env.BOOKING_GOOGLE_CLIENT_SECRET,
      refresh_token: env.BOOKING_GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) throw new Error('calendar_auth_failed');
  const token = (await tokenRes.json() as { access_token?: unknown })?.access_token;
  if (typeof token !== 'string') throw new Error('calendar_token_missing');
  const found: AdjacentEvent[] = [];
  for (const id of ids) {
    const params = new URLSearchParams({
      timeMin: new Date(a - 4 * HOUR).toISOString(), timeMax: new Date(b + 4 * HOUR).toISOString(),
      singleEvents: 'true', showDeleted: 'false', maxResults: '250',
      fields: 'nextPageToken,items(start,end,location,status,transparency)',
    });
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(id) + '/events?' + params;
    const res = await http(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('calendar_detail_access_unavailable');
    const data = await res.json() as { nextPageToken?: unknown; items?: Array<{
      start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
      location?: string; status?: string; transparency?: string;
    }> };
    if (!data || !Array.isArray(data.items) || data.nextPageToken) throw new Error('calendar_detail_incomplete');
    for (const event of data.items) {
      if (event.status === 'cancelled' || event.transparency === 'transparent') continue;
      const evStart = Date.parse(event.start?.dateTime || event.start?.date || '');
      const evEnd = Date.parse(event.end?.dateTime || event.end?.date || '');
      if (!Number.isFinite(evStart) || !Number.isFinite(evEnd) || evEnd <= evStart) throw new Error('calendar_event_invalid');
      if (evEnd <= a && a - evEnd <= 4 * HOUR || evStart >= b && evStart - b <= 4 * HOUR)
        found.push({ start: evStart, end: evEnd, area: identifyArea(event.location) });
    }
  }
  const prev = found.filter(x => x.end <= a).sort((x,y) => y.end - x.end)[0];
  const next = found.filter(x => x.start >= b).sort((x,y) => x.start - y.start)[0];
  const reasons: string[] = [];
  let feasible: boolean | null = true;
  let priorTransitMinutes: number | null = null;
  let nextTransitMinutes: number | null = null;
  if (!prev && !next) reasons.push('前後4時間の予定なし。出発拠点はオーナー確認');
  if (prev) {
    if (!prev.area) { reasons.push('直前の予定場所が判定不能'); feasible = null; }
    else {
      const trip = await getTransitEstimate(env, prev.area, venueArea, new Date(prev.end).toISOString(), dependencies);
      if (!trip) { reasons.push('直前の予定からの移動時間が未検証'); feasible = null; }
      else {
        priorTransitMinutes = trip.durationMinutes;
        if (a - prev.end < (trip.durationMinutes + 20) * MIN) { reasons.push('直前予定からの移動が時間不足'); feasible = false; }
      }
    }
  }
  if (next) {
    if (!next.area) { reasons.push('直後の予定場所が判定不能'); if (feasible !== false) feasible = null; }
    else {
      const trip = await getTransitEstimate(env, venueArea, next.area, new Date(b).toISOString(), dependencies);
      if (!trip) { reasons.push('直後の予定への移動時間が未検証'); if (feasible !== false) feasible = null; }
      else {
        nextTransitMinutes = trip.durationMinutes;
        if (next.start - b < (trip.durationMinutes + 20) * MIN) { reasons.push('直後予定への移動が時間不足'); feasible = false; }
      }
    }
  }
  return { complete: true, feasible, priorTransitMinutes, nextTransitMinutes, reasons, calendarsChecked: ids.length };
}
