import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = new URL(context.request.url);

  if (
    pathname.startsWith('/dashboard') &&
    pathname !== '/dashboard/login' &&
    !pathname.startsWith('/dashboard/logout')
  ) {
    const auth = context.cookies.get('ace-dash-auth');
    if (auth?.value !== 'true') {
      return context.redirect('/dashboard/login');
    }
  }

  return next();
});
