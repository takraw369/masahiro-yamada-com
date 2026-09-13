import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { verifyBridgeEnvelope } from '../../../lib/security/raindrop-command-jwk';

const BRIDGE_PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: '27xJrkm5xPGvTZxmo6J8fkPsTyzGVxL2ZW8l6ZgYXX4',
  y: 'GTE856GdRU6vdAxPa-_H6tKd8AuGc4ZwGN_zwizD5j4',
};

interface FlowRunnerBinding {
  raindropSearch(search: string, limit?: number): Promise<unknown>;
  raindropGet(ids: number[]): Promise<unknown>;
  raindropCurate(operations: Array<Record<string, unknown>>): Promise<unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const POST = async ({ request }: APIContext) => {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > 100000) return json({ ok: false, error: 'payload_too_large' }, 413);

  let raw: string;
  try { raw = await request.text(); } catch { return json({ ok: false, error: 'invalid_body' }, 400); }
  if (!raw || raw.length > 100000) return json({ ok: false, error: 'payload_too_large' }, 413);

  let input: unknown;
  try { input = JSON.parse(raw); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  let envelope;
  try { envelope = await verifyBridgeEnvelope(BRIDGE_PUBLIC_KEY, input); } catch { return json({ ok: false, error: 'invalid_signature' }, 401); }
  if (!envelope) return json({ ok: false, error: 'unauthorized' }, 401);

  const flow = (workerEnv as unknown as { FLOW_RUNNER?: FlowRunnerBinding }).FLOW_RUNNER;
  if (!flow) return json({ ok: false, error: 'flow_runner_unavailable' }, 503);

  try {
    if (envelope.payload.action === 'search') {
      const data = await flow.raindropSearch(envelope.payload.search, envelope.payload.limit ?? 25);
      return json({ ok: true, commandId: envelope.commandId, data });
    }
    if (envelope.payload.action === 'get') {
      const data = await flow.raindropGet(envelope.payload.ids);
      return json({ ok: true, commandId: envelope.commandId, data });
    }
    const data = await flow.raindropCurate(envelope.payload.operations as Array<Record<string, unknown>>);
    const ok = !data || typeof data !== 'object' || (data as Record<string, unknown>).ok !== false;
    return json({ ok, commandId: envelope.commandId, data }, ok ? 200 : 409);
  } catch {
    return json({ ok: false, error: 'flow_runner_request_failed', commandId: envelope.commandId }, 502);
  }
};
