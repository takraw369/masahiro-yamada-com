import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataSource = await readFile(new URL('../src/data/visualStructureTemplates.ts', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/pages/dashboard/visual-structures.astro', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');

test('visual structure library keeps exactly 20 canonical structure IDs', () => {
  const ids = [...dataSource.matchAll(/id:\s*'S(\d{2})'/g)].map((match) => match[1]);
  assert.equal(ids.length, 20);
  assert.deepEqual(ids, Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0')));
});

test('visual structure dashboard imports the canonical library and exposes reusable prompt actions', () => {
  assert.match(pageSource, /visualStructureTemplates/);
  assert.match(pageSource, /Prompt生成/);
  assert.match(pageSource, /文言イメージをコピー/);
  assert.match(pageSource, /masaVisualStructureLibraryV1/);
});

test('dashboard command center links to the visual structure library', () => {
  assert.match(dashboardSource, /href:'\/dashboard\/visual-structures'/);
});
