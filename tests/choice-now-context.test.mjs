import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';

const { choiceNowQuestions, fallbackChoiceNow } = await import('../src/lib/choiceNow.ts');
const choiceNow = await import('../src/pages/api/dashboard/choice-now.ts');

const origin = 'https://dashboard.example.test';

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: 'test-choice-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('question bank stays bounded and fallback returns five reusable decisions', () => {
  assert.equal(choiceNowQuestions.length, 20);
  assert.equal(new Set(choiceNowQuestions.map(q => q.id)).size, choiceNowQuestions.length);
  assert.equal(fallbackChoiceNow(5).length, 5);
  for (const q of choiceNowQuestions) {
    assert.ok(q.id && q.area && q.title && q.why);
    assert.equal(q.options.length, 3);
    assert.ok(q.tags.length >= 3);
  }
});

test('NOW 5 ranks from live aggregates without returning raw private context', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const target = String(url);
    if (target.endsWith('/masa_dashboard_feedback_list_v2')) return Response.json([
      { id:'f1', page:'/dashboard/choice-lab', message:'CHOICE NOW 5 · SET 1', context:JSON.stringify({kind:'choice_now_5',decisions:[{id:'brand-front',choice:'masa',at:new Date().toISOString()}]}), status:'open', created_at:new Date().toISOString() },
      { id:'f2', page:'/dashboard', message:'offer revenue customer sales', context:'private-feedback-detail', status:'open', created_at:new Date().toISOString() },
    ]);
    if (target.endsWith('/masa_intelligence_list_v1')) return Response.json([
      { title:'Automation operating signal', topic:'automation', lenses:['system'], why_it_matters:'workflow trigger', status:'active' },
    ]);
    if (target.endsWith('/masa_question_lab_overview_v1')) return Response.json({
      summary:{ question_count:10 }, domains:['Brand','Offer'], answers:[{ text:'private-answer-text' }],
    });
    assert.fail(`unexpected RPC: ${target}`);
  });

  const response = await choiceNow.GET({
    request: new Request(`${origin}/api/dashboard/choice-now?limit=5&exclude=focus-now`),
    locals: {},
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'context-ranked');
  assert.equal(body.questions.length, 5);
  assert.equal(body.questions.some(q => q.id === 'focus-now'), false);
  assert.equal(body.sourceSummary.recentFeedbackCount, 2);
  assert.equal(body.sourceSummary.intelligenceCount, 1);
  assert.equal(body.sourceSummary.questionLabAvailable, true);
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /private-answer-text|private-feedback-detail/);
});

test('NOW 5 degrades to a safe base set when live sources are unavailable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('offline', { status: 503 }));
  const response = await choiceNow.GET({
    request: new Request(`${origin}/api/dashboard/choice-now?limit=5`),
    locals: {},
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.questions.length, 5);
  assert.ok(['base-ranked','fallback'].includes(body.mode));
});
