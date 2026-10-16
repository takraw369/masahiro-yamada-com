import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const [robots, llms, middleware, astroConfig, sitemap, staticHeaders, wranglerConfig] = await Promise.all([
  readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/llms.txt.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/middleware.ts', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/sitemap.xml.ts', import.meta.url), 'utf8'),
  readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.toml', import.meta.url), 'utf8'),
]);

test('canonical origin is consistent across Astro, middleware, robots, and AI knowledge map', () => {
  for (const source of [robots, llms, astroConfig, sitemap]) {
    assert.match(source, /https:\/\/masahiroyamada\.com/);
  }
  assert.match(middleware, /const CANONICAL_HOST = 'masahiroyamada\.com'/);
  assert.match(middleware, /const CANONICAL_ORIGIN = `https:\/\/\$\{CANONICAL_HOST\}`/);
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

test('AI discovery text responses declare UTF-8 to prevent Japanese mojibake', () => {
  assert.match(staticHeaders, /\/robots\.txt\s+Content-Type:\s*text\/plain;\s*charset=utf-8/i);
  assert.match(llms, /'Content-Type': 'text\/plain; charset=utf-8'/);
  assert.match(llms, /山田昌寛/);
  assert.ok(!existsSync(new URL('../public/llms.txt', import.meta.url)), 'avoid a competing static asset');
});

test('Cloudflare observability persists without logging OAuth callback request URLs', () => {
  assert.match(wranglerConfig, /\[observability\]\s+redact_query_string = true\s+enabled = true\s+head_sampling_rate = 1/);
  assert.match(wranglerConfig, /\[observability\.logs\]\s+enabled = true\s+head_sampling_rate = 1\s+invocation_logs = false\s+persist = true/);
});
