const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const LEGACY_COOKIE_NAME = 'ace-dash-auth';
export const PRODUCTION_COOKIE_NAME = '__Host-ace-dashboard-session';
export const DEVELOPMENT_COOKIE_NAME = 'ace-dashboard-dev-session';

const BASE_PERMISSIONS = Object.freeze([
  'dashboard:read',
  'dashboard:write',
  'harness:read',
]);

const OPERATOR_PERMISSIONS = Object.freeze([
  ...BASE_PERMISSIONS,
  'harness:write',
]);

const ALLOWED_PERMISSIONS = new Set(OPERATOR_PERMISSIONS);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function loadAuthConfig(env = {}) {
  const mode = nonEmptyString(env.APP_ENV) ?? 'production';
  if (!['production', 'development', 'test'].includes(mode)) return null;

  const development = mode === 'development' || mode === 'test';
  const password = nonEmptyString(
    development ? env.DASHBOARD_DEV_PASSWORD : env.DASHBOARD_PASSWORD,
  );
  const operatorPassword = nonEmptyString(
    development ? env.DASHBOARD_DEV_OPERATOR_PASSWORD : env.DASHBOARD_OPERATOR_PASSWORD,
  );
  const sessionSecret = nonEmptyString(
    development ? env.DASHBOARD_DEV_SESSION_SECRET : env.DASHBOARD_SESSION_SECRET,
  );

  const minimumPasswordLength = development ? 12 : 16;
  if (
    !password
    || password.length < minimumPasswordLength
    || !sessionSecret
    || sessionSecret.length < 32
    || (operatorPassword && operatorPassword.length < minimumPasswordLength)
    || (operatorPassword && operatorPassword === password)
    || (env.HARNESS_SIDE_EFFECTS_ENABLED === 'true' && !operatorPassword)
  ) {
    return null;
  }

  return Object.freeze({
    mode,
    password,
    operatorPassword,
    sessionSecret,
    cookieName: development ? DEVELOPMENT_COOKIE_NAME : PRODUCTION_COOKIE_NAME,
    secureCookie: !development,
    sessionTtlSeconds: 60 * 60 * 8,
    operatorTtlSeconds: 60 * 15,
  });
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('Invalid base64url');
  const padded = value.replaceAll('-', '+').replaceAll('_', '/')
    + '='.repeat((4 - (value.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function verifyPassword(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string') return false;
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function createSessionToken(config, options = {}) {
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSeconds = options.ttlSeconds ?? config.sessionTtlSeconds;
  const permissions = options.permissions ?? BASE_PERMISSIONS;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const claims = {
    v: 1,
    sub: 'masa',
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    nonce: bytesToBase64Url(nonceBytes),
    permissions: [...new Set(permissions)],
  };
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(config.sessionSecret);
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
  );
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(token, config, options = {}) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const key = await importHmacKey(config.sessionSecret);
    const validSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!validSignature) return null;

    const claims = JSON.parse(decoder.decode(base64UrlToBytes(payload)));
    const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
    if (
      claims?.v !== 1
      || claims?.sub !== 'masa'
      || !Number.isInteger(claims?.iat)
      || !Number.isInteger(claims?.exp)
      || claims.iat > nowSeconds + 60
      || claims.exp <= nowSeconds
      || claims.exp - claims.iat > config.sessionTtlSeconds
      || !Array.isArray(claims?.permissions)
      || claims.permissions.length === 0
      || claims.permissions.some(
        (permission) => typeof permission !== 'string' || !ALLOWED_PERMISSIONS.has(permission),
      )
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function hasPermission(claims, permission) {
  return Boolean(claims?.permissions?.includes(permission));
}

export function basePermissions() {
  return [...BASE_PERMISSIONS];
}

export function operatorPermissions() {
  return [...OPERATOR_PERMISSIONS];
}

export function sessionCookieOptions(config, maxAge = config.sessionTtlSeconds) {
  return {
    path: '/',
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: 'strict',
    maxAge,
  };
}
