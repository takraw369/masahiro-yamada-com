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
  window_start?: unknown;
  window_end?: unknown;
  events?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const expected = env.CALENDAR_SYNC_SECRET;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!expected) {
    return new Response(JSON.stringify({ ok: false, error: 'calendar_sync_secret_missing' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!safeTokenEqual(token, expected)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: SyncBody;
  try {
    body = await request.json() as SyncBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.events) || body.events.length > 500) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_events' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const windowStart = text(body.window_start, 64);
  const windowEnd = text(body.window_end, 64);
  const startDate = new Date(windowStart);
  const endDate = new Date(windowEnd);
  if (!windowStart || !windowEnd || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_window' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const events = (body.events as IncomingEvent[]).map((item) => ({
    event_id: text(item.event_id, 512),
    calendar_id: text(item.calendar_id, 255) || 'primary',
    title: text(item.title, 500) || '(no title)',
    start_at: text(item.start_at, 64),
    end_at: text(item.end_at, 64),
    all_day: Boolean(item.all_day),
    location: text(item.location, 500) || null,
  }));

  if (events.some((item) => !item.event_id || !item.start_at || !item.end_at)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_event_shape' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const count = await supabaseRpc<number>(env, 'masa_calendar_snapshot_replace_v1', {
      p_owner_key: ownerKey,
      p_events: events,
      p_window_start: startDate.toISOString(),
      p_window_end: endDate.toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, event_count: count }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'calendar_sync_failed',
      detail: String(error).slice(0, 240),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
