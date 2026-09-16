import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const ASSET_TYPES = new Set(['video', 'slide', 'guide', 'audio', 'worksheet', 'quest', 'reflection']);
const STATUSES = new Set(['draft', 'live', 'archived']);
const THEME_SLUGS = new Set([
  'flow-foundation', 'body', 'mind', 'food-health', 'learning', 'relationships', 'ai-creation', 'athlete', 'world-quest',
]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET = async ({ locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc(env, 'masa_ace_asset_list_v1', {
      p_owner_key: ownerKey,
      p_limit: 50,
    });
    return json({ ok: true, data });
  } catch (error) {
    console.error('ace_asset_list_failed', error);
    return json({ ok: false, error: 'ace_asset_list_unavailable' }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 64_000) return json({ ok: false, error: 'payload_too_large' }, 413);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ ok: false, error: 'invalid_body' }, 400);

  const body = raw as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const assetType = typeof body.assetType === 'string' ? body.assetType.trim() : '';
  const assetUrl = typeof body.assetUrl === 'string' ? body.assetUrl.trim() : '';
  const thumbnailUrl = typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl.trim() : '';
  const sourceSystem = typeof body.sourceSystem === 'string' ? body.sourceSystem.trim() : 'drive';
  const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef.trim() : assetUrl;
  const themeSlug = typeof body.themeSlug === 'string' ? body.themeSlug.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : 'draft';
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean).slice(0, 30)
    : [];

  if (!title || title.length > 240) return json({ ok: false, error: 'invalid_title' }, 400);
  if (summary.length > 4000) return json({ ok: false, error: 'invalid_summary' }, 400);
  if (!ASSET_TYPES.has(assetType)) return json({ ok: false, error: 'invalid_asset_type' }, 400);
  if (!/^https:\/\/\S+$/i.test(assetUrl)) return json({ ok: false, error: 'invalid_asset_url' }, 400);
  if (thumbnailUrl && !/^https:\/\/\S+$/i.test(thumbnailUrl)) return json({ ok: false, error: 'invalid_thumbnail_url' }, 400);
  if (!sourceSystem || sourceSystem.length > 80) return json({ ok: false, error: 'invalid_source_system' }, 400);
  if (!sourceRef || sourceRef.length > 500) return json({ ok: false, error: 'invalid_source_ref' }, 400);
  if (themeSlug && !THEME_SLUGS.has(themeSlug)) return json({ ok: false, error: 'invalid_theme' }, 400);
  if (!STATUSES.has(status)) return json({ ok: false, error: 'invalid_status' }, 400);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc(env, 'masa_ace_asset_upsert_v1', {
      p_owner_key: ownerKey,
      p_title: title,
      p_summary: summary,
      p_asset_type: assetType,
      p_asset_url: assetUrl,
      p_thumbnail_url: thumbnailUrl || null,
      p_source_system: sourceSystem,
      p_source_ref: sourceRef,
      p_theme_slug: themeSlug || null,
      p_status: status,
      p_tags: tags,
      p_metadata: { registered_from: 'masahiroyamada_dashboard' },
    });
    return json({ ok: true, data }, 201);
  } catch (error) {
    console.error('ace_asset_upsert_failed', error);
    const message = String(error);
    if (message.includes('invalid_') || message.includes('theme_not_found')) {
      return json({ ok: false, error: 'invalid_asset' }, 400);
    }
    return json({ ok: false, error: 'ace_asset_upsert_unavailable' }, 503);
  }
};
