import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';

type CuratorOperation = {
  id: number;
  expectedLink: string;
  action: 'move' | 'tag' | 'trash';
  collectionId?: number;
  addTags?: string[];
  removeTags?: string[];
};

interface FlowRunnerBinding {
  health(): Promise<unknown>;
  status(limit?: number): Promise<unknown>;
  runWorkflow(workflowId: string, payload?: Record<string, unknown>): Promise<unknown>;
  raindropSearch(search: string, limit?: number): Promise<unknown>;
  raindropGet(ids: number[]): Promise<unknown>;
  raindropCurate(operations: CuratorOperation[]): Promise<unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function runner(): FlowRunnerBinding | null {
  const env = workerEnv as unknown as { FLOW_RUNNER?: FlowRunnerBinding };
  return env.FLOW_RUNNER ?? null;
}

function integerArray(value: unknown, max = 150): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) return null;
  if (!value.every((item) => Number.isInteger(item) && item > 0)) return null;
  return [...new Set(value as number[])];
}

function cleanStringArray(value: unknown, max = 40): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > max) return null;
  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 200)) return null;
  return [...new Set((value as string[]).map((item) => item.trim()))];
}

function curatorOperations(value: unknown): CuratorOperation[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 150) return null;
  const parsed: CuratorOperation[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const input = raw as Record<string, unknown>;
    const id = input.id;
    const expectedLink = input.expectedLink;
    const action = input.action;

    if (!Number.isInteger(id) || (id as number) <= 0) return null;
    if (typeof expectedLink !== 'string' || expectedLink.length < 1 || expectedLink.length > 4000) return null;
    if (!['move', 'tag', 'trash'].includes(String(action))) return null;

    const operation: CuratorOperation = {
      id: id as number,
      expectedLink,
      action: action as CuratorOperation['action'],
    };

    if (operation.action === 'move') {
      if (!Number.isInteger(input.collectionId) || ((input.collectionId as number) !== -1 && (input.collectionId as number) <= 0)) return null;
      operation.collectionId = input.collectionId as number;
    }

    if (operation.action === 'tag') {
      const addTags = cleanStringArray(input.addTags);
      const removeTags = cleanStringArray(input.removeTags);
      if (addTags === null || removeTags === null) return null;
      if ((!addTags || addTags.length === 0) && (!removeTags || removeTags.length === 0)) return null;
      operation.addTags = addTags;
      operation.removeTags = removeTags;
    }

    parsed.push(operation);
  }

  return parsed;
}

export const GET = async ({ url }: APIContext) => {
  const flow = runner();
  if (!flow) return json({ ok: false, error: 'flow_runner_unavailable' }, 503);

  try {
    const mode = url.searchParams.get('mode') ?? 'health';
    if (mode === 'health') return json({ ok: true, data: await flow.health() });
    if (mode === 'status') {
      const raw = Number(url.searchParams.get('limit') ?? 30);
      const limit = Number.isFinite(raw) ? Math.max(1, Math.min(Math.floor(raw), 100)) : 30;
      return json({ ok: true, data: await flow.status(limit) });
    }
    return json({ ok: false, error: 'unsupported_mode' }, 400);
  } catch {
    return json({ ok: false, error: 'flow_runner_request_failed' }, 502);
  }
};

export const POST = async ({ request }: APIContext) => {
  const flow = runner();
  if (!flow) return json({ ok: false, error: 'flow_runner_unavailable' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    switch (body.action) {
      case 'raindrop.search': {
        const search = typeof body.search === 'string' ? body.search.trim() : '';
        if (!search || search.length > 240) return json({ ok: false, error: 'invalid_search' }, 400);
        const raw = typeof body.limit === 'number' ? body.limit : 25;
        const limit = Number.isFinite(raw) ? Math.max(1, Math.min(Math.floor(raw), 50)) : 25;
        return json({ ok: true, data: await flow.raindropSearch(search, limit) });
      }
      case 'raindrop.get': {
        const ids = integerArray(body.ids);
        if (!ids) return json({ ok: false, error: 'invalid_ids' }, 400);
        return json({ ok: true, data: await flow.raindropGet(ids) });
      }
      case 'raindrop.curate': {
        const operations = curatorOperations(body.operations);
        if (!operations) return json({ ok: false, error: 'invalid_operations' }, 400);
        return json({ ok: true, data: await flow.raindropCurate(operations) });
      }
      case 'workflow.run': {
        const workflowId = typeof body.workflowId === 'string' ? body.workflowId.trim() : '';
        const allowed = new Set([
          'source_intake_v1',
          'signal_sensor_v1',
          'context_resolver_v1',
          'promotion_candidate_v1',
          'x_bookmark_intake_v1',
        ]);
        if (!allowed.has(workflowId)) return json({ ok: false, error: 'unsupported_workflow' }, 400);
        const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
          ? body.payload as Record<string, unknown>
          : {};
        return json({ ok: true, data: await flow.runWorkflow(workflowId, payload) });
      }
      default:
        return json({ ok: false, error: 'unsupported_action' }, 400);
    }
  } catch {
    return json({ ok: false, error: 'flow_runner_request_failed' }, 502);
  }
};
