import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHarnessAction, validateHarnessBody } from '../src/lib/security/harness-policy.mjs';

test('LINE Flow routes are explicit', () => {
  assert.equal(resolveHarnessAction('line', 'GET', 'tags')?.sideEffect, false);
  assert.equal(resolveHarnessAction('line', 'GET', 'scenarios')?.sideEffect, false);
  assert.equal(resolveHarnessAction('line', 'GET', 'scenarios/scenario_1')?.body, null);
  assert.equal(resolveHarnessAction('line', 'GET', 'scenarios/scenario_1/stats')?.sideEffect, false);
  assert.equal(resolveHarnessAction('line', 'PUT', 'scenarios/scenario_1')?.body, 'lineScenarioUpdate');
  assert.equal(resolveHarnessAction('line', 'POST', 'scenarios/scenario_1/steps')?.body, 'lineStepCreate');
  assert.equal(resolveHarnessAction('line', 'PUT', 'scenarios/scenario_1/steps/step_1')?.body, 'lineStepUpdate');
  assert.equal(resolveHarnessAction('line', 'POST', 'scenarios/scenario_1/steps/reorder')?.body, 'lineStepReorder');
  assert.equal(resolveHarnessAction('line', 'GET', 'unknown') ?? null, null);
});

test('LINE Flow scenario payloads stay narrow', () => {
  assert.equal(validateHarnessBody('lineScenarioCreate', {
    name: 'Welcome Flow',
    description: null,
    triggerType: 'friend_add',
    triggerTagId: null,
    lineAccountId: 'account_1',
    deliveryMode: 'elapsed',
    isActive: false,
  }), true);
  assert.equal(validateHarnessBody('lineScenarioUpdate', { isActive: true }), true);
  assert.equal(validateHarnessBody('lineScenarioCreate', {
    name: 'Wide', triggerType: 'friend_add', isActive: false, extra: true,
  }), false);
});

test('LINE Flow step payloads validate fields and order', () => {
  assert.equal(validateHarnessBody('lineStepCreate', {
    stepOrder: 1,
    offsetDays: 1,
    offsetMinutes: 30,
    messageType: 'text',
    messageContent: 'hello',
    conditionType: 'tag_exists',
    conditionValue: 'tag_1',
    nextStepOnFalse: 2,
    onReachTagId: 'tag_2',
  }), true);
  assert.equal(validateHarnessBody('lineStepUpdate', {
    messageType: 'text', messageContent: 'updated', templateId: null,
  }), true);
  assert.equal(validateHarnessBody('lineStepReorder', {
    orders: [
      { stepId: 'step_1', stepOrder: 2 },
      { stepId: 'step_2', stepOrder: 1 },
    ],
  }), true);
});
