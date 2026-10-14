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

test('Pipeline only reads canonical TASK_BOARD, without imaginary statuses or remote writes', async () => {
  const page = await readFile(pagePath, 'utf8');
  assert.match(page, /\/api\/dashboard\/task-execution\?limit=300/);
  assert.match(page, /READ ONLY · TASK_BOARD正本/);
  assert.match(page, /!payload\.ok \|\| !Array\.isArray\(payload\.items\)/);
  assert.match(page, /tasks = payload\.items/);
  assert.doesNotMatch(page, /Math\.random\(/);
  assert.doesNotMatch(page, /method:\s*['"](?:PUT|POST|DELETE|PATCH)/);
  assert.doesNotMatch(page, /draggable=["']true/);
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
  assert.doesNotMatch(page, /item\.progress/);
});