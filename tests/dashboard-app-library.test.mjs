import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const source = read('src/data/dashboardAppCatalog.ts');
const home = read('src/pages/dashboard/index.astro');
const page = read('src/pages/dashboard/apps.astro');
const layout = read('src/layouts/DashboardLayout.astro');

test('app library lists only existing, unique, same-origin routes', () => {
  const routes = [...source.matchAll(/"href": "(\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(routes.length >= 20, 'app collection should cover the primary tools');
  assert.equal(new Set(routes).size, routes.length, 'each app entry should have one distinct route');
  for (const href of routes) {
    assert.ok(!href.includes('..') && !href.includes('?') && !href.includes('#'), 'only literal safe paths');
    const path = href.replace(/^\//, '').replace(/\/$/, '');
    const candidates = [
      resolve(root, 'src/pages', path + '.astro'),
      resolve(root, 'src/pages', path, 'index.astro'),
      resolve(root, 'public', path),
    ];
    assert.ok(candidates.some(file => existsSync(file)), 'app link should exist: ' + href);
  }
});

test('launchers share one app registry and preserve dashboard navigation', () => {
  assert.match(home, /featuredDashboardApps\.map/);
  assert.match(home, /href="\/dashboard\/apps"/);
  assert.match(page, /dashboardAppCatalog\.filter/);
  assert.match(layout, /href: '\/dashboard\/apps'/);
  assert.match(page, /data-app-favorite/);
  assert.match(page, /data-app-filter/);
});

test('private FLOW MIND is not misleadingly labeled public', () => {
  assert.match(source, /"id": "flow-mind"[\s\S]{0,230}"access": "dashboard"/);
});
