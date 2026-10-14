import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { verifyDashboardSession } from '../../../lib/dashboardAuth';
import { jsonResponse } from '../../../lib/security/request.mjs';
import { nativeXReadEnabled, parseNativeXReadResponse } from '../../../lib/xNativeReadPolicy';

interface NativeXReadService {
  xNativeAccountsReadOnly(): Promise<unknown>;
}

interface NativeXReadEnv {
  DASHBOARD_PASSWORD?: string;
  X_NATIVE_READ_ENABLED?: string;
  FLOW_RUNNER?: NativeXReadService;
}

/**
 * Private Dashboard-only diagnostics. There is deliberately no POST endpoint,
 * no sender, and no automatic fallback to X Harness or a public API.
 */
export async function handleNativeXRead(context: APIContext, env: NativeXReadEnv) {
  const origin = new URL(context.request.url).origin;
  if (!await verifyDashboardSession(context.cookies.get('ace-dash-auth')?.value, env.DASHBOARD_PASSWORD ?? '', origin)) {
    return jsonResponse({ success: false, error: 'unauthorized' }, 401);
  }

  if (!nativeXReadEnabled(env)) {
    return jsonResponse({ success: false, error: 'native_x_read_disabled', enabled: false }, 423);
  }

  if (!env.FLOW_RUNNER || typeof env.FLOW_RUNNER.xNativeAccountsReadOnly !== 'function') {
    return jsonResponse({ success: false, error: 'native_x_runner_unavailable' }, 503);
  }

  try {
    const raw = await env.FLOW_RUNNER.xNativeAccountsReadOnly();
    const safe = parseNativeXReadResponse(raw);
    if (!safe) return jsonResponse({ success: false, error: 'native_x_response_invalid' }, 502);
    return jsonResponse({ ...safe, enabled: true });
  } catch {
    // Never expose upstream X errors or any token details in a website response.
    return jsonResponse({ success: false, error: 'native_x_read_failed' }, 502);
  }
}

export const GET = (context: APIContext) =>
  handleNativeXRead(context, workerEnv as unknown as NativeXReadEnv);
