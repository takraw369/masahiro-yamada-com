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

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : null;

const isUuid = (value: string | null) =>
  !value || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type LinkRow = {
  id: string;
  slug: string;
  publication_id: string | null;
  asset_id: string | null;
  source_channel: string;
  source_url: string | null;
  placement: string | null;
  cta_stage: string | null;
  destination_type: string | null;
  destination_url: string;
  campaign_ref: string | null;
  status: 'active' | 'paused' | 'archived';
  human_clicks: number;
  bot_clicks: number;
  last_clicked_at: string | null;
  created_at: string;
  updated_at: string;
};

export const GET = async ({ locals, url }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const requested = Number(url.searchParams.get('limit') || '100');
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.floor(requested), 500)) : 100;

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const links = await supabaseRpc<LinkRow[]>(env, 'masa_tracked_link_list_v1', {
      p_owner_key: ownerKey,
      p_limit: limit,
    });
    return json({ ok: true, links: Array.isArray(links) ? links : [], storage: 'supabase' });
  } catch (error) {
    console.error('note_harness_link_list_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, links: [], storage: 'unavailable', error: 'primary_storage_unavailable' }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return json({ ok: false, error: 'invalid_content_type' }, 415);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ ok: false, error: 'invalid_body' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const slug = text(body.slug, 80)?.toLowerCase() || '';
  let destinationUrl = text(body.destinationUrl, 2000) || '';
  const publicationId = text(body.publicationId, 80);
  const assetId = text(body.assetId, 180);
  const sourceChannel = text(body.sourceChannel, 60) || 'note';
  const sourceUrl = text(body.sourceUrl, 2000);
  const placement = text(body.placement, 120);
  const ctaStage = text(body.ctaStage, 80);
  const destinationType = text(body.destinationType, 80);
  const status = (text(body.status, 20)?.toLowerCase() || 'active') as 'active' | 'paused' | 'archived';

  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) return json({ ok: false, error: 'invalid_slug' }, 400);
  if (!/^https:\/\//i.test(destinationUrl)) return json({ ok: false, error: 'invalid_destination_url' }, 400);
  try {
    const destination = new URL(destinationUrl);
    if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('invalid_destination');
    destinationUrl = destination.toString();
  } catch {
    return json({ ok: false, error: 'invalid_destination_url' }, 400);
  }
  if (!isUuid(publicationId)) return json({ ok: false, error: 'invalid_publication_id' }, 400);
  if (!['active', 'paused', 'archived'].includes(status)) return json({ ok: false, error: 'invalid_status' }, 400);

  const campaignRef = text(body.campaignRef, 120) || `nh-${slug}`;

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const id = await supabaseRpc<string>(env, 'masa_tracked_link_upsert_v1', {
      p_owner_key: ownerKey,
      p_slug: slug,
      p_destination_url: destinationUrl,
      p_publication_id: publicationId || null,
      p_asset_id: assetId,
      p_source_channel: sourceChannel,
      p_source_url: sourceUrl,
      p_placement: placement,
      p_cta_stage: ctaStage,
      p_destination_type: destinationType,
      p_campaign_ref: campaignRef,
      p_status: status,
    });

    return json({
      ok: true,
      id,
      slug,
      campaignRef,
      trackUrl: `https://masahiroyamada.com/go/${encodeURIComponent(slug)}`,
      storage: 'supabase',
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('note_harness_link_upsert_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, storage: 'unavailable', error: 'save_failed' }, 503);
  }
};
