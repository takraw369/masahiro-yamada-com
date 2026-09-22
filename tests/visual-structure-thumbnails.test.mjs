import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/pages/dashboard/visual-structures.astro', import.meta.url), 'utf8');
const thumbnail = await readFile(new URL('../src/components/dashboard/VisualStructureThumbnail.astro', import.meta.url), 'utf8');

test('visual structure selector renders the shared thumbnail component', () => {
  assert.match(page, /VisualStructureThumbnail/);
  assert.match(page, /<VisualStructureThumbnail id=\{template\.id\} \/>/);
});

test('thumbnail component covers all 20 canonical structure ids', () => {
  for (let i = 1; i <= 20; i += 1) {
    const id = `S${String(i).padStart(2, '0')}`;
    assert.match(thumbnail, new RegExp(`id === '${id}'`));
  }
  assert.match(thumbnail, /opacity:\.26/);
  assert.match(thumbnail, /template-card\.is-active/);
});
