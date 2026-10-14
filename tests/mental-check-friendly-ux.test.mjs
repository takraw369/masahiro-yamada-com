import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/mental-check.astro', import.meta.url), 'utf8');

test('public quiz uses one question at a time, reversible step navigation, and completion-only follow-up', () => {
  assert.match(page, /let currentStepIndex = 0/);
  assert.match(page, /function showStep\(/);
  assert.match(page, /card\.hidden = atReview \|\| i !== currentStepIndex/);
  assert.match(page, /previousStep\?\.addEventListener\('click'/);
  assert.match(page, /nextStep\?\.addEventListener\('click'/);
  assert.match(page, /if \(q\.required && !activeAnswerPresent\(q\)\)/);
  assert.match(page, /followup\.hidden = !atReview/);
  assert.match(page, /submitWrap\.hidden = !atReview/);
  assert.match(page, /showStep\(missingIndex, true\)/);
});

test('mobile answer choices are vertically stacked, readable and touch friendly', () => {
  assert.match(page, /grid-template-columns: minmax\(0,1fr\)/);
  assert.match(page, /min-height: 62px/);
  assert.match(page, /font-size: 1\.06rem/);
  assert.match(page, /white-space: normal/);
  assert.match(page, /overflow-wrap: anywhere/);
  assert.match(page, /font-size: 16px/);
  assert.match(page, /aria-valuenow/);
  assert.match(page, /prefers-reduced-motion/);
});

test('quiz visual exception does not create duplicate backend or alter consent semantics', () => {
  assert.match(page, /body:has\(#mental-form\)/);
  assert.match(page, /background: #fffaf3/);
  assert.match(page, /followupConsent:.*followupConsent/);
  assert.match(page, /sessionStorage\.removeItem\('mental-check-session'\)/);
  assert.match(page, /\/api\/questionnaire\/mental/);
  assert.match(page, /\/api\/funnel\/mental-check/);
});
