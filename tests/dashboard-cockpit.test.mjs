import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { env } from './helpers/worker-runtime.mjs';

const cockpit = await import('../src/pages/api/dashboard/cockpit.ts');
const origin = 'https://dashboard.example.test';

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: 'test-cockpit-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('cockpit read model returns compact Project/Evidence data without raw detail blobs', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const target = String(url);
    if (target.endsWith('/masa_choice_project_context_v1')) return Response.json({
      primary_focus:{
        entity_id:'T-1', entity_type:'task', title:'Primary task', project:'PJT-1', priority:'P0', status:'NOW', due_date:'2026-09-20', next_action:'Do the next bounded step', stale:false,
        detail:{ raw:{ Notes:'PRIVATE-NOTES-SHOULD-NOT-LEAK' } },
      },
      focus:[
        { entity_id:'T-1', entity_type:'task', title:'Primary task', project:'PJT-1', priority:'P0', status:'NOW', next_action:'Do the next bounded step' },
        { entity_id:'T-2', entity_type:'task', title:'Second task', project:'PJT-2', priority:'P1', status:'NOW', next_action:'Second next step', detail:{ raw:{ Notes:'PRIVATE-SECOND-NOTES' } } },
      ],
      bottleneck_candidate:{ entity_id:'T-3', entity_type:'task', title:'Review gate', project:'PJT-3', priority:'P2', status:'REVIEW', next_action:'Resolve review' },
      blocked_high_priority:[{ entity_id:'T-4', entity_type:'task', title:'Blocked task', project:'PJT-4', priority:'P0', status:'WAIT', next_action:'Unblock it' }],
      signals:{ actionable_tasks:12, now_tasks:4, review_tasks:1, blocked_high_priority:1, overdue_actionable:2, stale_actionable:3, s_projects:5, sync_errors:0 },
      rule_version:'v1-test',
    });
    if (target.endsWith('/masa_evidence_list_v1')) return Response.json([
      { id:'E-1', title:'Real-use receipt', body:'PRIVATE-EVIDENCE-BODY', evidence_type:'observation', evidence_quality:'reviewed', status:'active', tags:['cockpit'], occurred_at:'2026-09-18T00:00:00Z', updated_at:'2026-09-18T00:10:00Z' },
    ]);
    assert.fail(`unexpected RPC: ${target}`);
  });

  const response = await cockpit.GET({ request:new Request(`${origin}/api/dashboard/cockpit`), locals:{} });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.project.available, true);
  assert.equal(body.project.primaryFocus.title, 'Primary task');
  assert.equal(body.project.primaryFocus.nextAction, 'Do the next bounded step');
  assert.equal(body.project.signals.blocked_high_priority, 1);
  assert.equal(body.evidence.items[0].title, 'Real-use receipt');
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /PRIVATE-NOTES-SHOULD-NOT-LEAK|PRIVATE-SECOND-NOTES|PRIVATE-EVIDENCE-BODY|detail|raw/);
});

test('cockpit read model degrades without breaking Dashboard shell', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('offline', { status:503 }));
  const response = await cockpit.GET({ request:new Request(`${origin}/api/dashboard/cockpit`), locals:{} });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.project.available, false);
  assert.deepEqual(body.project.focus, []);
  assert.equal(body.evidence.available, false);
});

test('cockpit UI keeps layout as local overlay and reuses existing safe write surfaces', async () => {
  const component = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');

  assert.match(component, /masa-dashboard-cockpit-v1/);
  assert.match(component, /hidden:\s*\['decision'\]/);
  assert.match(component, /\/api\/dashboard\/feedback/);
  assert.match(component, /\/api\/dashboard\/evidence/);
  assert.match(component, /kind:'dashboard_cockpit'/);
  assert.match(component, /正式変更・公開はここでは自動実行しない/);
  assert.match(page, /DashboardCockpit client:load/);
  assert.match(page, /Projectを見れば済むことは質問にしない/);
});
