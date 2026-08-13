import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const wranglerConfig = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const deployWorkflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

test('preview command uses the Workers runtime and rebuilds first', () => {
  assert.equal(packageJson.scripts.preview, 'npm run build && wrangler dev');
  assert.ok(!packageJson.scripts.preview.includes('wrangler pages dev'));
});

test('hosted previews cannot inherit production auth or data bindings', () => {
  assert.equal(wranglerConfig.preview_urls, true);
  assert.equal(wranglerConfig.previews.vars.APP_ENV, 'preview');
  assert.equal(wranglerConfig.previews.vars.HARNESS_PROXY_ENABLED, 'false');
  assert.equal(wranglerConfig.previews.vars.HARNESS_SIDE_EFFECTS_ENABLED, 'false');
  assert.equal('secrets' in wranglerConfig.previews, false);
  assert.deepEqual(wranglerConfig.previews.d1_databases, []);
  assert.deepEqual(wranglerConfig.previews.ratelimits, []);
});

test('production deploy rejects non-master provenance', () => {
  assert.match(deployWorkflow, /test "\$GITHUB_REF" = "refs\/heads\/master"/u);
  assert.match(deployWorkflow, /test "\$GITHUB_SHA" = "\$\(git rev-parse HEAD\)"/u);
});
