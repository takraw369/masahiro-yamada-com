import type { APIContext } from 'astro';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  supabaseRpc,
} from '../../../lib/siteStorage';

type Flow09Row = {
  number: number;
  meaning: string;
  life_area: string;
  episode: string;
  friction: string;
  updated_at: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const notes = await supabaseRpc<Flow09Row[]>(env, 'masa_flow_09_get_v1', {
      p_owner_key: ownerKey,
    });
    return json({ ok: true, notes: notes || [], storage: 'supabase' });
  } catch (error) {
    return json({ ok: false, notes: [], error: String(error) }, 500);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  let body: {
    number?: number;
    meaning?: string;
    lifeArea?: string;
    episode?: string;
    friction?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const number = Number(body.number);
  if (!Number.isInteger(number) || number < 0 || number > 9) {
    return json({ ok: false, error: 'invalid_number' }, 400);
  }

  const clean = (value: unknown, max: number) =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    await supabaseRpc<boolean>(env, 'masa_flow_09_set_v1', {
      p_owner_key: ownerKey,
      p_number: number,
      p_meaning: clean(body.meaning, 5000),
      p_life_area: clean(body.lifeArea, 5000),
      p_episode: clean(body.episode, 10000),
      p_friction: clean(body.friction, 5000),
    });

    return json({ ok: true, storage: 'supabase', savedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};
