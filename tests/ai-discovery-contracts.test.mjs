import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [robots, llms, middleware, astroConfig, sitemap] = await Promise.all([
  readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
  readFile(new URL('../public/llms.txt', import.meta.url), 'utf8'),
  readFile(new URL('../src/middleware.ts', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/sitemap.xml.ts', import.meta.url), 'utf8'),
]);

test('canonical origin is consistent across Astro, middleware, robots, and AI knowledge map', () => {
  for (const source of [robots, llms, middleware, astroConfig, sitemap]) {
    assert.match(source, /https:\/\/masahiroyamada\.com/);
  }
});

test('public discovery allows search and AI grounding without granting training permission', () => {
  assert.match(robots, /search=yes/);
  assert.match(robots, /ai-input=yes/);
  assert.match(robots, /ai-train=no/);
  assert.match(middleware, /Content-Signal/);
  assert.match(middleware, /search=yes, ai-input=yes, ai-train=no/);
});

test('canonical link header is emitted only for successful public HTML', () => {
  assert.match(middleware, /const isPublicHtml = response\.ok && contentType\.includes\('text\/html'\)/);
  assert.match(middleware, /rel=\"canonical\"/);
});

test('sitemap intentionally excludes private dashboard and API routes', () => {
  assert.doesNotMatch(sitemap, /['\"]\/dashboard/);
  assert.doesNotMatch(sitemap, /['\"]\/api\//);
  assert.match(sitemap, /['\"]\/library['\"]/);
  assert.match(sitemap, /['\"]\/faq['\"]/);
});
