#!/usr/bin/env node
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { MediaCatalog } from './catalog.mjs';
import { scanCatalog } from './scanner.mjs';
import { startLocalMediaHub } from './server.mjs';
import { eaglePreflight, prepareEagle, eagleQueue } from './eagle.mjs';
import { proposePhotosAction, transitionPhotosAction } from './photos-actions.mjs';

function usage() {
  console.log(`MASA Media Hub (local; originals are read-only)
  scan SOURCE --out PRIVATE_DIR [--limit 500 | --limit 0] [--resume] [--no-hash] [--hash-budget-mb 1024]
  serve PRIVATE_DIR/media-index.sqlite [--port 0]
  query CATALOG [--q TEXT] [--category KNOWLEDGE] [--priority S] [--offset 0] [--limit 48]
  review CATALOG --id ID [--category LIFE] [--priority A] [--tags TAG1,TAG2] [--project NAME]
  audit CATALOG [--offset 0] [--limit 100]
  status CATALOG
  eagle-check
  eagle-prepare CATALOG --id ID --mode local-original --approve-local-copy
  eagle-prepare CATALOG --id ID --mode bookmark --verified-url VERIFIED_PHOTO_URL
  eagle-queue CATALOG (plans only; live execution is disabled)
  photos-propose CATALOG --id ID --action add-to-album [--note TEXT]
  photos-transition CATALOG --id PROPOSAL_ID --state opened|manually-confirmed|completed [--confirmation TEXT]
  (prefix commands with: node scripts/media-hub/cli.mjs)`);
}
export function optionValue(args, flag, fallback) {
  const at = args.indexOf(flag);
  if (at < 0) return fallback;
  if (!args[at + 1] || args[at + 1].startsWith('--')) throw new Error('Missing value for ' + flag);
  return args[at + 1];
}
function integer(args, flag, fallback) {
  const value = Number(optionValue(args, flag, fallback));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(flag + ' must be a nonnegative integer');
  return value;
}
async function main() {
  const [command, input, ...args] = process.argv.slice(2);
  if (command === '--help') { usage(); return; }
  if (command === 'eagle-check') {
    if (input || args.length) throw new Error('eagle-check takes no arguments');
    console.log(JSON.stringify(await eaglePreflight(), null, 2)); return;
  }
  if (!command || !input || !['scan','serve','query','review','audit','status','eagle-prepare','eagle-queue','photos-propose','photos-transition'].includes(command)) { usage(); process.exitCode = 2; return; }
  const allowed = {
    scan: ['--out','--limit','--resume','--no-hash','--hash-budget-mb'], serve: ['--port'],
    query: ['--q','--category','--priority','--offset','--limit'],
    review: ['--id','--category','--priority','--tags','--project','--topic','--privacy','--rights','--useStatus'],
    audit: ['--offset','--limit'], status: [], 'eagle-queue': [],
    'eagle-prepare': ['--id','--mode','--approve-local-copy','--verified-url'],
    'photos-propose': ['--id','--action','--note'], 'photos-transition': ['--id','--state','--confirmation']
  }[command];
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.includes(flag)) throw new Error('Unknown option for ' + command + ': ' + flag);
    if (seen.has(flag)) throw new Error('Repeated option: ' + flag);
    seen.add(flag);
    if (!['--resume','--no-hash','--approve-local-copy'].includes(flag)) { optionValue(args, flag); i++; }
  }
  if (command === 'scan') {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    try {
      const result = await scanCatalog(input, {
        outDir: path.resolve(optionValue(args, '--out', './media-hub-private')), limit: integer(args, '--limit', '500'),
        resume: args.includes('--resume'), hashMaxBytes: args.includes('--no-hash') ? 0 : 128 * 1024 * 1024,
        hashBudgetBytes: integer(args, '--hash-budget-mb', '1024') * 1024 * 1024, signal: controller.signal,
        onProgress: s => console.error(JSON.stringify({ phase: s.phase, state: s.state, discovered: s.discovered, processed: s.processed, reused: s.reused, hashedBytes: s.hashedBytes }))
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.summary.scan.state === 'cancelled') process.exitCode = 130;
      else if (result.summary.scan.state === 'incomplete') process.exitCode = 1;
    } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
    return;
  }
  let catalog;
  try {
    // v1 JSON remains readable, but all new scans/reviews use the single SQLite index.
    if (command === 'serve' && input.endsWith('.json')) {
      const index = JSON.parse(await readFile(input, 'utf8'));
      if (index.schemaVersion !== 1 || index.sourceType !== 'extracted-google-takeout' || !Array.isArray(index.items)) throw new Error('Unsupported media index');
      const { url } = await startLocalMediaHub(index, { port: integer(args, '--port', '0') });
      console.log('MASA Media Hub (this Mac only; private session URL, do not share): ' + url);
      return;
    }
    if (!(await stat(path.resolve(input))).isFile()) throw new Error('Existing catalog file required');
    catalog = new MediaCatalog(path.resolve(input));
    if (!catalog.getSetting('root')) throw new Error('No scan in catalog');
    let result;
    if (command === 'serve') {
      const port = integer(args, '--port', '0');
      if (port > 65535) throw new Error('Invalid port');
      const { server, url } = await startLocalMediaHub(catalog, { port });
      server.once('close', () => catalog.close());
      console.log('MASA Media Hub (this Mac only; private session URL, do not share): ' + url);
      catalog = null; // owned by the server lifetime
      return;
    }
    if (command === 'eagle-prepare') {
      result = await prepareEagle(catalog, optionValue(args, '--id'), { mode: optionValue(args, '--mode', 'local-original'),
        approveLocalCopy: args.includes('--approve-local-copy'), verifiedUrl: optionValue(args, '--verified-url') });
    } else if (command === 'eagle-queue') result = eagleQueue(catalog);
    else if (command === 'photos-propose') result = proposePhotosAction(catalog, optionValue(args, '--id'), optionValue(args, '--action'), optionValue(args, '--note', ''));
    else if (command === 'photos-transition') result = transitionPhotosAction(catalog, optionValue(args, '--id'), optionValue(args, '--state'), optionValue(args, '--confirmation', ''));
    else if (command === 'review') {
      const patch = {};
      for (const key of ['category','priority','project','topic','privacy','rights','useStatus']) {
        const value = optionValue(args, '--' + key, undefined);
        if (value !== undefined) patch[key] = value;
      }
      const tags = optionValue(args, '--tags', undefined);
      if (tags !== undefined) patch.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (!Object.keys(patch).length) throw new Error('At least one review field required');
      result = catalog.review(optionValue(args, '--id'), patch);
    } else if (command === 'query') {
      result = catalog.query({ q: optionValue(args, '--q', ''), category: optionValue(args, '--category', ''),
        priority: optionValue(args, '--priority', ''), offset: integer(args, '--offset', '0'), limit: integer(args, '--limit', '48') });
    } else if (command === 'audit') result = catalog.audits({ offset: integer(args, '--offset', '0'), limit: integer(args, '--limit', '100') });
    else result = catalog.summary();
    console.log(JSON.stringify(result, null, 2));
  } finally { catalog?.close(); }
}
main().catch(e => { console.error('[media-hub] ' + e.message); process.exitCode = 1; });
