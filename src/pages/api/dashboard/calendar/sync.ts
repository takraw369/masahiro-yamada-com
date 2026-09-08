import type { APIContext } from 'astro';
import { safeTokenEqual } from '../../../../lib/dashboardAuth';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../../lib/siteStorage';

type IncomingEvent = {
  event_id?: unknown;
  calendar_id?: unknown;
  title?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  all_day?: unknown;
  location?: unknown;
};

type SyncBody = {
  source_synced_at?: unknown;
  window_start?: unknown;
  window_end?: unknown;
  events?: unknown;
};

const MAX_BODY_BYTES = 2_500_000;
const MAX_EVENTS = 500;
const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalText(value: unknown, max: number) {
  if (value === null || value === undefined || value === '') return null;
  return text(value, max);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const expected = env.CALENDAR_SYNC_SECRET;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!expected) return jsonResponse({ ok: false, error: 'calendar_sync_secret_missing' }, 503);
  if (!safeTokenEqual(token, expected)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413);
  }

  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!isRecord(parsed)) return jsonResponse({ ok: false, error: 'invalid_body' }, 400);
  const body = parsed as SyncBody;

  if (!Array.isArray(body.events) || body.events.length > MAX_EVENTS) {
    return jsonResponse({ ok: false, error: 'invalid_events' }, 400);
  }

  const windowStart = text(body.window_start, 64);
  const windowEnd = text(body.window_end, 64);
  const sourceSyncedAt = text(body.source_synced_at, 64);
  if (!windowStart || !windowEnd || !sourceSyncedAt) {
    return jsonResponse({ ok: false, error: 'invalid_window' }, 400);
  }

  const startDate = new Date(windowStart);
  const endDate = new Date(windowEnd);
  const sourceDate = new Date(sourceSyncedAt);
  if (
    Number.isNaN(startDate.getTime())
    || Number.isNaN(endDate.getTime())
    || Number.isNaN(sourceDate.getTime())
    || endDate <= startDate
    || endDate.getTime() - startDate.getTime() > MAX_WINDOW_MS
  ) {
    return jsonResponse({ ok: false, error: 'invalid_window' }, 400);
  }

  const seen = new Set<string>();
  const events = [] as Array<{
    event_id: string;
    calendar_id: string;
    title: string;
    start_at: string;
    end_at: string;
    all_day: boolean;
    location: string | null;
  }>;

  for (const rawEvent of body.events) {
    if (!isRecord(rawEvent)) return jsonResponse({ ok: false, error: 'invalid_event_shape' }, 400);
    const item = rawEvent as IncomingEvent;
    const eventId = text(item.event_id, 512);
    const calendarId = item.calendar_id === undefined ? 'primary' : text(item.calendar_id, 255);
    const title = item.title === undefined || item.title === '' ? '(no title)' : text(item.title, 500);
    const startAt = text(item.start_at, 64);
    const endAt = text(item.end_at, 64);
    const location = optionalText(item.location, 500);

    if (!eventId || !calendarId || !title || !startAt || !endAt) {
      return jsonResponse({ ok: false, error: 'invalid_event_shape' }, 400);
    }
    if (item.all_day !== undefined && typeof item.all_day !== 'boolean') {
      return jsonResponse({ ok: false, error: 'invalid_event_shape' }, 400);
    }
    if (item.location !== undefined && item.location !== null && location === null && item.location !== '') {
      return jsonResponse({ ok: false, error: 'invalid_event_shape' }, 400);
    }
    if (seen.has(eventId)) return jsonResponse({ ok: false, error: 'duplicate_event_id' }, 400);
    seen.add(eventId);

    const eventStart = new Date(startAt);
    const eventEnd = new Date(endAt);
    if (
      Number.isNaN(eventStart.getTime())
      || Number.isNaN(eventEnd.getTime())
      || eventEnd <= eventStart
      || eventEnd < startDate
      || eventStart > endDate
    ) {
      return jsonResponse({ ok: false, error: 'invalid_event_range' }, 400);
    }

    events.push({
      event_id: eventId,
      calendar_id: calendarId,
      title,
      start_at: eventStart.toISOString(),
      end_at: eventEnd.toISOString(),
      all_day: item.all_day === true,
      location,
    });
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const count = await supabaseRpc<number>(env, 'masa_calendar_snapshot_replace_v2', {
      p_owner_key: ownerKey,
      p_events: events,
      p_window_start: startDate.toISOString(),
      p_window_end: endDate.toISOString(),
      p_source_synced_at: sourceDate.toISOString(),
    });

    return jsonResponse({ ok: true, event_count: count });
  } catch (error) {
    if (String(error).includes('stale_calendar_snapshot')) {
      return jsonResponse({ ok: false, error: 'stale_snapshot' }, 409);
    }
    return jsonResponse({ ok: false, error: 'calendar_sync_failed' }, 500);
  }
};
