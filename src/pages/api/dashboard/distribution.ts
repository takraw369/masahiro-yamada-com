import type { APIContext } from 'astro';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  supabaseRpc,
} from '../../../lib/siteStorage';

type DistributionContentRow = {
  asset_id: string;
  genre: string | null;
  current_title: string | null;
  sell_readiness: string | null;
  productization_status: string | null;
  product_format_candidate: string | null;
  target_audience: string | null;
  next_action: string | null;
  source_url: string | null;
  related_project: string | null;
  last_reviewed: string | null;
  source_updated_at: string | null;
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<DistributionContentRow[]>(
      env,
      'masa_distribution_content_get_v1',
      {
        p_owner_key: ownerKey,
        p_asset_ids: ['C034', 'C033', 'C035'],
      },
    );

    return new Response(JSON.stringify({
      ok: true,
      storage: 'drive-supabase-read-model',
      content: rows || [],
    }), { headers: JSON_HEADERS });
  } catch {
    return new Response(JSON.stringify({
      ok: false,
      storage: 'static-fallback',
      content: [],
      error: 'distribution_unavailable',
    }), {
      status: 503,
      headers: JSON_HEADERS,
    });
  }
};
