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

test('inline study feedback reaches the existing contact store with a receipt', async (t) => {
  const { POST } = await import('../src/pages/api/contact.ts');
  Object.assign(env, {
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key',
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://supabase.example.test/rest/v1/rpc/submit_contact_inquiry_v1');
    const args = JSON.parse(options.body);
    assert.equal(args.p_category, 'technical');
    assert.equal(args.p_email, 'study@example.test');
    assert.match(args.p_message, /^\[乙4アプリ改善\]\[s10\]/);
    return Response.json('test-receipt-id');
  });
  const url = new URL('https://masahiroyamada.com/api/contact');
  const response = await POST({
    request: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'technical', name: '乙4アプリ改善', email: 'study@example.test',
        message: '[乙4アプリ改善][s10] G型受信機の問題\nコメント: M型の説明を見たい', consent: true }) }),
    locals: {}, url,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, 'test-receipt-id');
});
