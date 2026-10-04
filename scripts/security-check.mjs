import { execFileSync } from 'node:child_process';

// Temporary, narrow exception for an upstream Astro production dependency.
// Astro imports http-cache-semantics for build-time remote asset caching. The
// currently published package (4.2.0) has no patched release as of 2026-10-04.
// These advisories concern attacker-influenced shared HTTP caches, which are
// not the deployed request path in this application.
//
// Keep this exception time-bounded. Any critical advisory, different package,
// different high advisory, or expiry must fail CI.
const EXCEPTION_EXPIRES = new Date('2026-10-31T00:00:00Z');
const ALLOWED_PACKAGE = 'http-cache-semantics';
const ALLOWED_ADVISORY_IDS = new Set([
  'GHSA-ch52-4w7c-c8xp',
  'GHSA-f27v-pv5m-c5g6',
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

  const vias = Array.isArray(vuln.via)
    ? vuln.via.filter((item) => item && typeof item === 'object')
    : [];
  const severeVias = vias.filter((item) => ['high', 'critical'].includes(item?.severity));
  const ids = severeVias.map(advisoryId).filter(Boolean);
  const hasUnknownSevereVia = severeVias.some((item) => !advisoryId(item));
  const hasCriticalVia = severeVias.some((item) => item?.severity === 'critical');

  // npm may report an ancestor/package-level fixAvailable object even when the
  // affected package itself has no patched version. Do not use that aggregate
  // field to widen or narrow this explicit advisory allow-list.
  const allowed =
    !expired &&
    name === ALLOWED_PACKAGE &&
    vuln.severity === 'high' &&
    !hasCriticalVia &&
    !hasUnknownSevereVia &&
    ids.length > 0;

  if (allowed) {
    acknowledged.push({
      name,
      ids: [...new Set(ids)],
      range: vuln.range,
      fixAvailable: vuln.fixAvailable,
    });
  } else {
    blocking.push({
      name,
      severity: vuln?.severity,
      range: vuln?.range,
      fixAvailable: vuln?.fixAvailable,
      via: severeVias.map((item) => ({
        title: item.title,
        url: item.url,
        severity: item.severity,
      })),
    });
  }
}

if (acknowledged.length) {
  console.warn('Temporarily acknowledged upstream audit finding(s):');
  for (const item of acknowledged) {
    console.warn(`- ${item.name} ${item.range || ''}: ${item.ids.join(', ')}`);
  }
  console.warn(`Exception expires: ${EXCEPTION_EXPIRES.toISOString()}`);
}

if (blocking.length) {
  console.error('Blocking production dependency vulnerabilities detected:');
  console.error(JSON.stringify(blocking, null, 2));
  process.exit(1);
}

console.log('Production dependency security gate passed.');
