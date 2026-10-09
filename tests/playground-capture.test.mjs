import assert from 'node:assert/strict';
import test from 'node:test';
import { readPlaygroundCapture } from '../src/lib/playgroundCapture.ts';

const origin = 'https://dashboard.example.test/dashboard/playground';
test('ordinary visits never open capture', () => {
  assert.equal(readPlaygroundCapture(`${origin}?url=https://example.com`), null);
});
test('URL share prefills Source, preserves query ampersands and removes consumed inputs', () => {
  const params = new URLSearchParams({ capture: '1', url: 'https://www.youtube.com/watch?v=abc&t=10', title: '本番 & 身体', text: '一行目\n二行目', lens: 'saved' });
  const result = readPlaygroundCapture(`${origin}?${params}`);
  assert.equal(result.fields.url, 'https://www.youtube.com/watch?v=abc&t=10');
  assert.equal(result.fields.title, '本番 & 身体');
  assert.equal(result.fields.excerpt, '一行目\n二行目');
  assert.equal(result.fields.collectionType, 'Source');
  assert.equal(result.cleanPath, '/dashboard/playground?lens=saved');
});
test('fragment share keeps text out of requests and is consumed without retaining payload', () => {
  const params = new URLSearchParams({ capture: '1', text: '音声メモからの気づき' });
  const link = `${origin}#${params}`;
  assert.equal(new URL(link).search, '');
  const result = readPlaygroundCapture(link);
  assert.equal(result.fields.title, '音声メモからの気づき');
  assert.equal(result.fields.collectionType, 'Insight');
  assert.equal(result.cleanPath, '/dashboard/playground');
});
test('rejects executable and credential-bearing URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:password@example.com', '//example.com']) {
    const result = readPlaygroundCapture(`${origin}#${new URLSearchParams({ capture: '1', url })}`);
    assert.equal(result.fields.url, '');
    assert.ok(result.warning);
  }
});
test('bounds untrusted text and title, keeping the form usable', () => {
  const result = readPlaygroundCapture(`${origin}#${new URLSearchParams({ capture: '1', title: 'a'.repeat(300), text: 'b'.repeat(5000) })}`);
  assert.equal(result.fields.title.length, 240);
  assert.equal(result.fields.excerpt.length, 4000);
  assert.ok(result.warning);
});
