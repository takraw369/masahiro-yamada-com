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

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : null;

const finiteNonNegativeInteger = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined;
  return parsed;
};

const isUuid = (value: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

type NotePublication = {
  id: string;
  asset_id: string;
  title: string;
  status: string;
  draft_ref: string | null;
  published_url: string | null;
  published_at: string | null;
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
  line_registrations: number | null;
  purchases: number | null;
  revenue_yen: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  last_metric_at: string | null;
  observed_at: string | null;
};

export const GET = async ({ locals, url }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const requested = Number(url.searchParams.get('limit') || '100');
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.floor(requested), 500)) : 100;

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const publications = await supabaseRpc<NotePublication[]>(env, 'masa_note_publication_list_v1', {
      p_owner_key: ownerKey,
      p_limit: limit,
    });
    return json({ ok: true, publications: Array.isArray(publications) ? publications : [], storage: 'supabase' });
  } catch (error) {
    console.error('note_publication_list_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, publications: [], storage: 'unavailable', error: 'primary_storage_unavailable' }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return json({ ok: false, error: 'invalid_content_type' }, 415);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ ok: false, error: 'invalid_body' }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const action = clean(body.action, 30)?.toLowerCase();
  const env = getSiteStorageEnv(locals);

  try {
    const ownerKey = await getDashboardOwnerKey(env);

    if (action === 'register') {
      const assetId = clean(body.assetId, 180) || '';
      const publishedUrl = clean(body.publishedUrl, 2000) || '';
      const providerPostId = clean(body.providerPostId, 500);
      const draftRef = clean(body.draftRef, 2000);
      const cta = clean(body.cta, 2000);
      const campaignRef = clean(body.campaignRef, 120);
      const publishedAt = clean(body.publishedAt, 80);

      if (!assetId) return json({ ok: false, error: 'asset_id_required' }, 400);
      if (!/^https:\/\/note\.com\//i.test(publishedUrl)) return json({ ok: false, error: 'invalid_note_url' }, 400);
      if (publishedAt && Number.isNaN(Date.parse(publishedAt))) return json({ ok: false, error: 'invalid_published_at' }, 400);

      const publicationId = await supabaseRpc<string>(env, 'masa_note_publication_register_v1', {
        p_owner_key: ownerKey,
        p_asset_id: assetId,
        p_published_url: publishedUrl,
        p_provider_post_id: providerPostId,
        p_draft_ref: draftRef,
        p_cta: cta,
        p_campaign_ref: campaignRef,
        p_published_at: publishedAt || new Date().toISOString(),
      });

      return json({ ok: true, action, publicationId, storage: 'supabase' });
    }

    if (action === 'metrics') {
      const publicationId = clean(body.publicationId, 80);
      if (!isUuid(publicationId)) return json({ ok: false, error: 'invalid_publication_id' }, 400);

      const fields = ['impressions', 'views', 'likes', 'comments', 'shares', 'saves'] as const;
      const metrics: Record<(typeof fields)[number], number | null | undefined> = {
        impressions: null,
        views: null,
        likes: null,
        comments: null,
        shares: null,
        saves: null,
      };
      for (const field of fields) {
        metrics[field] = finiteNonNegativeInteger(body[field]);
        if (metrics[field] === undefined) return json({ ok: false, error: `invalid_${field}` }, 400);
      }
      if (Number(metrics.impressions || 0) > 2147483647) return json({ ok: false, error: 'invalid_impressions' }, 400);
      const engagements = ['likes', 'comments', 'shares', 'saves'].reduce((total, field) => total + Number(metrics[field as keyof typeof metrics] || 0), 0);
      if (engagements > 2147483647) return json({ ok: false, error: 'invalid_engagements' }, 400);

      const rawMetrics = body.rawMetrics && typeof body.rawMetrics === 'object' && !Array.isArray(body.rawMetrics)
        ? body.rawMetrics as Record<string, unknown>
        : {};
      if (JSON.stringify(rawMetrics).length > 60000) return json({ ok: false, error: 'raw_metrics_too_large' }, 413);

      const capturedAt = clean(body.capturedAt, 80);
      if (capturedAt && Number.isNaN(Date.parse(capturedAt))) return json({ ok: false, error: 'invalid_captured_at' }, 400);

      const snapshotId = await supabaseRpc<string>(env, 'masa_note_metrics_record_v1', {
        p_owner_key: ownerKey,
        p_publication_id: publicationId,
        p_provider_post_id: clean(body.providerPostId, 500),
        p_impressions: metrics.impressions,
        p_views: metrics.views,
        p_likes: metrics.likes,
        p_comments: metrics.comments,
        p_shares: metrics.shares,
        p_saves: metrics.saves,
        p_raw_metrics: rawMetrics,
        p_captured_at: capturedAt || new Date().toISOString(),
      });

      return json({ ok: true, action, snapshotId, storage: 'supabase' });
    }

    return json({ ok: false, error: 'unsupported_action' }, 400);
  } catch (error) {
    console.error('note_publication_action_failed', error instanceof Error ? error.message.slice(0, 240) : 'unknown');
    return json({ ok: false, storage: 'unavailable', error: 'save_failed' }, 503);
  }
};
