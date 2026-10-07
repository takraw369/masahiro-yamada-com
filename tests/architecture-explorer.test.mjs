import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const pageUrl = new URL('../src/pages/dashboard/architecture.astro', import.meta.url);
const dataUrl = new URL('../src/data/architectureExplorer.ts', import.meta.url);
const middlewareUrl = new URL('../src/middleware.ts', import.meta.url);
const layoutUrl = new URL('../src/layouts/DashboardLayout.astro', import.meta.url);

test('architecture explorer stays read-only and explicit about evidence boundaries', async () => {
  const [page, data] = await Promise.all([
    readFile(pageUrl, 'utf8'),
    readFile(dataUrl, 'utf8'),
  ]);

  assert.match(page, /DashboardLayout/);
  assert.match(page, /SYSTEM ARCHITECTURE · INVESTIGATION MAP/);
  assert.match(page, /Brain Graph/);
  assert.match(data, /TARGET REPO NOT CONNECTED/);
  assert.match(data, /MASA PRIMARY is currently Google Drive \/ Supabase \/ masahiro-yamada-com \/ masa-automation centered/);
  assert.match(data, /status:'confirmed'/);
  assert.match(data, /status:'inferred'/);
  assert.match(data, /status:'unknown'/);
  assert.match(data, /Model inference and Modal compute are separate concepts until code proves otherwise/);
  assert.doesNotMatch(page, /fetch\s*\(/);
  assert.doesNotMatch(page, /\/api\/dashboard\//);
});

test('architecture explorer inherits the existing private dashboard auth boundary', async () => {
  const middleware = await readFile(middlewareUrl, 'utf8');
  assert.match(middleware, /pathname\.startsWith\('\/dashboard'\)/);
  assert.match(middleware, /verifyDashboardSession/);
  assert.match(middleware, /same_origin_required/);
});

test('graph references resolve and canonical system roles remain distinct from target-app hypotheses', async () => {
  const data = await readFile(dataUrl, 'utf8');
  assert.match(data, /Google Drive \/ MASA_OS/);
  assert.match(data, /Structured State \/ Relation \/ Runtime Data/);
  assert.match(data, /LAB \/ PORT SOURCE ONLY/);
  assert.match(data, /Convex: User/);
  assert.match(data, /Cloudflare R2/);
  assert.match(data, /Modal/);
});


test('architecture explorer is discoverable from shared dashboard navigation', async () => {
  const layout = await readFile(layoutUrl, 'utf8');
  assert.match(layout, /href: '\/dashboard\/graph', label: 'Graph'/);
  assert.match(layout, /href: '\/dashboard\/architecture', label: 'Architecture'/);
});
