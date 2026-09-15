import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const linePage = readFileSync(new URL('../src/pages/dashboard/line.astro', import.meta.url), 'utf8');
const knowledgePage = readFileSync(new URL('../src/pages/dashboard/knowledge.astro', import.meta.url), 'utf8');
const library = readFileSync(new URL('../public/scripts/line-asset-library.js', import.meta.url), 'utf8');
const deepLink = readFileSync(new URL('../public/scripts/flow-mind-deeplink.js', import.meta.url), 'utf8');

test('LINE Flow loads the Knowledge asset library', () => {
  assert.match(linePage, /line-asset-library\.js/u);
  assert.match(library, /\/api\/dashboard\/knowledge\?q=/u);
  assert.match(library, /\/api\/dashboard\/knowledge\?id=/u);
  assert.match(library, /ASSET LIBRARY/u);
  assert.match(library, /原本はDrive/u);
});

test('asset library exposes theme, message-role and source navigation', () => {
  for (const label of ['ACE', 'RE:DEFINE', '教育', '身体・健康', 'FLOW / SLF', '自信・自己理解', '人間関係', '学習・才能', 'お金・価値', 'Quest', '哲学・原理']) {
    assert.match(library, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
  for (const label of ['コア', '問い', '再定義', '展開']) assert.match(library, new RegExp(label, 'u'));
  assert.match(library, /FLOW MIND ↗/u);
  assert.match(library, /GRAPH ↗/u);
  assert.match(library, /DRIVE原本 ↗/u);
});

test('knowledge candidates can be reused in the selected LINE step without duplicating the source of truth', () => {
  assert.match(library, /HTMLTextAreaElement\.prototype/u);
  assert.match(library, /new Event\('input'/u);
  assert.match(library, /本文に置く/u);
  assert.match(library, /＋ 追記/u);
  assert.match(library, /新Step/u);
  assert.doesNotMatch(library, /docs\.googleapis\.com|drive\/v3|SUPABASE_SERVICE_ROLE/u);
});

test('FLOW MIND supports query deep links from LINE Flow', () => {
  assert.match(knowledgePage, /flow-mind-deeplink\.js/u);
  assert.match(deepLink, /URLSearchParams/u);
  assert.match(deepLink, /command-input/u);
  assert.match(deepLink, /dispatchEvent\(new Event\('input'/u);
});
