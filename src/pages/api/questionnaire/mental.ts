import type { APIContext } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const SET_KEY = 'mental_condition_lead_v1';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export const GET = async ({ locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const data = await supabaseRpc<Record<string, unknown>>(env, 'public_question_set_v1', {
      p_set_key: SET_KEY,
    });
    return json({ ok: true, data });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!Array.isArray(body.answers) || body.answers.length < 1 || body.answers.length > 100) {
    return json({ ok: false, error: 'invalid_answers' }, 400);
  }

  const answers = body.answers
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map(item => ({
      questionKey: clean(item.questionKey, 160),
      value: Array.isArray(item.value)
        ? item.value.filter((value): value is string => typeof value === 'string').map(value => value.slice(0, 160)).slice(0, 30)
        : typeof item.value === 'string' || typeof item.value === 'number' || typeof item.value === 'boolean'
          ? item.value
          : null,
    }))
    .filter(item => item.questionKey && item.value !== null);

  if (!answers.length) return json({ ok: false, error: 'answers_required' }, 400);

  try {
    const env = getSiteStorageEnv(locals);
    const data = await supabaseRpc<Record<string, unknown>>(env, 'submit_questionnaire_v1', {
      p_set_key: SET_KEY,
      p_session_key: clean(body.sessionKey, 120) || null,
      p_answers: answers,
      p_display_name: clean(body.displayName, 160) || null,
      p_email: clean(body.email, 254) || null,
      p_contact_route: clean(body.contactRoute, 500) || null,
      p_followup_consent: body.followupConsent === true,
      p_source_ref: clean(body.sourceRef, 500) || '/mental-check',
      p_website: clean(body.website, 200) || null,
    });
    return json({ ok: true, data }, 201);
  } catch (error) {
    const message = String(error);
    const status = message.includes('required_answers_missing') || message.includes('invalid_answers') ? 400 : 500;
    return json({ ok: false, error: message }, status);
  }
};
