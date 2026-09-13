import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { QUEST_GUARDRAILS, STARTER_RECIPES } from '../src/lib/line-flow-recipes.ts';

test('Quest soft-return recipe changes angle and backs off over time', () => {
  const quest = STARTER_RECIPES.find((recipe) => recipe.id === 'quest-soft-return');
  assert.ok(quest);
  assert.equal(quest.triggerType, 'manual');
  assert.deepEqual(quest.steps.map((step) => step.offsetDays), [1, 2, 4, 7]);
  assert.equal(new Set(quest.steps.map((step) => step.angle)).size, quest.steps.length);
  assert.equal(new Set(quest.steps.map((step) => step.message)).size, quest.steps.length);
  assert.match(quest.steps.at(-1).message, /距離を置いてOK|戻れる場所/);
});

test('Quest guardrails explicitly reduce repeated pressure', () => {
  const copy = QUEST_GUARDRAILS.map((rule) => `${rule.when} ${rule.then}`).join('\n');
  assert.match(copy, /同じ催促を繰り返さず/);
  assert.match(copy, /毎日追わず、間隔を空ける/);
  assert.match(copy, /通知を弱める選択肢/);
});

test('LINE Flow keeps partial data and presents reconnectable errors', async () => {
  const [manager, proxy] = await Promise.all([
    readFile(new URL('../src/components/dashboard/LineFlowManager.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/security/harness-proxy.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(manager, /Promise\.allSettled/);
  assert.match(manager, /payload\?\.message \|\| fallbackHarnessMessage/);
  assert.match(manager, /className="error-retry"/);
  assert.match(manager, /STARTER_RECIPES/);
  assert.match(proxy, /retryable: true/);
  assert.match(proxy, /upstreamMessage\(provider/);
  assert.doesNotMatch(proxy, /private upstream detail/);
});
