import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Market Pulse reuses the existing read-only market endpoint and Investment route', async () => {
  const [component, page] = await Promise.all([
    readFile(new URL('../src/components/dashboard/MarketPulseGadget.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8'),
  ]);

  assert.match(component, /fetch\('\/api\/dashboard\/investment-market'/);
  assert.match(component, /href="\/dashboard\/investment"/);
  assert.match(component, /signals\.slice\(0, 5\)/);
  assert.match(component, /実測資金フローや投資判断ではありません/);
  assert.doesNotMatch(component, /method:\s*['"]POST['"]/);
  assert.doesNotMatch(component, /api\/dashboard\/market-pulse/);
  assert.match(page, /MarketPulseGadget client:load/);
});
