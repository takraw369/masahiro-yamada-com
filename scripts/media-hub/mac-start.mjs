#!/usr/bin/env node
// Mac convenience entrypoint. No credentials or Google Photos write-back.
import { execFileSync, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { scanTakeout, saveIndex } from './core.mjs';
import { startLocalMediaHub } from './server.mjs';

function askFolder() {
  try {
    return execFileSync('osascript', ['-e', 'POSIX path of (choose folder with prompt "Google Takeoutの展開済みフォルダを選択")'], { encoding: 'utf8' }).trim();
  } catch { throw new Error('Folder selection cancelled or not available'); }
}
async function main() {
  if (process.platform !== 'darwin') throw new Error('Mac-specific launcher. Other systems: use cli.mjs');
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const folder = askFolder();
  const out = path.join(homedir(), 'Library', 'Application Support', 'MASA-Media-Hub');
  console.log('[media-hub] Scanning Takeout (read only).', full ? 'All supported files.' : 'First 500 media files only.');
  const index = await scanTakeout(folder, { limit: full ? 0 : 500 });
  if (!index.summary.count) throw new Error('No supported image/video files found; choose the extracted Google Photos folder');
  const location = await saveIndex(index, out);
  const { url } = await startLocalMediaHub(index);
  console.log('[media-hub] Items:', index.summary.count, 'Report:', location);
  console.log('[media-hub] Private localhost URL:', url);
  console.log('No original files changed. Press Ctrl+C to stop the local gallery.');
  const child = spawn('open', [url], { stdio: 'ignore' });
  child.on('error', () => console.log('Open the URL above manually in Safari.'));
}
main().catch(e => { console.error('[media-hub] ' + e.message); process.exitCode = 1; });
