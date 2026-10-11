import assert from 'node:assert/strict';
import test from 'node:test';
import { getXConnectionIssue } from '../src/lib/xConnectionIssue.ts';

test('missing connection settings are distinct from temporary failures', () => {
  assert.match(getXConnectionIssue(503, { error: 'upstream_unavailable' }).message, /接続設定が未完了/);
  for (const [status, body] of [[0, null], [502, { error: 'upstream_request_failed' }], [503, { error: 'other' }]]) {
    assert.equal(getXConnectionIssue(status, body).retryLabel, '再読み込み');
    assert.doesNotMatch(getXConnectionIssue(status, body).message, /未完了/);
  }
  assert.match(getXConnectionIssue(504).message, /時間がかかっています/);
});

test('dashboard session expiry and upstream rejection have different recovery guidance', () => {
  assert.match(getXConnectionIssue(401, { error: 'unauthorized' }).message, /ログイン/);
  assert.match(getXConnectionIssue(401, { error: 'Unauthorized' }).message, /X連携の認証/);
  assert.match(getXConnectionIssue(403).message, /利用権限/);
});

test('unexpected bodies and private upstream detail never enter UI messages', () => {
  const privateDetail = 'private-token-placeholder';
  for (const body of [null, 'bad json', [], {error: privateDetail, message: privateDetail}, {error: {value: privateDetail}}, {error:'upstream_unavailable', message:privateDetail}]) {
    for (const status of [0, 401, 403, 502, 503, 504]) assert.ok(!JSON.stringify(getXConnectionIssue(status, body)).includes(privateDetail));
  }
});
