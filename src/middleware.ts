import { defineMiddleware } from 'astro:middleware';
import { DASHBOARD_COOKIE_NAME, verifyDashboardSession } from './lib/dashboard-auth';

const protectedApiPrefixes = [
  '/api/dashboard',
  '/api/flashcards',
  '/api/schedule',
  '/api/x-harness',
  '/api/line-harness',
];

function withPrivateHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Pragma', 'no-cache');
  headers.append('Vary', 'Cookie');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  const isDashboardPage = pathname.startsWith('/dashboard');
  const isProtectedApi = protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = pathname === '/dashboard/login' || pathname.startsWith('/dashboard/logout');

  if (!isDashboardPage && !isProtectedApi) return next();

  if (isAuthRoute) return withPrivateHeaders(await next());

  const env = context.locals.runtime?.env as Record<string, string> | undefined;
  const sessionSecret = env?.DASHBOARD_SESSION_SECRET ?? '';
  const token = context.cookies.get(DASHBOARD_COOKIE_NAME)?.value;
  const authenticated = await verifyDashboardSession(token, sessionSecret);

  if (!authenticated) {
    if (isProtectedApi) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-store',
        },
      });
    }
    return context.redirect('/dashboard/login');
  }

  if (isProtectedApi && !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method)) {
    const requestOrigin = context.request.headers.get('Origin');
    const expectedOrigin = new URL(context.request.url).origin;
    const fetchSite = context.request.headers.get('Sec-Fetch-Site');
    if ((requestOrigin && requestOrigin !== expectedOrigin) || fetchSite === 'cross-site') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-store',
        },
      });
    }
  }

  return withPrivateHeaders(await next());
});
