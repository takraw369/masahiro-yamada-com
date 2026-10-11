import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMentalCheckRecommendation } from '../public/js/mental-check-routing.js';

const page = readFileSync(new URL('../src/pages/mental-check.astro', import.meta.url), 'utf8');
const input = (questionKey, value) => ({ questionKey, value });

test('feedback request routes to existing LINE without treating it as diagnosis', () => {
  const result = buildMentalCheckRecommendation([
    input('mental_v1_feedback_interest', 'true'),
    input('mental_v1_main_problem', 'tension'),
  ], [
    { question_key: 'mental_v1_main_problem', options: [{ option_key: 'tension', label: '緊張が強い' }] },
  ], true);
  assert.equal(result.primary, 'line');
  assert.equal(result.focus, '緊張・感情との向き合い方');
  assert.match(result.nextAction, /次の一動作/);
  assert.match(result.guidance, /返信を保証するものではありません/);
});

test('urgency plus real interest can route to consultation without feedback opt-in', () => {
  const result = buildMentalCheckRecommendation([
    input('mental_v1_urgency', '4'),
    input('mental_v1_support_format', 'single'),
    input('mental_v1_feedback_interest', 'false'),
  ], [], false);
  assert.equal(result.primary, 'line');
  assert.match(result.guidance, /匿名回答から自動でご連絡することはありません/);
});

test('anonymous / low intent stays on preview instead of forcing a sale', () => {
  const result = buildMentalCheckRecommendation([
    input('mental_v1_urgency', '2'),
    input('mental_v1_feedback_interest', 'false'),
    input('mental_v1_main_problem', 'body'),
  ]);
  assert.equal(result.primary, 'toolkit');
  assert.equal(result.focus, '身体・コンディション');
  assert.match(result.guidance, /先行プレビュー/);
});

test('parent or coach is not force-routed to athlete sale', () => {
  assert.equal(buildMentalCheckRecommendation([
    input('mental_v1_role', 'coach'),
    input('mental_v1_urgency', '5'),
    input('mental_v1_support_format', 'ongoing'),
  ]).primary, 'toolkit');
});

test('missing and unrecognized answers fail safely to generic action', () => {
  const result = buildMentalCheckRecommendation([], []);
  assert.equal(result.primary, 'toolkit');
  assert.match(result.nextAction, /最初のサイン/);
  const unknown = buildMentalCheckRecommendation([input('mental_v1_main_problem', 'some-new-option')], []);
  assert.equal(unknown.focus, 'some-new-option');
});

test('existing answer POST and consent guard run before result is displayed', () => {
  assert.match(page, /const answers = collectAnswers\(\)/);
  assert.match(page, /if \(!res\.ok \|\| !body\.ok\) throw new Error/);
  const responseChecked = page.indexOf("if (!res.ok || !body.ok) throw new Error(body.error || 'submit_failed')");
  const resultRendered = page.indexOf("document.getElementById('result-current').textContent");
  assert.ok(resultRendered > responseChecked);
  assert.match(page, /followupConsent/);
  assert.match(page, /\/js\/mental-check-routing\.js/);
  assert.match(page, /\.textContent = recommendation\./);
});
