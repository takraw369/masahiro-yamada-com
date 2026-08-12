import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEVELOPMENT_COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  PRODUCTION_COOKIE_NAME,
  basePermissions,
  createSessionToken,
  hasPermission,
  loadAuthConfig,
  operatorPermissions,
  sessionCookieOptions,
  verifyPassword,
  verifySessionToken,
} from '../src/lib/security/auth.mjs';
import {
  isSameOriginRequest,
  jsonResponse,
} from '../src/lib/security/request.mjs';
import {
  isDashboardPath,
  isProtectedApiPath,
  isPublicDashboardRoute,
} from '../src/lib/security/route-policy.mjs';
import {
  consumeRateLimit,
  resetRateLimitsForTests,
} from '../src/lib/security/rate-limit.mjs';

const productionEnv = Object.freeze({
  APP_ENV: 'production',
  DASHBOARD_PASSWORD: 'production-password-not-real',
  DASHBOARD_OPERATOR_PASSWORD: 'operator-password-not-real',
  DASHBOARD_SESSION_SECRET: 'session-secret-not-real-000000000000000000000000',
  HARNESS_SIDE_EFFECTS_ENABLED: 'false',
});

const developmentEnv = Object.freeze({
  APP_ENV: 'development',
  DASHBOARD_DEV_PASSWORD: 'development-password-not-real',
  DASHBOARD_DEV_OPERATOR_PASSWORD: 'development-operator-not-real',
  DASHBOARD_DEV_SESSION_SECRET: 'development-session-secret-not-real-000000000000',
  HARNESS_SIDE_EFFECTS_ENABLED: 'false',
});

test('production and development authentication configs never fall back across environments', () => {
  const production = loadAuthConfig({
    ...productionEnv,
    DASHBOARD_DEV_PASSWORD: 'should-not-be-selected',
    DASHBOARD_DEV_SESSION_SECRET: 'should-not-be-selected-0000000000000000000000',
  });
  assert.equal(production.password, productionEnv.DASHBOARD_PASSWORD);
  assert.equal(production.cookieName, PRODUCTION_COOKIE_NAME);
  assert.equal(production.secureCookie, true);

  const development = loadAuthConfig({
    ...developmentEnv,
    DASHBOARD_PASSWORD: 'should-not-be-selected',
    DASHBOARD_SESSION_SECRET: 'should-not-be-selected-0000000000000000000000',
  });
  assert.equal(development.password, developmentEnv.DASHBOARD_DEV_PASSWORD);
  assert.equal(development.cookieName, DEVELOPMENT_COOKIE_NAME);
  assert.equal(development.secureCookie, false);

  assert.equal(loadAuthConfig({
    APP_ENV: 'production',
    DASHBOARD_DEV_PASSWORD: developmentEnv.DASHBOARD_DEV_PASSWORD,
    DASHBOARD_DEV_SESSION_SECRET: developmentEnv.DASHBOARD_DEV_SESSION_SECRET,
  }), null);
});

test('authentication config fails closed on weak, reused, missing, or unknown settings', () => {
  assert.equal(loadAuthConfig({}), null);
  assert.equal(loadAuthConfig({ ...productionEnv, APP_ENV: 'preview' }), null);
  assert.equal(loadAuthConfig({ ...productionEnv, DASHBOARD_PASSWORD: 'too-short' }), null);
  assert.equal(loadAuthConfig({ ...productionEnv, DASHBOARD_SESSION_SECRET: 'too-short' }), null);
  assert.equal(loadAuthConfig({
    ...productionEnv,
    DASHBOARD_OPERATOR_PASSWORD: productionEnv.DASHBOARD_PASSWORD,
  }), null);
  assert.equal(loadAuthConfig({
    ...productionEnv,
    DASHBOARD_OPERATOR_PASSWORD: undefined,
    HARNESS_SIDE_EFFECTS_ENABLED: 'true',
  }), null);
});

test('legacy fixed cookies and unsigned values never authenticate', async () => {
  const config = loadAuthConfig(productionEnv);
  assert.notEqual(config.cookieName, LEGACY_COOKIE_NAME);
  assert.equal(await verifySessionToken('true', config), null);
  assert.equal(await verifySessionToken('false', config), null);
  assert.equal(await verifySessionToken('unsigned.payload', config), null);
});

test('signed sessions verify server-side and reject tampering, wrong keys, and expiry', async () => {
  const nowMs = Date.UTC(2026, 7, 12, 0, 0, 0);
  const config = loadAuthConfig(productionEnv);
  const token = await createSessionToken(config, { nowMs, permissions: basePermissions() });
  const claims = await verifySessionToken(token, config, { nowMs: nowMs + 1000 });
  assert.equal(claims.sub, 'masa');
  assert.equal(hasPermission(claims, 'dashboard:read'), true);
  assert.equal(hasPermission(claims, 'harness:write'), false);

  const [payload, signature] = token.split('.');
  const tampered = `${payload.slice(0, -1)}A.${signature}`;
  assert.equal(await verifySessionToken(tampered, config, { nowMs }), null);

  const wrongConfig = loadAuthConfig({
    ...productionEnv,
    DASHBOARD_SESSION_SECRET: 'different-session-secret-not-real-0000000000000000',
  });
  assert.equal(await verifySessionToken(token, wrongConfig, { nowMs }), null);
  assert.equal(
    await verifySessionToken(token, config, { nowMs: nowMs + (config.sessionTtlSeconds * 1000) }),
    null,
  );
});

test('operator session is explicit, short-lived, and grants write permission', async () => {
  const nowMs = Date.UTC(2026, 7, 12, 0, 0, 0);
  const config = loadAuthConfig(productionEnv);
  const token = await createSessionToken(config, {
    nowMs,
    ttlSeconds: config.operatorTtlSeconds,
    permissions: operatorPermissions(),
  });
  const claims = await verifySessionToken(token, config, { nowMs: nowMs + 1000 });
  assert.equal(hasPermission(claims, 'harness:write'), true);
  assert.equal(
    await verifySessionToken(token, config, { nowMs: nowMs + (config.operatorTtlSeconds * 1000) }),
    null,
  );
});

test('password comparison and cookie attributes use safe defaults', async () => {
  const config = loadAuthConfig(productionEnv);
  assert.equal(await verifyPassword(productionEnv.DASHBOARD_PASSWORD, config.password), true);
  assert.equal(await verifyPassword('incorrect-password-not-real', config.password), false);
  assert.deepEqual(sessionCookieOptions(config), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: config.sessionTtlSeconds,
  });
});

test('dashboard and all credential-bearing API paths are server-protected', () => {
  assert.equal(isDashboardPath('/dashboard'), true);
  assert.equal(isDashboardPath('/dashboard/private'), true);
  assert.equal(isPublicDashboardRoute('/dashboard/login'), true);
  assert.equal(isPublicDashboardRoute('/dashboard/logout'), true);
  assert.equal(isPublicDashboardRoute('/dashboard/private'), false);
  for (const path of [
    '/api/dashboard/state',
    '/api/x-harness/x-accounts',
    '/api/line-harness/line-accounts',
  ]) {
    assert.equal(isProtectedApiPath(path), true, path);
  }
  assert.equal(isProtectedApiPath('/api/public'), false);
});

test('mutating requests require exact same-origin and responses deny caching/CORS', async () => {
  const allowed = new Request('https://example.test/api/dashboard/state', {
    method: 'POST',
    headers: { Origin: 'https://example.test' },
  });
  const crossOrigin = new Request('https://example.test/api/dashboard/state', {
    method: 'POST',
    headers: { Origin: 'https://attacker.invalid' },
  });
  const missingOrigin = new Request('https://example.test/api/dashboard/state', { method: 'POST' });
  assert.equal(isSameOriginRequest(allowed), true);
  assert.equal(isSameOriginRequest(crossOrigin), false);
  assert.equal(isSameOriginRequest(missingOrigin), false);

  const response = jsonResponse({ ok: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
});

test('rate limiting fails closed in production and has bounded test fallback', async () => {
  resetRateLimitsForTests();
  const unavailable = await consumeRateLimit(undefined, 'production-key');
  assert.equal(unavailable.allowed, false);
  assert.equal(unavailable.unavailable, true);

  const first = await consumeRateLimit(undefined, 'test-key', {
    allowLocalFallback: true,
    limit: 1,
    nowMs: 1000,
  });
  const second = await consumeRateLimit(undefined, 'test-key', {
    allowLocalFallback: true,
    limit: 1,
    nowMs: 1001,
  });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});
