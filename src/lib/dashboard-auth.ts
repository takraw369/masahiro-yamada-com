export const DASHBOARD_COOKIE_NAME = 'masa-control-session';
export const DASHBOARD_SESSION_TTL_SECONDS = 60 * 60 * 12;

const encoder = new TextEncoder();

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function createDashboardSession(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + DASHBOARD_SESSION_TTL_SECONDS;
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = `v1.${expiresAt}.${toBase64Url(nonce)}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyDashboardSession(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token || !secret) return false;

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const signature = fromBase64Url(parts[3]);
  if (!signature) return false;

  const payload = parts.slice(0, 3).join('.');
  const key = await importHmacKey(secret);
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload));
}

export async function verifyDashboardPassword(
  candidate: string,
  expected: string,
  secret: string
): Promise<boolean> {
  if (!candidate || !expected || !secret) return false;
  const key = await importHmacKey(secret);
  const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected));
  return crypto.subtle.verify('HMAC', key, expectedSignature, encoder.encode(candidate));
}
