/**
 * PR-scoped Supabase migration ACL gate.
 *
 * This is a static guard, not an authorization proof. Runtime access and
 * payment/auth flows need separate review.
 *
 * CI: MIGRATION_BASE_SHA=... MIGRATION_HEAD_SHA=... node scripts/check-supabase-migration-acls.mjs
 * Local: node scripts/check-supabase-migration-acls.mjs --files migrations/example.sql
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const stripComments = (sql) => sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\r\n]*/g, '');

const namePattern = (name) => {
  // Names originate only from the constrained identifier patterns below.
  const escaped = name.replace(/\$/g, '\\$');
  return 'public\\.(?:"' + escaped + '"|' + escaped + ')(?![\\w$])';
};

export function scanMigration(sql) {
  const source = stripComments(sql);
  const problems = [];
  const tableRegex = /^\s*create\s+(?:(?:unlogged|temporary|temp)\s+)?table\s+(?:if\s+not\s+exists\s+)?public\.(?:"([\w$]+)"|([\w$]+))/gim;
  const functionRegex = /^\s*create\s+(?:or\s+replace\s+)?function\s+public\.(?:"([\w$]+)"|([\w$]+))\s*\(/gim;
  const found = (regex) => [...source.matchAll(regex)]
    .map((match) => (match[1] || match[2]).toLowerCase());

  for (const name of new Set(found(tableRegex))) {
    // Every new table needs an object-specific GRANT or REVOKE decision.
    const acl = new RegExp(
      '\\b(?:grant|revoke)\\s+[\\w\\s,]*?\\bon\\s+(?:table\\s+)?' + namePattern(name),
      'i',
    );
    if (!acl.test(source)) {
      problems.push('public.' + name + ': table creation lacks explicit GRANT/REVOKE');
    }
  }

  for (const name of new Set(found(functionRegex))) {
    // An explicit PUBLIC revoke is required even if later role-specific GRANTs exist.
    const revoke = new RegExp(
      '\\brevoke\\s+[\\w\\s,]*?\\bon\\s+function\\s+' +
        namePattern(name) + '\\s*\\([^;]*?\\)\\s+from\\s+[^;]*?\\bpublic\\b',
      'i',
    );
    if (!revoke.test(source)) {
      problems.push('public.' + name + ': function creation lacks REVOKE from PUBLIC');
    }
  }
  return problems;
}

function changedMigrationPaths(base, head) {
  const output = execFileSync('git', [
    'diff', '--name-only', '-z', '--diff-filter=ACMR',
    base + '...' + head, '--', 'migrations/',
  ], { encoding: 'utf8' });
  return output.split('\0').filter((file) => /^migrations\/[^/]+\.sql$/i.test(file));
}

export function checkFiles(paths) {
  return paths.flatMap((file) => {
    const source = readFileSync(resolve(file), 'utf8');
    return scanMigration(source).map((message) => file + ': ' + message);
  });
}

function main() {
  const index = process.argv.indexOf('--files');
  let paths;
  if (index >= 0) {
    paths = process.argv.slice(index + 1);
    if (!paths.length) throw new Error('--files requires a migration path');
  } else {
    const base = process.env.MIGRATION_BASE_SHA;
    const head = process.env.MIGRATION_HEAD_SHA;
    if (!base || !head) {
      throw new Error('Supply MIGRATION_BASE_SHA/MIGRATION_HEAD_SHA or use --files');
    }
    paths = changedMigrationPaths(base, head);
  }

  const problems = checkFiles(paths);
  if (problems.length) {
    process.stderr.write('Supabase ACL guard failed:\n- ' + problems.join('\n- ') + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Supabase ACL guard passed (' + paths.length + ' changed SQL migrations).\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error?.message || error) + '\n');
    process.exitCode = 1;
  }
}
