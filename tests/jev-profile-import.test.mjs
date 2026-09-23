import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const endpoint = await readFile(
  new URL('../src/pages/api/dashboard/profile-preview.ts', import.meta.url),
  'utf8',
);
const page = await readFile(
  new URL('../src/pages/dashboard/profile-import.astro', import.meta.url),
  'utf8',
);

test('JEV profile preview stays behind the existing private dashboard API boundary', () => {
  assert.match(endpoint, /FLOW_RUNNER/);
  assert.match(endpoint, /profileJevPreview\(rawText: string\)/);
  assert.match(endpoint, /rawText\.length > 4000/);
  assert.match(endpoint, /Cache-Control': 'no-store'/);
});

test('profile import requires explicit review before local persistence', () => {
  assert.match(page, /HUMAN GATE/);
  assert.match(page, /id="save-profile"/);
  assert.match(page, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(page, /const STORAGE_KEY = 'masa\.profile\.v1'/);
  assert.doesNotMatch(page, /localStorage\.setItem\([^\n]+rawText/);
});

test('profile import warns against high-risk secrets and identifiers', () => {
  assert.match(page, /マイナンバー/);
  assert.match(page, /パスポート番号/);
  assert.match(page, /銀行口座/);
  assert.match(page, /クレジットカード番号/);
  assert.match(page, /パスワード/);
  assert.match(page, /APIキー/);
});
