import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const taskExecution = await import('../src/pages/api/dashboard/task-execution.ts');

const origin = 'https://dashboard.example.test';

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: 'test-task-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('task execution API exposes deterministic read model without AI calls', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const target = String(url);
    assert.ok(target.endsWith('/masa_task_execution_list_v1'));
    return Response.json({
      rule: '1 Task = 1 Execution Thread = 1 Deliverable = 1 Validation = 1 Receipt',
      summary: { aiRun: 2, masaGate: 1, review: 1, wait: 1, lastSourceSyncAt: '2026-09-18T00:00:00Z' },
      items: [
        {
          task_id: 'T0099', status: 'NOW', priority: 'P0', task: 'Build task flow', project: 'MASA OS',
          due_date: null, time_hint: null, next_action: 'Ship read-only UI', execution_lane: 'AI_RUN',
          execution_class: 'GPT_DO_NOW', source_revision: 1, source_edit_at: '2026-09-18', source_edit_by: 'ChatGPT',
          source_updated_at: '2026-09-18T00:00:00Z', updated_at: '2026-09-18T00:00:00Z', phase: 'EXECUTE',
        },
      ],
    });
  });

  const response = await taskExecution.GET({
    request: new Request(`${origin}/api/dashboard/task-execution?limit=120`),
    locals: {},
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.aiApiCalls, 0);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].taskId, 'T0099');
  assert.equal(body.items[0].executionLane, 'AI_RUN');
  assert.equal(body.items[0].executionClass, 'GPT_DO_NOW');
  assert.equal(body.items[0].phase, 'EXECUTE');
  assert.equal(body.summary.aiRun, 2);
});
