import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('LINE bridge opens Graph with an opener and injects the Knowledge roundtrip bridge', async () => {
  const bridge = await readFile(new URL('../public/scripts/line-flow-asset-bridge.js', import.meta.url), 'utf8');

  assert.match(bridge, /masa:line-graph-selection/);
  assert.match(bridge, /masa:line-graph-result/);
  assert.match(bridge, /graph-line-knowledge-bridge\.js/);
  assert.match(bridge, /window\.open\(url\.toString\(\), 'masa-line-knowledge-graph'\)/);
  assert.match(bridge, /\.la-links a\[href\*="\/dashboard\/graph"\]/);
  assert.match(bridge, /event\.origin !== window\.location\.origin/);
  assert.match(bridge, /new CustomEvent\(EVENT/);
});

test('Graph bridge searches Knowledge and returns selected copy to the original LINE Step', async () => {
  const graphBridge = await readFile(new URL('../public/scripts/graph-line-knowledge-bridge.js', import.meta.url), 'utf8');

  assert.match(graphBridge, /\/api\/dashboard\/knowledge\?q=/);
  assert.match(graphBridge, /\/api\/dashboard\/knowledge\?id=/);
  assert.match(graphBridge, /Knowledge NodeをLINEへ返す/);
  assert.match(graphBridge, /本文に置く/);
  assert.match(graphBridge, /＋ 追記/);
  assert.match(graphBridge, /新Step/);
  assert.match(graphBridge, /window\.opener\.postMessage/);
  assert.match(graphBridge, /source: 'graph'/);
  assert.match(graphBridge, /FLOW MIND ↗/);
  assert.match(graphBridge, /data-node="N017"/);
});
