#!/usr/bin/env node
// Safe Mac/Linux canary: creates ONLY synthetic Takeout files in an OS temp dir.
// No private archive discovery, network calls, Eagle writes or source modification.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, stat, statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { scanCatalog } from './scanner.mjs';
import { MediaCatalog } from './catalog.mjs';
import { startLocalMediaHub } from './server.mjs';
import { prepareEagle, eagleQueue } from './eagle.mjs';

const mixed = process.argv.includes('--mixed');
const at = process.argv.indexOf('--count');
const count = at < 0 ? 500 : Number(process.argv[at + 1]);
if (!Number.isSafeInteger(count) || count < 2 || count > 100000) throw new Error('--count must be 2..100000');
if(mixed && count>1000) throw new Error('--mixed is a bounded canary (maximum 1000), not a scale trial');
const originals = new Map(), sha = value => createHash('sha256').update(value).digest('hex');
async function writeFixture(file,data){await writeFile(file,data);if(mixed)originals.set(file,sha(data));}
const capacity = await statfs(tmpdir());
// Two physical files per media plus catalog/journal/metadata space and an OS reserve.
const estimate = count * (2 * Math.max(4096, capacity.bsize) + 8192) + 768 * 1024 * 1024;
if (capacity.bavail * capacity.bsize < estimate) throw new Error('Insufficient temp-disk space for this synthetic count; choose a smaller --count. No fixture created.');
const dir = await mkdtemp(path.join(tmpdir(), 'masa-media-synthetic-'));
console.error('Synthetic-only fixture: ' + dir);
const source = path.join(dir, 'Takeout'), outDir = path.join(dir, 'report');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n1QAAAAASUVORK5CYII=', 'base64');
// Non-PNG payloads deliberately are not real encoded media. This exercises
// extension/metadata/index/handoff logic, never HEIC/video decoding.
const payload = filename => filename.endsWith('.png') ? png : Buffer.from('SYNTHETIC-CONTAINER-ONLY:' + path.extname(filename));
for (let n = 0; n < count; n++) {
  if (n % 1000 === 0) { const available = await statfs(dir); if (available.bavail * available.bsize < 512 * 1024 * 1024) throw new Error('Synthetic generation stopped to preserve disk space: ' + dir); }
  const folder = ['家族','研究資料','デザイン','大会'][Math.floor(n / 100) % 4];
  const ext = mixed ? ['.jpeg','.HEIC','.mp4','.MOV','.png'][n % 5] : '.png';
  const filename = `SYNTHETIC_${String(n).padStart(6,'0')}${mixed ? '_合成' : ''}${ext}`;
  const parent = path.join(source, folder); await mkdir(parent, { recursive:true });
  await writeFixture(path.join(parent, filename), payload(filename));
  if (!mixed || n % 7 !== 0) await writeFixture(path.join(parent, filename + '.supplemental-metadata.json'), mixed && n % 19 === 0 ? '{' : JSON.stringify({ title: filename, description: `Synthetic fixture ${n}`, photoTakenTime:{timestamp:mixed && n % 11 === 0 ? 'missing-date' : String(1700000000+n)} }));
}
const started = performance.now();
const controller = new AbortController();
const pilot = await scanCatalog(source, { outDir, limit: Math.min(100,count), signal:controller.signal });
assert.equal(pilot.summary.count, Math.min(100,count));
const done = await scanCatalog(source, { outDir, limit:0, resume:true, ...(mixed ? {} : {hashMaxBytes:0}) });
assert.equal(done.summary.count,count);
const scanMs = performance.now()-started;
const catalog = new MediaCatalog(done.filename);
const first = catalog.query({limit:1}).items[0];
catalog.review(first.id,{category:'CREATIVE',priority:'S',privacy:'PRIVATE',rights:'SYNTHETIC',tags:['canary-reviewed']});
const plan = await prepareEagle(catalog, first.id, {approveLocalCopy:true});
assert.equal(plan.executionEnabled,false);assert.equal(eagleQueue(catalog).length,1);
assert.deepEqual(await prepareEagle(catalog,first.id,{approveLocalCopy:true}),plan);
if(mixed){assert.ok(catalog.summary().kinds.video>0);assert.ok(catalog.summary().confirmedGroups>0);assert.ok(catalog.query({q:'合成'}).total===count);}
assert.equal(catalog.query({q:'canary-reviewed'}).total,1);
const samples=[];
for(let n=0;n<20;n++) { const start=performance.now(); catalog.query({q:`SYNTHETIC_${String(n).padStart(6,'0')}`}); samples.push(performance.now()-start); }
samples.sort((a,b)=>a-b);
const {server,url}=await startLocalMediaHub(catalog);
try {
  const response=await fetch(new URL('api/items?limit=2',url)); assert.equal((await response.json()).items.length,2);
  const media=await fetch(new URL('media/'+first.id,url)); assert.equal(media.status,200); assert.deepEqual(Buffer.from(await media.arrayBuffer()),payload(first.filename));
  assert.equal((await fetch(new URL('/api/items',url))).status,404);
} finally { await new Promise(resolve=>server.close(resolve)); }
const rescan=await scanCatalog(source,{outDir,limit:0,hashMaxBytes:0});
assert.equal(rescan.summary.scan.reused,count);
for(const [file,hash] of originals)assert.equal(sha(await readFile(file)),hash,'synthetic original unchanged');
const receipt={corpus:'synthetic-only',platform:process.platform,node:process.version,count,scanMs:Math.round(scanMs),searchP95Ms:+samples[18].toFixed(2),peakRssMiB:+(process.resourceUsage().maxRSS/1024).toFixed(1),catalogMiB:+((await stat(done.filename)).size/1024/1024).toFixed(2),resume:'PASS',review:'PASS',privateViewer:'PASS',incrementalReuse:rescan.summary.scan.reused,sourceIntegrity:mixed?'all generated media and sidecars SHA256 unchanged':'covered by focused tests',formats:mixed?['JPEG','HEIC','MP4','MOV','PNG']:['PNG'],metadata:mixed?'missing/malformed/date-fallback exercised':'sidecar supplied',confirmedDuplicateGroups:catalog.summary().confirmedGroups,handoffPlan:'one synthetic item; idempotent; execution disabled',codecPlayback:'UNVERIFIED (synthetic container labels only)',realTakeout:'UNVERIFIED',realEagle:'UNVERIFIED'};
catalog.close();
console.log(JSON.stringify(receipt,null,2));
console.log('Synthetic source and private report retained locally for inspection: '+dir);
