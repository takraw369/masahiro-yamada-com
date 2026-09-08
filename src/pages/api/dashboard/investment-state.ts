import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const state = await supabaseRpc<Record<string, unknown>>(env, 'masa_investment_state_get_v1', { p_owner_key: ownerKey });
    return json({ ok: true, state: state || {}, storage: 'supabase' });
  } catch (error) {
    return json({ ok: false, state: {}, storage: 'unavailable', error: String(error) }, 500);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  if (!isRecord(body) || !isRecord(body.state)) return json({ ok: false, error: 'invalid_state' }, 400);
  if (JSON.stringify(body.state).length > 180000) return json({ ok: false, error: 'state_too_large' }, 413);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    await supabaseRpc<boolean>(env, 'masa_investment_state_set_v1', { p_owner_key: ownerKey, p_state: body.state });
    return json({ ok: true, storage: 'supabase', savedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, storage: 'unavailable', error: String(error) }, 500);
  }
};
