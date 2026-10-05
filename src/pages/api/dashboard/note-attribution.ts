import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

type AttributionRow = {
  link_id: string;
  slug: string;
  publication_id: string | null;
  asset_id: string | null;
  title: string | null;
  placement: string | null;
  cta_stage: string | null;
  destination_type: string | null;
  campaign_ref: string | null;
  human_clicks: number;
  consented_contacts: number;
  line_engaged_contacts: number;
  first_touch_paid_customers: number;
  first_touch_paid_purchases: number;
  first_touch_revenue_yen: number;
  last_clicked_at: string | null;
  published_url: string | null;
  published_at: string | null;
};

export const GET = async ({ locals, url }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const requested = Number(url.searchParams.get('limit') || '100');
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.floor(requested), 500)) : 100;

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<AttributionRow[]>(env, 'masa_note_attribution_summary_v1', {
      p_owner_key: ownerKey,
      p_limit: limit,
    });

    return json({
      ok: true,
      attributionModel: 'direct-click + consented-first-touch-assisted',
      caveats: {
        lineEngagedContacts: 'Contacts first attributed to this campaign who later produced LINE-channel events; this is not the same as confirmed friend-add attribution.',
        firstTouchRevenue: 'Paid purchases from contacts whose persisted source_campaign is this Note Harness campaign. Treat as first-touch assisted revenue, not proof of a direct conversion.',
      },
      rows: Array.isArray(rows) ? rows : [],
      storage: 'supabase',
    });
  } catch (error) {
    console.error('note_attribution_summary_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, rows: [], storage: 'unavailable', error: 'primary_storage_unavailable' }, 503);
  }
};
