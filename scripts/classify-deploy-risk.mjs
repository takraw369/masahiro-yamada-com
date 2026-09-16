import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const exactRiskyPaths = new Map([
  ['wrangler.toml', 'cloudflare-config'],
  ['wrangler.json', 'cloudflare-config'],
  ['wrangler.jsonc', 'cloudflare-config'],
  ['package.json', 'runtime-dependencies'],
  ['package-lock.json', 'runtime-dependencies'],
  ['npm-shrinkwrap.json', 'runtime-dependencies'],
  ['astro.config.mjs', 'build-config'],
  ['astro.config.ts', 'build-config'],
  ['tsconfig.json', 'build-config'],
  ['src/middleware.ts', 'request-auth-boundary'],
  ['src/lib/dashboardAuth.ts', 'auth-boundary'],
  ['src/lib/siteStorage.ts', 'storage-boundary'],
  ['scripts/patch-worker.mjs', 'worker-build-chain'],
  ['scripts/verify-worker-config.mjs', 'worker-build-chain'],
  ['scripts/preview.mjs', 'worker-preview-chain'],
]);

const prefixRiskRules = [
  ['.github/workflows/', 'github-workflow'],
  ['.github/actions/', 'github-action'],
  ['src/pages/api/', 'server-api'],
  ['supabase/', 'database-supabase'],
  ['migrations/', 'database-migration'],
  ['db/', 'database'],
];

const patternRiskRules = [
  [/^src\/lib\/.*(?:stripe|payment|billing)/iu, 'payments'],
  [/^src\/lib\/.*(?:supabase|database|storage)/iu, 'data-access'],
  [/^src\/lib\/.*auth/iu, 'auth-boundary'],
  [/(?:^|\/)(?:\.env|.*secret.*)(?:$|\.)/iu, 'secret-config'],
];

function normalizeFiles(files) {
  return [...new Set(files.map((file) => String(file).trim().replace(/^\.\//u, '')).filter(Boolean))].sort();
}

function reasonForFile(file) {
  if (exactRiskyPaths.has(file)) return exactRiskyPaths.get(file);
  for (const [prefix, reason] of prefixRiskRules) {
    if (file.startsWith(prefix)) return reason;
  }
  for (const [pattern, reason] of patternRiskRules) {
    if (pattern.test(file)) return reason;
  }
  return null;
}

export function classifyDeployRisk(files, { eventName = 'push', forceRisky = false } = {}) {
  const normalized = normalizeFiles(files);
  const riskyFiles = [];
  const reasons = new Set();

  if (forceRisky || eventName === 'workflow_dispatch') reasons.add('manual-dispatch');

  for (const file of normalized) {
    const reason = reasonForFile(file);
    if (!reason) continue;
    riskyFiles.push(file);
    reasons.add(reason);
  }

  return {
    risky: reasons.size > 0,
    changedFiles: normalized,
    riskyFiles,
    reasons: [...reasons].sort(),
  };
}

function writeGithubOutput(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const summary = result.risky
    ? `${result.reasons.join(',')}: ${result.riskyFiles.join(',') || 'manual dispatch'}`
    : 'safe application/content delta';
  appendFileSync(outputPath, `risky=${String(result.risky)}\n`);
  appendFileSync(outputPath, `summary=${summary.replace(/[\r\n]/gu, ' ')}\n`);
  appendFileSync(outputPath, `risky_count=${result.riskyFiles.length}\n`);
}

async function main() {
  const input = readFileSync(0, 'utf8');
  const files = input.split(/\r?\n/u).filter(Boolean);
  const result = classifyDeployRisk(files, {
    eventName: process.env.GITHUB_EVENT_NAME || 'push',
    forceRisky: process.env.DEPLOY_FORCE_RISKY === 'true',
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  writeGithubOutput(result);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
