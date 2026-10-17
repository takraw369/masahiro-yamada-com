#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { scanTakeout, saveIndex } from './core.mjs';
import { startLocalMediaHub } from './server.mjs';

function usage() {
  console.log('MASA Media Hub (local, read-only)');
  console.log('  node scripts/media-hub/cli.mjs scan "/path/to/extracted/Takeout" --out "/path/to/private/report" [--limit 100] [--no-hash]');
  console.log('  node scripts/media-hub/cli.mjs serve "/path/to/private/report/media-index.json" [--port 41596]');
}
function optionValue(args, flag, fallback) {
  const at = args.indexOf(flag);
  if (at < 0) return fallback;
  if (!args[at + 1] || args[at + 1].startsWith('--')) throw new Error('Missing value for ' + flag);
  return args[at + 1];
}
async function main() {
  const [command, input, ...args] = process.argv.slice(2);
  if (!command || !input || !['scan', 'serve'].includes(command)) { usage(); process.exitCode = 2; return; }
  if (command === 'scan') {
    const out = path.resolve(optionValue(args, '--out', './media-hub-private'));
    const limit = Number(optionValue(args, '--limit', '0'));
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('--limit must be a nonnegative integer');
    const index = await scanTakeout(input, { limit, hashMaxBytes: args.includes('--no-hash') ? 0 : 128 * 1024 * 1024 });
    const dest = await saveIndex(index, out);
    console.log(JSON.stringify({ report: dest, summary: index.summary, warnings: index.warnings.length }, null, 2));
    console.log('No originals modified. Suggestions are tentative and must be reviewed.');
  } else {
    const index = JSON.parse(await readFile(input, 'utf8'));
    if (index.schemaVersion !== 1 || index.sourceType !== 'extracted-google-takeout' || !Array.isArray(index.items)) throw new Error('Unsupported media index');
    const port = Number(optionValue(args, '--port', '0'));
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
    const { url } = await startLocalMediaHub(index, { port });
    console.log('MASA Media Hub (this Mac only): ' + url);
    console.log('Private token in URL: do not share. Press Ctrl+C to close.');
  }
}
main().catch(e => { console.error('[media-hub] ' + e.message); process.exitCode = 1; });
