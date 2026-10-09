import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const {
  CRM_SCENE_KEY, createCrmContact, createCrmSnapshot, getCrmContacts,
  getCrmStats, removeCrmContact, upsertCrmContact, validateCrmBoardSnapshot,
  validateCrmContact,
} = await import('../src/lib/crm.ts');
const { GET, POST } = await import('../src/pages/api/dashboard/board.ts');

const origin = 'https://dashboard.example.test';
const fakeEnv = {
  DASHBOARD_PASSWORD: 'test-relationship-owner-secret',
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key',
};

function contact(id = 'crm:person_001', patch = {}) {
  return {
    ...createCrmContact(id, new Date('2026-10-05T00:00:00.000Z')),
    name: 'Sample Person',
    relation: '見込み客',
    stage: 'OPPORTUNITY',
    opportunity: '勝ち筋OS 90分セッション',
    nextAction: '日程候補を送る',
    nextAt: '2026-10-05',
    lastContactAt: '2026-10-04',
    valueYen: 19800,
    source: 'LINE',
    tags: ['performance'],
    referenceUrl: 'https://drive.google.com/file/d/sample/view',
    notes: '必要最小限の関係メモ',
    ...patch,
  };
}

function context(body, { method = 'POST', path = '/api/dashboard/board' } = {}) {
  return {
    locals: { runtime: { env: { DASHBOARD_PASSWORD: 'obsolete-secret' } } },
    request: new Request(`${origin}${path}`, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    }),
  };
}

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, fakeEnv);
});

test('Relationship OS stores one person as validated scene data and supports update/remove', () => {
  const first = contact();
  validateCrmContact(first);
  let snapshot = upsertCrmContact(createCrmSnapshot(), first);
  assert.equal(getCrmContacts(snapshot).length, 1);
  assert.equal(getCrmContacts(snapshot)[0].nextAction, '日程候補を送る');

  const updated = { ...first, stage: 'CUSTOMER', nextAction: 'セッション実施日を確定する', updatedAt: '2026-10-05T01:00:00.000Z' };
  snapshot = upsertCrmContact(snapshot, updated);
  assert.equal(getCrmContacts(snapshot)[0].stage, 'CUSTOMER');
  assert.equal(snapshot.nodes[0].label, 'Sample Person');
  assert.match(snapshot.nodes[0].note, /CUSTOMER/);

  snapshot = removeCrmContact(snapshot, first.id);
  assert.deepEqual(getCrmContacts(snapshot), []);
});

test('CRM validation rejects unsafe or malformed records instead of silently storing them', () => {
  assert.throws(() => validateCrmContact(contact('crm:unsafe01', { referenceUrl: 'http://example.com' })), /crm_invalid_reference_url/);
  assert.throws(() => validateCrmContact(contact('crm:tags001', { tags: ['ACE', 'ACE'] })), /crm_duplicate_tags/);
  assert.throws(() => validateCrmContact(contact('crm:date001', { nextAt: '2026-02-31' })), /crm_invalid_date:nextAt/);
  assert.throws(() => validateCrmContact(contact('crm:value01', { valueYen: -1 })), /crm_invalid_value/);
  assert.throws(() => validateCrmBoardSnapshot({ nodes: [], edges: [{ id:'edge' }], viewport: { x:0, y:0, zoom:1 } }), /crm_edges_not_supported/);
});

test('CRM summary prioritizes actionable relationships and opportunity pipeline', () => {
  const contacts = [
    contact('crm:due001', { stage:'OPPORTUNITY', valueYen:19800, nextAt:'2026-10-05' }),
    contact('crm:future1', { stage:'CONVERSATION', valueYen:36000, nextAt:'2026-10-10' }),
    contact('crm:client1', { stage:'CUSTOMER', valueYen:19800, nextAction:'', nextAt:'' }),
  ];
  const stats = getCrmStats(contacts, '2026-10-05');
  assert.deepEqual(stats, { total:3, due:1, opportunities:2, customers:1, pipelineYen:55800 });
});

test('crm scene requires a revision and preserves compare-and-swap semantics', async (t) => {
  const snapshot = upsertCrmContact(createCrmSnapshot(), contact());
  const missingRevision = await POST(context({ sceneKey: CRM_SCENE_KEY, snapshot, actor:'human' }));
  assert.equal(missingRevision.status, 400);
  assert.equal((await missingRevision.json()).error, 'expected_revision_required');

  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, fakeEnv.SUPABASE_URL);
    const args = JSON.parse(options.body);
    calls.push({ path: parsed.pathname, args });
    if (parsed.pathname.endsWith('masa_flow_canvas_get_v1')) {
      return Response.json({ sceneKey: CRM_SCENE_KEY, snapshot: createCrmSnapshot(), revision: 2 });
    }
    assert.equal(parsed.pathname.endsWith('masa_flow_canvas_save_v1'), true);
    return Response.json({ sceneKey: CRM_SCENE_KEY, revision: 3, updatedBy: args.p_actor });
  });

  const saved = await POST(context({ sceneKey: CRM_SCENE_KEY, snapshot, expectedRevision:2, actor:'human' }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.revision, 3);
  const saveCall = calls.find(call => call.path.endsWith('masa_flow_canvas_save_v1'));
  assert.equal(saveCall.args.p_scene_key, CRM_SCENE_KEY);
  assert.equal(saveCall.args.p_expected_revision, 2);

  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    const args = JSON.parse(options.body);
    if (parsed.pathname.endsWith('masa_flow_canvas_get_v1')) {
      return Response.json({ sceneKey: CRM_SCENE_KEY, snapshot: createCrmSnapshot(), revision: 4 });
    }
    throw new Error(`unexpected save ${args.p_scene_key}`);
  });
  const stale = await POST(context({ sceneKey: CRM_SCENE_KEY, snapshot, expectedRevision:2, actor:'human' }));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, 'revision_conflict');
});

test('crm GET returns only validated persisted scene data', async (t) => {
  const snapshot = upsertCrmContact(createCrmSnapshot(), contact());
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname.endsWith('masa_flow_canvas_get_v1'), true);
    const args = JSON.parse(options.body);
    assert.equal(args.p_scene_key, CRM_SCENE_KEY);
    return Response.json({ sceneKey: CRM_SCENE_KEY, snapshot, revision: 7 });
  });
  const response = await GET(context(undefined, { method:'GET', path:'/api/dashboard/board?scene=crm' }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.revision, 7);
  assert.equal(payload.data.snapshot.nodes[0].crmContact.name, 'Sample Person');
});
