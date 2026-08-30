import { dashboardOwnerKey } from './dashboardAuth';

export interface SiteStorageEnv {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  DASHBOARD_PASSWORD?: string;
  DB?: D1Database;
}

const jsonHeaders = (key: string) => ({
  apikey: key,
  'Content-Type': 'application/json',
});

export function getSiteStorageEnv(locals: any): SiteStorageEnv {
  return (locals?.runtime?.env || {}) as SiteStorageEnv;
}

export function hasSupabase(env: SiteStorageEnv) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
}

export async function getDashboardOwnerKey(env: SiteStorageEnv) {
  if (!env.DASHBOARD_PASSWORD) throw new Error('dashboard_secret_missing');
  return dashboardOwnerKey(env.DASHBOARD_PASSWORD);
}

export async function supabaseRpc<T>(
  env: SiteStorageEnv,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('supabase_not_configured');
  }

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: jsonHeaders(env.SUPABASE_PUBLISHABLE_KEY),
    body: JSON.stringify(args),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`supabase_rpc_${name}_${response.status}:${text.slice(0, 240)}`);
  }

  return (text ? JSON.parse(text) : null) as T;
}

function d1Timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type MigrationStats = {
  skipped: boolean;
  state: number;
  feedback: number;
  funnel: number;
};

export async function migrateLegacyD1(env: SiteStorageEnv): Promise<MigrationStats> {
  const stats: MigrationStats = { skipped: false, state: 0, feedback: 0, funnel: 0 };
  if (!env.DB || !hasSupabase(env)) {
    return { ...stats, skipped: true };
  }

  const ownerKey = await getDashboardOwnerKey(env);
  const alreadyMigrated = await supabaseRpc<boolean>(env, 'masa_legacy_d1_migrated_v2', {
    p_owner_key: ownerKey,
  });
  if (alreadyMigrated) {
    return { ...stats, skipped: true };
  }

  let hadUnexpectedError = false;

  try {
    const rows = await env.DB.prepare(
      'SELECT slot_id, xp, checked_at FROM ace_checked WHERE user_id = ?'
    ).bind('masa').all<{ slot_id: string; xp: number; checked_at: string }>();

    for (const row of rows.results || []) {
      await supabaseRpc<boolean>(env, 'masa_dashboard_state_set_v2', {
        p_owner_key: ownerKey,
        p_slot_id: row.slot_id,
        p_checked: true,
        p_xp: row.xp || 0,
      });
      stats.state += 1;
    }
  } catch (error) {
    // A missing legacy table is expected when an old D1 migration never ran.
    if (!String(error).includes('no such table')) hadUnexpectedError = true;
  }

  try {
    const rows = await env.DB.prepare(
      `SELECT id, page, message, context, status, created_at
       FROM dashboard_feedback
       WHERE user_id = ?
       ORDER BY id ASC`
    ).bind('masa').all<{
      id: number;
      page: string;
      message: string;
      context: string | null;
      status: string;
      created_at: string;
    }>();

    for (const row of rows.results || []) {
      await supabaseRpc<string>(env, 'masa_dashboard_feedback_import_v2', {
        p_owner_key: ownerKey,
        p_legacy_id: row.id,
        p_page: row.page,
        p_message: row.message,
        p_context: row.context,
        p_status: row.status,
        p_created_at: d1Timestamp(row.created_at),
      });
      stats.feedback += 1;
    }
  } catch (error) {
    if (!String(error).includes('no such table')) hadUnexpectedError = true;
  }

  try {
    const rows = await env.DB.prepare(
      `SELECT id, session_id, event_name, source, medium, campaign, path, created_at
       FROM trinity_funnel_events
       ORDER BY id ASC`
    ).all<{
      id: number;
      session_id: string;
      event_name: string;
      source: string | null;
      medium: string | null;
      campaign: string | null;
      path: string;
      created_at: string;
    }>();

    for (const row of rows.results || []) {
      await supabaseRpc<number>(env, 'trinity_funnel_event_import', {
        p_legacy_id: row.id,
        p_session_id: row.session_id,
        p_event_name: row.event_name,
        p_source: row.source,
        p_medium: row.medium,
        p_campaign: row.campaign,
        p_path: row.path,
        p_created_at: d1Timestamp(row.created_at),
      });
      stats.funnel += 1;
    }
  } catch (error) {
    if (!String(error).includes('no such table')) hadUnexpectedError = true;
  }

  if (!hadUnexpectedError) {
    await supabaseRpc<boolean>(env, 'masa_legacy_d1_mark_migrated_v2', {
      p_owner_key: ownerKey,
    });
  }

  return stats;
}
