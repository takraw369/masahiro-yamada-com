/**
 * Smart Booking Lab — proposal-only availability engine.
 * Calendar is the source of facts; an unverified snapshot never grants permission to sell.
 * No external maps, venue or payment calls happen here.
 */
export type SessionMode = 'online' | 'premium' | 'in_person';
export type ClientArea = 'kunitachi' | 'tachikawa' | 'shinjuku' | 'yokohama' | 'other';
export type LocationChoice = {
  id: string;
  label: string;
  area: string;
  format: SessionMode;
  venueVerified: boolean;
};
export type CalendarBusyEvent = {
  start_at: string;
  end_at: string;
  all_day?: boolean;
  location?: string | null;
  areaKey?: string | null;
};
export type CalendarSync = {
  synced_at: string;
  source_synced_at?: string | null;
  window_start: string | null;
  window_end: string | null;
};
export type TravelLookup = (fromArea: string, toArea: string) => number | null;
export type BookingCandidate = {
  startsAt: string;
  endsAt: string;
  day: string;
  locationId: string;
  locationLabel: string;
  mode: SessionMode;
  status: 'needs_review';
  checks: string[];
  clientAreaMatch: boolean;
  estimatedTravelMinutes: number | null;
};

export const SESSION_DURATION_MIN = 90;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TZ_OFFSET = '+09:00';
export const CLIENT_AREAS: Record<ClientArea, string> = {
  kunitachi: '国立・矢川',
  tachikawa: '立川',
  shinjuku: '新宿・渋谷',
  yokohama: '横浜・川崎',
  other: 'その他',
};
export const LOCATION_CHOICES: LocationChoice[] = [
  { id: 'online-yagawa', label: 'オンライン：矢川周辺（個室要確認）', area: 'kunitachi', format: 'online', venueVerified: false },
  { id: 'online-private', label: 'オンライン：静かな個室を別途手配', area: 'other', format: 'online', venueVerified: false },
  { id: 'hotel-shinjuku', label: 'プレミアム：新宿周辺ホテルラウンジ', area: 'shinjuku', format: 'premium', venueVerified: false },
  { id: 'hotel-yokohama', label: 'プレミアム：横浜周辺ホテルラウンジ', area: 'yokohama', format: 'premium', venueVerified: false },
  { id: 'hotel-tachikawa', label: 'プレミアム：立川周辺ホテルラウンジ', area: 'tachikawa', format: 'premium', venueVerified: false },
  { id: 'meeting-kunitachi', label: '対面：国立周辺の会議室', area: 'kunitachi', format: 'in_person', venueVerified: false },
  { id: 'meeting-tachikawa', label: '対面：立川周辺の会議室', area: 'tachikawa', format: 'in_person', venueVerified: false },
];

function parsedTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const valueMs = Date.parse(value);
  return Number.isFinite(valueMs) ? valueMs : null;
}
function jstDate(ms: number): string {
  return new Date(ms + 9 * HOUR_MS).toISOString().slice(0, 10);
}
function startUtc(day: string, hour: number, minute = 0): number {
  return Date.parse(day + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00' + TZ_OFFSET);
}
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
function areaMatches(clientArea: ClientArea, location: LocationChoice): boolean {
  return location.area === clientArea;
}
function travelMinutesBetween(fromArea: string | null | undefined, toArea: string, travel: TravelLookup): number | null {
  if (!fromArea) return null;
  if (fromArea === toArea) return 0;
  const minutes = travel(fromArea, toArea);
  return minutes !== null && Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

/** Fail closed when calendar data is missing, stale, or does not cover the requested window. */
export function calendarReady(sync: CalendarSync | null | undefined, windowStart: number, windowEnd: number, nowMs: number): boolean {
  const stamp = parsedTime(sync?.source_synced_at || sync?.synced_at);
  const from = parsedTime(sync?.window_start);
  const to = parsedTime(sync?.window_end);
  return stamp !== null && from !== null && to !== null
    && stamp <= nowMs + 2 * MINUTE_MS && nowMs - stamp <= 60 * MINUTE_MS
    && from <= windowStart && to >= windowEnd;
}

export function suggestBookingCandidates(options: {
  events: CalendarBusyEvent[];
  sync: CalendarSync | null;
  mode: SessionMode;
  clientArea: ClientArea;
  now: string;
  days?: number;
  minLeadHours?: number;
  maxResults?: number;
  /** Only verified third-party travel times are accepted; unknown travel is never guessed. */
  travelMinutes?: TravelLookup;
  /** True only after every relevant personal/work/family calendar is in the snapshot. */
  allCalendarsVerified?: boolean;
}): { candidates: BookingCandidate[]; reason: string | null } {
  const { events, sync, mode, clientArea, now } = options;
  const nowMs = parsedTime(now);
  if (nowMs === null) return { candidates: [], reason: 'invalid_current_time' };
  const days = Math.min(14, Math.max(1, Math.floor(options.days ?? 14)));
  const startDay = jstDate(nowMs);
  const windowStart = startUtc(startDay, 0);
  const windowEnd = windowStart + days * 24 * HOUR_MS;
  if (!calendarReady(sync, windowStart, windowEnd, nowMs)) {
    return { candidates: [], reason: 'calendar_not_fresh_or_incomplete' };
  }
  if (!Array.isArray(events)) return { candidates: [], reason: 'invalid_calendar_events' };
  const parsedEvents = [] as Array<{ start: number; end: number; area: string | null }>;
  for (const event of events) {
    const start = parsedTime(event.start_at);
    const end = parsedTime(event.end_at);
    if (start === null || end === null || end <= start) {
      return { candidates: [], reason: 'invalid_calendar_events' };
    }
    parsedEvents.push({ start, end, area: event.areaKey || null });
  }
  const choices = LOCATION_CHOICES.filter(item => item.format === mode)
    .sort((a, b) => Number(areaMatches(clientArea, b)) - Number(areaMatches(clientArea, a)));
  const travel = options.travelMinutes || (() => null);
  const maxResults = Math.min(120, Math.max(1, Math.floor(options.maxResults ?? 24)));
  const lead = Math.max(0, options.minLeadHours ?? 24) * HOUR_MS;
  const candidates: BookingCandidate[] = [];

  for (let d = 0; d < days; d += 1) {
    const day = jstDate(windowStart + d * 24 * HOUR_MS);
    for (let hour = 10; hour <= 16; hour += 1) {
      for (let minute of [0, 30]) {
        const begin = startUtc(day, hour, minute);
        const finish = begin + SESSION_DURATION_MIN * MINUTE_MS;
        if (finish > startUtc(day, 18) || begin < nowMs + lead) continue;
        if (parsedEvents.some(event => overlaps(begin - 20 * MINUTE_MS, finish + 20 * MINUTE_MS, event.start, event.end))) continue;
        const nearbyPrevious = parsedEvents
          .filter(event => event.end <= begin && begin - event.end <= 4 * HOUR_MS)
          .sort((a, b) => b.end - a.end)[0];
        const nearbyNext = parsedEvents
          .filter(event => event.start >= finish && event.start - finish <= 4 * HOUR_MS)
          .sort((a, b) => a.start - b.start)[0];
        for (const choice of choices) {
          let totalTravel = 0;
          let unknownTravel = false;
          let feasible = true;
          for (const [event, before] of [[nearbyPrevious, true], [nearbyNext, false]] as const) {
            if (!event) continue;
            const route = before
              ? travelMinutesBetween(event.area, choice.area, travel)
              : travelMinutesBetween(choice.area, event.area || '', travel);
            if (route === null) { unknownTravel = true; continue; }
            const gap = before ? begin - event.end : event.start - finish;
            if (gap < (route + 20) * MINUTE_MS) { feasible = false; break; }
            totalTravel += route;
          }
          if (!feasible) continue;
          const checks = ['予約直前にGoogle Calendar全件を再照合', '施設の利用・空席を確認'];
          if (!options.allCalendarsVerified) checks.push('同期対象以外のカレンダーを確認');
          if (unknownTravel) checks.push('前後の予定との移動時間を確認');
          if (mode === 'online') checks.push('会話・録音・有償利用を認める個室を確保');
          if (mode !== 'online') checks.push('クライアント希望エリアと対面会場を合意');
          candidates.push({
            startsAt: new Date(begin).toISOString(),
            endsAt: new Date(finish).toISOString(),
            day,
            locationId: choice.id,
            locationLabel: choice.label,
            mode,
            status: 'needs_review',
            checks,
            clientAreaMatch: areaMatches(clientArea, choice),
            estimatedTravelMinutes: unknownTravel ? null : totalTravel,
          });
        }
      }
    }
  }
  candidates.sort((a, b) => Number(b.clientAreaMatch) - Number(a.clientAreaMatch) || a.startsAt.localeCompare(b.startsAt));
  return { candidates: candidates.slice(0, maxResults), reason: null };
}
