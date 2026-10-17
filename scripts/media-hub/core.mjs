import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, opendir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.avif', '.tif', '.tiff', '.bmp']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp', '.mts', '.m2ts']);
const SKIP_DIRS = new Set(['__MACOSX', '.git', 'node_modules', '.Trashes']);
const MAX_SIDECAR = 2 * 1024 * 1024;

export function categorySuggestion(s) {
  const str = s.normalize('NFKC').toLowerCase();
  if (/(screenshot|screen.?record|スクリーンショット|スクショ|画面収録|講義資料|研究資料|ホワイトボード|lecture|research|seminar)/i.test(str)) return ['KNOWLEDGE', 'ファイル名・フォルダ名からの推定'];
  if (/(b.roll|graphic|illustration|creative|素材|デザイン|ロゴ|図解|canva|thumbnail|サムネ|stock|motion|visual)/i.test(str)) return ['CREATIVE', 'ファイル名・フォルダ名からの推定'];
  if (/(takraw|セパタクロー|athlete|試合|大会|競技|メダル|表彰|代表|競技歴|competition|medal)/i.test(str)) return ['EVIDENCE', 'ファイル名・フォルダ名からの推定'];
  if (/(family|家族|旅行|誕生日|ペット|mahru|思い出|vacation|holiday)/i.test(str)) return ['LIFE', 'ファイル名・フォルダ名からの推定'];
  return ['UNSORTED', '内容未解析'];
}
export function sourceUrlFromSidecar(meta) {
  // An export-supplied link is NOT a verified permanent deep link.
  const candidate = meta?.url;
  if (typeof candidate !== 'string' || candidate.length > 2048) return null;
  try {
    const u = new URL(candidate);
    if (u.protocol === 'https:' && u.hostname === 'photos.google.com' && !u.username && !u.password) return u.href;
  } catch {}
  return null;
}
function pickDate(meta, fallbackMs) {
  for (const value of [meta?.photoTakenTime?.timestamp, meta?.creationTime?.timestamp]) {
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0 && n < 5000000000) return new Date(n * 1000).toISOString();
  }
  return new Date(fallbackMs).toISOString();
}
function sidecarNames(name) { return [name + '.supplemental-metadata.json', name + '.json']; }
async function readSidecar(filePath) {
  try {
    const s = await stat(filePath);
    if (!s.isFile() || s.size > MAX_SIDECAR) return null;
    const meta = JSON.parse(await readFile(filePath, 'utf8'));
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : null;
  } catch { return null; }
}
async function *walk(root, limit = 0) {
  const dirs = [root];
  let yielded = 0;
  while (dirs.length) {
    const dir = dirs.pop();
    let d;
    try { d = await opendir(dir); } catch { continue; }
    for await (const entry of d) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) dirs.push(full);
      else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!PHOTO_EXT.has(ext) && !VIDEO_EXT.has(ext)) continue;
        yield full;
        yielded++;
        if (limit > 0 && yielded >= limit) return;
      }
      // Never follow symlinked folders or files.
    }
  }
}
function stableId(rel) { return createHash('sha256').update(rel).digest('hex').slice(0, 24); }
export async function fileSha256(full) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(full)) hash.update(chunk);
  return hash.digest('hex');
}
export async function scanTakeout(rootArg, { limit = 0, hashMaxBytes = 128 * 1024 * 1024 } = {}) {
  const root = await realpath(rootArg);
  const s = await stat(root);
  if (!s.isDirectory()) throw new Error('Input must be an extracted Google Takeout directory');
  const items = [];
  const warnings = [];
  for await (const full of walk(root, limit)) {
    let info;
    try { info = await lstat(full); } catch { continue; }
    if (!info.isFile()) continue;
    const relativePath = path.relative(root, full).split(path.sep).join('/');
    const filename = path.basename(full);
    let meta = null;
    for (const candidate of sidecarNames(filename)) {
      meta = await readSidecar(path.join(path.dirname(full), candidate));
      if (meta) break;
    }
    const [category, categoryReason] = categorySuggestion(relativePath);
    const ext = path.extname(filename).toLowerCase();
    const sourceUrl = sourceUrlFromSidecar(meta);
    items.push({
      id: stableId(relativePath), relativePath, filename,
      kind: VIDEO_EXT.has(ext) ? 'video' : 'photo', ext, bytes: info.size,
      takenAt: pickDate(meta, info.mtimeMs), dateSource: meta?.photoTakenTime?.timestamp ? 'takeout' : meta?.creationTime?.timestamp ? 'takeout-created' : 'file-mtime',
      category, categoryReason, priority: 'UNREVIEWED',
      description: typeof meta?.description === 'string' ? meta.description.slice(0, 1200) : '',
      sourceUrl, sourceUrlStatus: sourceUrl ? 'export-supplied-unverified' : 'unavailable',
      duplicateGroup: null, duplicateStatus: 'none'
    });
  }
  // Equal size only identifies a candidate; hashing confirms exact duplicates.
  const groups = new Map();
  for (const item of items) {
    if (!item.bytes) continue;
    const group = groups.get(item.bytes) ?? [];
    group.push(item);
    groups.set(item.bytes, group);
  }
  let checkedGroups = 0, candidateGroups = 0, confirmedGroups = 0;
  for (const [bytes, sameSize] of groups) {
    if (sameSize.length < 2) continue;
    candidateGroups++;
    if (hashMaxBytes === 0 || bytes > hashMaxBytes) {
      for (const item of sameSize) item.duplicateStatus = 'same-size-unverified';
      continue;
    }
    const hashed = new Map();
    for (const item of sameSize) {
      try {
        const hash = await fileSha256(path.join(root, item.relativePath));
        if (!hashed.has(hash)) hashed.set(hash, []);
        hashed.get(hash).push(item);
      } catch (e) { warnings.push('hash failed for ' + item.id + ': ' + (e.code || 'read-error')); }
    }
    checkedGroups++;
    for (const [hash, matches] of hashed) {
      if (matches.length < 2) continue;
      confirmedGroups++;
      for (const item of matches) {
        item.duplicateStatus = 'sha256-identical';
        item.duplicateGroup = hash.slice(0, 20);
      }
    }
  }
  const categories = { LIFE: 0, KNOWLEDGE: 0, CREATIVE: 0, EVIDENCE: 0, UNSORTED: 0 };
  const kinds = { photo: 0, video: 0 };
  let totalBytes = 0;
  for (const item of items) { categories[item.category]++; kinds[item.kind]++; totalBytes += item.bytes; }
  return {
    schemaVersion: 1, createdAt: new Date().toISOString(),
    sourceType: 'extracted-google-takeout', root,
    limitations: ['ローカル・読み取り専用', '分類はファイル名等による暫定推定（画像内容のAI解析は未実装）', 'TakeoutのsourceUrlは未検証。原本同期やアルバム操作は未実装', '同サイズのみの重複候補は未確認'],
    summary: { count: items.length, totalBytes, kinds, categories, candidateGroups, checkedGroups, confirmedGroups, limited: limit > 0 },
    warnings, items
  };
}
export async function saveIndex(index, outDir) {
  await mkdir(outDir, { recursive: true, mode: 0o700 });
  await chmod(outDir, 0o700);
  const dest = path.join(outDir, 'media-index.json');
  const temp = dest + '.tmp-' + process.pid;
  await writeFile(temp, JSON.stringify(index, null, 2), { mode: 0o600, flag: 'wx' });
  await rename(temp, dest);
  await chmod(dest, 0o600);
  return dest;
}
