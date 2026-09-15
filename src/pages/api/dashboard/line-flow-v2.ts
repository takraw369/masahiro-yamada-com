import type { APIContext } from 'astro';
import { verifyDashboardSession } from '../../../lib/dashboardAuth.ts';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';
import { isSameOriginRequest, jsonResponse } from '../../../lib/security/request.mjs';

type Action = 'analytics' | 'routes:list' | 'routes:replace';

type ReplyRouteInput = {
  matchType: 'exact' | 'contains';
  matchValue: string;
  toStepId: string;
  priority?: number;
};

function isUuidLike(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function validRoute(value: unknown): value is ReplyRouteInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const route = value as Record<string, unknown>;
  return (route.matchType === 'exact' || route.matchType === 'contains')
    && typeof route.matchValue === 'string'
    && route.matchValue.trim().length >= 1
    && route.matchValue.length <= 120
    && isUuidLike(route.toStepId)
    && (route.priority === undefined || (Number.isInteger(route.priority) && Number(route.priority) >= 1 && Number(route.priority) <= 10000));
}

export const POST = async (context: APIContext) => {
  const env = getSiteStorageEnv(context.locals);
  const url = new URL(context.request.url);

  if (!await verifyDashboardSession(
    context.cookies.get('ace-dash-auth')?.value,
    env.DASHBOARD_PASSWORD || '',
    url.origin,
  )) return jsonResponse({ error: 'unauthorized' }, 401);

  if (!isSameOriginRequest(context.request)) return jsonResponse({ error: 'same_origin_required' }, 403);
  if (!context.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: 'json_required' }, 415);
  }

  const raw = await context.request.text();
  if (new TextEncoder().encode(raw).byteLength > 20_000) return jsonResponse({ error: 'invalid_body' }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const action = body.action as Action;
  const scenarioId = body.scenarioId;
  if (!['analytics', 'routes:list', 'routes:replace'].includes(action) || !isUuidLike(scenarioId)) {
    return jsonResponse({ error: 'invalid_input' }, 400);
  }

  const payload: Record<string, unknown> = { scenarioId };
  if (action === 'routes:replace') {
    if (!isUuidLike(body.stepId) || !Array.isArray(body.routes) || body.routes.length > 20 || !body.routes.every(validRoute)) {
      return jsonResponse({ error: 'invalid_input' }, 400);
    }
    payload.stepId = body.stepId;
    payload.routes = body.routes.map((route) => ({
      matchType: route.matchType,
      matchValue: route.matchValue.trim(),
      toStepId: route.toStepId,
      priority: route.priority ?? 100,
    }));
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const data = await supabaseRpc<unknown>(env, 'masa_line_flow_v2', {
      p_owner_key: ownerKey,
      p_action: action,
      p_payload: payload,
    });
    return jsonResponse({ success: true, data }, 200);
  } catch (error) {
    console.error('LINE Flow v2 API failed', {
      action,
      error: error instanceof Error ? error.message.replace(/:[\s\S]*$/u, '') : 'unknown',
    });
    return jsonResponse({
      error: 'line_runtime_unavailable',
      message: 'LINE Flowの分析・分岐データを更新できませんでした。少し待ってから再試行してください。',
      retryable: true,
    }, 502);
  }
};
