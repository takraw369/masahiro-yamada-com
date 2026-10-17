import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('FLOW FRAME is linked from dashboard tools and includes six output choices', async () => {
  const page = await read('src/pages/dashboard/flow-frame.astro');
  const nav = await read('src/layouts/DashboardLayout.astro');
  const home = await read('src/pages/dashboard/index.astro');
  assert.match(page, /DashboardLayout/);
  for (const id of ['ff-file', 'ff-title', 'ff-preview', 'ff-export', 'ff-zip'])
    assert.ok(page.includes(id), id);
  for (const fmt of ['instagram', 'square', 'story', 'note', 'appstoreMedium', 'appstore'])
    assert.ok(page.includes('data-ff-size="' + fmt + '"'), fmt);
  assert.match(nav, /href: '\/dashboard\/flow-frame'/);
  assert.match(home, /href:'\/dashboard\/flow-frame'/);
});

test('FLOW FRAME client JS parses, generates PNG and ZIP locally', async () => {
  const js = await read('public/scripts/flow-frame.js');
  assert.doesNotThrow(() => new Script(js));
  assert.match(js, /width: 1179, height: 2556/);
  assert.match(js, /canvas.toBlob\(/);
  assert.match(js, /application\/zip/);
  assert.match(js, /crc32\(data\)/);
  assert.doesNotMatch(js, /fetch\s*\(/);
  assert.doesNotMatch(js, /XMLHttpRequest/);
});