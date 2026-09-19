import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const automation = await readFile(
  new URL('../src/pages/api/dashboard/automation.ts', import.meta.url),
  'utf8',
);

test('canonical asset control plane reuses the existing private automation route', () => {
  assert.match(automation, /canonicalAssetPreview\(sourceId: number\)/);
  assert.match(automation, /canonicalAssetWrite\(sourceId: number, confirmation: string\)/);
  assert.match(automation, /case 'canonical\.preview'/);
  assert.match(automation, /case 'canonical\.write'/);
});

test('canonical write keeps an exact explicit Human Gate token', () => {
  assert.match(
    automation,
    /const CANONICAL_WRITE_CONFIRMATION = 'CONFIRM_ONE_CANONICAL_WRITE'/,
  );
  assert.match(
    automation,
    /confirmation !== CANONICAL_WRITE_CONFIRMATION/,
  );
  assert.match(
    automation,
    /canonical_human_gate_required/,
  );
});

test('canonical preview and write reject invalid source ids before RPC', () => {
  assert.match(automation, /function positiveInteger\(value: unknown\)/);
  assert.match(automation, /invalid_source_id/);
});
