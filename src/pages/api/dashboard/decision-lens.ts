import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const actions = new Set(['draft','lock','actual','outcome']);
const lenses = new Set(['core','alt','2035','challenge']);
const bounded = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max;
const validId = (id: unknown) =>
  id === undefined || (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

export const GET = async ({ locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const key = await getDashboardOwnerKey(env);
    const items = await supabaseRpc<unknown>(env, 'masa_cognitive_cases_list_v1', {
      p_owner_key: key, p_limit: 25,
    });
    return json({ ok: true, items: Array.isArray(items) ? items : [], storage: 'supabase' });
  } catch {
    return json({ ok: false, items: [], error: 'decision_storage_unavailable' }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 24000) return json({ ok: false, error: 'payload_too_large' }, 413);
  let data: unknown;
  try {
    const source = await request.text();
    if (source.length > 24000) return json({ ok: false, error: 'payload_too_large' }, 413);
    data = JSON.parse(source);
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!isRecord(data) || !actions.has(String(data.action)) || !isRecord(data.case)) {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }
  const item = data.case;
  if (!validId(item.id)) return json({ ok: false, error: 'invalid_case_id' }, 400);
  const action = data.action as string;
  const fields: Record<string, number> = {
    title: 180, context_text: 6000, options_text: 3000,
    prediction_text: 6000, rationale_text: 4000,
    actual_text: 6000, difference_text: 4000, outcome_text: 4000,
  };
  for (const [name,max] of Object.entries(fields)) {
    if (item[name] !== undefined && !bounded(item[name], max)) {
      return json({ ok: false, error: 'invalid_field' }, 400);
    }
  }
  if (action !== 'draft' && typeof item.id !== 'string') {
    return json({ ok: false, error: 'draft_required' }, 400);
  }
  if (action === 'draft' && (
    !String(item.title ?? '').trim() ||
    !String(item.context_text ?? '').trim() ||
    !lenses.has(String(item.lens || 'core'))
  )) return json({ ok: false, error: 'invalid_draft' }, 400);
  if (action === 'lock' && !String(item.prediction_text ?? '').trim()) {
    return json({ ok: false, error: 'prediction_required' }, 400);
  }
  if (action === 'actual' && !String(item.actual_text ?? '').trim()) {
    return json({ ok: false, error: 'actual_required' }, 400);
  }
  // Only allow the fields for the requested transition. Immutable fields are
  // enforced again by the SQL RPC, not by trusting browser state.
  const allowed = action === 'draft' ? ['id','title','context_text','options_text','lens']
    : action === 'lock' ? ['id','prediction_text','rationale_text']
    : action === 'actual' ? ['id','actual_text','difference_text']
    : ['id','outcome_text'];
  const safe = Object.fromEntries(allowed.filter(k => k in item).map(k => [k,item[k]]));
  try {
    const env = getSiteStorageEnv(locals);
    const key = await getDashboardOwnerKey(env);
    const saved = await supabaseRpc<unknown>(env, 'masa_cognitive_case_save_v1', {
      p_owner_key: key, p_action: action, p_case: safe,
    });
    return json({ ok: true, item: saved, storage: 'supabase' });
  } catch {
    return json({ ok: false, error: 'decision_storage_unavailable' }, 503);
  }
};
