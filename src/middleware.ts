import { env as workerEnv } from 'cloudflare:workers';
import { defineMiddleware } from 'astro:middleware';
import { createDashboardSession, verifyDashboardSession, dashboardCookieOptions } from './lib/dashboardAuth';
import { isSameOriginRequest, privateHeaders } from './lib/security/request.mjs';

const CANONICAL_HOST = 'masahiroyamada.com';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
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
  const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const isLocalCodexPoc = isLocalHost && (pathname === '/dashboard/codex' || pathname === '/dashboard/codex/');
  const isFlowMindPage = pathname === '/mind' || pathname.startsWith('/mind/');
  const isDashboardPage =
    pathname.startsWith('/dashboard') &&
    pathname !== '/dashboard/login' &&
    !pathname.startsWith('/dashboard/logout');
  // Machine-to-machine Calendar sync has its own Bearer-secret gate in the handler.
  // Only this exact POST bypasses browser session / same-origin enforcement.
  const isCalendarSyncApi = pathname === '/api/dashboard/calendar/sync' && context.request.method === 'POST';
  const isDashboardApi =
    pathname.startsWith('/api/dashboard') &&
    !DASHBOARD_AUTH_BOOTSTRAP_APIS.has(pathname) &&
    !isCalendarSyncApi;
  const isHarnessApi = /^\/api\/(x|line)-harness(?:\/|$)/.test(pathname);
  const isPrivate = isFlowMindPage || pathname.startsWith('/dashboard') || pathname.startsWith('/api/dashboard') || isHarnessApi;

  if (isPrivate && !isCalendarSyncApi && !isSameOriginRequest(context.request)) {
    return new Response(JSON.stringify({ ok: false, error: 'same_origin_required' }), {
      status: 403, headers: privateHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  if (!isLocalCodexPoc && (isFlowMindPage || isDashboardPage || isDashboardApi || isHarnessApi)) {
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

    // Rolling session: every authenticated Dashboard/FLOW MIND access extends the cookie
    // for another 24 hours. If the private UI is unused for 24 hours, login is required again.
    context.cookies.set('ace-dash-auth', await createDashboardSession(password, url.origin), dashboardCookieOptions);
  }

  const response = await next();

  if (isPrivate) {
    for (const [name, value] of Object.entries(privateHeaders())) response.headers.set(name, value);
    return response;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isPublicHtml = response.ok && contentType.includes('text/html');
  if (isPublicHtml) {
    const canonicalUrl = new URL(pathname, CANONICAL_ORIGIN).toString();
    response.headers.append('Link', `<${canonicalUrl}>; rel="canonical"`);
    response.headers.set('Content-Signal', 'search=yes, ai-input=yes, ai-train=no');
  }

  return response;
});
