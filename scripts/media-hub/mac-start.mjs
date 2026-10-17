#!/usr/bin/env node
// Mac convenience entrypoint. No credentials or Google Photos write-back.
import { execFileSync, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { MediaCatalog } from './catalog.mjs';
import { scanCatalog } from './scanner.mjs';
import { stableId } from './files.mjs';
import { startLocalMediaHub } from './server.mjs';

function askFolder() {
  try {
    return execFileSync('osascript', ['-e', 'POSIX path of (choose folder with prompt "Google Takeoutの展開済みフォルダを選択")'], { encoding: 'utf8' }).trim();
  } catch { throw new Error('Folder selection cancelled or not available'); }
}
async function main() {
  if (process.platform !== 'darwin') throw new Error('Mac-specific launcher. Other systems: use cli.mjs');
  const args = process.argv.slice(2);
  const folder = await realpath(askFolder());
  const out = path.join(homedir(), 'Library', 'Application Support', 'MASA-Media-Hub', stableId(folder));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  let result;
  try {
    result = await scanCatalog(folder, { outDir: out, limit: args.includes('--full') ? 0 : 500, resume: args.includes('--resume'), signal: controller.signal,
      onProgress: s => console.log('[media-hub]', s.phase, s.state, 'scanned:', s.processed, 'reused:', s.reused) });
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
  if (result.summary.scan.state === 'cancelled') { process.exitCode = 130; return; }
  if (!result.summary.count) throw new Error('No supported image/video files found; choose the extracted Google Photos folder');
  const catalog = new MediaCatalog(result.filename);
  const { url, server } = await startLocalMediaHub(catalog);
  server.once('close', () => catalog.close());
  console.log('[media-hub] Items:', result.summary.count, 'Private report:', result.filename);
  console.log('[media-hub] Private localhost URL:', url);
  console.log('No original files changed. Press Ctrl+C to stop the local gallery.');
  const child = spawn('open', [url], { stdio: 'ignore' });
  child.on('error', () => console.log('Open the URL above manually in Safari.'));
}
main().catch(e => { console.error('[media-hub] ' + e.message); process.exitCode = 1; });
