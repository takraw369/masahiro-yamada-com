import { env as workerEnv } from 'cloudflare:workers';
import { defineMiddleware } from 'astro:middleware';
import { createDashboardSession, verifyDashboardSession, dashboardCookieOptions } from './lib/dashboardAuth';
import { isSameOriginRequest, privateHeaders } from './lib/security/request.mjs';

const CANONICAL_HOST = 'masahiroyamada.com';
const DASHBOARD_AUTH_BOOTSTRAP_APIS = new Set([
  '/api/dashboard/google-login',
  '/api/dashboard/password-login',
  '/api/dashboard/reset-password',
]);
const REDIRECT_HOSTS = new Set([
  'www.masahiroyamada.com',
  'masahiro-yamada.com',
  'www.masahiro-yamada.com',
  'masahiroyamada.jp',
  'www.masahiroyamada.jp',
  'yamadamasahiro.com',
  'www.yamadamasahiro.com',
  'yamadamasahiro.jp',
  'www.yamadamasahiro.jp',
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  const { pathname } = url;
  const isDashboardPage =
    pathname.startsWith('/dashboard') &&
    pathname !== '/dashboard/login' &&
    !pathname.startsWith('/dashboard/logout');
  // This machine-to-machine endpoint has its own constant-time Bearer-secret gate.
  // Keep it outside browser session/Origin checks so Apps Script can call it.
  const isCalendarSyncApi = pathname === '/api/dashboard/calendar/sync' && context.request.method === 'POST';
  const isDashboardApi =
    pathname.startsWith('/api/dashboard') &&
    !DASHBOARD_AUTH_BOOTSTRAP_APIS.has(pathname) &&
    !isCalendarSyncApi;
  const isHarnessApi = /^\/api\/(x|line)-harness(?:\/|$)/.test(pathname);
  const isPrivate =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/dashboard') ||
    isHarnessApi;

  if (isPrivate && !isCalendarSyncApi && !isSameOriginRequest(context.request)) {
    return new Response(JSON.stringify({ ok: false, error: 'same_origin_required' }), {
      status: 403, headers: privateHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  if (isDashboardPage || isDashboardApi || isHarnessApi) {
    const env = workerEnv as unknown as Record<string, string>;
    const password = env.DASHBOARD_PASSWORD ?? '';
    const cookie = context.cookies.get('ace-dash-auth')?.value;

    if (!await verifyDashboardSession(cookie, password, url.origin)) {
      if (isDashboardApi || isHarnessApi) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
          status: 401,
          headers: privateHeaders({ 'Content-Type': 'application/json' }),
        });
      }
      return new Response(null, { status: 302, headers: privateHeaders({ Location: '/dashboard/login' }) });
    }

    // Rolling session: every authenticated Dashboard access extends the cookie
    // for another 24 hours. If the Dashboard is unused for 24 hours, login is
    // required again.
    context.cookies.set('ace-dash-auth', await createDashboardSession(password, url.origin), dashboardCookieOptions);
  }

  const response = await next();
  if (isPrivate) {
    for (const [name, value] of Object.entries(privateHeaders())) response.headers.set(name, value);
  }
  return response;
});
