import { execFileSync } from 'node:child_process';

// Temporary, narrow exception for an upstream Astro production dependency.
// Astro imports http-cache-semantics from packages/astro/src/assets/build/remote.ts
// for build-time remote asset caching. The currently published package (4.2.0)
// has no patched release as of 2026-10-04. These advisories require a shared,
// attacker-influenced HTTP cache, which is not the deployed request path here.
//
// Keep this exception time-bounded. Any critical advisory, fix becoming
// available, different package, different advisory, or expiry must fail CI.
const EXCEPTION_EXPIRES = new Date('2026-10-31T00:00:00Z');
const ALLOWED_PACKAGE = 'http-cache-semantics';
const ALLOWED_ADVISORY_IDS = new Set([
  'GHSA-ch52-4w7c-c8xp', // CVE-2026-93748: max-stale shared-cache disclosure
  'GHSA-f27v-pv5m-c5g6', // CVE-2026-93750: Vary:* shared-cache disclosure
  'CVE-2026-93748',
  'CVE-2026-93750',
]);

function advisoryId(via) {
  const haystack = [via?.url, via?.title, via?.name].filter(Boolean).join(' ');
  for (const id of ALLOWED_ADVISORY_IDS) {
    if (haystack.toLowerCase().includes(id.toLowerCase())) return id;
  }
  return null;
}

let report;
try {
  const stdout = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  });
  report = JSON.parse(stdout);
} catch (error) {
  const stdout = error?.stdout?.toString?.() || '';
  if (!stdout) {
    console.error(error?.stderr?.toString?.() || error);
    process.exit(1);
  }
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error(stdout);
    process.exit(1);
  }
}

const vulnerabilities = report?.vulnerabilities || {};
const blocking = [];
const acknowledged = [];
const expired = Date.now() >= EXCEPTION_EXPIRES.getTime();

for (const [name, vuln] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(vuln?.severity)) continue;

  const vias = Array.isArray(vuln.via) ? vuln.via.filter((item) => item && typeof item === 'object') : [];
  const ids = vias.map(advisoryId).filter(Boolean);
  const hasUnknownVia = vias.some((item) => !advisoryId(item) && ['high', 'critical'].includes(item?.severity));
  const hasCriticalVia = vias.some((item) => item?.severity === 'critical');
  const fixAvailable = vuln?.fixAvailable && vuln.fixAvailable !== false;

  const allowed =
    !expired &&
    name === ALLOWED_PACKAGE &&
    vuln.severity === 'high' &&
    !hasCriticalVia &&
    !hasUnknownVia &&
    ids.length > 0 &&
    !fixAvailable;

  if (allowed) {
    acknowledged.push({ name, ids: [...new Set(ids)], range: vuln.range });
  } else {
    blocking.push({ name, severity: vuln?.severity, range: vuln?.range, fixAvailable: vuln?.fixAvailable, via: vias.map((item) => ({ title: item.title, url: item.url, severity: item.severity })) });
  }
}

if (acknowledged.length) {
  console.warn('Temporarily acknowledged upstream audit finding(s):');
  for (const item of acknowledged) console.warn(`- ${item.name} ${item.range || ''}: ${item.ids.join(', ')}`);
  console.warn(`Exception expires: ${EXCEPTION_EXPIRES.toISOString()}`);
}

if (blocking.length) {
  console.error('Blocking production dependency vulnerabilities detected:');
  console.error(JSON.stringify(blocking, null, 2));
  process.exit(1);
}

console.log('Production dependency security gate passed.');
