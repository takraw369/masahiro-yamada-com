import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const ideasSource = read('src/data/dashboardAppIdeas.ts');
const appCatalog = read('src/data/dashboardAppCatalog.ts');
const appsPage = read('src/pages/dashboard/apps.astro');
const homePage = read('src/pages/dashboard/index.astro');

const match = ideasSource.match(/export const dashboardAppIdeas: DashboardAppIdea\[\] = (\[[\s\S]*\]);\s*$/);
assert.ok(match, 'ideas registry is a readable list');
const ideas = JSON.parse(match[1]);

test('Drive-backed app ideas are uniquely identified and explicitly not marked as launched', () => {
  const activeIds = [...appCatalog.matchAll(/"id": "([^"]+)"/g)].map(m => m[1]);
  assert.ok(ideas.length >= 10);
  assert.equal(new Set(ideas.map(item => item.id)).size, ideas.length);
  for (const idea of ideas) {
    assert.ok(!activeIds.includes(idea.id), 'do not create duplicate launch entries: ' + idea.id);
    assert.ok(['prototype', 'planned'].includes(idea.status), 'no invented live state');
    assert.match(idea.title, /\S/);
    assert.match(idea.description, /\S/);
    assert.match(idea.nextAction, /\S/);
    for (const url of [idea.href, idea.sourceUrl]) {
      const parsed = new URL(url);
      assert.equal(parsed.protocol, 'https:');
      assert.ok(['docs.google.com', 'drive.google.com'].includes(parsed.hostname), 'source links must point to Drive');
    }
  }
});

test('nutritional prototype and concept remain separate, never imply a deployed nutrition service', () => {
  assert.equal(ideas.find(item => item.id === 'nutri-flow')?.status, 'prototype');
  assert.equal(ideas.find(item => item.id === 'farm-flow')?.status, 'planned');
  assert.equal(ideas.find(item => item.id === 'thai-life-quest')?.status, 'prototype');
});

test('app library separates unfinished apps while preserving search and favorites', () => {
  assert.match(appsPage, /dashboardAppCatalog\.filter/);
  assert.match(appsPage, /dashboardAppIdeas\.filter/);
  assert.match(appsPage, /data-app-filter="prototype"/);
  assert.match(appsPage, /data-app-filter="planned"/);
  assert.match(appsPage, /data-app-favorite/);
  assert.match(appsPage, /Drive上のHTMLはプレビューだけでは動かない場合/);
  assert.match(appsPage, /target="_blank" rel="noopener noreferrer"/);
  assert.match(homePage, /dashboardAppCatalog\.length \+ dashboardAppIdeas\.length/);
  assert.match(homePage, /featuredDashboardApps\.map/);
});
