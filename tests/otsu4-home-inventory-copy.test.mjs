import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../src/pages/otsu4/index.astro', import.meta.url), 'utf8');

test('home labels reflect the 33-symbol trainer', () => {
  assert.ok(home.includes('シンボルマーク33種類を暗記'));
  assert.ok(!home.includes('シンボルマーク20種類'));
  assert.ok(home.includes('href="/otsu4/symbols/"'));
});

test('law entry no longer freezes the inventory at 70 questions', () => {
  assert.ok(home.includes('法令だけの10・20・全問テスト'));
  assert.ok(home.includes('法令問題から10・20・全問を選べます'));
  assert.ok(!home.includes('全70問'));
  assert.ok(!home.includes('法令70問'));
  assert.ok(home.includes('href="/otsu4/tests/?topic=law-all"'));
});
