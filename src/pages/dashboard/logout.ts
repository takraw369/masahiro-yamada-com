export const GET = () =>
  new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard/login',
      'Set-Cookie': 'ace-dash-auth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    },
  });
