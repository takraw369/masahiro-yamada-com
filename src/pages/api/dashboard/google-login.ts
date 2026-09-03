import type { APIContext } from 'astro';
import { dashboardAuthToken } from '../../../lib/dashboardAuth';
import { dashboardBearerToken, getDashboardGoogleAdmin } from '../../../lib/dashboardGoogleAuth';
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

  try {
    const admin = await getDashboardGoogleAdmin(env, accessToken);
    if (!admin) {
      return new Response(JSON.stringify({ ok: false, error: 'dashboard_admin_required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.DASHBOARD_PASSWORD) {
      throw new Error('dashboard_secret_missing');
    }

    const token = await dashboardAuthToken(env.DASHBOARD_PASSWORD);
    cookies.set('ace-dash-auth', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'google_login_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
