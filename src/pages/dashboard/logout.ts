import { DASHBOARD_COOKIE_NAME } from '../../lib/dashboard-auth';

export const GET = () =>
  new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard/login',
      'Set-Cookie': `${DASHBOARD_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
