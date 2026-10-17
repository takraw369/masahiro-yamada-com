// All acquisition stays on the local filesystem. Never follow Takeout symlinks.
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.avif', '.tif', '.tiff', '.bmp']);
export const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp', '.mts', '.m2ts']);
export const SKIP_DIRS = new Set(['__MACOSX', '.git', 'node_modules', '.Trashes']);
export const stableId = rel => createHash('sha256').update(rel).digest('hex').slice(0, 24);
export const fingerprint = s => [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs].join(':');
export const normalize = s => String(s).normalize('NFKC').toLowerCase();

export async function safePath(root, rel) {
  if (!rel || path.isAbsolute(rel) || rel.split(/[\\/]/).some(p => !p || p === '.' || p === '..')) throw new Error('unsafe-path');
  let full = root;
  for (const part of rel.split('/')) {
    full = path.join(full, part);
    if ((await lstat(full)).isSymbolicLink()) throw new Error('symlink');
  }
  const resolved = await realpath(full);
  if (!resolved.startsWith(root + path.sep)) throw new Error('outside-root');
  return resolved;
}

export async function openSource(root, rel) {
  const full = await safePath(root, rel);
  const before = await lstat(full);
  const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
  const actual = await handle.stat();
  if (!actual.isFile() || actual.dev !== before.dev || actual.ino !== before.ino) {
    await handle.close();
    throw new Error('source-changed');
  }
  return { handle, info: actual, full };
}

export async function readMetadata(root, rel) {
  const { handle, info } = await openSource(root, rel);
  try {
    if (info.size > 2 * 1024 * 1024) throw new Error('oversized-sidecar');
    // Bounded read even if another process grows the file after stat.
    const buffer = Buffer.alloc(Math.min(info.size + 1, 2 * 1024 * 1024 + 1));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > info.size) throw new Error('source-changed');
    const meta = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('invalid-sidecar');
    return meta;
  } finally { await handle.close(); }
}

export async function hashSource(root, rel, expectedFingerprint, signal) {
  const { handle, info } = await openSource(root, rel);
  try {
    if (fingerprint(info) !== expectedFingerprint) throw new Error('source-changed');
    const hash = createHash('sha256');
    const stream = handle.createReadStream({ autoClose: false, highWaterMark: 256 * 1024, signal, end: Math.max(0, info.size - 1) });
    let bytes = 0;
    for await (const chunk of stream) { bytes += chunk.length; hash.update(chunk); }
    if (bytes !== info.size || fingerprint(await handle.stat()) !== expectedFingerprint) throw new Error('source-changed');
    return hash.digest('hex');
  } finally { await handle.close(); }
}
