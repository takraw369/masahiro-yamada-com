import assert from 'node:assert/strict';
import test from 'node:test';
import { X_ACCOUNT_PLAYBOOKS, findXAccountPlaybook } from '../src/lib/xAccountPlaybook.ts';
import { findConnectedXAccount, prepareXComposeReview } from '../src/lib/xComposerReview.ts';

test('four editorial brands preserve current handles without planned aliases', () => {
  assert.deepEqual(X_ACCOUNT_PLAYBOOKS.map(item => item.username), [
    'MASAHIRO_501', 'aima_no_te', 'kodomo_athlete', 'sunlovesflow',
  ]);
  for (const item of X_ACCOUNT_PLAYBOOKS) {
    assert.equal(item.publicUsername, item.username);
    assert.equal(findXAccountPlaybook(`@${item.username.toUpperCase()}`), item);
  }
  assert.match(findXAccountPlaybook('kodomo_athlete').name, /アスリート/);
  assert.match(findXAccountPlaybook('aima_no_te').name, /あいま/);
  assert.match(findXAccountPlaybook('sunlovesflow').name, /ユトラ/);
});

test('unconnected brand never resolves to another real account or becomes reviewable', () => {
  const accounts = [{ id: 'fixture-existing-id', username: 'kodomo_athlete', isActive: true }];
  for (const username of ['MASAHIRO_501', 'aima_no_te', 'sunlovesflow', 'all_are_ace']) {
    const resolved = findConnectedXAccount(accounts, username);
    assert.equal(resolved, undefined);
    assert.throws(() => prepareXComposeReview({ text: 'fixture draft', accountId: resolved?.id || '', mode: 'now', scheduledAt: '' }, accounts), /接続先/);
  }
  assert.equal(findConnectedXAccount(accounts, '@KODOMO_ATHLETE'), accounts[0]);
  assert.equal(findConnectedXAccount([{ ...accounts[0], isActive: false }], 'kodomo_athlete'), undefined);
  assert.equal(findConnectedXAccount([], 'kodomo_athlete'), undefined);
});
