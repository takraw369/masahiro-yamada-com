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

type XPostDraftRequest = {
  source: {
    title?: string;
    excerpt?: string;
    topic?: string;
    factType?: string;
    whyItMatters?: string;
    sourceClaim?: string;
    sourceUrl?: string;
  };
  account: {
    username: string;
    name?: string;
    profile?: string;
    concept: string;
    worldview: string;
    audience: string;
    tone: string;
    pillars?: string[];
    boundary: string;
  };
};

const CANONICAL_WRITE_CONFIRMATION = 'CONFIRM_ONE_CANONICAL_WRITE';

type CanonicalTargetRequest = {
  sourceId: number; sourceUrl: string; targetId: string;
  action: 'PATCH' | 'LINK_EXISTING' | 'NO_NEW_FILE';
  appendText: string; evidenceText: string;
  conflictStatus: 'clear' | 'conflict' | 'unreviewed';
};
type CanonicalTargetAuthorization = CanonicalTargetRequest & {
  targetRevision: string; targetDigest: string; sourceDigest: string; deltaDigest: string;
};

interface FlowRunnerBinding {
  health(): Promise<unknown>;
  status(limit?: number): Promise<unknown>;
  runWorkflow(workflowId: string, payload?: Record<string, unknown>): Promise<unknown>;
  raindropSearch(search: string, limit?: number): Promise<unknown>;
  raindropGet(ids: number[]): Promise<unknown>;
  raindropCurate(operations: CuratorOperation[]): Promise<unknown>;
  canonicalAssetPreview(sourceId: number, target?: CanonicalTargetRequest): Promise<unknown>;
  canonicalAssetWrite(sourceId: number, confirmation: string, target?: CanonicalTargetAuthorization): Promise<unknown>;
  generateXPostDraft(input: XPostDraftRequest): Promise<unknown>;
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

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) > 0 ? value as number : null;
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

function cleanOptionalString(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
}

function cleanRequiredString(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) return null;
  return value.trim();
}

function xPostDraftInput(value: unknown): XPostDraftRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (!root.source || typeof root.source !== 'object' || Array.isArray(root.source)) return null;
  if (!root.account || typeof root.account !== 'object' || Array.isArray(root.account)) return null;
  const source = root.source as Record<string, unknown>;
  const account = root.account as Record<string, unknown>;

  const username = cleanRequiredString(account.username, 80);
  const concept = cleanRequiredString(account.concept, 800);
  const worldview = cleanRequiredString(account.worldview, 800);
  const audience = cleanRequiredString(account.audience, 600);
  const tone = cleanRequiredString(account.tone, 600);
  const boundary = cleanRequiredString(account.boundary, 800);
  if (!username || !concept || !worldview || !audience || !tone || !boundary) return null;

  const name = cleanOptionalString(account.name, 200);
  const profile = cleanOptionalString(account.profile, 1200);
  const pillars = cleanStringArray(account.pillars, 8);
  const title = cleanOptionalString(source.title, 1000);
  const excerpt = cleanOptionalString(source.excerpt, 3000);
  const topic = cleanOptionalString(source.topic, 200);
  const factType = cleanOptionalString(source.factType, 100);
  const whyItMatters = cleanOptionalString(source.whyItMatters, 1200);
  const sourceClaim = cleanOptionalString(source.sourceClaim, 2000);
  const sourceUrl = cleanOptionalString(source.sourceUrl, 2000);
  if ([name, profile, title, excerpt, topic, factType, whyItMatters, sourceClaim, sourceUrl].some((item) => item === null) || pillars === null) return null;

  return {
    source: {
      ...(title ? { title } : {}),
      ...(excerpt ? { excerpt } : {}),
      ...(topic ? { topic } : {}),
      ...(factType ? { factType } : {}),
      ...(whyItMatters ? { whyItMatters } : {}),
      ...(sourceClaim ? { sourceClaim } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
    },
    account: {
      username: username.replace(/^@/, ''),
      ...(name ? { name } : {}),
      ...(profile ? { profile } : {}),
      concept,
      worldview,
      audience,
      tone,
      ...(pillars ? { pillars } : {}),
      boundary,
    },
  };
}

function canonicalTarget(value: unknown, sourceId: number, write: boolean): CanonicalTargetRequest | CanonicalTargetAuthorization | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.sourceId !== sourceId || typeof input.sourceUrl !== 'string' || input.sourceUrl.length > 4000) return null;
  try {
    const url = new URL(input.sourceUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
  } catch { return null; }
  if (typeof input.targetId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(input.targetId)) return null;
  if (!['PATCH', 'LINK_EXISTING', 'NO_NEW_FILE'].includes(String(input.action))) return null;
  if (typeof input.appendText !== 'string' || input.appendText.length > 6000
    || (input.action === 'PATCH' ? !input.appendText.trim() : input.appendText !== '')) return null;
  if (typeof input.evidenceText !== 'string' || !input.evidenceText.trim() || input.evidenceText.length > 2000) return null;
  if (!['clear', 'conflict', 'unreviewed'].includes(String(input.conflictStatus))) return null;
  const request: CanonicalTargetRequest = {
    sourceId, sourceUrl: input.sourceUrl, targetId: input.targetId,
    action: input.action as CanonicalTargetRequest['action'], appendText: input.appendText,
    evidenceText: input.evidenceText, conflictStatus: input.conflictStatus as CanonicalTargetRequest['conflictStatus'],
  };
  if (!write) return request;
  if (typeof input.targetRevision !== 'string' || !input.targetRevision || input.targetRevision.length > 512) return null;
  const digests = [input.targetDigest, input.sourceDigest, input.deltaDigest];
  if (!digests.every(digest => typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest))) return null;
  return { ...request, targetRevision: input.targetRevision, targetDigest: input.targetDigest as string,
    sourceDigest: input.sourceDigest as string, deltaDigest: input.deltaDigest as string };
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
      case 'x.postDraft': {
        const input = xPostDraftInput(body.input);
        if (!input) return json({ ok: false, error: 'invalid_x_post_draft_input' }, 400);
        return json({ ok: true, data: await flow.generateXPostDraft(input) });
      }
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
      case 'canonical.preview': {
        const sourceId = positiveInteger(body.sourceId);
        if (!sourceId) return json({ ok: false, error: 'invalid_source_id' }, 400);
        if (body.target !== undefined) {
          const target = canonicalTarget(body.target, sourceId, false);
          if (!target) return json({ ok: false, error: 'invalid_canonical_target' }, 400);
          const health = await flow.health() as { canonicalTargetContract?: unknown } | null;
          if (health?.canonicalTargetContract !== 'exact_source_target_v2') return json({ ok: false, error: 'canonical_target_runner_not_ready' }, 503);
          return json({ ok: true, data: await flow.canonicalAssetPreview(sourceId, target) });
        }
        return json({ ok: true, data: await flow.canonicalAssetPreview(sourceId) });
      }
      case 'canonical.write': {
        const sourceId = positiveInteger(body.sourceId);
        if (!sourceId) return json({ ok: false, error: 'invalid_source_id' }, 400);
        const confirmation = typeof body.confirmation === 'string' ? body.confirmation : '';
        if (confirmation !== CANONICAL_WRITE_CONFIRMATION) {
          return json({ ok: false, error: 'canonical_human_gate_required' }, 400);
        }
        if (body.target !== undefined) {
          const target = canonicalTarget(body.target, sourceId, true);
          if (!target) return json({ ok: false, error: 'invalid_canonical_target_authorization' }, 400);
          const health = await flow.health() as { canonicalTargetContract?: unknown } | null;
          if (health?.canonicalTargetContract !== 'exact_source_target_v2') return json({ ok: false, error: 'canonical_target_runner_not_ready' }, 503);
          return json({ ok: true, data: await flow.canonicalAssetWrite(sourceId, confirmation, target as CanonicalTargetAuthorization) });
        }
        return json({ ok: true, data: await flow.canonicalAssetWrite(sourceId, confirmation) });
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
