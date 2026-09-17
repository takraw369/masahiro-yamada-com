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

test('NOW 5 ranks project/evidence context and explains WHY NOW without raw private text', async (t) => {
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
    if (target.endsWith('/masa_choice_project_context_v1')) return Response.json({
      primary_focus:{ title:'private-project-title', project:'private-project-name', priority:'P0', due_date:'2026-09-18', next_action:'private-next-action' },
      focus:[{ title:'private-project-title', project:'private-project-name', priority:'P0', due_date:'2026-09-18' }],
      review_queue:[{ title:'private-review-title', project:'private-project-name', priority:'P1' }],
      stale_queue:[],
      blocked_high_priority:[],
      signals:{ actionable_tasks:9, now_tasks:3, review_tasks:2, overdue_actionable:1, blocked_high_priority:0, stale_actionable:0, s_projects:2, sync_errors:0 },
      rule_version:'v1_2_stable_task_id',
    });
    if (target.endsWith('/masa_evidence_list_v1')) return Response.json([
      { title:'private-evidence-title', body:'private-evidence-detail about offer revenue result', tags:['offer','evidence','result'], evidence_type:'observation', evidence_quality:'raw', status:'active' },
      { title:'private-evidence-title-2', body:'automation workflow evidence', tags:['automation','system'], evidence_type:'experiment', evidence_quality:'reviewed', status:'active' },
    ]);
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
  assert.equal(body.sourceSummary.projectOsAvailable, true);
  assert.equal(body.sourceSummary.evidenceCount, 2);
  assert.equal(body.sourceSummary.projectSignals.now_tasks, 3);
  for (const question of body.questions) {
    assert.ok(Array.isArray(question.whyNow));
    assert.ok(question.whyNow.length >= 1);
  }
  assert.ok(body.questions.some(q => q.whyNow.some(reason => /Project OS|Evidence|Intelligence|Choice/.test(reason))));
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /private-answer-text|private-feedback-detail|private-project-title|private-project-name|private-next-action|private-review-title|private-evidence-title|private-evidence-detail/);
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
  for (const question of body.questions) assert.ok(Array.isArray(question.whyNow));
});
