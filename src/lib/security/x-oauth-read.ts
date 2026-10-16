import type { APIContext } from 'astro';
import { verifyDashboardSession } from '../dashboardAuth.ts';
import { isSameOriginRequest, jsonResponse, privateHeaders } from './request.mjs';
import { nativeXReadEnabled, parseNativeXReadResponse } from '../xNativeReadPolicy.ts';

const targets = ['MASAHIRO_501', 'aima_no_te', 'kodomo_athlete', 'sunlovesflow'];
export const X_OAUTH_CALLBACK_PATH = '/api/dashboard/x-oauth/callback';
export const X_OAUTH_PENDING_COOKIE = 'masa-x-oauth-pending';
export const X_OAUTH_RECEIPT_COOKIE = 'masa-x-oauth-read-receipt';
const ttl = 600;
const encoder = new TextEncoder();
type Pending = { target: string; state: string; verifier: string; redirectUri: string; expires: number; persist: boolean; expectedUserId?: string };
export type XOAuthConnection = { target: string; userId: string; username: string; connectedAt: string; verifiedAt: string; expiresAt: string; status: 'connected' | 'expired' | 'reauthorization_required' };
interface OAuthService {
  xOAuthReadConfig(): Promise<unknown>;
  xOAuthBeginRead(input: { target: string; state: string; challenge: string; redirectUri: string }): Promise<unknown>;
  xOAuthCompleteRead(input: { target: string; code: string; verifier: string; redirectUri: string; persist?: boolean; expectedUserId?: string }): Promise<unknown>;
  xOAuthConnectionsRead?(): Promise<unknown>;
  xOAuthConnectionRecheckRead?(input: { target: string; expectedUserId: string }): Promise<unknown>;
  xOAuthDisconnectRead?(input: { target: string; expectedUserId: string }): Promise<unknown>;
}
export interface XOAuthEnv { DASHBOARD_PASSWORD?: string; DASHBOARD_SESSION_SECRET?: string; X_NATIVE_READ_ENABLED?: string; FLOW_RUNNER?: OAuthService }

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function key(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`masa:x-oauth-read:v1:${secret}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function sealOAuthCookie(secret: string, origin: string, purpose: string, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`${origin}:${purpose}`) }, await key(secret), encoder.encode(JSON.stringify(value)));
  return `${b64(iv)}.${b64(new Uint8Array(data))}`;
}
export async function openOAuthCookie(secret: string, origin: string, purpose: string, value?: string): Promise<Record<string, unknown> | null> {
  try {
    if (!secret || !value || value.length > 3500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null;
    const [iv, data] = value.split('.');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: encoder.encode(`${origin}:${purpose}`) }, await key(secret), unb64(data));
    const result: unknown = JSON.parse(new TextDecoder().decode(plain));
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    const item = result as Record<string, unknown>;
    if (typeof item.expires !== 'number' || item.expires <= Date.now() || item.expires > Date.now() + ttl * 1000) return null;
    return item;
  } catch { return null; }
}
function cookieOptions(context: APIContext) {
  return { path: '/api/dashboard/x-oauth', httpOnly: true, secure: new URL(context.request.url).protocol === 'https:', sameSite: 'lax' as const, maxAge: ttl };
}
async function authorized(context: APIContext, env: XOAuthEnv) {
  return await verifyDashboardSession(context.cookies.get('ace-dash-auth')?.value, env.DASHBOARD_PASSWORD || '', new URL(context.request.url).origin);
}
function target(value: unknown) {
  return typeof value === 'string' ? targets.find(item => item.toLowerCase() === value.replace(/^@/, '').toLowerCase()) : undefined;
}
function callbackUri(value: unknown, origin: string) {
  return typeof value === 'string' && value === `${origin}${X_OAUTH_CALLBACK_PATH}` ? value : null;
}
const numericId = (value: unknown): value is string => typeof value === 'string' && /^\d{1,25}$/.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
// Only explicitly allowed metadata may cross the service/browser boundary.
export function parseXOAuthConnection(raw: unknown): XOAuthConnection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>; const handle = target(row.target);
  if (!handle || !numericId(row.userId) || typeof row.username !== 'string' || row.username.toLowerCase() !== handle.toLowerCase()
    || !date(row.connectedAt) || !date(row.verifiedAt) || !date(row.expiresAt)
    || !['connected', 'expired', 'reauthorization_required'].includes(String(row.status))) return null;
  return { target: handle, userId: row.userId, username: row.username, connectedAt: row.connectedAt, verifiedAt: row.verifiedAt, expiresAt: row.expiresAt,
    status: row.status === 'connected' && Date.parse(row.expiresAt) <= Date.now() ? 'expired' : row.status as XOAuthConnection['status'] };
}
async function connections(env: XOAuthEnv, required = false): Promise<XOAuthConnection[]> {
  if (typeof env.FLOW_RUNNER?.xOAuthConnectionsRead !== 'function') {
    if (required) throw new Error();
    return [];
  }
  const raw = await env.FLOW_RUNNER.xOAuthConnectionsRead();
  if (!raw || typeof raw !== 'object') throw new Error();
  const result = raw as Record<string, unknown>;
  if (result.success !== true || result.postingEnabled !== false || result.schedulingEnabled !== false || !Array.isArray(result.data) || result.data.length > 4) throw new Error();
  const rows = result.data.map(parseXOAuthConnection);
  if (rows.some(row => !row) || new Set(rows.map(row => row!.target)).size !== rows.length || new Set(rows.map(row => row!.userId)).size !== rows.length) throw new Error();
  return rows as XOAuthConnection[];
}
async function settings(env: XOAuthEnv, origin: string) {
  if (!nativeXReadEnabled(env)) return { error: 'x_oauth_disabled' };
  if (!env.DASHBOARD_SESSION_SECRET) return { error: 'x_oauth_configuration_required' };
  if (!env.FLOW_RUNNER || typeof env.FLOW_RUNNER.xOAuthReadConfig !== 'function') return { error: 'x_oauth_runner_unavailable' };
  const raw = await env.FLOW_RUNNER.xOAuthReadConfig();
  if (!raw || typeof raw !== 'object') return { error: 'x_oauth_configuration_required' };
  const config = raw as Record<string, unknown>;
  const redirectUri = callbackUri(config.redirectUri, origin);
  const enabledTargets = Array.isArray(config.enabledTargets) ? config.enabledTargets.map(target).filter((item): item is string => !!item) : ['MASAHIRO_501'];
  return config.enabled === true && config.configured === true && redirectUri
    ? { redirectUri, persistenceConfigured: config.persistenceConfigured === true, enabledTargets } : { error: 'x_oauth_configuration_required' };
}
export async function handleXOAuthStatus(context: APIContext, env: XOAuthEnv) {
  if (context.request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!await authorized(context, env)) return jsonResponse({ error: 'unauthorized' }, 401);
  try {
    const origin = new URL(context.request.url).origin;
    const config = await settings(env, origin);
    const saved = await openOAuthCookie(env.DASHBOARD_SESSION_SECRET || '', origin, 'receipt', context.cookies.get(X_OAUTH_RECEIPT_COOKIE)?.value);
    const parsed = saved ? parseNativeXReadResponse(saved.result) : null;
    const receipt = parsed && target(saved?.target) && parsed.data[0].username.toLowerCase() === String(saved?.target).toLowerCase()
      ? { ...parsed, target: saved!.target, verifiedAt: saved!.verifiedAt, proof: 'oauth_callback', tokenStored: false } : null;
    const rows = nativeXReadEnabled(env) ? await connections(env, config.persistenceConfigured === true) : [];
    return jsonResponse({ available: 'redirectUri' in config, ...config, connections: rows, scopes: ['users.read', 'tweet.read'], offlineAccess: false, postingEnabled: false, schedulingEnabled: false, receipt });
  } catch { return jsonResponse({ available: false, error: 'x_oauth_configuration_required', receipt: null }); }
}

async function body(context: APIContext) {
  const reader = context.request.body?.getReader(); if (!reader) throw new Error();
  let size = 0; let text = ''; const decoder = new TextDecoder();
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error(); } text += decoder.decode(chunk.value, { stream: true }); }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
export async function handleXOAuthStart(context: APIContext, env: XOAuthEnv) {
  if (context.request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!await authorized(context, env)) return jsonResponse({ error: 'unauthorized' }, 401);
  if (!isSameOriginRequest(context.request)) return jsonResponse({ error: 'same_origin_required' }, 403);
  if (!context.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: 'json_required' }, 415);
  try {
    const input = await body(context);
    const handle = target(input?.target);
    if (!handle || Object.keys(input).some(item => item !== 'target')) return jsonResponse({ error: 'invalid_target' }, 400);
    const origin = new URL(context.request.url).origin;
    const config = await settings(env, origin);
    if (!config.redirectUri) return jsonResponse({ error: config.error }, 503);
    if (!config.enabledTargets!.includes(handle)) return jsonResponse({ error: 'x_oauth_target_not_enabled' }, 403);
    const existing = (await connections(env, config.persistenceConfigured === true)).find(row => row.target === handle);
    const pending: Pending = { target: handle, state: b64(crypto.getRandomValues(new Uint8Array(32))), verifier: b64(crypto.getRandomValues(new Uint8Array(32))), redirectUri: config.redirectUri, expires: Date.now() + ttl * 1000,
      persist: config.persistenceConfigured === true, ...(existing ? { expectedUserId: existing.userId } : {}) };
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(pending.verifier))));
    const response = await env.FLOW_RUNNER!.xOAuthBeginRead({ target: handle, state: pending.state, challenge, redirectUri: pending.redirectUri });
    if (!response || typeof response !== 'object' || !('authorizeUrl' in response) || typeof response.authorizeUrl !== 'string') throw new Error();
    const url = new URL(response.authorizeUrl);
    const params = url.searchParams;
    if (url.origin !== 'https://x.com' || url.pathname !== '/i/oauth2/authorize' || url.username || url.password || url.hash
      || params.get('state') !== pending.state || params.get('code_challenge') !== challenge || params.get('code_challenge_method') !== 'S256'
      || params.get('scope') !== 'users.read tweet.read' || params.get('redirect_uri') !== pending.redirectUri || params.get('response_type') !== 'code' || !params.get('client_id')
      || [...params.keys()].some(item => !['state', 'code_challenge', 'code_challenge_method', 'scope', 'redirect_uri', 'response_type', 'client_id'].includes(item))
      || [...new Set(params.keys())].some(item => params.getAll(item).length !== 1)) throw new Error();
    context.cookies.set(X_OAUTH_PENDING_COOKIE, await sealOAuthCookie(env.DASHBOARD_SESSION_SECRET!, origin, 'pending', pending), cookieOptions(context));
    context.cookies.delete(X_OAUTH_RECEIPT_COOKIE, { path: cookieOptions(context).path });
    return jsonResponse({ authorizeUrl: url.href, target: handle });
  } catch { return jsonResponse({ error: 'x_oauth_start_failed' }, 502); }
}

function finish(context: APIContext, result: string) {
  return new Response(null, { status: 303, headers: privateHeaders({ Location: `/dashboard/post?x_oauth=${result}#x-oauth-read` }) });
}
export async function handleXOAuthCallback(context: APIContext, env: XOAuthEnv) {
  if (context.request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!await authorized(context, env)) return jsonResponse({ error: 'unauthorized' }, 401);
  const origin = new URL(context.request.url).origin;
  const stored = context.cookies.get(X_OAUTH_PENDING_COOKIE)?.value;
  context.cookies.delete(X_OAUTH_RECEIPT_COOKIE, { path: cookieOptions(context).path });
  // Cookie consumption plus the provider's single-use PKCE code prevents replay.
  context.cookies.delete(X_OAUTH_PENDING_COOKIE, { path: cookieOptions(context).path });
  try {
    const pending = await openOAuthCookie(env.DASHBOARD_SESSION_SECRET || '', origin, 'pending', stored);
    const params = new URL(context.request.url).searchParams;
    if (!pending || !target(pending.target) || typeof pending.state !== 'string' || typeof pending.verifier !== 'string'
      || params.getAll('state').length !== 1 || params.get('state') !== pending.state) return finish(context, 'expired');
    if (params.get('error')) return finish(context, 'cancelled');
    if (params.getAll('code').length !== 1 || !params.get('code')) return finish(context, 'failed');
    const config = await settings(env, origin);
    if (!config.redirectUri || config.redirectUri !== pending.redirectUri || !config.enabledTargets!.includes(String(pending.target))
      || (pending.persist === true && config.persistenceConfigured !== true)) return finish(context, 'failed');
    const existing = (await connections(env, pending.persist === true)).find(row => row.target === pending.target);
    if (existing && pending.expectedUserId && existing.userId !== pending.expectedUserId) return finish(context, 'identity_mismatch');
    const expectedUserId = existing?.userId || (numericId(pending.expectedUserId) ? pending.expectedUserId : undefined);
    const raw = await env.FLOW_RUNNER!.xOAuthCompleteRead({ target: String(pending.target), code: params.get('code')!, verifier: pending.verifier, redirectUri: config.redirectUri,
      ...(pending.persist === true ? { persist: true } : {}), ...(expectedUserId ? { expectedUserId } : {}) });
    const safe = parseNativeXReadResponse(raw);
    const result = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const scopes = result.scopes;
    if (!safe || safe.data[0].username.toLowerCase() !== String(pending.target).toLowerCase()
      || (expectedUserId && safe.data[0].id !== expectedUserId)
      || result.proof !== 'oauth_callback' || result.tokenStored !== (pending.persist === true) || typeof result.verifiedAt !== 'string' || Math.abs(Date.now() - Date.parse(result.verifiedAt)) > 60000 || !Number.isFinite(Date.parse(String(result.verifiedAt)))
      || !Array.isArray(scopes) || scopes.length !== 2 || !['users.read', 'tweet.read'].every(scope => scopes.includes(scope))) {
      return finish(context, result.error === 'x_oauth_identity_mismatch' ? 'identity_mismatch' : 'failed');
    }
    if (pending.persist === true) {
      const stored = (await connections(env, true)).find(row => row.target === pending.target);
      return finish(context, stored?.userId === safe.data[0].id && stored.status === 'connected' ? 'connected' : 'failed');
    }
    await context.cookies.set(X_OAUTH_RECEIPT_COOKIE, await sealOAuthCookie(env.DASHBOARD_SESSION_SECRET!, origin, 'receipt', {
      target: pending.target, result: safe, verifiedAt: result.verifiedAt, expires: Date.now() + ttl * 1000,
    }), cookieOptions(context));
    return finish(context, 'verified');
  } catch { return finish(context, 'failed'); }
}

export async function handleXOAuthConnectionAction(context: APIContext, env: XOAuthEnv, action: 'recheck' | 'disconnect') {
  if (context.request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!await authorized(context, env)) return jsonResponse({ error: 'unauthorized' }, 401);
  if (!isSameOriginRequest(context.request)) return jsonResponse({ error: 'same_origin_required' }, 403);
  if (!context.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: 'json_required' }, 415);
  if (!nativeXReadEnabled(env)) return jsonResponse({ error: 'x_oauth_disabled' }, 503);
  try {
    const input = await body(context); const handle = target(input?.target);
    if (!handle || Object.keys(input).some(item => item !== 'target')) return jsonResponse({ error: 'invalid_target' }, 400);
    const existing = (await connections(env, true)).find(row => row.target === handle);
    if (!existing) return jsonResponse({ error: 'x_oauth_connection_missing' }, 404);
    const method = action === 'disconnect' ? env.FLOW_RUNNER?.xOAuthDisconnectRead : env.FLOW_RUNNER?.xOAuthConnectionRecheckRead;
    if (typeof method !== 'function') return jsonResponse({ error: 'x_oauth_configuration_required' }, 503);
    const args = { target: handle, expectedUserId: existing.userId };
    const raw = action === 'disconnect'
      ? await env.FLOW_RUNNER!.xOAuthDisconnectRead!(args)
      : await env.FLOW_RUNNER!.xOAuthConnectionRecheckRead!(args);
    if (!raw || typeof raw !== 'object') throw new Error();
    const result = raw as Record<string, unknown>;
    if (result.success !== true || result.postingEnabled !== false || result.schedulingEnabled !== false) throw new Error();
    const rows = await connections(env, true);
    if (action === 'disconnect' && rows.some(row => row.target === handle)) throw new Error();
    const connection = rows.find(row => row.target === handle);
    if (action === 'recheck' && (!connection || connection.userId !== existing.userId)) throw new Error();
    return jsonResponse({ success: true, connections: rows, postingEnabled: false, schedulingEnabled: false });
  } catch { return jsonResponse({ error: action === 'disconnect' ? 'x_oauth_disconnect_failed' : 'x_oauth_recheck_failed' }, 502); }
}
