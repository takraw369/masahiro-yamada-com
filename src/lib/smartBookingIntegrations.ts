/**
 * Server-only adapters for Booking OS. No token/key is ever sent to a browser.
 * A missing connection or partial provider response is an error (fail closed).
 */
type Http = typeof fetch;
export interface BookingConnections {
  BOOKING_GOOGLE_CLIENT_ID?: string;
  BOOKING_GOOGLE_CLIENT_SECRET?: string;
  BOOKING_GOOGLE_REFRESH_TOKEN?: string;
  BOOKING_GOOGLE_CALENDAR_IDS?: string;
  BOOKING_MAPS_ROUTES_KEY?: string;
}
export type BusySpan = { start: string; end: string };
export type BusySnapshot = { busy: BusySpan[]; checkedAt: string; calendarCount: number };
export type PublicArea = 'kunitachi' | 'tachikawa' | 'shinjuku' | 'yokohama';
const AREAS: Record<PublicArea, string> = {
  kunitachi: '矢川駅、東京都国立市',
  tachikawa: '立川駅、東京都立川市',
  shinjuku: '新宿駅、東京都新宿区',
  yokohama: '横浜駅、神奈川県横浜市',
};
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function fail(reason: string): never { throw new Error(reason); }
function parseConfiguredIds(value?: string): string[] {
  const items = (value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!items.length || items.length > 20 || new Set(items).size !== items.length) fail('booking_calendars_not_verified');
  if (items.some(s => s.length > 256 || /[\s<>]/.test(s))) fail('booking_calendars_invalid');
  return items;
}
export function validateWindow(start: string, end: string) {
  if (!ISO.test(start) || !ISO.test(end)) fail('invalid_calendar_window');
  const a = Date.parse(start), b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b - a > 15 * 86400000) fail('invalid_calendar_window');
  return { a, b };
}
export async function getLiveBusy(
  env: BookingConnections, start: string, end: string, deps: { http?: Http; now?: () => Date } = {},
): Promise<BusySnapshot> {
  const { a, b } = validateWindow(start, end);
  const now = deps.now?.() || new Date();
  if (a < now.getTime() - 3600000 || b > now.getTime() + 16 * 86400000) fail('calendar_window_out_of_range');
  const ids = parseConfiguredIds(env.BOOKING_GOOGLE_CALENDAR_IDS);
  if (!env.BOOKING_GOOGLE_CLIENT_ID || !env.BOOKING_GOOGLE_CLIENT_SECRET || !env.BOOKING_GOOGLE_REFRESH_TOKEN) fail('google_calendar_oauth_unconfigured');
  const http = deps.http || fetch;
  const tokenRes = await http('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.BOOKING_GOOGLE_CLIENT_ID,
      client_secret: env.BOOKING_GOOGLE_CLIENT_SECRET,
      refresh_token: env.BOOKING_GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) fail('google_calendar_token_failure');
  const token: unknown = await tokenRes.json();
  const access = typeof token === 'object' && token !== null && 'access_token' in token && typeof token.access_token === 'string' ? token.access_token : '';
  if (!access) fail('google_calendar_token_missing');
  const busyRes = await http('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), timeZone: 'Asia/Tokyo', items: ids.map(id => ({ id })) }),
  });
  if (!busyRes.ok) fail('google_calendar_freebusy_failure');
  const data: unknown = await busyRes.json();
  if (!data || typeof data !== 'object' || !('calendars' in data) || !data.calendars || typeof data.calendars !== 'object') fail('google_calendar_invalid_response');
  const calendars = data.calendars as Record<string, { busy?: BusySpan[]; errors?: unknown[] }>;
  const allBusy: BusySpan[] = [];
  for (const id of ids) {
    const cal = calendars[id];
    if (!cal || !Array.isArray(cal.busy) || (Array.isArray(cal.errors) && cal.errors.length)) fail('google_calendar_incomplete');
    for (const period of cal.busy) {
      if (!period || typeof period.start !== 'string' || typeof period.end !== 'string' || !Number.isFinite(Date.parse(period.start)) || !Number.isFinite(Date.parse(period.end)) || Date.parse(period.end) <= Date.parse(period.start)) fail('google_calendar_invalid_busy');
      allBusy.push({ start: period.start, end: period.end });
    }
  }
  return { busy: allBusy, calendarCount: ids.length, checkedAt: now.toISOString() };
}

/** Include pre/post buffer and check for conflicts across *all* verified calendars. */
export function slotIsFree(busy: BusySpan[], start: string, end: string, bufferMinutes = 20): boolean {
  const { a, b } = validateWindow(start, end);
  if (!Array.isArray(busy) || busy.some(x => !Number.isFinite(Date.parse(x?.start)) || !Number.isFinite(Date.parse(x?.end)))) return false;
  const buffer = bufferMinutes * 60000;
  return busy.every(x => a - buffer >= Date.parse(x.end) || b + buffer <= Date.parse(x.start));
}
export function stationForArea(area: string): string | null {
  return Object.prototype.hasOwnProperty.call(AREAS, area) ? AREAS[area as PublicArea] : null;
}
export async function getTransitEstimate(
  env: BookingConnections, origin: PublicArea, destination: PublicArea, departureAt: string,
  deps: { http?: Http; now?: () => Date } = {},
): Promise<{ durationMinutes: number; mode: 'TRANSIT'; fromStation: string; toStation: string } | null> {
  const source = stationForArea(origin), target = stationForArea(destination);
  if (!source || !target || !env.BOOKING_MAPS_ROUTES_KEY) return null;
  const when = Date.parse(departureAt), now = (deps.now?.() || new Date()).getTime();
  if (!Number.isFinite(when) || when < now || when > now + 14 * 86400000) return null;
  if (origin === destination) return { durationMinutes: 0, mode: 'TRANSIT', fromStation: source, toStation: target };
  const http = deps.http || fetch;
  const r = await http('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': env.BOOKING_MAPS_ROUTES_KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,duration',
    },
    body: JSON.stringify({
      origins: [{ waypoint: { address: source } }],
      destinations: [{ waypoint: { address: target } }],
      travelMode: 'TRANSIT', departureTime: new Date(when).toISOString(),
      languageCode: 'ja', regionCode: 'JP',
    }),
  });
  if (!r.ok) return null;
  const data: unknown = await r.json();
  if (!Array.isArray(data) || data.length !== 1) return null;
  const leg = data[0] as Record<string, unknown>;
  if (leg.condition !== 'ROUTE_EXISTS' || leg.originIndex !== 0 || leg.destinationIndex !== 0
    || (typeof leg.status === 'object' && leg.status !== null && 'code' in leg.status && leg.status.code !== 0)) return null;
  const duration = typeof leg.duration === 'string' ? Number(leg.duration.replace(/s$/, '')) : NaN;
  if (!Number.isFinite(duration) || duration < 0) return null;
  return { durationMinutes: Math.ceil(duration / 60), mode: 'TRANSIT', fromStation: source, toStation: target };
}
