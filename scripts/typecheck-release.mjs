import { spawnSync } from 'node:child_process';

const LEGACY_ERROR_BUDGET = 279;
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
const totalErrors = summary ? Number(summary[1]) : diagnostics.length;

const base = process.env.TYPECHECK_BASE_SHA || 'HEAD^1';
const head = process.env.TYPECHECK_HEAD_SHA || 'HEAD';
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
console.log(`- total Astro errors: ${totalErrors}`);
console.log(`- transitional legacy budget: ${LEGACY_ERROR_BUDGET}`);
console.log(`- changed files: ${changedFiles.size}`);
console.log(`- changed files with type errors: ${changedUnique.length}`);

if (changedUnique.length > 0) {
  console.error('\n[typecheck-release] New/edited source files must be type-clean:');
  for (const file of changedUnique) console.error(`- ${file}`);
  process.exit(1);
}

if (totalErrors > LEGACY_ERROR_BUDGET) {
  console.error(`\n[typecheck-release] Type debt regressed: ${totalErrors} > ${LEGACY_ERROR_BUDGET}.`);
  process.exit(1);
}

if (check.status === 0) {
  console.log('[typecheck-release] Full repository typecheck is clean.');
} else {
  console.log('[typecheck-release] PASS: no changed-file errors and legacy debt did not increase.');
  console.log('[typecheck-release] Full debt remains visible above and must be reduced separately; it is not hidden or treated as resolved.');
}
