import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

const canonicalFiles = [
  'src/pages/otsu6/index.astro',
  'public/otsu6/app.js',
  'public/otsu6/questions.js',
  'public/otsu6/styles.css',
  'public/otsu6/service-worker.js',
];

const forbiddenDuplicates = [
  'src/pages/otsu6.astro',
  'src/components/Otsu6StudyApp.tsx',
  'src/components/Otsu6StudyAppPrepared.tsx',
  'src/data/otsu6Questions.ts',
  'src/lib/prepareOtsu6Questions.ts',
  'src/styles/otsu6.css',
  'public/otsu6-feedback.js',
];

test('Otsu6 has one canonical implementation', () => {
  for (const path of canonicalFiles) {
    assert.equal(exists(path), true, `missing canonical Otsu6 file: ${path}`);
  }

  for (const path of forbiddenDuplicates) {
    assert.equal(exists(path), false, `duplicate Otsu6 implementation must not exist: ${path}`);
  }
});

test('canonical Otsu6 route loads only canonical runtime assets', () => {
  const page = read('src/pages/otsu6/index.astro');
  assert.match(page, /\/otsu6\/questions\.js/);
  assert.match(page, /\/otsu6\/app\.js/);
  assert.match(page, /\/otsu6\/styles\.css/);
  assert.doesNotMatch(page, /Otsu6StudyApp|otsu6-feedback/);
});

test('middleware does not inject a second Otsu6 runtime', () => {
  const middleware = read('src/middleware.ts');
  assert.doesNotMatch(middleware, /otsu6-feedback|pathname === ['"]\/otsu6/);
});

test('legacy Otsu6 service worker delegates to the canonical worker', () => {
  const legacyWorker = read('public/otsu6/sw.js');
  assert.match(legacyWorker, /importScripts\(['"]\.\/service-worker\.js['"]\)/);
  assert.doesNotMatch(legacyWorker, /addEventListener\(['"]fetch['"]/);
});
