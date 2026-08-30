import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = new URL(context.request.url);
  const isDashboardPage =
    pathname.startsWith('/dashboard') &&
    pathname !== '/dashboard/login' &&
    !pathname.startsWith('/dashboard/logout');
  const isDashboardApi = pathname.startsWith('/api/dashboard');

  if (isDashboardPage || isDashboardApi) {
    const auth = context.cookies.get('ace-dash-auth');
    if (auth?.value !== 'true') {
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
