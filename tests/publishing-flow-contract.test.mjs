import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const flow = await readFile(new URL('../src/pages/dashboard/content-flow.astro', import.meta.url), 'utf8');
const post = await readFile(new URL('../src/pages/dashboard/post.astro', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');

test('Publishing Flow stays a local decision overlay over existing canonical surfaces', () => {
  assert.match(flow, /const oldKey = 'masa-content-flow-v1'/);
  assert.match(flow, /masa-publishing-flow-v2/);
  assert.match(flow, /正式な配信実績・KPIはDISTRIBUTION_OSへ戻す/);
  assert.match(flow, /href="\/dashboard\/content-schedule"/);
  assert.match(dashboard, /href="\/dashboard\/content-flow"/);
  assert.doesNotMatch(flow, /\bfetch\s*\(/);
  assert.doesNotMatch(flow, /\/api\//);
});

test('Publishing Flow hands a draft scaffold to X only after explicit user actions', () => {
  assert.match(flow, /data-handoff="post"/);
  assert.match(flow, /addEventListener\('click'/);
  assert.match(flow, /localStorage\.setItem\('masa-publishing-handoff-v1'/);
  assert.match(post, /type="button" id="handoff-to-composer"/);
  assert.match(post, /button\?\.addEventListener\('click'/);
  assert.match(post, /new CustomEvent\('masa:x-compose'/);
  assert.doesNotMatch(post, /\bfetch\s*\(/);
  assert.doesNotMatch(post, /\/api\/x-harness\//);
});
