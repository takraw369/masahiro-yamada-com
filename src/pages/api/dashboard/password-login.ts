import type { APIContext } from 'astro';
import { createDashboardSession, dashboardCookieOptions } from '../../../lib/dashboardAuth';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

export const POST = async ({ request, locals, cookies }: APIContext) => {
  const env = getSiteStorageEnv(locals);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const password = body && typeof body === 'object' && !Array.isArray(body) && 'password' in body && typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 128) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_password' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const valid = await supabaseRpc<boolean>(
      env,
      'verify_dashboard_login_password',
      { p_password: password },
    );

    if (valid !== true) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.DASHBOARD_PASSWORD) {
      throw new Error('dashboard_secret_missing');
    }

    const token = await createDashboardSession(env.DASHBOARD_PASSWORD, new URL(request.url).origin);
    cookies.set('ace-dash-auth', token, dashboardCookieOptions);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'password_login_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
