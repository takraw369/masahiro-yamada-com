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
    const allCopy = [q.concept, q.question, ...(q.choices || []), q.explanation, ...(q.choiceNotes || []), q.expected || '', q.source?.label || ''].join(' ');
    assert.doesNotMatch(allCopy, foreign, q.id);
    // 危険物の講習に関連する共通法令の問題は認めるが、構造・電気・鑑別に別試験の専門論点は混ぜない。
    if (!q.category.startsWith('law-')) {
      assert.doesNotMatch([q.concept, q.question].join(' '), /指定数量|危険物施設|危険物取扱者|仮貯蔵|ガソリンの引火点/, q.id);
    }
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

test('危険物関連の共通法令は講習で扱う範囲だけ維持し、履歴IDと正答を保持', () => {
  const retained = {
    c34: 2, // 危険物第4類の性質
    c35: 1, // 気体との区別
    c36: 2, // 指定数量
    c37: 0, // 製造所・貯蔵所・取扱所
    c38: 1, // 屋内タンク貯蔵所
    c39: 2, // 仮貯蔵・仮取扱い
    l36: 1, // 危険物製造所等の警報設備
    l59: 1  // 危険物製造所等に必要な警報設備の種類
  };
  for (const [id, answer] of Object.entries(retained)) {
    const q = questions.find(q => q.id === id);
    assert.ok(q, id);
    assert.equal(q.answer, answer, id);
    assert.ok(q.category.startsWith('law-'), id);
  }
});

test('ホームと法令・テスト画面は消防設備士乙4と明示し、危険物取扱者との混同を防ぐ', () => {
  for (const page of [
    '../src/pages/otsu4/index.astro',
    '../src/pages/otsu4/tests/index.astro',
    '../src/pages/otsu4/hourei/index.astro'
  ]) {
    const source = read(page);
    assert.match(source, /消防設備士乙4|消防設備士 乙4|消防設備士乙種第4類|消防設備士 乙種第4類/, page);
    assert.match(source, /危険物取扱者/, page);
  }
});
