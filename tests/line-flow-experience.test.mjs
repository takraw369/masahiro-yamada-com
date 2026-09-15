import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/dashboard/line.astro', import.meta.url), 'utf8');
const recipes = readFileSync(new URL('../src/lib/line-flow-recipes.ts', import.meta.url), 'utf8');
const manager = readFileSync(new URL('../src/components/dashboard/LineFlowManagerV2.tsx', import.meta.url), 'utf8');

test('LINE Flow uses native-first typography without external font requests', () => {
  assert.doesNotMatch(page, /fonts\.googleapis\.com/u);
  assert.match(page, /-apple-system/u);
  assert.match(page, /Hiragino Sans/u);
  assert.match(page, /font-variant-numeric:\s*tabular-nums/u);
});

test('LINE Flow recipe library covers onboarding, diagnosis, education, offer and reactivation', () => {
  for (const id of ['welcome', 'diagnosis', 'education', 'offer-soft', 'reactivate']) {
    assert.match(recipes, new RegExp(`id: '${id}'`, 'u'));
  }
  assert.match(recipes, /安心 → 現在地 → 小さな体験 → 理解 → 自己選択/u);
});

test('LINE Flow keeps measurable step cards and reorder controls', () => {
  assert.match(manager, /currentCount/u);
  assert.match(manager, /reachedCount/u);
  assert.match(manager, /waitingCount/u);
  assert.match(manager, /cancelledCount/u);
  assert.match(manager, /steps\/reorder/u);
  assert.match(manager, /draggable/u);
});
