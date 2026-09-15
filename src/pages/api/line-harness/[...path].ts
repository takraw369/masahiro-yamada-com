import type { APIContext } from 'astro';
import { verifyDashboardSession } from '../../../lib/dashboardAuth.ts';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';
import { resolveHarnessAction, validateHarnessBody } from '../../../lib/security/harness-policy.mjs';
import { isSameOriginRequest, jsonResponse } from '../../../lib/security/request.mjs';

type RpcCall = { action: string; payload: Record<string, unknown> };

function mapLineAction(method: string, path: string, body: Record<string, unknown>): RpcCall | null {
  const parts = path.split('/');

  if (method === 'GET' && path === 'line-accounts') return { action: 'line-accounts', payload: {} };
  if (method === 'GET' && path === 'tags') return { action: 'tags', payload: {} };
  if (path === 'scenarios') {
    if (method === 'GET') return { action: 'scenarios:list', payload: {} };
    if (method === 'POST') return { action: 'scenarios:create', payload: body };
  }

  if (parts[0] !== 'scenarios' || !parts[1]) return null;
  const scenarioId = parts[1];

  if (parts.length === 2) {
    if (method === 'GET') return { action: 'scenarios:get', payload: { id: scenarioId } };
    if (method === 'PUT') return { action: 'scenarios:update', payload: { id: scenarioId, ...body } };
  }

  if (parts.length === 3 && parts[2] === 'stats' && method === 'GET') {
    return { action: 'scenarios:stats', payload: { id: scenarioId } };
  }

  if (parts.length === 3 && parts[2] === 'steps' && method === 'POST') {
    return { action: 'steps:create', payload: { scenarioId, ...body } };
  }

  if (parts.length === 4 && parts[2] === 'steps' && parts[3] === 'reorder' && method === 'POST') {
    return { action: 'steps:reorder', payload: { scenarioId, ...body } };
  }

  if (parts.length === 4 && parts[2] === 'steps' && parts[3] !== 'reorder') {
    const stepId = parts[3];
    if (method === 'PUT') return { action: 'steps:update', payload: { scenarioId, stepId, ...body } };
    if (method === 'DELETE') return { action: 'steps:delete', payload: { scenarioId, stepId } };
  }

  return null;
}

export const ALL = async (context: APIContext) => {
  const env = getSiteStorageEnv(context.locals);
  const url = new URL(context.request.url);

  if (!await verifyDashboardSession(
    context.cookies.get('ace-dash-auth')?.value,
    env.DASHBOARD_PASSWORD || '',
    url.origin,
  )) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  if (!isSameOriginRequest(context.request)) {
    return jsonResponse({ error: 'same_origin_required' }, 403);
  }

  const resolved = resolveHarnessAction('line', context.request.method, context.params.path);
  if (!resolved || resolved.path === 'broadcasts') {
    return jsonResponse({ error: 'action_not_allowed' }, 404);
  }
  if (url.search) return jsonResponse({ error: 'query_not_allowed' }, 400);

  let body: Record<string, unknown> = {};
  if (resolved.body) {
    if (!context.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return jsonResponse({ error: 'json_required' }, 415);
    }
    const raw = await context.request.text();
    if (new TextEncoder().encode(raw).byteLength > 10_000) {
      return jsonResponse({ error: 'invalid_body' }, 413);
    }
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }
    if (!validateHarnessBody(resolved.body, body)) {
      return jsonResponse({ error: 'invalid_input' }, 400);
    }
  }

  const rpc = mapLineAction(resolved.method, resolved.path, body);
  if (!rpc) return jsonResponse({ error: 'action_not_allowed' }, 404);

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc<unknown>(env, 'masa_line_flow_api', {
      p_owner_key: ownerKey,
      p_action: rpc.action,
      p_payload: rpc.payload,
    });
    return jsonResponse({ success: true, data }, 200);
  } catch (error) {
    console.error('LINE Flow Supabase adapter failed', {
      action: rpc.action,
      error: error instanceof Error ? error.message.replace(/:[\s\S]*$/u, '') : 'unknown',
    });
    return jsonResponse({
      error: 'line_runtime_unavailable',
      message: 'LINE本番データに接続できませんでした。少し待ってから再接続してください。',
      retryable: true,
    }, 502);
  }
};
