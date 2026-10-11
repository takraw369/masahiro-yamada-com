import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(read('../public/otsu4/questions.js') + ';window.rows=OTSU4_QUESTIONS;', context);
vm.runInNewContext(read('../public/otsu4/learn/lessons.js'), context);
const questions = context.window.rows;
const lessons = context.window.OTSU4_LESSONS;

test('消防設備士乙4の問題には別資格の専用論点・名称が混入しない', () => {
  const foreign = /危険物取扱者|危険物乙(?:種)?4|危険物の取り扱いだけ|危険物の性質並びにその火災予防|保安監督者|保安距離|保有空地|給油取扱所の構造/;
  for (const q of questions) {
    assert.ok(['law-common','law-class','electric','structure','practical'].includes(q.category), q.id);
    assert.doesNotMatch([q.question, ...(q.choices || []), q.explanation].join(' '), foreign, q.id);
  }
  for (const lesson of lessons) {
    assert.doesNotMatch([lesson.title, lesson.intro, ...lesson.questions.flatMap(q => [q.text, ...q.choices, ...q.reasons])].join(' '), foreign, lesson.id);
  }
});

test('講習で扱った危険物関連は消防設備士の共通法令に限定して残す', () => {
  for (const id of ['c34','c35','c36','c37','c38','c39']) {
    const question = questions.find(q => q.id === id);
    assert.ok(question, id);
    assert.equal(question.category, 'law-common', id);
  }
  assert.match(questions.find(q => q.id === 'c34').question, /消防設備士の共通法令/);
});

test('基礎レッスンは消防設備士の第4類を明示する', () => {
  const scope = lessons.find(l => l.id === 'scope');
  assert.match(scope.title, /消防設備士乙4/);
  assert.match(scope.intro, /消防設備士乙種第4類/);
  assert.equal(scope.questions[1].correct, 1);
  assert.match(scope.questions[1].choices[3], /第6類の消火器/);
});
