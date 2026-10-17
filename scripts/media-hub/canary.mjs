#!/usr/bin/env node
// Safe Mac/Linux canary: creates ONLY synthetic Takeout files in an OS temp dir.
// No private archive discovery, network calls, Eagle writes or source modification.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, stat, statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { scanCatalog } from './scanner.mjs';
import { MediaCatalog } from './catalog.mjs';
import { startLocalMediaHub } from './server.mjs';

const at = process.argv.indexOf('--count');
const count = at < 0 ? 500 : Number(process.argv[at + 1]);
if (!Number.isSafeInteger(count) || count < 2 || count > 100000) throw new Error('--count must be 2..100000');
const capacity = await statfs(tmpdir());
// Two physical files per media plus catalog/journal/metadata space and an OS reserve.
const estimate = count * (2 * Math.max(4096, capacity.bsize) + 8192) + 768 * 1024 * 1024;
if (capacity.bavail * capacity.bsize < estimate) throw new Error('Insufficient temp-disk space for this synthetic count; choose a smaller --count. No fixture created.');
const dir = await mkdtemp(path.join(tmpdir(), 'masa-media-synthetic-'));
console.error('Synthetic-only fixture: ' + dir);
const source = path.join(dir, 'Takeout'), outDir = path.join(dir, 'report');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n1QAAAAASUVORK5CYII=', 'base64');
for (let n = 0; n < count; n++) {
  if (n % 1000 === 0) { const available = await statfs(dir); if (available.bavail * available.bsize < 512 * 1024 * 1024) throw new Error('Synthetic generation stopped to preserve disk space: ' + dir); }
  const folder = ['家族','研究資料','デザイン','大会'][Math.floor(n / 100) % 4];
  const filename = `SYNTHETIC_${String(n).padStart(6,'0')}.png`;
  const parent = path.join(source, folder); await mkdir(parent, { recursive:true });
  await writeFile(path.join(parent, filename), png);
  await writeFile(path.join(parent, filename + '.supplemental-metadata.json'), JSON.stringify({ title: filename, description: `Synthetic fixture ${n}`, photoTakenTime:{timestamp:String(1700000000+n)} }));
}
const started = performance.now();
const controller = new AbortController();
const pilot = await scanCatalog(source, { outDir, limit: Math.min(100,count), signal:controller.signal });
assert.equal(pilot.summary.count, Math.min(100,count));
const done = await scanCatalog(source, { outDir, limit:0, resume:true, hashMaxBytes:0 });
assert.equal(done.summary.count,count);
const scanMs = performance.now()-started;
const catalog = new MediaCatalog(done.filename);
const first = catalog.query({limit:1}).items[0];
catalog.review(first.id,{priority:'S',tags:['canary-reviewed']});
assert.equal(catalog.query({q:'canary-reviewed'}).total,1);
const samples=[];
for(let n=0;n<20;n++) { const start=performance.now(); catalog.query({q:`SYNTHETIC_${String(n).padStart(6,'0')}`}); samples.push(performance.now()-start); }
samples.sort((a,b)=>a-b);
const {server,url}=await startLocalMediaHub(catalog);
try {
  const response=await fetch(new URL('api/items?limit=2',url)); assert.equal((await response.json()).items.length,2);
  const media=await fetch(new URL('media/'+first.id,url)); assert.equal(media.status,200); assert.deepEqual(Buffer.from(await media.arrayBuffer()),png);
  assert.equal((await fetch(new URL('/api/items',url))).status,404);
} finally { await new Promise(resolve=>server.close(resolve)); }
const rescan=await scanCatalog(source,{outDir,limit:0,hashMaxBytes:0});
assert.equal(rescan.summary.scan.reused,count);
const receipt={corpus:'synthetic-only',platform:process.platform,node:process.version,count,scanMs:Math.round(scanMs),searchP95Ms:+samples[18].toFixed(2),peakRssMiB:+(process.resourceUsage().maxRSS/1024).toFixed(1),catalogMiB:+((await stat(done.filename)).size/1024/1024).toFixed(2),resume:'PASS',review:'PASS',privateViewer:'PASS',incrementalReuse:rescan.summary.scan.reused,realTakeout:'UNVERIFIED',realEagle:'UNVERIFIED'};
catalog.close();
console.log(JSON.stringify(receipt,null,2));
console.log('Synthetic source and private report retained locally for inspection: '+dir);
