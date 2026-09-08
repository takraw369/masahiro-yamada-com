const encoder = new TextEncoder();

async function hmacHex(secret: string, purpose: string): Promise<string> {
  if (!secret) throw new Error('dashboard_secret_missing');

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`masahiro-yamada.com:${purpose}:v1`),
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export const dashboardAuthToken = (password: string) =>
  hmacHex(password, 'dashboard-auth');

export const DASHBOARD_IDLE_TIMEOUT_SECONDS = 60 * 60 * 24;

// Preserve the storage-owner derivation below: changing it would orphan data.
// Sessions have a separate purpose, signed expiry and request-origin audience.
export async function createDashboardSession(secret: string, origin: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + DASHBOARD_IDLE_TIMEOUT_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `v2.${expires}.${nonce}`;
  return `${payload}.${await hmacHex(secret, `session:${origin}:${payload}`)}`;
}

export async function verifyDashboardSession(token: string | undefined, secret: string, origin: string, now = Date.now()) {
  if (!secret || !token || token.length > 256) return false;
  const match = /^v2\.(\d{10})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const expires = Number(match[1]);
  const seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + DASHBOARD_IDLE_TIMEOUT_SECONDS) return false;
  const payload = `v2.${match[1]}.${match[2]}`;
  return safeTokenEqual(match[3], await hmacHex(secret, `session:${origin}:${payload}`));
}

export const dashboardCookieOptions = {
  path: '/', httpOnly: true, secure: true, sameSite: 'lax' as const,
  maxAge: DASHBOARD_IDLE_TIMEOUT_SECONDS,
};

export const dashboardOwnerKey = (password: string) =>
  hmacHex(password, 'dashboard-storage-owner');

export function safeTokenEqual(left: string | undefined, right: string | undefined) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}
