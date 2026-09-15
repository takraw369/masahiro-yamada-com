import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('LINE Flow uses the first-party Supabase runtime instead of legacy line-crm-worker', async () => {
  const route = await readFile(new URL('../src/pages/api/line-harness/[...path].ts', import.meta.url), 'utf8');

  assert.match(route, /masa_line_flow_api/);
  assert.match(route, /getDashboardOwnerKey/);
  assert.match(route, /verifyDashboardSession/);
  assert.match(route, /isSameOriginRequest/);
  assert.doesNotMatch(route, /handleHarnessProxy\('line'/);
  assert.doesNotMatch(route, /LINE_HARNESS_URL/);
});
