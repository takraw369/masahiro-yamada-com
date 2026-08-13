import { defineMiddleware } from 'astro:middleware';
import { env as cloudflareEnv } from 'cloudflare:workers';
import {
  hasPermission,
  loadAuthConfig,
  verifySessionToken,
} from './lib/security/auth.mjs';
import {
  isMutatingMethod,
  isSameOriginRequest,
  jsonResponse,
  privateHeaders,
} from './lib/security/request.mjs';
import {
  DASHBOARD_LOGIN,
  isDashboardPath,
  isProtectedApiPath,
  isPublicDashboardRoute,
} from './lib/security/route-policy.mjs';

function withPrivateHeaders(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(privateHeaders())) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  const dashboardPath = isDashboardPath(pathname);
  const protectedApi = isProtectedApiPath(pathname);
  const publicDashboardRoute = isPublicDashboardRoute(pathname);

  const securityLocals = context.locals as unknown as {
    securityEnv?: Cloudflare.Env;
    securitySession?: unknown;
  };
  if (dashboardPath || protectedApi) securityLocals.securityEnv = cloudflareEnv;

  if ((!dashboardPath || publicDashboardRoute) && !protectedApi) {
    return dashboardPath ? withPrivateHeaders(await next()) : next();
  }

  const env = securityLocals.securityEnv as Record<string, unknown> | undefined;
  const config = loadAuthConfig(env);
  if (!config) {
    return protectedApi
      ? jsonResponse({ error: 'service_unavailable' }, 503)
      : withPrivateHeaders(context.redirect(DASHBOARD_LOGIN, 302));
  }

  const token = context.cookies.get(config.cookieName)?.value;
  const session = token ? await verifySessionToken(token, config) : null;
  if (!session || !hasPermission(session, 'dashboard:read')) {
    return protectedApi
      ? jsonResponse({ error: 'authentication_required' }, 401)
      : context.redirect(DASHBOARD_LOGIN, 302);
  }

  if (protectedApi && isMutatingMethod(context.request.method)) {
    if (!isSameOriginRequest(context.request)) {
      return jsonResponse({ error: 'invalid_origin' }, 403);
    }
    if (pathname.startsWith('/api/dashboard/') && !hasPermission(session, 'dashboard:write')) {
      return jsonResponse({ error: 'authorization_required' }, 403);
    }
  }

  securityLocals.securitySession = session;
  return withPrivateHeaders(await next());
});
