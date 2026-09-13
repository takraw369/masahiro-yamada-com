import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Raindrop fallback uses a private Cloudflare Service Binding', async () => {
  const [wrangler, middleware, endpoint] = await Promise.all([
    read('wrangler.toml'),
    read('src/middleware.ts'),
    read('src/pages/api/dashboard/automation.ts'),
  ]);

  assert.match(wrangler, /\[\[services\]\][\s\S]*binding\s*=\s*"FLOW_RUNNER"[\s\S]*service\s*=\s*"masa-flow-runner"/);
  assert.match(middleware, /pathname\.startsWith\('\/api\/dashboard'\)/);
  assert.match(endpoint, /FLOW_RUNNER/);
  assert.doesNotMatch(endpoint, /RAINDROP_ACCESS_TOKEN|Authorization:\s*Bearer|api\.raindrop\.io/);
});

test('Raindrop curator proxy is narrow, bounded, and reversible', async () => {
  const endpoint = await read('src/pages/api/dashboard/automation.ts');

  assert.match(endpoint, /'raindrop\.search'/);
  assert.match(endpoint, /'raindrop\.get'/);
  assert.match(endpoint, /'raindrop\.curate'/);
  assert.match(endpoint, /value\.length > 150/);
  assert.match(endpoint, /expectedLink/);
  assert.match(endpoint, /'move', 'tag', 'trash'/);
  assert.doesNotMatch(endpoint, /deleteBookmark|method:\s*['"]DELETE['"]/);
});

test('Control Plane does not expose an arbitrary Flow Runner method bridge', async () => {
  const endpoint = await read('src/pages/api/dashboard/automation.ts');

  assert.match(endpoint, /unsupported_action/);
  assert.match(endpoint, /unsupported_workflow/);
  assert.doesNotMatch(endpoint, /body\.method|body\.rpc|\[body\.action\]/);
});
