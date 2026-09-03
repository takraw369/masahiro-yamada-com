import type { SiteStorageEnv } from './siteStorage';

type SupabaseUser = {
  id: string;
  email?: string;
};

const bearer = (request: Request) => {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

function requireSupabase(env: SiteStorageEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('supabase_not_configured');
  }
  return {
    url: env.SUPABASE_URL.replace(/\/$/, ''),
    key: env.SUPABASE_PUBLISHABLE_KEY,
  };
}

export function dashboardBearerToken(request: Request) {
  return bearer(request);
}

export async function getDashboardGoogleAdmin(
  env: SiteStorageEnv,
  accessToken: string,
): Promise<SupabaseUser | null> {
  if (!accessToken) return null;
  const { url, key } = requireSupabase(env);

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!userResponse.ok) return null;

  const user = (await userResponse.json()) as SupabaseUser;

  const adminResponse = await fetch(`${url}/rest/v1/rpc/is_dashboard_admin`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!adminResponse.ok) return null;

  const isAdmin = Boolean(await adminResponse.json());
  return isAdmin ? user : null;
}

export async function resetDashboardPasswordWithGoogle(
  env: SiteStorageEnv,
  accessToken: string,
  newPassword: string,
) {
  const { url, key } = requireSupabase(env);
  const response = await fetch(`${url}/rest/v1/rpc/reset_dashboard_login_password`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_new_password: newPassword }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`dashboard_password_reset_${response.status}:${text.slice(0, 240)}`);
  }
  return text ? Boolean(JSON.parse(text)) : false;
}
