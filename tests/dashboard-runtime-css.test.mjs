import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

const pageDir = new URL('../src/pages/dashboard/', import.meta.url);
const root = new URL('../', import.meta.url);

async function pages(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes:true });
  const all = [];
  for (const entry of entries) {
    if (entry.isDirectory()) all.push(...await pages(new URL(entry.name + '/', dir), prefix + entry.name + '/'));
    else if (entry.name.endsWith('.astro')) all.push(prefix + entry.name);
  }
  return all;
}

const dynamics = [
  ['tasks.astro','task-shell'],
  ['evidence.astro','evidence-shell'],
  ['choice-lab.astro','shell'],
  ['board.astro','board-app'],
  ['graph.astro','graph-app'],
  ['design-lab.astro','lab-shell'],
  ['question-lab.astro','lab-shell'],
  ['relationships.astro','crm-shell'],
  ['voice.astro','voice-shell'],
  ['ace-assets.astro','asset-shell'],
  ['content-flow.astro','flow-shell'],
];

test('dashboard page inventory is audited for runtime injected elements', async () => {
  const inventory = await pages(pageDir);
  assert.ok(inventory.length >= 41, 'page inventory must include all Dashboard routes');
  const covered = new Set(dynamics.map(([name]) => name));
  const problems = [];
  for (const name of inventory) {
    const source = await readFile(new URL(name, pageDir), 'utf8');
    if (/(?:\.innerHTML\s*=|\.insertAdjacentHTML\s*\()/.test(source) && /<style>/.test(source) && !covered.has(name)) problems.push(name);
  }
  assert.deepEqual(problems, [], 'new dynamically injected pages need runtime-safe CSS');
});

test('dynamically populated pages load route-isolated global styles without editing legacy scripts', async () => {
  const layout = await readFile(new URL('src/layouts/DashboardLayout.astro',root), 'utf8');
  assert.match(layout, /runtimeStylePages/);
  assert.match(layout, /runtimeStyleHref/);
  assert.match(layout, /rel="stylesheet" href=\{runtimeStyleHref\}/);
  for (const [name, pageRoot] of dynamics) {
    const source = await readFile(new URL(name, pageDir), 'utf8');
    const styleName = name.replace(/\\.astro$/, '.css');
    const css = await readFile(new URL('public/dashboard/runtime-css/' + styleName, root), 'utf8');
    assert.ok(source.includes('<style>'), name + ' page remains unchanged');
    assert.ok(css.includes('@scope (.' + pageRoot + ')'), name + ' runtime style is page-bounded');
    assert.match(css, /:scope\\s*\\{/, name);
    assert.ok(layout.includes("'" + name.replace('.astro','') + "'"), name + ' mapped');
  }
});

test('Task Flow runtime CSS styles actual innerHTML cards and contains long text', async () => {
  const page = await readFile(new URL('tasks.astro',pageDir), 'utf8');
  const css = await readFile(new URL('public/dashboard/runtime-css/tasks.css',root), 'utf8');
  const layout = await readFile(new URL('src/layouts/DashboardLayout.astro',root), 'utf8');
  assert.match(page, /list\\.innerHTML\\s*=\\s*shown\\.map/);
  assert.match(css, /@scope \\(\\.task-shell\\)/);
  assert.match(css, /\\.task-card \\{ min-width:0; max-width:100%; box-sizing:border-box/);
  assert.match(css, /\\.task-card \\.next \\{ max-width:100%; overflow-wrap:anywhere/);
  assert.match(css, /\\.task-card \\.flow \\{ width:100%; min-width:0; max-width:100%; overflow-x:auto/);
  assert.match(css, /grid-template-columns:minmax\\(0,1fr\\)/);
  assert.match(layout, /pathname === '\/dashboard\/tasks' \\? 'TASK FLOW' : eyebrow/);
});

test('all Dashboard routes load responsive guardrails regardless of rendering technology', async () => {
  const layout = await readFile(new URL('src/layouts/DashboardLayout.astro',root), 'utf8');
  const styles = await readFile(new URL('src/styles/dashboard-mobile-guardrails.css',root), 'utf8');
  assert.match(layout, /dashboard-mobile-guardrails\.css/);
  assert.match(styles, /\.content \*,/);
  assert.match(styles, /box-sizing: border-box/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /font-size: 16px/);
});
