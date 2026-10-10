import assert from 'node:assert/strict';
import test from 'node:test';

const agent = await import('../src/lib/coconalaRevenueAgent.ts');

test('revenue agent keeps recurring fulfillment off MASA lane', () => {
  const recurring = agent.COCONALA_REVENUE_STEPS.filter(step => step.recurring);
  const manualRecurring = recurring.filter(step => step.lane === 'MASA_GATE');
  assert.deepEqual(manualRecurring.map(step => step.id), ['change']);
  assert.ok(agent.automationCoverage() >= 0.75);
});

test('only publish transition requires stage gate in happy path', () => {
  assert.equal(agent.requiresHumanGate('READY_TO_PUBLISH', 'LIVE'), true);
  assert.equal(agent.requiresHumanGate('LIVE', 'SALE_DETECTED'), false);
  assert.equal(agent.requiresHumanGate('SALE_DETECTED', 'DELIVERED'), false);
  assert.equal(agent.requiresHumanGate('DELIVERED', 'LEARN'), false);
});

test('learning loops back to live without requiring another delivery action', () => {
  assert.equal(agent.nextStage('LEARN'), 'LIVE');
  assert.equal(agent.nextStage('SALE_DETECTED'), 'DELIVERED');
  assert.equal(agent.nextStage('PAUSED'), 'PAUSED');
});
