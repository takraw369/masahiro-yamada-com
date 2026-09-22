import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('LINE bridge opens Graph and supports resilient roundtrip transport', async () => {
  const bridge = await readFile(new URL('../public/scripts/line-flow-asset-bridge.js', import.meta.url), 'utf8');

  assert.match(bridge, /masa:line-graph-selection/);
  assert.match(bridge, /masa:line-graph-result/);
  assert.match(bridge, /masa-line-graph-roundtrip-v1/);
  assert.match(bridge, /graph-line-knowledge-bridge\.js/);
  assert.match(bridge, /graph-line-roundtrip-runtime\.js/);
  assert.match(bridge, /new BroadcastChannel\(GRAPH_CHANNEL\)/);
  assert.match(bridge, /processedGraphRequests/);
  assert.match(bridge, /window\.open\(url\.toString\(\), 'masa-line-knowledge-graph'\)/);
  assert.match(bridge, /\.la-links a\[href\*="\/dashboard\/graph"\]/);
  assert.match(bridge, /event\.origin !== window\.location\.origin/);
  assert.match(bridge, /new CustomEvent\(EVENT/);
});

test('LINE bridge confirms React textarea changes and waits for the actual new Step', async () => {
  const bridge = await readFile(new URL('../public/scripts/line-flow-asset-bridge.js', import.meta.url), 'utf8');

  assert.match(bridge, /current\.value\.trim\(\) === next\.trim\(\)/);
  assert.match(bridge, /selectedStepId/);
  assert.match(bridge, /nextSelected !== beforeSelected/);
  assert.doesNotMatch(bridge, /Date\.now\(\) - startedAt > 700/);
});

test('Graph bridge searches Knowledge and exposes LINE return actions', async () => {
  const graphBridge = await readFile(new URL('../public/scripts/graph-line-knowledge-bridge.js', import.meta.url), 'utf8');

  assert.match(graphBridge, /\/api\/dashboard\/knowledge\?q=/);
  assert.match(graphBridge, /\/api\/dashboard\/knowledge\?id=/);
  assert.match(graphBridge, /Knowledge NodeをLINEへ返す/);
  assert.match(graphBridge, /本文に置く/);
  assert.match(graphBridge, /＋ 追記/);
  assert.match(graphBridge, /新Step/);
  assert.match(graphBridge, /FLOW MIND ↗/);
  assert.match(graphBridge, /data-node="N017"/);
});

test('Graph runtime returns by opener, parent, or BroadcastChannel and visibly reports the result', async () => {
  const runtime = await readFile(new URL('../public/scripts/graph-line-roundtrip-runtime.js', import.meta.url), 'utf8');

  assert.match(runtime, /new BroadcastChannel\(GRAPH_CHANNEL\)/);
  assert.match(runtime, /window\.parent\.postMessage\(payload/);
  assert.match(runtime, /window\.opener\.postMessage/);
  assert.match(runtime, /channel\.postMessage/);
  assert.match(runtime, /stopImmediatePropagation/);
  assert.match(runtime, /LINEの選択中Stepへ送信中/);
  assert.match(runtime, /LINE側の応答がありません/);
  assert.match(runtime, /window\.close\(\)/);
});

test('LINE-launched Graph prioritizes a simple two-stage mobile action flow', async () => {
  const runtime = await readFile(new URL('../public/scripts/graph-line-roundtrip-runtime.js', import.meta.url), 'utf8');

  assert.match(runtime, /matchMedia\('\(max-width: 760px\)'\)/);
  assert.match(runtime, /graphApp\.prepend\(panel\)/);
  assert.match(runtime, /glk-mobile-docked/);
  assert.match(runtime, /LINEに使う文を選ぶ/);
  assert.match(runtime, /この文を選ぶ/);
  assert.match(runtime, /この文をLINEで使う/);
  assert.match(runtime, /今のStepと入れ替える/);
  assert.match(runtime, /下に足す/);
  assert.match(runtime, /新しいStepにする/);
  assert.match(runtime, /data-action="replace"/);
  assert.match(runtime, /data-action="append"/);
  assert.match(runtime, /data-action="new-step"/);
  assert.match(runtime, /\.glk-actions\{display:none!important\}/);
  assert.match(runtime, /panel\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
});

test('mobile LINE opens Graph in an in-page iframe overlay instead of relying on a child tab', async () => {
  const bridge = await readFile(new URL('../public/scripts/line-flow-asset-bridge.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../public/scripts/graph-line-roundtrip-runtime.js', import.meta.url), 'utf8');

  assert.match(bridge, /GRAPH_OVERLAY_ID/);
  assert.match(bridge, /document\.createElement\('iframe'\)/);
  assert.match(bridge, /frame\.addEventListener\('load', \(\) => injectGraphBridge\(frame\.contentWindow\)\)/);
  assert.match(bridge, /if \(isMobile\(\)\) \{\s*openGraphOverlay\(url\)/);
  assert.match(bridge, /masa:line-graph-close/);
  assert.match(runtime, /window\.parent && window\.parent !== window/);
  assert.match(runtime, /window\.parent\.postMessage\(\{ type: GRAPH_CLOSE \}/);
});

test('Dashboard layout self-loads Graph roundtrip scripts for Safari-safe startup', async () => {
  const layout = await readFile(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');

  assert.match(layout, /<script is:inline src="\/scripts\/graph-line-knowledge-bridge\.js"><\/script>/);
  assert.match(layout, /<script is:inline src="\/scripts\/graph-line-roundtrip-runtime\.js"><\/script>/);
});