import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const pagePath = new URL('../src/pages/dashboard/pipeline.astro', import.meta.url);
const layoutPath = new URL('../src/layouts/DashboardLayout.astro', import.meta.url);
const homePath = new URL('../src/pages/dashboard/index.astro', import.meta.url);

test('Task Pipeline is reachable from existing MASA Dashboard surfaces', async () => {
  const [page, layout, home] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(layoutPath, 'utf8'),
    readFile(homePath, 'utf8')
  ]);
  assert.match(page, /DashboardLayout title="Task Pipeline"/);
  assert.match(layout, /href: '\/dashboard\/pipeline', label: 'Task Pipeline'/);
  assert.match(home, /href:'\/dashboard\/pipeline'/);
});

test('Pipeline reads TASK_BOARD and writes stages only through the canonical Sheet-gated endpoint', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /\/api\/dashboard\/task-execution\?limit=300/);
  assert.match(page, /Google Sheets · TASK_BOARD正本/);
  assert.match(page, /!payload\.ok \|\| !Array\.isArray\(payload\.items\)/);
  assert.match(page, /tasks = payload\.items/);
  assert.doesNotMatch(page, /Math\.random\(/);
  assert.match(page, /\/api\/dashboard\/task-move/);
  assert.match(page, /expectedRevision:item\.sourceRevision/);
  assert.match(page, /data\.verified/);
  assert.match(page, /await refreshWriter\(\)/);
  assert.match(page, /button\.draggable = writeEnabled/);
  assert.match(page, /dragstart/);
  assert.match(page, /dragover/);
  assert.match(page, /dragend/);
  assert.match(page, /event\.preventDefault\(\)/);
});

test('Pipeline is mobile-aware and accessible, including no fake progress percentages', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /<style is:global>/);
  assert.match(page, /overflow-x:auto/);
  assert.match(page, /@media\(max-width:640px\)/);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /aria-labelledby="pipeline-detail-heading"/);
  assert.match(page, /textContent =/);
  assert.match(page, /phaseFor\(item\)/);
  assert.match(page, /dateKey\(item\.dueDate\)/);
  assert.match(page, /pipeline-task-date', formatDue\(item\)/, 'date formatter receives a Task, not dueDate text');
  assert.doesNotMatch(page, /item\.progress/);
});