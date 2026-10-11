import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('foundation lessons cover the official subject map and explain every answer option', () => {
  const source = readFileSync(new URL('../public/otsu4/learn/lessons.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const lessons = context.window.OTSU4_LESSONS;
  assert.equal(lessons.length, 10);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length);
  for (const area of ['法令', '電気', '構造', '鑑別']) assert.ok(lessons.some((lesson) => lesson.area.includes(area)), area);
  for (const lesson of lessons) {
    assert.ok(lesson.intro.length > 30 && lesson.takeaway.length > 10, lesson.id);
    assert.ok(lesson.points.length >= 2 && lesson.visual.length >= 2, lesson.id);
    assert.equal(lesson.questions.length, 2, lesson.id);
    for (const question of lesson.questions) {
      assert.equal(question.choices.length, 4, question.text);
      assert.equal(question.reasons.length, 4, question.text);
      assert.ok(question.correct >= 0 && question.correct < 4, question.text);
      assert.equal(new Set(question.choices).size, 4, question.text);
      assert.ok(question.reasons.every((reason) => reason.length >= 8), question.text);
    }
  }
});

test('the foundational route stays separate from practice and links back to it', () => {
  const page = readFileSync(new URL('../src/pages/otsu4/learn/index.astro', import.meta.url), 'utf8');
  const practice = readFileSync(new URL('../src/pages/otsu4/index.astro', import.meta.url), 'utf8');
  assert.match(page, /href="\/otsu4\/"/);
  assert.match(page, /id="improvement-form"/);
  assert.match(practice, /href="\/otsu4\/learn\/"/);
  assert.match(practice, /data-start="mock"/);
});


test('practice feedback connects each answer to prioritized related concepts', () => {
  const app = readFileSync(new URL('../public/otsu4/app.js', import.meta.url), 'utf8');
  assert.match(app, /RELATED_CONCEPT_GROUPS/);
  assert.match(app, /次につなぐ関連論点/);
  assert.match(app, /weak\(item\)/);
  assert.match(app, /attempts\(item\) === 0/);
  assert.match(app, /choiceExplanations\(q, row\) \+ relatedConcepts\(q\)/);
});
