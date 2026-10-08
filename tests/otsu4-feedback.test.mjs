import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { env } from './helpers/worker-runtime.mjs';

test('every Otsu4 multiple-choice answer has a distinct explanation for all four options', async () => {
  const source = await readFile(new URL('../public/otsu4/questions.js', import.meta.url), 'utf8');
  const questions = vm.runInNewContext(`${source}\nOTSU4_QUESTIONS`);
  const multipleChoice = questions.filter((question) => question.choices);
  // Keep this test valid when the shared question bank grows with lecture material.
  assert.ok(questions.length >= 79, 'lecture question bank must remain available');
  assert.ok(multipleChoice.length >= 72, 'multiple-choice review questions must remain available');
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  for (const id of ['c09', 'c39']) assert.ok(questions.some((question) => question.id === id), id);
  for (const question of multipleChoice) {
    assert.equal(question.choiceNotes?.length, question.choices.length, question.id);
    assert.equal(new Set(question.choiceNotes).size, question.choices.length, question.id);
    for (const note of question.choiceNotes) assert.ok(note.length > 8, question.id);
  }
});


test('lecture marks remain connected to the shared Otsu4 bank and original records', async () => {
  const source = await readFile(new URL('../public/otsu4/questions.js', import.meta.url), 'utf8');
  const questions = vm.runInNewContext(`${source}\nOTSU4_QUESTIONS`);
  const marked = questions.filter(q => q.lectureMarked);
  assert.ok(marked.length >= 40);
  assert.ok(marked.every(q => q.lecturePage && q.choices.length === 4));
  assert.ok(marked.some(q => q.concept.includes('ガス漏れ')));
  assert.ok(marked.some(q => q.concept.includes('自火報')));
  assert.ok(marked.some(q => q.concept.includes('機器点検')));
  assert.ok(questions.some(q => q.id === 'c01'));
  assert.ok(questions.some(q => q.id === 's01'));
  assert.ok(questions.some(q => q.id === 'p07'));
  const html = await readFile(new URL('../src/pages/otsu4/index.astro', import.meta.url), 'utf8');
  assert.match(html, /data-start="lecture"/);
  const app = await readFile(new URL('../public/otsu4/app.js', import.meta.url), 'utf8');
  assert.match(app, /mode === "lecture"/);
});


test('Otsu4 lecture p308 tools drill matches all 12 unique workbook items and keeps records', async () => {
 const html = await readFile(new URL('../src/pages/otsu4/kambetsu/index.astro', import.meta.url), 'utf8');
 const inline = html.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline);
 assert.doesNotThrow(() => new vm.Script(inline));
 const selected = inline.match(/const textbook308Tools = (\[[^\n]+\]);/);
 assert.ok(selected,'p308 names must be stored');
 const names = JSON.parse(selected[1]);
 const namesExpected = ['モール','リングスリーブ','ラジオペンチ','ニッパー','圧着ペンチ','ワイヤーカッター','ワイヤーストリッパー','パイプカッター','パイプベンダー','ねじ切り器','リーマ','ホルソ'];
 assert.deepEqual(names,namesExpected);
 assert.equal(new Set(names).size,12);
 const hints = inline.match(/const textbook308Hints = (\{[^\n]+\});/);
 assert.ok(hints);
 const notes = JSON.parse(hints[1]);
 assert.ok(names.every(name => notes[name]?.length>18));
 assert.match(inline,/scope==='tools308'/);
 assert.match(inline,/flashDeck=scope==='tools308'/);
 assert.match(html,/value="tools308"/);
 assert.match(inline,/entryParams.get\('cards'\)==='p308'/);
 assert.match(html,/otsu4-kambetsu-state-v2/);
 const home=await readFile(new URL('../src/pages/otsu4/index.astro',import.meta.url),'utf8');
 assert.match(home,/\\?cards=p308/);
});
test('Otsu4 identification flashcards are accessible, typed, and preserve the current quiz state', async () => {
  const source = await readFile(new URL('../src/pages/otsu4/kambetsu/index.astro', import.meta.url), 'utf8');
  const script = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'inline identification script is present');
  assert.doesNotThrow(() => new vm.Script(script));
  const raw = script.match(/const foundationFlashCards = (\[[^\n]+\]);/);
  assert.ok(raw, 'foundation cards are defined separately from the quiz');
  const cards = JSON.parse(raw[1]);
  assert.ok(cards.length >= 18, 'at least 18 core knowledge cards');
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.ok(cards.every(card => ['id','group','title','question','answer','hint'].every(field => typeof card[field] === 'string' && card[field].length > 2)));
  assert.ok(cards.some(card => card.question.includes('差動式')));
  assert.ok(cards.some(card => card.question.includes('P型')));
  assert.ok(cards.some(card => card.question.includes('加熱試験器')));
  assert.match(source, /id="flashcards"/);
  assert.match(source, /id="flash-flip"/);
  assert.match(source, /data-flash-grade="miss"/);
  assert.match(source, /data-flash-grade="unsure"/);
  assert.match(source, /data-flash-grade="ok"/);
  assert.match(source, /const photoFlashCards = \(\) =>/);
  assert.match(source, /loadPhoto\(current\.photoTool,'flash-photo'\)/);
  assert.match(source, /id="app" hidden/);
  assert.match(source, /const K='otsu4-kambetsu-state-v2'/);
  assert.match(source, /const FLASH_KEY = 'otsu4-kambetsu-flashcards-v1'/);
  assert.match(source, /function openTest\(\)/);
  const home = await readFile(new URL('../src/pages/otsu4/index.astro', import.meta.url), 'utf8');
  assert.match(home, /鑑別フラッシュカード/);
  const catalog = await readFile(new URL('../src/pages/otsu4/tests/index.astro', import.meta.url), 'utf8');
  assert.match(catalog, /鑑別フラッシュカード＋記述テスト/);
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
