import { defineMiddleware } from 'astro:middleware';
import { dashboardAuthToken, safeTokenEqual } from './lib/dashboardAuth';

const CANONICAL_HOST = 'masahiroyamada.com';
const DASHBOARD_IDLE_TIMEOUT_SECONDS = 60 * 60 * 24;
const DASHBOARD_AUTH_BOOTSTRAP_APIS = new Set([
  '/api/dashboard/google-login',
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
  const isDashboardApi =
    pathname.startsWith('/api/dashboard') &&
    !DASHBOARD_AUTH_BOOTSTRAP_APIS.has(pathname);

  if (isDashboardPage || isDashboardApi) {
    const env = context.locals.runtime?.env as Record<string, string> | undefined;
    const password = env?.DASHBOARD_PASSWORD ?? '';
    const cookie = context.cookies.get('ace-dash-auth')?.value;
    const expected = password ? await dashboardAuthToken(password) : '';

    if (!safeTokenEqual(cookie, expected)) {
      if (isDashboardApi) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/dashboard/login');
    }

    // Rolling session: every authenticated Dashboard access extends the cookie
    // for another 24 hours. If the Dashboard is unused for 24 hours, login is
    // required again.
    context.cookies.set('ace-dash-auth', cookie!, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: DASHBOARD_IDLE_TIMEOUT_SECONDS,
    });
  }

  return next();
});
