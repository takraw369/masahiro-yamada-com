import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const linePage = readFileSync(new URL('../src/pages/dashboard/line.astro', import.meta.url), 'utf8');
const knowledgePage = readFileSync(new URL('../src/pages/dashboard/knowledge.astro', import.meta.url), 'utf8');
const library = readFileSync(new URL('../public/scripts/line-asset-library.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../public/scripts/line-flow-asset-bridge.js', import.meta.url), 'utf8');
const deepLink = readFileSync(new URL('../public/scripts/flow-mind-deeplink.js', import.meta.url), 'utf8');

test('LINE Flow stays anchored to the PRIMARY Lian control plane and loads the Knowledge bridge', () => {
  assert.match(linePage, /PRIMARY \/ リアン/u);
  assert.match(linePage, /\/dashboard\/lian/u);
  assert.match(linePage, /line-flow-asset-bridge\.js/u);
  assert.match(linePage, /line-asset-library\.js/u);
  assert.match(library, /\/api\/dashboard\/knowledge\?q=/u);
  assert.match(library, /\/api\/dashboard\/knowledge\?id=/u);
  assert.match(library, /\/api\/dashboard\/knowledge\?related=/u);
  assert.match(library, /ASSET LIBRARY/u);
  assert.match(library, /正本はDrive/u);
});

test('asset library exposes genre, theme, purpose, message-role and provenance navigation', () => {
  for (const label of ['ACE', '身体・健康', '心・認知', '人・関係', '価値・事業', '哲学・原理']) {
    assert.match(library, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
  for (const label of ['入口', '診断', '教育', '行動', '商品導線', '再活性']) {
    assert.match(library, new RegExp(label, 'u'));
  }
  for (const label of ['コア', 'Hook', '安心', '問い', '再定義', '教育', 'Story', 'Quest', 'CTA', '返信', '再開', 'Offer']) {
    assert.match(library, new RegExp(label, 'u'));
  }
  assert.match(library, /FLOW MIND ↗/u);
  assert.match(library, /GRAPH ↗/u);
  assert.match(library, /DRIVE原本 ↗/u);
  assert.match(library, /Knowledge更新/u);
  assert.match(library, /RELATED KNOWLEDGE/u);
});

test('Knowledge asset library emits a stable insertion contract instead of owning editor DOM details', () => {
  assert.match(library, /masa:line-flow-asset/u);
  assert.match(library, /masa:line-flow-asset-result/u);
  assert.doesNotMatch(library, /HTMLTextAreaElement\.prototype/u);
  assert.doesNotMatch(library, /\.inspect textarea/u);
  assert.match(library, /本文に置く/u);
  assert.match(library, /＋ 追記/u);
  assert.match(library, /新Step/u);
  assert.doesNotMatch(library, /docs\.googleapis\.com|drive\/v3|SUPABASE_SERVICE_ROLE/u);
});

test('LINE editor adapter contains current DOM compatibility in one isolated bridge', () => {
  assert.match(bridge, /masa:line-flow-asset/u);
  assert.match(bridge, /masa:line-flow-asset-result/u);
  assert.match(bridge, /HTMLTextAreaElement\.prototype/u);
  assert.match(bridge, /\.inspect textarea/u);
  assert.match(bridge, /\.add/u);
});

test('FLOW MIND supports query deep links from LINE Flow', () => {
  assert.match(knowledgePage, /flow-mind-deeplink\.js/u);
  assert.match(deepLink, /URLSearchParams/u);
  assert.match(deepLink, /command-input/u);
  assert.match(deepLink, /dispatchEvent\(new Event\('input'/u);
});
