import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const clean = (value: string | null) => value?.trim() || '';
const clampLimit = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
};

export const GET = async ({ request, locals }: APIContext) => {
  const url = new URL(request.url);
  const mode = clean(url.searchParams.get('mode')) || 'overview';
  const q = clean(url.searchParams.get('q'));
  const domain = clean(url.searchParams.get('domain'));
  const key = clean(url.searchParams.get('key'));
  const personId = clean(url.searchParams.get('personId'));

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);

    if (mode === 'overview') {
      const data = await supabaseRpc<Record<string, unknown>>(env, 'masa_question_lab_overview_v1', {
        p_owner_key: ownerKey,
        p_search: q || null,
        p_domain: domain || null,
        p_limit: clampLimit(url.searchParams.get('limit'), 250, 500),
      });
      return json({ ok: true, data });
    }

    if (mode === 'question') {
      if (!key) return json({ ok: false, error: 'question_key_required' }, 400);
      const data = await supabaseRpc<Record<string, unknown>>(env, 'masa_question_lab_question_v1', {
        p_owner_key: ownerKey,
        p_question_key: key,
        p_limit: clampLimit(url.searchParams.get('limit'), 100, 500),
      });
      return json({ ok: true, data });
    }

    if (mode === 'people') {
      const data = await supabaseRpc<unknown[]>(env, 'masa_question_lab_people_v1', {
        p_owner_key: ownerKey,
        p_search: q || null,
        p_limit: clampLimit(url.searchParams.get('limit'), 150, 500),
      });
      return json({ ok: true, data });
    }

    if (mode === 'person') {
      if (!personId) return json({ ok: false, error: 'person_id_required' }, 400);
      const data = await supabaseRpc<Record<string, unknown>>(env, 'masa_question_lab_person_v1', {
        p_owner_key: ownerKey,
        p_person_id: personId,
        p_limit: clampLimit(url.searchParams.get('limit'), 300, 1000),
      });
      return json({ ok: true, data });
    }

    if (mode === 'reverse') {
      if (!q) return json({ ok: true, data: [] });
      const data = await supabaseRpc<unknown[]>(env, 'masa_question_lab_reverse_v1', {
        p_owner_key: ownerKey,
        p_search: q,
        p_limit: clampLimit(url.searchParams.get('limit'), 150, 500),
      });
      return json({ ok: true, data });
    }

    return json({ ok: false, error: 'unknown_mode' }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};
