import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { env } from './helpers/worker-runtime.mjs';

const {
  REVENUE_NODE_ID, REVENUE_STAGES, REVENUE_FIELDS, createRevenueMission,
  getRevenueReadiness, getRevenueMission, withRevenueMission,
  updateRevenueFields, transitionRevenueMission, validateRevenueBoardUpdate,
} = await import('../src/lib/revenueMission.ts');
const { createFlowBoardSnapshot } = await import('../src/lib/flowBoard.ts');
const { GET, POST } = await import('../src/pages/api/dashboard/board.ts');
const { onRequest } = await import('../src/middleware.ts');
const { createDashboardSession, dashboardOwnerKey } = await import('../src/lib/dashboardAuth.ts');

const origin = 'https://dashboard.example.test';
const fakeEnv = {
  DASHBOARD_PASSWORD: 'test-revenue-owner-and-signing-secret',
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key',
};
const receipt = (name) => `/dashboard/evidence#receipt-${name}`;
const asset = (name) => `https://drive.google.com/file/d/${name}/view`;
const emptyBoard = () => ({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
const boardWith = (mission) => withRevenueMission(createFlowBoardSnapshot(), mission);
const packageFields = {
  sourceAsset: asset('source'), mainContent: asset('pdf'), worksheet: asset('worksheet'),
  promptPack: asset('prompts'), preview: asset('preview'),
  description: '仮説・選択肢・次の7日間の行動を整理するワークブック。',
  coverBrief: '落ち着いた表紙。成果保証や診断を示す表現を使わない。',
  priceHypothesis: '初回の価格仮説: 1,500円。公開時に MASA が確認。',
};

function atQa() {
  let mission = updateRevenueFields(createRevenueMission(), packageFields);
  mission = transitionRevenueMission(mission, 'PACKAGE', { actor: 'ai' });
  return transitionRevenueMission(mission, 'QA', { actor: 'ai' });
}
function reviewed() {
  return updateRevenueFields(atQa(), { qa: '本文・ワーク・例を試した記録: qa-1', policy: '規約・表現・素材権利を確認した記録: policy-1' });
}
function ready() {
  const mission = updateRevenueFields(reviewed(), { publishGate: 'MASA が商品・価格・販売方法を確認: gate-1' });
  return transitionRevenueMission(mission, 'READY_TO_PUBLISH', { actor: 'human' });
}
function live() {
  const mission = updateRevenueFields(ready(), { liveUrl: 'https://marketplace.example.test/products/one', liveEvidence: receipt('published') });
  return transitionRevenueMission(mission, 'LIVE', { actor: 'human' });
}
function validate(previous, next, actor = 'human') {
  return validateRevenueBoardUpdate(boardWith(previous), boardWith(next), { sceneKey: 'main', actor });
}

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, fakeEnv);
});

function context(body, { method = 'POST', path = '/api/dashboard/board', session, requestOrigin = origin, headers = {} } = {}) {
  const writes = [];
  return {
    writes,
    locals: { runtime: { env: { DASHBOARD_PASSWORD: 'obsolete-and-wrong-secret' } } },
    request: new Request(`${origin}${path}`, {
      method,
      headers: { ...(requestOrigin === null ? {} : { Origin: requestOrigin }), 'Content-Type': 'application/json', ...headers },
      ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }),
    cookies: { get: () => session ? { value: session } : undefined, set: (...args) => writes.push(args) },
  };
}
function requestBody(snapshot, expectedRevision = 1, actor = 'human') {
  return { sceneKey: 'main', snapshot, expectedRevision, ...(actor === undefined ? {} : { actor }) };
}

// Emulates only existing Board RPCs. Any request to a marketplace, a publisher,
// a new database table, or any other external endpoint fails the test.
function mockBoard(t, initialSnapshot = emptyBoard(), { initialRevision = 1, beforeSave, readResponse, failRead = false, failSave = false } = {}) {
  let snapshot = structuredClone(initialSnapshot);
  let revision = initialRevision;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, fakeEnv.SUPABASE_URL);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.apikey, fakeEnv.SUPABASE_PUBLISHABLE_KEY);
    const args = JSON.parse(options.body);
    assert.equal(args.p_owner_key, await dashboardOwnerKey(fakeEnv.DASHBOARD_PASSWORD));
    calls.push({ path: parsed.pathname, args });
    if (parsed.pathname === '/rest/v1/rpc/masa_flow_canvas_get_v1') {
      if (failRead) throw new Error('private upstream failure');
      return Response.json(readResponse === undefined ? { sceneKey: args.p_scene_key, snapshot, revision } : readResponse);
    }
    assert.equal(parsed.pathname, '/rest/v1/rpc/masa_flow_canvas_save_v1');
    if (failSave) throw new Error('private save failure');
    if (beforeSave) await beforeSave();
    if (args.p_expected_revision !== null && args.p_expected_revision !== revision) {
      return Response.json({ message: 'revision_conflict' }, { status: 409 });
    }
    snapshot = structuredClone(args.p_snapshot);
    revision += 1;
    return Response.json({ sceneKey: args.p_scene_key, revision, updatedBy: args.p_actor });
  });
  return {
    calls, get snapshot() { return structuredClone(snapshot); }, get revision() { return revision; },
    get saves() { return calls.filter(call => call.path.endsWith('masa_flow_canvas_save_v1')); },
  };
}

test('one First Product starts with honest hypotheses and 14 visible READY criteria', () => {
  const mission = createRevenueMission();
  assert.equal(mission.state, 'ASSET_SOURCE');
  assert.equal(mission.sourceAsset, '');
  assert.match(mission.title, /AI言語化.*7日行動設計/);
  assert.match(mission.promise, /診断や成果保証はしない/);
  const result = getRevenueReadiness(mission);
  assert.equal(result.total, 14);
  assert.equal(result.complete, 3);
  assert.equal(result.ready, false);
  assert.equal(result.missing[0].key, 'sourceAsset');
  assert.match(result.nextAction, /Source asset/);
  assert.deepEqual(REVENUE_STAGES, ['ASSET_SOURCE', 'PACKAGE', 'QA', 'READY_TO_PUBLISH', 'LIVE', 'SALE_DETECTED', 'DELIVERED', 'LEARN']);
});

test('every READY criterion is required, even when a client claims READY', async (t) => {
  for (const { key } of REVENUE_FIELDS.filter(field => field.group !== 'signal')) {
    await t.test(key, () => {
      const mission = { ...ready(), state: 'QA', [key]: '' };
      const result = getRevenueReadiness(mission);
      assert.equal(result.ready, false);
      assert.equal(result.complete, 13);
      assert.deepEqual(result.missing.map(item => item.key), [key]);
      assert.throws(() => transitionRevenueMission(mission, 'READY_TO_PUBLISH', { actor: 'human' }), /revenue_(source_required|package_incomplete|ready_incomplete)/);
    });
  }
});

test('complete path records publication once and permits AI sale, delivery and learning updates without per-sale approval', () => {
  let mission = createRevenueMission();
  const apply = (next, actor = 'ai') => { validate(mission, next, actor); mission = next; };
  apply(updateRevenueFields(mission, { sourceAsset: packageFields.sourceAsset }));
  apply(transitionRevenueMission(mission, 'PACKAGE', { actor: 'ai' }));
  apply(updateRevenueFields(mission, packageFields));
  apply(transitionRevenueMission(mission, 'QA', { actor: 'ai' }));
  apply(updateRevenueFields(mission, { qa: 'QA receipt', policy: 'Policy receipt' }));
  apply(updateRevenueFields(mission, { publishGate: 'MASA reviewed package and price' }), 'human');
  apply(transitionRevenueMission(mission, 'READY_TO_PUBLISH', { actor: 'ai' }));
  apply(updateRevenueFields(mission, { liveUrl: 'https://marketplace.example.test/product/one', liveEvidence: receipt('published') }));
  apply(transitionRevenueMission(mission, 'LIVE', { actor: 'human' }), 'human');
  apply(updateRevenueFields(mission, { saleSignal: receipt('sale') }));
  apply(transitionRevenueMission(mission, 'SALE_DETECTED', { actor: 'ai' }));
  apply(updateRevenueFields(mission, { deliveryEvidence: receipt('delivery') }));
  apply(transitionRevenueMission(mission, 'DELIVERED', { actor: 'system' }), 'system');
  apply(updateRevenueFields(mission, { learning: asset('learning'), nextAction: '説明の改善案を Drive に記録し MASA に提案する。' }));
  apply(transitionRevenueMission(mission, 'LEARN', { actor: 'ai' }));
  assert.equal(mission.state, 'LEARN');
  assert.match(getRevenueReadiness(mission).nextAction, /説明の改善案/);
});

test('skipped stages, missing source, missing package, and unproven sales/delivery/learning fail closed', () => {
  assert.throws(() => transitionRevenueMission(createRevenueMission(), 'PACKAGE', { actor: 'ai' }), /source_required/);
  assert.throws(() => transitionRevenueMission(createRevenueMission(), 'QA', { actor: 'human' }), /invalid_transition/);
  const packaging = transitionRevenueMission(updateRevenueFields(createRevenueMission(), { sourceAsset: asset('one') }), 'PACKAGE', { actor: 'ai' });
  assert.throws(() => transitionRevenueMission(packaging, 'QA', { actor: 'ai' }), /package_incomplete/);
  assert.throws(() => transitionRevenueMission(atQa(), 'LIVE', { actor: 'human' }), /invalid_transition/);
  assert.throws(() => transitionRevenueMission(live(), 'SALE_DETECTED', { actor: 'ai' }), /sale_evidence_required/);
  const sold = transitionRevenueMission(updateRevenueFields(live(), { saleSignal: receipt('sale') }), 'SALE_DETECTED', { actor: 'ai' });
  assert.throws(() => transitionRevenueMission(sold, 'DELIVERED', { actor: 'ai' }), /delivery_evidence_required/);
  const delivered = transitionRevenueMission(updateRevenueFields(sold, { deliveryEvidence: receipt('delivery') }), 'DELIVERED', { actor: 'ai' });
  assert.throws(() => transitionRevenueMission(delivered, 'LEARN', { actor: 'ai' }), /learning_evidence_required/);
  assert.throws(() => transitionRevenueMission(updateRevenueFields(delivered, { learning: receipt('learning') }), 'LEARN', { actor: 'ai' }), /learning_action_required/);
  assert.throws(() => transitionRevenueMission(live(), 'QA', { actor: 'human' }), /invalid_transition/);
});

test('package changes invalidate previous QA, policy and Human Gate, including simultaneous forged approvals', () => {
  const previous = ready();
  const next = updateRevenueFields(previous, { description: 'A revised package', qa: 'claimed fresh QA', policy: 'claimed fresh check', publishGate: 'claimed fresh approval' });
  assert.equal(next.state, 'PACKAGE');
  assert.equal(next.qa, '');
  assert.equal(next.policy, '');
  assert.equal(next.publishGate, '');
  assert.doesNotThrow(() => validate(previous, next, 'ai'));
  assert.throws(() => validate(previous, { ...previous, description: 'A revised package' }, 'human'), /invalid_transition/);
  assert.throws(() => validate(previous, { ...next, qa: previous.qa, policy: previous.policy, publishGate: previous.publishGate }, 'human'), /stale_review/);
  const reviewChanged = updateRevenueFields(previous, { qa: 'new QA receipt' });
  assert.equal(reviewChanged.state, 'QA');
  assert.equal(reviewChanged.publishGate, '');
  assert.doesNotThrow(() => validate(previous, reviewChanged, 'ai'));
  const rework = transitionRevenueMission(previous, 'PACKAGE', { actor: 'ai' });
  assert.equal(rework.qa, '');
  assert.doesNotThrow(() => validate(previous, rework, 'ai'));
  const staleAction = updateRevenueFields({ ...previous, nextAction: '公開する' }, { description: 'Revised' });
  assert.match(getRevenueReadiness(staleAction).nextAction, /QA レビュー記録/);
  const sourceRemoved = updateRevenueFields(previous, { sourceAsset: '' });
  assert.equal(sourceRemoved.state, 'ASSET_SOURCE');
  assert.match(getRevenueReadiness(sourceRemoved).nextAction, /Source asset/);
});

test('only an explicit human audit label can record approval or actual publication; URL alone is insufficient', () => {
  const prior = reviewed();
  const approved = updateRevenueFields(prior, { publishGate: 'MASA approval receipt' });
  for (const actor of ['ai', 'system', undefined, '', true, ['human']]) {
    assert.throws(() => validateRevenueBoardUpdate(boardWith(prior), boardWith(approved), { sceneKey: 'main', actor }), /human_gate_required/);
    assert.throws(() => transitionRevenueMission(ready(), 'LIVE', { actor }), /human_gate_required/);
  }
  assert.doesNotThrow(() => validate(prior, approved, 'human'));
  assert.throws(() => transitionRevenueMission(ready(), 'LIVE', { actor: 'human' }), /publication_evidence_required/);
  const withUrl = updateRevenueFields(ready(), { liveUrl: 'https://marketplace.example.test/one' });
  assert.throws(() => transitionRevenueMission(withUrl, 'LIVE', { actor: 'human' }), /publication_evidence_required/);
  const published = transitionRevenueMission(withUrl, 'LIVE', { actor: 'human', evidence: receipt('published') });
  assert.equal(published.liveEvidence, receipt('published'));
  assert.throws(() => validate(ready(), published, 'ai'), /human_gate_required/);
});

test('published package, price, approval and publication proof stay locked while next improvements remain editable', () => {
  const mission = live();
  for (const key of ['title', 'priceHypothesis', 'sourceAsset', 'qa', 'policy', 'publishGate', 'liveUrl', 'liveEvidence']) {
    const value = ['sourceAsset', 'liveUrl', 'liveEvidence'].includes(key) ? asset('changed') : 'changed';
    assert.throws(() => updateRevenueFields(mission, { [key]: value }), /live_package_locked/, key);
    assert.throws(() => validate(mission, { ...mission, [key]: value }), /live_package_locked/, key);
  }
  assert.equal(updateRevenueFields(mission, { nextAction: 'Prepare a material-change proposal for MASA' }).state, 'LIVE');
});

test('unsafe URLs, arbitrary sale payloads, unknown fields, and oversized content are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://drive.google.com/file/d/1', 'https://user:password@example.test/file']) {
    assert.throws(() => updateRevenueFields(createRevenueMission(), { sourceAsset: url }), /invalid_url/);
  }
  for (const value of ['Buyer email and message', 'https://other.example.test/receipt', '//evil.example.test/receipt']) {
    assert.throws(() => updateRevenueFields(live(), { saleSignal: value }), /invalid_url:saleSignal/);
  }
  assert.doesNotThrow(() => updateRevenueFields(live(), { saleSignal: 'https://masahiroyamada.com/dashboard/evidence#sale-1' }));
  assert.doesNotThrow(() => updateRevenueFields(live(), { learning: 'https://docs.google.com/document/d/learning/edit' }));
  assert.throws(() => updateRevenueFields(ready(), { liveUrl: receipt('not-a-listing') }), /invalid_url:liveUrl/);
  for (const patch of [{ title: 'x'.repeat(401) }, { description: 'x'.repeat(4001) }, { sourceAsset: `https://example.test/${'x'.repeat(1500)}` }, { title: '\u0000bad' }, { title: false }, { extra: 'unknown' }, { state: 'LIVE' }]) {
    assert.throws(() => updateRevenueFields(createRevenueMission(), patch), /revenue_invalid/);
  }
});

test('Board integration preserves existing canvas, unknown metadata, user position, and edges without mutation or duplication', () => {
  const seed = createFlowBoardSnapshot();
  seed.extra = { retained: true };
  seed.nodes[0].externalMetadata = { retained: 'node' };
  seed.edges[0].externalMetadata = { retained: 'edge' };
  const original = structuredClone(seed);
  const first = withRevenueMission(seed, createRevenueMission());
  assert.deepEqual(seed, original);
  assert.equal(first.nodes.length, seed.nodes.length + 1);
  assert.deepEqual(first.nodes.filter(node => node.id !== REVENUE_NODE_ID), seed.nodes);
  assert.deepEqual(first.edges.slice(0, seed.edges.length), seed.edges);
  assert.deepEqual(first.viewport, seed.viewport);
  assert.deepEqual(first.extra, seed.extra);
  const node = first.nodes.find(item => item.id === REVENUE_NODE_ID);
  Object.assign(node, { x: 53, y: 71, w: 456, h: 234, externalMetadata: { retained: true } });
  const nextMission = updateRevenueFields(createRevenueMission(), { nextAction: 'Continue from Drive' });
  const next = withRevenueMission(first, nextMission);
  const updated = next.nodes.find(item => item.id === REVENUE_NODE_ID);
  assert.deepEqual([updated.x, updated.y, updated.w, updated.h], [53, 71, 456, 234]);
  assert.deepEqual(updated.externalMetadata, { retained: true });
  assert.match(updated.note, /Source asset/);
  assert.doesNotMatch(updated.note, /Continue from Drive/);
  assert.equal(next.edges.length, first.edges.length);
  assert.deepEqual(getRevenueMission(next), nextMission);
  const read = getRevenueMission(next);
  read.title = 'client mutation';
  assert.notEqual(getRevenueMission(next).title, read.title);
});

test('Board rejects duplicate/renamed/malformed missions, deletion, alternate scenes, and advanced-stage insertion', () => {
  const snapshot = boardWith(createRevenueMission());
  const duplicate = structuredClone(snapshot);
  duplicate.nodes.push(structuredClone(snapshot.nodes.find(node => node.id === REVENUE_NODE_ID)));
  assert.throws(() => getRevenueMission(duplicate), /duplicate_mission/);
  const renamed = structuredClone(snapshot);
  renamed.nodes.find(node => node.id === REVENUE_NODE_ID).id = 'other-mission';
  assert.throws(() => getRevenueMission(renamed), /invalid_node/);
  for (const malformed of [null, {}, { ...createRevenueMission(), version: 2 }, { ...createRevenueMission(), state: 'PUBLISHING' }, { ...createRevenueMission(), buyerEmail: 'private@example.test' }]) {
    assert.throws(() => getRevenueMission({ nodes: [{ id: REVENUE_NODE_ID, revenueMission: malformed }], edges: [] }), /invalid_mission|invalid_field/);
  }
  assert.throws(() => getRevenueMission({ nodes: [{ id: REVENUE_NODE_ID }], edges: [] }), /invalid_mission/);
  assert.throws(() => validateRevenueBoardUpdate(snapshot, emptyBoard(), { sceneKey: 'main', actor: 'human' }), /removal_forbidden/);
  assert.throws(() => validateRevenueBoardUpdate(emptyBoard(), snapshot, { sceneKey: 'revenue', actor: 'human' }), /main_scene_required/);
  assert.throws(() => validateRevenueBoardUpdate(emptyBoard(), boardWith(ready()), { sceneKey: 'main', actor: 'human' }), /initial_stage_required/);
  assert.doesNotThrow(() => validateRevenueBoardUpdate(emptyBoard(), snapshot, { sceneKey: 'main', actor: 'ai' }));
});

test('actual Board handler persists and reads the one mission via existing owner-scoped RPCs only', async (t) => {
  const storage = mockBoard(t, emptyBoard(), { initialRevision: 0 });
  const snapshot = boardWith(createRevenueMission());
  let response = await POST(context(requestBody(snapshot, 0, 'ai')));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.revision, 1);
  assert.deepEqual(storage.snapshot, snapshot);
  assert.equal(storage.saves[0].args.p_actor, 'ai');
  response = await GET(context(undefined, { method: 'GET', path: '/api/dashboard/board?scene=main' }));
  const read = await response.json();
  assert.equal(read.ok, true);
  assert.deepEqual(getRevenueMission(read.data.snapshot), createRevenueMission());
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('actual handler enforces Human Gate and stage validation on crafted snapshots, not only UI helpers', async (t) => {
  const prior = reviewed();
  const approved = updateRevenueFields(prior, { publishGate: 'MASA approval receipt' });
  const storage = mockBoard(t, boardWith(prior));
  for (const actor of ['ai', 'system', null]) {
    const body = requestBody(boardWith(approved));
    if (actor === null) delete body.actor; else body.actor = actor;
    const response = await POST(context(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'revenue_human_gate_required');
  }
  const response = await POST(context(requestBody(boardWith(approved), 1, 'human')));
  assert.equal(response.status, 200);
  assert.equal(storage.saves.length, 1);
  assert.equal(getRevenueMission(storage.snapshot).publishGate, approved.publishGate);
});

test('actual handler rejects deletion, stale approvals, duplicate missions and initial READY insertion without a save', async (t) => {
  await t.test('existing mission', async (t) => {
    const previous = ready();
    const storage = mockBoard(t, boardWith(previous));
    const duplicate = boardWith(previous);
    duplicate.nodes.push(structuredClone(duplicate.nodes.find(node => node.id === REVENUE_NODE_ID)));
    for (const snapshot of [emptyBoard(), duplicate, boardWith({ ...previous, priceHypothesis: 'changed price' }), boardWith({ ...previous, state: 'SALE_DETECTED' })]) {
      assert.equal((await POST(context(requestBody(snapshot)))).status, 400);
    }
    assert.equal(storage.saves.length, 0);
  });
  await t.test('initial mission', async (t) => {
    const storage = mockBoard(t, emptyBoard(), { initialRevision: 0 });
    const response = await POST(context(requestBody(boardWith(ready()), 0)));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'revenue_initial_stage_required');
    assert.equal(storage.saves.length, 0);
  });
});

test('actual handler records human publication and subsequent AI signals without marketplace or evidence mutations', async (t) => {
  let mission = ready();
  const storage = mockBoard(t, boardWith(mission));
  const save = async (next, actor) => {
    const response = await POST(context(requestBody(boardWith(next), storage.revision, actor)));
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    mission = next;
  };
  const nextLive = transitionRevenueMission(updateRevenueFields(mission, { liveUrl: 'https://marketplace.example.test/product/one', liveEvidence: receipt('published') }), 'LIVE', { actor: 'human' });
  assert.equal((await POST(context(requestBody(boardWith(nextLive), 1, 'ai')))).status, 400);
  await save(nextLive, 'human');
  await save(transitionRevenueMission(updateRevenueFields(mission, { saleSignal: receipt('sale') }), 'SALE_DETECTED', { actor: 'ai' }), 'ai');
  await save(transitionRevenueMission(updateRevenueFields(mission, { deliveryEvidence: receipt('delivery') }), 'DELIVERED', { actor: 'system' }), 'system');
  await save(transitionRevenueMission(updateRevenueFields(mission, { learning: asset('learning'), nextAction: '説明の改善案を MASA に提案する。' }), 'LEARN', { actor: 'ai' }), 'ai');
  assert.equal(getRevenueMission(storage.snapshot).state, 'LEARN');
  assert.equal(storage.saves.length, 4);
});

test('compare-and-swap rejects stale revisions before save and races between read and write at the RPC boundary', async (t) => {
  const base = boardWith(createRevenueMission());
  await t.test('already stale', async (t) => {
    const storage = mockBoard(t, base, { initialRevision: 2 });
    const response = await POST(context(requestBody(base, 1)));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'revision_conflict');
    assert.equal(storage.saves.length, 0);
  });
  await t.test('two simultaneous writers', async (t) => {
    let arrived = 0;
    let release;
    const bothAtSave = new Promise(resolve => { release = resolve; });
    const storage = mockBoard(t, base, { beforeSave: async () => { arrived += 1; if (arrived === 2) release(); await bothAtSave; } });
    const first = boardWith(updateRevenueFields(createRevenueMission(), { nextAction: 'First writer' }));
    const second = boardWith(updateRevenueFields(createRevenueMission(), { nextAction: 'Second writer' }));
    const responses = await Promise.all([POST(context(requestBody(first, 1, 'human'))), POST(context(requestBody(second, 1, 'ai')))]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const winner = responses[0].status === 200 ? first : second;
    assert.deepEqual(storage.snapshot, winner);
    assert.equal(storage.revision, 2);
    assert.ok(storage.saves.every(call => call.args.p_expected_revision === 1));
  });
});

test('Board request validation rejects malformed shapes, sizes, actor types and missing/rounded revisions before storage access', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not reach storage'); });
  const base = requestBody(emptyBoard());
  const cases = [
    ['{', 400, 'invalid_json'], ['null', 400, 'invalid_json'], ['[]', 400, 'invalid_json'],
    [{ ...base, sceneKey: '../main' }, 400, 'invalid_scene_key'],
    [{ ...base, snapshot: null }, 400, 'invalid_snapshot'],
    [{ ...base, snapshot: [] }, 400, 'invalid_snapshot'],
    [{ ...base, snapshot: { nodes: {} , edges: [] } }, 400, 'invalid_snapshot_shape'],
    [{ ...base, snapshot: { nodes: [], edges: {} } }, 400, 'invalid_snapshot_shape'],
    [{ ...base, snapshot: { nodes: Array(501).fill({}), edges: [] } }, 413, 'snapshot_too_large'],
    [{ ...base, snapshot: { nodes: [], edges: Array(1501).fill({}) } }, 413, 'snapshot_too_large'],
    ...[undefined, null, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1].map(expectedRevision => [{ ...base, expectedRevision }, 400, 'expected_revision_required']),
    ...[['human'], {}, null, 1, 'admin'].map(actor => [{ ...base, actor }, 400, 'invalid_actor']),
    [{ ...base, padding: '日'.repeat(74_000) }, 413, 'payload_too_large'],
  ];
  for (const [body, status, error] of cases) {
    const response = await POST(context(body));
    assert.equal(response.status, status, error);
    assert.equal((await response.json()).error, error);
  }
  assert.equal((await POST(context(base, { headers: { 'Content-Length': '220001' } }))).status, 413);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('read and save outages and malformed stored state fail closed with sanitized 503 and no replacement seed', async (t) => {
  const snapshot = boardWith(createRevenueMission());
  for (const options of [
    { failRead: true }, { failSave: true }, { readResponse: null },
    { readResponse: { revision: '1', snapshot } }, { readResponse: { revision: 1, snapshot: null } },
    { readResponse: { revision: 1, snapshot: { nodes: [], edges: {} } } },
    { readResponse: { revision: 1, snapshot: { nodes: [{ id: REVENUE_NODE_ID }], edges: [] } } },
  ]) {
    await t.test(JSON.stringify(options), async (t) => {
      t.mock.method(console, 'error', () => {});
      const storage = mockBoard(t, snapshot, options);
      const response = await POST(context(requestBody(snapshot)));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: 'board_write_unavailable' });
      if (!options.failSave) assert.equal(storage.saves.length, 0);
      assert.deepEqual(storage.snapshot, snapshot);
    });
  }
  await t.test('GET outage', async (t) => {
    t.mock.method(console, 'error', () => {});
    mockBoard(t, snapshot, { failRead: true });
    const response = await GET(context(undefined, { method: 'GET' }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'board_read_unavailable' });
  });
});

test('Revenue remains behind existing origin-bound Dashboard sessions and same-origin mutation gate', async (t) => {
  const snapshot = boardWith(createRevenueMission());
  const storage = mockBoard(t, snapshot);
  for (const method of ['GET', 'POST']) {
    const ctx = context(requestBody(snapshot), { method });
    const response = await onRequest(ctx, () => { throw new Error('unauthenticated handler must not run'); });
    assert.equal(response.status, 401);
  }
  const session = await createDashboardSession(fakeEnv.DASHBOARD_PASSWORD, origin);
  for (const requestOrigin of [null, 'https://evil.example.test']) {
    const ctx = context(requestBody(snapshot), { session, requestOrigin });
    const response = await onRequest(ctx, () => { throw new Error('cross-origin handler must not run'); });
    assert.equal(response.status, 403);
  }
  const foreign = await createDashboardSession(fakeEnv.DASHBOARD_PASSWORD, 'https://foreign.example.test');
  assert.equal((await onRequest(context(requestBody(snapshot), { session: foreign }), () => POST(context(requestBody(snapshot))))).status, 401);
  assert.equal(storage.calls.length, 0);
  const ctx = context(requestBody(snapshot, 1, 'ai'), { session });
  const response = await onRequest(ctx, () => POST(ctx));
  assert.equal(response.status, 200);
  assert.equal(ctx.writes.length, 1);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('Revenue adds no automatic publication or private write channel', async () => {
  const model = await readFile(new URL('../src/lib/revenueMission.ts', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/pages/api/dashboard/board.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(model, /\bfetch\s*\(|localStorage|service_role|setInterval|cron/);
  assert.doesNotMatch(api, /marketplace.*fetch|\/api\/(x|line)-harness|SUPABASE_SERVICE|publishingFlow|coconalaRevenueAgent/);
  assert.match(api, /validateRevenueBoardUpdate\(current\.snapshot/);
  assert.match(api, /p_expected_revision: expectedRevision/);
});

test('Dashboard, FLOW Board and Evidence Lab expose one connected resumable mission', async () => {
  const dashboard = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  const board = await readFile(new URL('../src/pages/dashboard/board.astro', import.meta.url), 'utf8');
  const evidence = await readFile(new URL('../src/pages/dashboard/evidence.astro', import.meta.url), 'utf8');
  assert.match(dashboard, /RevenueMission client:only="react"/);
  assert.match(board, /mission.*revenue/);
  assert.match(board, /selectedId === REVENUE_NODE_ID/);
  assert.match(board, /Revenue の準備・証跡は「商品準備」で編集/);
  assert.match(evidence, /id="\$\{esc\(item\.id\)\}"/);
  assert.match(evidence, /リンクをコピー/);
  assert.match(evidence, /最新300件まで/);
});
