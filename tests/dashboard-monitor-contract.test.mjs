import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('MONITOR is an installable same-origin standalone route', () => {
  const manifest = JSON.parse(read('public/monitor.webmanifest'));
  const parent = JSON.parse(read('public/masa-os.webmanifest'));
  assert.equal(manifest.id, '/dashboard/monitor');
  assert.equal(manifest.start_url, '/dashboard/monitor');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.ok(parent.shortcuts.some((item) => item.url === '/dashboard/monitor'));
});

test('MONITOR reads canonical shared state without creating a second store', () => {
  const page = read('src/pages/dashboard/monitor.astro');
  assert.match(page, /api\/dashboard\/task-execution\?limit=300/);
  assert.match(page, /api\/dashboard\/board\?scene=main/);
  assert.match(page, /getRevenueMission/);
  assert.match(page, /cache: 'no-store'/);
  assert.match(page, /credentials: 'same-origin'/);
  assert.doesNotMatch(page, /\blocalStorage\b|\bsessionStorage\b/);
  assert.doesNotMatch(page, /method:\s*['"]POST['"]/);
});

test('MONITOR uses private dashboard auth boundary and is reachable from main navigation', () => {
  const middleware = read('src/middleware.ts');
  const layout = read('src/layouts/DashboardLayout.astro');
  assert.match(middleware, /pathname\.startsWith\('\/dashboard'\)/);
  assert.match(layout, /href: '\/dashboard\/monitor'/);
  assert.match(layout, /manifest: '\/monitor\.webmanifest'/);
});
