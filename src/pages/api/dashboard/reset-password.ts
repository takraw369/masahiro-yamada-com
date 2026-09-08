import type { APIContext } from 'astro';
import { createDashboardSession, dashboardCookieOptions } from '../../../lib/dashboardAuth';
import {
  dashboardBearerToken,
  getDashboardGoogleAdmin,
  resetDashboardPasswordWithGoogle,
} from '../../../lib/dashboardGoogleAuth';
import { getSiteStorageEnv } from '../../../lib/siteStorage';


export const POST = async ({ request, locals, cookies }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  const accessToken = dashboardBearerToken(request);

  if (!accessToken) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_access_token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !('password' in body) || typeof body.password !== 'string') {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_password' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const password = body.password;
  if (password.length < 12 || password.length > 128) {
    return new Response(JSON.stringify({ ok: false, error: 'password_length' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const admin = await getDashboardGoogleAdmin(env, accessToken);
    if (!admin) {
      return new Response(JSON.stringify({ ok: false, error: 'dashboard_admin_required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check session prerequisites before changing the stored login password.
    if (!env.DASHBOARD_PASSWORD) throw new Error('dashboard_secret_missing');
    const updated = await resetDashboardPasswordWithGoogle(env, accessToken, password);
    if (!updated) throw new Error('password_not_updated');

    const token = await createDashboardSession(env.DASHBOARD_PASSWORD, new URL(request.url).origin);
    cookies.set('ace-dash-auth', token, dashboardCookieOptions);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'password_reset_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
