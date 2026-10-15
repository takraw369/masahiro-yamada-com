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
type Pending = { target: string; state: string; verifier: string; redirectUri: string; expires: number };
interface OAuthService {
  xOAuthReadConfig(): Promise<unknown>;
  xOAuthBeginRead(input: { target: string; state: string; challenge: string; redirectUri: string }): Promise<unknown>;
  xOAuthCompleteRead(input: { target: string; code: string; verifier: string; redirectUri: string }): Promise<unknown>;
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
async function settings(env: XOAuthEnv, origin: string) {
  if (!nativeXReadEnabled(env)) return { error: 'x_oauth_disabled' };
  if (!env.DASHBOARD_SESSION_SECRET) return { error: 'x_oauth_configuration_required' };
  if (!env.FLOW_RUNNER || typeof env.FLOW_RUNNER.xOAuthReadConfig !== 'function') return { error: 'x_oauth_runner_unavailable' };
  const raw = await env.FLOW_RUNNER.xOAuthReadConfig();
  if (!raw || typeof raw !== 'object') return { error: 'x_oauth_configuration_required' };
  const config = raw as Record<string, unknown>;
  const redirectUri = callbackUri(config.redirectUri, origin);
  return config.enabled === true && config.configured === true && redirectUri
    ? { redirectUri } : { error: 'x_oauth_configuration_required' };
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
    return jsonResponse({ available: 'redirectUri' in config, ...config, scopes: ['users.read', 'tweet.read'], offlineAccess: false, receipt });
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
    const pending: Pending = { target: handle, state: b64(crypto.getRandomValues(new Uint8Array(32))), verifier: b64(crypto.getRandomValues(new Uint8Array(32))), redirectUri: config.redirectUri, expires: Date.now() + ttl * 1000 };
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
    if (!config.redirectUri || config.redirectUri !== pending.redirectUri) return finish(context, 'failed');
    const raw = await env.FLOW_RUNNER!.xOAuthCompleteRead({ target: String(pending.target), code: params.get('code')!, verifier: pending.verifier, redirectUri: config.redirectUri });
    const safe = parseNativeXReadResponse(raw);
    const result = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const scopes = result.scopes;
    if (!safe || safe.data[0].username.toLowerCase() !== String(pending.target).toLowerCase()
      || result.proof !== 'oauth_callback' || result.tokenStored !== false || typeof result.verifiedAt !== 'string' || Math.abs(Date.now() - Date.parse(result.verifiedAt)) > 60000 || !Number.isFinite(Date.parse(String(result.verifiedAt)))
      || !Array.isArray(scopes) || scopes.length !== 2 || !['users.read', 'tweet.read'].every(scope => scopes.includes(scope))) {
      return finish(context, result.error === 'x_oauth_identity_mismatch' ? 'identity_mismatch' : 'failed');
    }
    await context.cookies.set(X_OAUTH_RECEIPT_COOKIE, await sealOAuthCookie(env.DASHBOARD_SESSION_SECRET!, origin, 'receipt', {
      target: pending.target, result: safe, verifiedAt: result.verifiedAt, expires: Date.now() + ttl * 1000,
    }), cookieOptions(context));
    return finish(context, 'verified');
  } catch { return finish(context, 'failed'); }
}
