import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';

interface FlowRunnerBinding {
  profileJevPreview(rawText: string): Promise<unknown>;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function runner(): FlowRunnerBinding | null {
  const env = workerEnv as unknown as { FLOW_RUNNER?: FlowRunnerBinding };
  return env.FLOW_RUNNER ?? null;
}

export const POST = async ({ request }: APIContext) => {
  const flow = runner();
  if (!flow) return json({ ok: false, error: 'flow_runner_unavailable' }, 503);

  let rawText = '';
  try {
    const body = await request.json() as Record<string, unknown>;
    rawText = typeof body?.rawText === 'string' ? body.rawText.trim() : '';
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!rawText || rawText.length > 4000) {
    return json({ ok: false, error: 'invalid_profile_text' }, 400);
  }

  try {
    return json({ ok: true, data: await flow.profileJevPreview(rawText) });
  } catch {
    return json({ ok: false, error: 'profile_preview_failed' }, 502);
  }
};
