import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { env } from './helpers/worker-runtime.mjs';

test('every Otsu4 multiple-choice answer has a distinct explanation for all four options', async () => {
  const source = await readFile(new URL('../public/otsu4/questions.js', import.meta.url), 'utf8');
  const questions = vm.runInNewContext(`${source}\nOTSU4_QUESTIONS`);
  const multipleChoice = questions.filter((question) => question.choices);
  assert.equal(questions.length, 48);
  assert.equal(multipleChoice.length, 41);
  for (const question of multipleChoice) {
    assert.equal(question.choiceNotes?.length, question.choices.length, question.id);
    assert.equal(new Set(question.choiceNotes).size, question.choices.length, question.id);
    for (const note of question.choiceNotes) assert.ok(note.length > 8, question.id);
  }
});

test('inline Otsu4 feedback reaches the reusable Supabase feedback pipeline', async (t) => {
  const { POST } = await import('../src/pages/api/app-feedback.ts');
  Object.assign(env, {
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key',
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://supabase.example.test/rest/v1/rpc/submit_app_feedback_v1');
    const args = JSON.parse(options.body);
    assert.equal(args.p_app_key, 'otsu4');
    assert.equal(args.p_client_event_id, 'otsu4-test-event-001');
    assert.equal(args.p_context_key, 'question:s10');
    assert.equal(args.p_actor_ref, 'study@example.test');
    assert.equal(args.p_message, 'M型の説明を見たい');
    assert.equal(args.p_meta.questionId, 's10');
    return Response.json({ ok: true, accepted: true, duplicate: false });
  });
  const url = new URL('https://masahiroyamada.com/api/app-feedback');
  const response = await POST({
    request: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientEventId: 'otsu4-test-event-001', appKey: 'otsu4', contextKey: 'question:s10',
        message: 'M型の説明を見たい', actorRef: 'study@example.test', sourceRef: '/otsu4', consent: true,
        meta: { questionId: 's10', category: 'structure', selectedOption: 'B' },
      }) }),
    locals: {}, url,
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.data.accepted, true);
});
