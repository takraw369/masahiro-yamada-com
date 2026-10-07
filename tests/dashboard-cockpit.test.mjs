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


test('dashboard mobile baseline prevents viewport text overflow and iOS input zoom', async () => {
  const component = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');

  assert.match(layout, /-webkit-text-size-adjust:\s*100%/);
  assert.match(layout, /\.content-inner > \* \{ min-width: 0; max-width: 100%; \}/);
  assert.match(layout, /overflow-wrap:\s*anywhere/);
  assert.match(layout, /min-height:\s*44px; touch-action:\s*manipulation/);

  assert.match(component, /\.evidence-list article>div\{min-width:0;max-width:100%;overflow:hidden\}/);
  assert.match(component, /\.evidence-list strong\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
  assert.match(component, /\.cockpit-grid\{grid-template-columns:minmax\(0,1fr\);max-width:100%\}/);
  assert.match(component, /\.cockpit textarea\{max-width:100%;font-size:16px\}/);
});


test('dashboard mobile prioritizes action before explanation', async () => {
  const component = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
  const standard = await readFile(new URL('../docs/dashboard-mobile-ui-standard.md', import.meta.url), 'utf8');

  assert.match(page, /@media\(max-width:620px\)\{\.dash-head\{display:none\}/);
  assert.match(component, /\.cockpit-title\{display:none\}/);
  assert.match(component, /\{editing \? '完了' : '配置'\}/);
  assert.match(layout, /\.page-title \{ display: none; \}/);
  assert.match(layout, /\.capture-label, \.quick-label, \.command-shortcut \{ display: none; \}/);
  assert.match(layout, /\.content \{ padding-top: 12px; scroll-margin-top: 82px; \}/);
  assert.match(standard, /Action before explanation/);
  assert.match(standard, /One-screen density is part of quality/);
});
