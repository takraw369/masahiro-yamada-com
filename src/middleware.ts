import { defineMiddleware } from 'astro:middleware';
import { dashboardAuthToken, safeTokenEqual } from './lib/dashboardAuth';

const CANONICAL_HOST = 'masahiro-yamada.com';
const REDIRECT_HOSTS = new Set([
  'www.masahiro-yamada.com',
  'masahiroyamada.com',
  'www.masahiroyamada.com',
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
  const isDashboardApi = pathname.startsWith('/api/dashboard');

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
  }

  return next();
});
