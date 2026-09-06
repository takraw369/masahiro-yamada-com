import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type CalendarEventRow = {
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
};

type SyncStatusRow = {
  synced_at: string;
  window_start: string | null;
  window_end: string | null;
  event_count: number;
};

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export const GET = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const url = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const defaultTo = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const from = parseDate(url.searchParams.get('from'), defaultFrom);
  const to = parseDate(url.searchParams.get('to'), defaultTo);

  if (to <= from || to.getTime() - from.getTime() > 120 * 24 * 60 * 60 * 1000) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_window' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const [events, status] = await Promise.all([
      supabaseRpc<CalendarEventRow[]>(env, 'masa_calendar_snapshot_get_v1', {
        p_owner_key: ownerKey,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
      supabaseRpc<SyncStatusRow[]>(env, 'masa_calendar_sync_status_v1', {
        p_owner_key: ownerKey,
      }),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      events: events || [],
      sync: status?.[0] || null,
      source: 'google_calendar_snapshot',
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'calendar_unavailable',
      detail: String(error).slice(0, 240),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
