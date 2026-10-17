import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { scanCatalog } from '../scripts/media-hub/scanner.mjs';
import { MediaCatalog } from '../scripts/media-hub/catalog.mjs';
import { startLocalMediaHub } from '../scripts/media-hub/server.mjs';

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'masa-media-catalog-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'), outDir = path.join(dir, 'private');
  await mkdir(source);
  const file = async (rel, body = 'synthetic') => { await mkdir(path.dirname(path.join(source, rel)), { recursive: true }); await writeFile(path.join(source, rel), body); };
  const scan = options => scanCatalog(source, { outDir, limit: 0, ...options });
  const open = result => { const catalog = new MediaCatalog(result.filename); t.after(() => catalog.close()); return catalog; };
  return { dir, source, outDir, file, scan, open };
}

test('deterministic pilot, resume and incremental review/hash reuse survive reopening', async t => {
  const f = await fixture(t);
  for (const name of ['z.jpg','b.jpg','あ.jpg','a.jpg']) await f.file(name, 'same-data');
  const first = await f.scan({ limit: 2 });
  assert.equal(first.summary.scan.state, 'limited');
  const db = f.open(first);
  assert.deepEqual(db.query().items.map(i => i.filename), ['a.jpg','b.jpg']);
  const id = db.query().items[0].id;
  db.review(id, { category: 'EVIDENCE', priority: 'S', tags: ['競技記録','ＴＡＫＲＡＷ'], project: 'MASA OS', privacy: 'PRIVATE', rights: 'REVIEW_REQUIRED' });
  assert.equal(db.query({ q: '競技記録', priority: 'S' }).total, 1);
  assert.equal(db.query({ q: 'takraw' }).total, 1);
  assert.equal(db.query({ q: '競技' }).total, 1);
  const continued = await f.scan({ resume: true });
  assert.equal(continued.summary.count, 4);
  assert.equal(continued.summary.scan.state, 'complete');
  assert.equal(continued.summary.reviewed, 1);
  const rescan = await f.scan();
  assert.equal(rescan.summary.scan.reused, 4);
  assert.equal(rescan.summary.scan.hashedBytes, 0);
  assert.equal(db.getItem(id).priority, 'S');
  await assert.rejects(f.scan({ resume: true }), /complete/);
  assert.throws(() => db.review(id, { category: 'anything' }), /category/);
  assert.throws(() => db.review(id, JSON.parse('{"__proto__":{}}')), /fields/);
});

test('AppleDouble resource forks never consume pilot slots or become media/JSON metadata', async t => {
  const f=await fixture(t);
  await f.file('写真.jpeg','real synthetic bytes');
  await f.file('写真.jpeg.json',JSON.stringify({title:'写真.jpeg',description:'正しいメタデータ'}));
  await f.file('._写真.jpeg','synthetic resource fork');
  await f.file('._写真.jpeg.json','not JSON; synthetic AppleDouble');
  const result=await f.scan({limit:1}),catalog=f.open(result);
  assert.equal(result.summary.count,1);assert.equal(result.summary.scan.state,'complete');
  assert.equal(catalog.query().items[0].filename,'写真.jpeg');
  assert.equal(catalog.query({q:'正しいメタデータ'}).total,1);
  assert.equal(catalog.audits().filter(a=>a.code==='skipped-appledouble').length,2);
  assert.equal(await readFile(path.join(f.source,'._写真.jpeg'),'utf8'),'synthetic resource fork');
});

test('cancel after a durable checkpoint then resume has no lost or repeated records', async t => {
  const f = await fixture(t);
  for (let n = 0; n < 140; n++) await f.file(`${String(n).padStart(3,'0')}.png`);
  const controller = new AbortController();
  const cancelled = await f.scan({ signal: controller.signal, onProgress: p => { if (p.processed >= 90) controller.abort(); } });
  assert.equal(cancelled.summary.scan.state, 'cancelled');
  const done = await f.scan({ resume: true });
  assert.equal(done.summary.count, 140);
  assert.equal(done.summary.scan.processed, 140);
  assert.equal(done.summary.scan.state, 'complete');
});

test('sidecar variants, conservative ambiguity, dates and verified album evidence', async t => {
  const f = await fixture(t);
  const meta = (title, extra = {}) => JSON.stringify({ title, photoTakenTime: {timestamp:'bad'}, creationTime:{timestamp:'1700000000'}, ...extra });
  await f.file('家族/写真(1).jpg');
  await f.file('家族/写真.jpg(1).json', meta('写真.jpg'));
  await f.file('家族/長いファイル名.jpg');
  await f.file('家族/長いファイル.supplemental-metadata.json', meta('長いファイル名.jpg', { description: '旅行' }));
  await f.file('家族/metadata.json', JSON.stringify({title:'家族のアルバム',access:'protected'}));
  await f.file('家族/ambiguous.jpg');
  await f.file('家族/ambig-a.json', meta('ambiguous.jpg'));
  await f.file('家族/ambig-b.json', meta('ambiguous.jpg'));
  await f.file('家族/broken.jpg'); await f.file('家族/broken.jpg.json', '{');
  await f.file('家族/large.jpg.json', ' '.repeat(2 * 1024 * 1024 + 1));
  await f.file('家族/notes.txt');
  await f.file('empty-date.jpg'); await f.file('empty-date.jpg.json', meta('empty-date.jpg', {photoTakenTime:{timestamp:'no'},creationTime:{timestamp:'NaN'}}));
  const result = await f.scan(); const db = f.open(result);
  const items = db.query().items;
  const item = name => items.find(i => i.filename === name);
  assert.equal(item('写真(1).jpg').metadataStatus, 'filename');
  assert.equal(item('長いファイル名.jpg').metadataStatus, 'unique-title');
  assert.equal(item('長いファイル名.jpg').dateSource, 'takeout-created');
  assert.equal(item('長いファイル名.jpg').takenAt, '2023-11-14T22:13:20.000Z');
  assert.equal(item('長いファイル名.jpg').albums[0].evidence, 'takeout-album-metadata');
  assert.equal(item('ambiguous.jpg').metadataStatus, 'ambiguous');
  assert.equal(item('empty-date.jpg').dateSource, 'file-mtime');
  const counts = Object.fromEntries(result.summary.auditCounts.map(r => [r.code, r.count]));
  assert.equal(counts['ambiguous-sidecar'], 1);
  assert.equal(counts['malformed-sidecar'], 1);
  assert.equal(counts['sidecar-oversized-sidecar'], 1);
  assert.equal(counts['unsupported-file'], 1);
  assert.ok(counts['unmatched-sidecar'] >= 2);
});

test('hash budgets never turn equal sizes into proof, changed bytes invalidate cached proof', async t => {
  const f = await fixture(t);
  await f.file('a.jpg', 'aaaa'); await f.file('b.jpg', 'aaaa'); await f.file('c.jpg', 'bbbb');
  const limited = await f.scan({ hashBudgetBytes: 4 });
  assert.equal(limited.summary.scan.hashedBytes, 4);
  assert.equal(limited.summary.confirmedGroups, 0);
  assert.ok(f.open(limited).query().items.some(i => i.duplicateStatus === 'same-size-unverified'));
  const done = await f.scan(); assert.equal(done.summary.confirmedGroups, 1);
  await f.file('b.jpg', 'cccc');
  const changed = await f.scan(); assert.equal(changed.summary.confirmedGroups, 0);
  await rm(path.join(f.source, 'c.jpg'));
  const removed = await f.scan(); assert.equal(removed.summary.count, 2); assert.equal(removed.summary.missing, 1);
});

test('deep trees, symlinked media/metadata/directories and out-of-root reports are isolated', async t => {
  const f = await fixture(t);
  const deep = Array.from({length:80}, () => 'd').join('/');
  await f.file(deep + '/日本語.heic');
  await f.file('real.jpg');
  const external = path.join(f.dir, 'external'); await mkdir(external); await writeFile(path.join(external, 'secret.jpg'), 'DO-NOT-READ');
  await symlink(path.join(external, 'secret.jpg'), path.join(f.source, 'linked.jpg'));
  await symlink(external, path.join(f.source, 'linked-directory'));
  await symlink(path.join(external, 'secret.jpg'), path.join(f.source, 'real.jpg.json'));
  const result = await f.scan(); assert.equal(result.summary.count, 2);
  const db = f.open(result); assert.equal(db.getItem(db.query().items[0].id).sourceUrl, null);
  assert.equal(result.summary.auditCounts.find(r => r.code === 'skipped-symlink').count, 3);
  await assert.rejects(f.scan({ outDir: path.join(f.source, 'report') }), /outside/);
  await assert.rejects(f.scan({ minFreeBytes: Number.MAX_SAFE_INTEGER }), /free space/);
  assert.equal((await readFile(path.join(external, 'secret.jpg'), 'utf8')), 'DO-NOT-READ');
  assert.equal((await stat(result.filename)).mode & 0o777, 0o600);
});

test('authenticated SQL viewer is paginated, never serves index/root, and blocks replaced paths', async t => {
  const f = await fixture(t); await f.file('video.mp4','0123456789');
  const db = f.open(await f.scan()); const item = db.query().items[0];
  const {server,url} = await startLocalMediaHub(db);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(new URL('api/items?q=video',url));
  const body = await response.text(); assert.ok(!body.includes(f.source));
  assert.equal(JSON.parse(body).items.length, 1);
  assert.equal((await fetch(new URL('media-index.sqlite',url))).status,404);
  assert.equal((await fetch(new URL('api/items',url), {method:'POST'})).status,403);
  assert.equal((await fetch(new URL('media/'+item.id,url), {headers:{Range:'bytes=20-30'}})).status,416);
  const range = await fetch(new URL('media/'+item.id,url), {headers:{Range:'bytes=1-3'}}); assert.equal(await range.text(),'123');
  const secret = path.join(f.dir,'secret.mp4'); await writeFile(secret,'secret');
  await rm(path.join(f.source,'video.mp4')); await symlink(secret,path.join(f.source,'video.mp4'));
  const denied = await fetch(new URL('media/'+item.id,url)); assert.equal(denied.status,500); assert.ok(!(await denied.text()).includes('secret.mp4'));
});

test('exact limit is complete when no work remains; cached proof is revalidated after a pause', async t => {
  const f = await fixture(t);
  for (const name of ['a.jpg','b.jpg','c.jpg']) await f.file(name, 'aaaa');
  const first = await f.scan({ limit:2 }); assert.equal(first.summary.confirmedGroups,1);
  await f.file('a.jpg','bbbb');
  const resumed = await f.scan({ resume:true, limit:3 });
  assert.equal(resumed.summary.scan.state,'complete');
  const db = f.open(resumed); assert.notEqual(db.query({q:'a.jpg'}).items[0].duplicateStatus,'sha256-identical');
  assert.ok(db.audits().some(r=>r.code==='hash-source-changed'));
});

test('failed media stays incomplete and can retry; Unicode title normalization and year folders are conservative', async t => {
  const f=await fixture(t);
  for(let n=0;n<120;n++) await f.file(`${String(n).padStart(3,'0')}.png`);
  await f.file('Photos from 2025/test.jpg');
  await f.file('Photos from 2025/metadata.json',JSON.stringify({title:'Photos from 2025',access:'protected'}));
  await f.file('e\u0301-long.jpg');
  await f.file('shortened.json',JSON.stringify({title:'é-long.jpg',description:'normalized title'}));
  let removed=false;
  const result=await f.scan({hashMaxBytes:0,onProgress:p=>{ if(!removed && p.processed>=99) { removed=true; unlinkSync(path.join(f.source,'119.png')); } }});
  const db=f.open(result);
  assert.equal(result.summary.scan.state,'incomplete');
  assert.equal(db.query({q:'normalized title'}).total,1);
  assert.deepEqual(db.query({q:'Photos from'}).items[0].albums,[]);
  await f.file('119.png');
  const retry=await f.scan({resume:true});
  assert.equal(retry.summary.scan.state,'complete');
  assert.equal(retry.summary.count,122);
});

test('incremental metadata changes refresh search without losing reviewed tags', async t => {
  const f=await fixture(t); await f.file('research.jpg'); await f.file('research.jpg.json',JSON.stringify({description:'original search text'}));
  const db=f.open(await f.scan()); const id=db.query().items[0].id;
  db.review(id,{tags:['keep-local'],priority:'A'});
  assert.equal(db.getItem(id).categoryReviewStatus,'suggested');
  await f.scan(); assert.equal(db.query({q:'keep-local'}).total,1);
  await f.file('research.jpg.json',JSON.stringify({description:'replacement indexed text'}));
  await f.scan();
  assert.equal(db.query({q:'replacement indexed'}).total,1);
  assert.equal(db.query({q:'original search'}).total,0);
  assert.equal(db.query({q:'keep-local'}).total,1);
  assert.equal(db.getItem(id).priority,'A');
});

test('SQLite auto-rollback on a full catalog preserves original capacity error and committed state', () => {
  const catalog=new MediaCatalog(':memory:');
  try {
    catalog.setSetting('durable','keep');
    const pages=catalog.db.prepare('PRAGMA page_count').get().page_count;
    catalog.db.exec('PRAGMA max_page_count='+pages);
    assert.throws(()=>catalog.transaction(()=>catalog.setSetting('too-large','x'.repeat(1024*1024))),/full/i);
    assert.equal(catalog.getSetting('durable'),'keep');
    assert.equal(catalog.getSetting('too-large'),null);
  } finally {catalog.close();}
});
