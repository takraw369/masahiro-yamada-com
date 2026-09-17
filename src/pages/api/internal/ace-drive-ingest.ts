import type { APIContext } from 'astro';
import { safeTokenEqual } from '../../../lib/dashboardAuth';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc, type SiteStorageEnv } from '../../../lib/siteStorage';

const ACE_ASSET_INBOX_FOLDER_ID = '1fQgmupO4w7oZfhKSFEselFzc651gkqE4';
const MAX_BODY_BYTES = 64_000;
const ASSET_TYPES = new Set(['video', 'slide', 'guide', 'audio', 'worksheet', 'quest', 'reflection']);
const THEME_SLUGS = new Set([
  'flow-foundation', 'body', 'mind', 'food-health', 'learning', 'relationships', 'ai-creation', 'athlete', 'world-quest',
]);

type AceDriveIngestEnv = SiteStorageEnv & {
  ACE_DRIVE_INGEST_SECRET?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  },
});

function requiredText(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === '') return '';
  return requiredText(value, max);
}

function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com');
  } catch {
    return false;
  }
}

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals) as AceDriveIngestEnv;
  const expectedSecret = env.ACE_DRIVE_INGEST_SECRET?.trim() || '';
  const auth = request.headers.get('authorization') || '';
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';

  if (!expectedSecret) return json({ ok: false, error: 'ace_drive_ingest_secret_missing' }, 503);
  if (!safeTokenEqual(token, expectedSecret)) return json({ ok: false, error: 'unauthorized' }, 401);

  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }
  if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }

  const body = raw as Record<string, unknown>;
  const folderId = requiredText(body.folderId, 160);
  const fileId = requiredText(body.fileId, 240);
  const title = requiredText(body.title, 240);
  const summary = optionalText(body.summary, 4000);
  const assetType = requiredText(body.assetType, 40);
  const assetUrl = requiredText(body.assetUrl, 2000);
  const themeSlug = optionalText(body.themeSlug, 80);
  const mimeType = optionalText(body.mimeType, 240);
  const createdTime = optionalText(body.createdTime, 80);
  const modifiedTime = optionalText(body.modifiedTime, 80);
  const tags = Array.isArray(body.tags)
    ? body.tags
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= 80)
      .slice(0, 30)
    : [];

  if (folderId !== ACE_ASSET_INBOX_FOLDER_ID) return json({ ok: false, error: 'invalid_folder' }, 400);
  if (!fileId || !/^[A-Za-z0-9_-]{10,240}$/.test(fileId)) return json({ ok: false, error: 'invalid_file_id' }, 400);
  if (!title) return json({ ok: false, error: 'invalid_title' }, 400);
  if (summary === null) return json({ ok: false, error: 'invalid_summary' }, 400);
  if (!assetType || !ASSET_TYPES.has(assetType)) return json({ ok: false, error: 'invalid_asset_type' }, 400);
  if (!assetUrl || !isGoogleDriveUrl(assetUrl)) return json({ ok: false, error: 'invalid_asset_url' }, 400);
  if (themeSlug === null || (themeSlug && !THEME_SLUGS.has(themeSlug))) return json({ ok: false, error: 'invalid_theme' }, 400);
  if (mimeType === null || createdTime === null || modifiedTime === null) return json({ ok: false, error: 'invalid_metadata' }, 400);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc(env, 'masa_ace_asset_upsert_v1', {
      p_owner_key: ownerKey,
      p_title: title,
      p_summary: summary || '',
      p_asset_type: assetType,
      p_asset_url: assetUrl,
      p_thumbnail_url: null,
      p_source_system: 'drive',
      p_source_ref: fileId,
      p_theme_slug: themeSlug || null,
      p_status: 'draft',
      p_tags: tags,
      p_metadata: {
        registered_from: 'google_drive_apps_script',
        drive_folder_id: ACE_ASSET_INBOX_FOLDER_ID,
        mime_type: mimeType || null,
        created_time: createdTime || null,
        modified_time: modifiedTime || null,
      },
    });
    return json({ ok: true, data }, 201);
  } catch (error) {
    console.error('ace_drive_ingest_failed', error);
    const message = String(error);
    if (message.includes('invalid_') || message.includes('theme_not_found')) {
      return json({ ok: false, error: 'invalid_asset' }, 400);
    }
    return json({ ok: false, error: 'ace_drive_ingest_unavailable' }, 503);
  }
};
