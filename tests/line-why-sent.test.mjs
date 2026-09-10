import assert from 'node:assert/strict';
import test from 'node:test';
import { whySentRows, duplicateCandidates } from '../src/lib/lineWhySent.ts';

test('inbound has no outbound disclosure or duplicate flag', () => {
  const message = { direction: 'inbound', why_sent: { execution_id: 'run', duplicate_candidate_message_ids: ['1'] } };
  assert.deepEqual(whySentRows(message), []);
  assert.deepEqual(duplicateCandidates(message), []);
});
test('old snapshot / missing historical evidence renders Not captured without inference', () => {
  for (const why_sent of [undefined, null, {}, [], 'invalid']) {
    const rows = whySentRows({ direction: 'outbound', why_sent });
    assert.ok(rows.length > 0);
    assert.ok(rows.every(([, value]) => value === 'Not captured'));
  }
});
test('outbound evidence retains recorded values, separates current labels and execution', () => {
  const rows = Object.fromEntries(whySentRows({ direction: 'outbound', message_id: '9007199254740993', why_sent: {
    sequence_key: 'welcome', sequence_name: 'Current welcome', step_index: 2, enrollment_id: 'enrollment',
    request_group_id: 'group', idempotency: { message_key: 'retention', delivery_date: '2026-09-09', reason: 'quest_not_completed_today' },
  } }));
  assert.equal(rows.Message, '9007199254740993');
  assert.equal(rows['Sequence key (recorded)'], 'welcome');
  assert.equal(rows['Step index (recorded)'], '2');
  assert.equal(rows['Execution ID'], 'Not captured');
  assert.equal(rows['Scheduled / due'], 'Not captured');
  assert.equal(rows['Guard reason'], 'quest_not_completed_today');
});
test('untrusted nested values are not stringified as evidence', () => {
  assert.equal(Object.fromEntries(whySentRows({ direction: 'outbound', why_sent: { execution_id: { secret: 'hidden' }, attempt: NaN } }))['Execution ID'], 'Not captured');
});
test('candidate IDs are bounded and never promoted to confirmed duplicates', () => {
  assert.deepEqual(duplicateCandidates({ direction: 'outbound', why_sent: { duplicate_candidate_message_ids: ['1', null, '<script>', 2, '3'] } }), ['1', '3']);
});
