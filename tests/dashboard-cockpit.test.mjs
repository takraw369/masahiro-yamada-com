import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('cockpit reuses existing task/evidence/feedback pathways and keeps layout local', async () => {
  const component = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');

  assert.match(component, /masa-dashboard-cockpit-v1/);
  assert.match(component, /\/api\/dashboard\/task-execution\?limit=80/);
  assert.match(component, /\/api\/dashboard\/evidence/);
  assert.match(component, /\/api\/dashboard\/feedback/);
  assert.match(component, /hidden:\s*\['decision'\]/);
  assert.match(component, /kind:'dashboard_cockpit'/);
  assert.match(component, /正式変更・公開は自動実行しない/);
  assert.match(component, /\/dashboard\/tasks/);
  assert.doesNotMatch(component, /\/api\/dashboard\/cockpit/);
  assert.match(page, /DashboardCockpit client:load/);
  assert.match(page, /Projectを見れば済むことは質問にしない/);
  assert.match(page, /href:\s*'\/dashboard\/tasks'/);
});

test('cockpit keeps NOW 5 as optional decision exception rather than default surface', async () => {
  const component = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  assert.match(component, /DECISION · EXCEPTION/);
  assert.match(component, /ProjectやTaskを見れば済むことは質問にしない/);
  assert.match(component, /NOW 5 \/ 判断待ちを見る/);
});
