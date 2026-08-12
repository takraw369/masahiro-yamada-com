export const DASHBOARD_LOGIN = '/dashboard/login';
export const DASHBOARD_LOGOUT = '/dashboard/logout';

export function isDashboardPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function isPublicDashboardRoute(pathname) {
  return pathname === DASHBOARD_LOGIN || pathname === DASHBOARD_LOGOUT;
}

export function isProtectedApiPath(pathname) {
  return pathname === '/api/dashboard'
    || pathname.startsWith('/api/dashboard/')
    || pathname === '/api/x-harness'
    || pathname.startsWith('/api/x-harness/')
    || pathname === '/api/line-harness'
    || pathname.startsWith('/api/line-harness/');
}
