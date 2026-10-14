import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const {
  REVENUE_FIELDS, createRevenueMission, getRevenueReadiness,
  updateRevenueFields, transitionRevenueMission,
} = await import('../src/lib/revenueMission.ts');

// No live Board requests: test the selector against a genuine 13/14 QA state.
test('the sole remaining QA item is MASA human publication confirmation', () => {
  const packagePatch = Object.fromEntries(
    REVENUE_FIELDS.filter(field => field.group === 'package').map(field => [
      field.key,
      field.kind === 'url' ? `https://drive.google.com/file/d/${field.key}/view` : `reviewed: ${field.key}`,
    ]),
  );
  let mission = updateRevenueFields(createRevenueMission(), packagePatch);
  mission = transitionRevenueMission(mission, 'PACKAGE', { actor: 'human' });
  mission = transitionRevenueMission(mission, 'QA', { actor: 'human' });
  mission = updateRevenueFields(mission, { qa: 'Review recorded', policy: 'Policy checked' });
  const readiness = getRevenueReadiness(mission);
  assert.equal(readiness.complete, 13);
  assert.equal(readiness.total, 14);
  assert.deepEqual(readiness.missing.map(field => field.key), ['publishGate']);
  assert.match(readiness.nextAction, /MASA 公開確認の記録/);
  assert.equal(mission.publishGate, ''); // Navigation is not an approval event.
});

test('next-step card expands and focuses an existing editor control without writing state', async () => {
  const ui = await readFile(new URL('../src/components/dashboard/RevenueMission.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/revenue-mission.css', import.meta.url), 'utf8');
  const routing = ui.match(/function openEditorAt\([^]*?\n  \}/)?.[0] || '';
  assert.match(ui, /const firstMissing = !afterLive \? readiness\.missing\[0\]/);
  assert.match(ui, /onClick=\{\(\) => openEditorAt\(firstMissing\.key\)\}/);
  assert.match(ui, /aria-controls="revenue-editor"/);
  assert.match(ui, /id=\{`revenue-field-\$\{field\.key\}`\}/);
  assert.match(ui, /input\.scrollIntoView\(\{ block: 'center', behavior: 'auto' \}\)/);
  assert.match(ui, /if \(!input\.disabled\) input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(routing, /setExpanded\(true\)/);
  assert.doesNotMatch(routing, /save\(|fetch\(|transitionRevenueMission\(|updateRevenueFields\(/);
  assert.match(ui, /publishGate: 'MASA がこの内容・価格・規約を確認した判断記録。AI は承認を記入しない。'/);
  assert.match(css, /\.revenue-next \.revenue-step-cta\{[^}]*min-height:44px/);
  assert.match(css, /\.revenue-fields input,\.revenue-fields textarea\{font-size:16px\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
