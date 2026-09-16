import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDeployRisk } from '../scripts/classify-deploy-risk.mjs';

test('ordinary dashboard and content changes stay on the automatic lane', () => {
  const result = classifyDeployRisk([
    'src/pages/dashboard/post.astro',
    'src/components/dashboard/PostComposer.tsx',
    'src/styles/dashboard.css',
    'public/app-icons/post-512.png',
    'docs/release-note.md',
  ]);
  assert.equal(result.risky, false);
  assert.deepEqual(result.riskyFiles, []);
});

test('workflow and Cloudflare changes require a human gate', () => {
  const result = classifyDeployRisk(['.github/workflows/deploy.yml', 'wrangler.toml']);
  assert.equal(result.risky, true);
  assert.deepEqual(result.reasons, ['cloudflare-config', 'github-workflow']);
});

test('server API, auth, storage and database changes require a human gate', () => {
  const result = classifyDeployRisk([
    'src/pages/api/dashboard/state.ts',
    'src/middleware.ts',
    'src/lib/dashboardAuth.ts',
    'src/lib/siteStorage.ts',
    'supabase/migrations/20260916.sql',
  ]);
  assert.equal(result.risky, true);
  assert.ok(result.reasons.includes('server-api'));
  assert.ok(result.reasons.includes('request-auth-boundary'));
  assert.ok(result.reasons.includes('auth-boundary'));
  assert.ok(result.reasons.includes('storage-boundary'));
  assert.ok(result.reasons.includes('database-supabase'));
});

test('runtime dependency and payment changes require a human gate', () => {
  const result = classifyDeployRisk(['package-lock.json', 'src/lib/stripeClient.ts']);
  assert.equal(result.risky, true);
  assert.ok(result.reasons.includes('runtime-dependencies'));
  assert.ok(result.reasons.includes('payments'));
});

test('manual dispatch is always protected even with an otherwise safe delta', () => {
  const result = classifyDeployRisk(['src/pages/dashboard/index.astro'], { eventName: 'workflow_dispatch' });
  assert.equal(result.risky, true);
  assert.deepEqual(result.reasons, ['manual-dispatch']);
});

test('classification normalizes duplicate and ./ paths', () => {
  const result = classifyDeployRisk(['./src/pages/dashboard/post.astro', 'src/pages/dashboard/post.astro']);
  assert.equal(result.changedFiles.length, 1);
  assert.equal(result.risky, false);
});
