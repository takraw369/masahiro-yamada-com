import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceUrlFromSidecar, categorySuggestion } from '../scripts/media-hub/core.mjs';
import { scanCatalog } from '../scripts/media-hub/scanner.mjs';
import { MediaCatalog } from '../scripts/media-hub/catalog.mjs';
import { startLocalMediaHub } from '../scripts/media-hub/server.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'masa-media-hub-tests-'));
const sources = path.join(root, 'Takeout', 'Google Photos');
await mkdir(path.join(sources, 'スクリーンショット'), { recursive: true });
await mkdir(path.join(sources, '家族'), { recursive: true });
await mkdir(path.join(sources, '大会'), { recursive: true });
await writeFile(path.join(sources, 'スクリーンショット', 'Capture.png'), 'byte-identical-test-image');
await writeFile(path.join(sources, 'スクリーンショット', 'Copy.png'), 'byte-identical-test-image');
await writeFile(path.join(sources, '家族', 'photo.jpg'), 'another-test-image');
await writeFile(path.join(sources, '大会', 'final.mp4'), 'not-a-real-video-content');
await writeFile(path.join(sources, '家族', 'photo.jpg.supplemental-metadata.json'), JSON.stringify({ photoTakenTime: {timestamp: '1700000000'}, description: '旅の記録', url: 'https://photos.google.com/photo/abc' }));
await writeFile(path.join(sources, '家族', 'bad.json'), '{not json');
await symlink(path.join(root, 'secret.txt'), path.join(sources, '家族', 'outside.jpg'));
await writeFile(path.join(root, 'secret.txt'), 'private-unrelated-data');

const result = await scanCatalog(sources, { outDir: path.join(root, 'private-report'), limit: 0 });
const catalog = new MediaCatalog(result.filename);
after(() => catalog.close());
const index = { root: sources, summary: result.summary, items: catalog.query({ limit: 72 }).items };
const asset = name => index.items.find(item => item.filename === name);

test('read-only scan finds images and videos, skips sidecars and symlinks', async () => {
  assert.equal(index.summary.count, 4);
  assert.equal(index.summary.kinds.photo, 3);
  assert.equal(index.summary.kinds.video, 1);
  assert.equal(asset('outside.jpg'), undefined);
  assert.equal((await readFile(path.join(sources, '家族', 'photo.jpg'))).toString(), 'another-test-image');
});
test('Takeout date and unverified link metadata are distinguished', () => {
  assert.equal(asset('photo.jpg').takenAt, new Date(1700000000 * 1000).toISOString());
  assert.equal(asset('photo.jpg').dateSource, 'takeout');
  assert.equal(asset('photo.jpg').sourceUrl, 'https://photos.google.com/photo/abc');
  assert.equal(asset('photo.jpg').sourceUrlStatus, 'export-supplied-unverified');
  for (const url of ['https://evil.example/a', 'javascript:alert(1)', 'https://photos.google.com.evil.example/a'])
    assert.equal(sourceUrlFromSidecar({ url }), null);
});
test('heuristics remain conservative and do not auto-classify everyone as LIFE', () => {
  assert.equal(asset('photo.jpg').category, 'LIFE');
  assert.equal(asset('final.mp4').category, 'EVIDENCE');
  assert.equal(asset('Capture.png').category, 'KNOWLEDGE');
  assert.equal(categorySuggestion('ordinary/IMG_123.jpg')[0], 'UNSORTED');
});
test('SHA256 confirms exact duplicates rather than relying on same size', () => {
  assert.equal(asset('Capture.png').duplicateStatus, 'sha256-identical');
  assert.equal(asset('Copy.png').duplicateGroup, asset('Capture.png').duplicateGroup);
  assert.equal(asset('photo.jpg').duplicateStatus, 'none');
  assert.equal(index.summary.confirmedGroups, 1);
});
test('unhashed same-size files are labeled provisional', async () => {
  const result = await scanCatalog(sources, { outDir: path.join(root, 'no-hash'), hashMaxBytes: 0, limit: 0 });
  const db = new MediaCatalog(result.filename);
  const noHash = { items: db.query({ limit: 72 }).items }; db.close();
  assert.equal(noHash.items.filter(x => x.duplicateStatus === 'same-size-unverified').length, 2);
});
test('report is private and does not alter source media', async () => {
  const out = path.join(root, 'private-report');
  const file = result.filename;
  assert.equal(catalog.summary().count, 4);
  if (process.platform !== 'win32') {
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await stat(out)).mode & 0o777, 0o700);
  }
});
test('localhost API requires random token; media range is read only', async () => {
  const { server, url } = await startLocalMediaHub(catalog);
  after(async () => { await new Promise(resolve => server.close(resolve)); });
  assert.equal((await fetch(new URL('/api/summary', url))).status, 404);
  const summary = await fetch(new URL('api/summary', url));
  assert.equal((await summary.json()).summary.count, 4);
  const rows = await fetch(new URL('api/items?category=EVIDENCE', url));
  assert.equal((await rows.json()).total, 1);
  const media = await fetch(new URL('media/' + asset('Capture.png').id, url));
  assert.equal(await media.text(), 'byte-identical-test-image');
  const range = await fetch(new URL('media/' + asset('Capture.png').id, url), { headers: { Range: 'bytes=0-3' } });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), 'byte');
  assert.equal((await fetch(new URL('media/' + 'a'.repeat(24), url))).status, 404);
});
