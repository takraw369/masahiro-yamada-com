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
