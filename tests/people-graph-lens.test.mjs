import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceMap, shortestPath } from '../src/lib/peopleGraphModel.ts';

const edges = [
  {a:'self',b:'a'}, {a:'self',b:'b'}, {a:'a',b:'c'},
  {a:'c',b:'d'}, {a:'d',b:'e'}, {a:'b',b:'d'}
];

test('People lens respects 1–4 hop limits without inventing edges', () => {
  assert.deepEqual([...distanceMap('self',edges,1).entries()], [['self',0],['a',1],['b',1]]);
  assert.equal(distanceMap('self',edges,2).has('d'), true);
  assert.equal(distanceMap('self',edges,2).has('e'), false);
  assert.equal(distanceMap('self',edges,3).get('e'), 3);
});

test('Shortest human connection path uses the actual recorded links', () => {
  assert.deepEqual(shortestPath('self','e',edges), ['self','b','d','e']);
  assert.deepEqual(shortestPath('a','a',edges), ['a']);
  assert.deepEqual(shortestPath('a','unknown',edges), []);
});

test('Existing Knowledge graph remains the primary default view', () => {
  const graph = readFileSync(new URL('../src/pages/dashboard/graph.astro', import.meta.url),'utf8');
  assert.match(graph,/get\('view'\) === 'people'/);
  assert.match(graph,/PeopleGraphLens client:only="react"/);
  assert.match(graph,/href="\/dashboard\/graph" aria-current/);
  assert.match(graph,/href="\/dashboard\/graph\?view=people"/);
});

test('Demo People lens has no hidden production data access', () => {
  const people = readFileSync(new URL('../src/components/dashboard/PeopleGraphLens.tsx', import.meta.url),'utf8');
  assert.match(people,/架空データ・本番未接続/);
  assert.doesNotMatch(people,/\bfetch\s*\(/);
  assert.doesNotMatch(people,/localStorage|sessionStorage|indexedDB|SUPABASE_/);
  assert.doesNotMatch(people,/api\.x\.com|graph\.facebook\.com|open\.tiktokapis\.com/);
});

test('People Graph can be opened from the normal Dashboard MY APPS shelf', () => {
  const catalog = readFileSync(new URL('../src/data/dashboardAppCatalog.ts', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  assert.match(catalog, /"id": "ace-people-graph"/);
  assert.match(catalog, /"href": "\/dashboard\/graph\?view=people"/);
  assert.match(catalog, /"featured": true/);
  assert.match(home, /featuredDashboardApps\.map\(app =>/);
  assert.match(home, /<a href=\{app\.href\} class="home-app-card"/);
});
