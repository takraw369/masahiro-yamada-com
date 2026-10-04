import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../public/otsu4/app.js', import.meta.url), 'utf8');
const relatedConceptsSource = app.slice(app.indexOf('  function relatedConcepts(q) {'), app.indexOf('  function answer('));

function rankedConcepts(candidates, related = candidates.map((item) => item.concept)) {
  const current = { id: 'current', concept: 'current concept', subject: 'electric' };
  const context = {
    RELATED_CONCEPT_GROUPS: [[current.concept, ...related]],
    OTSU4_QUESTIONS: [current, ...candidates],
    subject: (item) => item.subject,
    weak: (item) => Boolean(item.weak),
    attempts: (item) => item.attempts ?? 0,
    mastered: (item) => Boolean(item.mastered),
    score: (item) => item.score ?? 0,
    escapeHtml: (value) => value,
    current,
  };
  const html = vm.runInNewContext(`${relatedConceptsSource}\nrelatedConcepts(current)`, context);
  return [...html.matchAll(/<li><strong>([^<]+) <small>/g)].map((match) => match[1]);
}

const candidate = (id, values = {}) => ({ id, concept: id, subject: 'electric', ...values });

test('explicit related concepts precede even weak, unseen, high-score same-subject fallback', () => {
  const related = candidate('related', { attempts: 3, mastered: true, score: -200 });
  const fallback = candidate('fallback', { weak: true, score: 500 });
  for (const rows of [[fallback, related], [related, fallback]]) {
    assert.deepEqual(rankedConcepts(rows, ['related']), ['related', 'fallback']);
  }
});

test('weak related concepts precede non-weak unseen concepts despite lower score', () => {
  const weak = candidate('weak', { weak: true, attempts: 2, score: -200 });
  const unseen = candidate('unseen', { score: 500 });
  for (const rows of [[unseen, weak], [weak, unseen]]) {
    assert.deepEqual(rankedConcepts(rows), ['weak', 'unseen']);
  }
});

test('unseen concepts precede seen concepts of equal relation and weakness despite lower score', () => {
  const unseen = candidate('unseen', { score: -200 });
  const seen = candidate('seen', { attempts: 2, score: 500 });
  for (const rows of [[seen, unseen], [unseen, seen]]) {
    assert.deepEqual(rankedConcepts(rows), ['unseen', 'seen']);
  }
});
