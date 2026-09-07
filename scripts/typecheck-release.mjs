import { spawnSync } from 'node:child_process';

const stripAnsi = (value) => value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
  });
}

const check = run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', 'check']);
const raw = `${check.stdout ?? ''}\n${check.stderr ?? ''}`;
process.stdout.write(raw);

const output = stripAnsi(raw);
const diagnostics = [...output.matchAll(/^(src\/[^:\n]+):\d+:\d+\s+-\s+error\b/gm)].map((match) => match[1]);
const summary = output.match(/-\s+(\d+)\s+errors\b/);

// A non-zero Astro check with no normal diagnostic summary means the checker
// itself could not complete (for example, invalid config or migration errors).
// Never relabel that as legacy type debt.
if (check.status !== 0 && !summary) {
  console.error('\n[typecheck-release] FAIL: Astro check did not complete normally; release diagnostics are not trustworthy.');
  process.exit(1);
}

const totalErrors = summary ? Number(summary[1]) : diagnostics.length;
const head = process.env.TYPECHECK_HEAD_SHA || 'HEAD';
let base = process.env.TYPECHECK_BASE_REF || 'origin/master';
const mergeBase = run('git', ['merge-base', base, head]);
if (mergeBase.status === 0 && (mergeBase.stdout ?? '').trim()) {
  base = mergeBase.stdout.trim();
}

const diff = run('git', ['diff', '--name-only', base, head]);
if (diff.status !== 0) {
  process.stderr.write(`\n[typecheck-release] Could not compute changed files for ${base}..${head}.\n`);
  process.stderr.write(diff.stderr ?? '');
  process.exit(1);
}

const changedFiles = new Set((diff.stdout ?? '').split(/\r?\n/).filter(Boolean));
const changedDiagnostics = diagnostics.filter((file) => changedFiles.has(file));
const changedUnique = [...new Set(changedDiagnostics)];

console.log('\n[typecheck-release] release delta summary');
console.log(`- comparison base: ${base}`);
console.log(`- total repository Astro errors (visible legacy debt): ${totalErrors}`);
console.log(`- changed files: ${changedFiles.size}`);
console.log(`- changed files with type errors: ${changedUnique.length}`);

if (changedUnique.length > 0) {
  console.error('\n[typecheck-release] New/edited source files must be type-clean:');
  for (const file of changedUnique) console.error(`- ${file}`);
  process.exit(1);
}

if (check.status === 0) {
  console.log('[typecheck-release] Full repository typecheck is clean.');
} else {
  console.log('[typecheck-release] PASS: the release delta is type-clean against current master.');
  console.log('[typecheck-release] Pre-existing errors remain visible above and are tracked as separate debt; this gate does not relabel them as resolved.');
}
