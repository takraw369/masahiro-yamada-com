import type { APIRoute } from 'astro';
import { getSiteStorageEnv } from '../../../../lib/siteStorage';

export const prerender = false;

// Publishable key is intentionally public. Never return a service-role key here.
export const GET: APIRoute = ({ locals }) => {
  const env = getSiteStorageEnv(locals);
  const url = env.SUPABASE_URL?.replace(/\/$/, '') || '';
  const key = env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url) || !key) {
    return new Response(JSON.stringify({ ok: false, error: 'temporarily_unavailable' }), {
      status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(JSON.stringify({ ok: true, url, publishableKey: key }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
