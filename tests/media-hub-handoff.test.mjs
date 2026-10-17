import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanCatalog } from '../scripts/media-hub/scanner.mjs';
import { MediaCatalog } from '../scripts/media-hub/catalog.mjs';
import { eaglePreflight, prepareEagle, eagleQueue } from '../scripts/media-hub/eagle.mjs';
import { proposePhotosAction, transitionPhotosAction } from '../scripts/media-hub/photos-actions.mjs';

async function fixture(t) {
  const dir=await mkdtemp(path.join(tmpdir(),'masa-media-handoff-')); t.after(()=>rm(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source'); await mkdir(source); await writeFile(path.join(source,'sample.png'),'synthetic');
  await writeFile(path.join(source,'sample.png.json'),JSON.stringify({title:'sample.png',url:'https://photos.google.com/photo/TEST_ONLY'}));
  const result=await scanCatalog(source,{outDir:path.join(dir,'private'),limit:0});
  const catalog=new MediaCatalog(result.filename); t.after(()=>catalog.close());
  const id=catalog.query().items[0].id;
  return {catalog,id,source};
}

test('Eagle preflight is fixed loopback GET, strips paths, and handles redirects/auth/errors', async () => {
  const result=await eaglePreflight({fetchImpl:async (url,options)=>{
    assert.equal(url,'http://127.0.0.1:41595/api/application/info'); assert.equal(options.method,'GET'); assert.equal(options.redirect,'error');
    return new Response(JSON.stringify({status:'success',data:{version:'4.0.0',platform:'darwin',execPath:'/private/secret'}}));
  }});
  assert.equal(result.state,'available'); assert.ok(!JSON.stringify(result).includes('secret'));
  assert.equal((await eaglePreflight({fetchImpl:async()=>new Response('',{status:403})})).state,'authentication-required');
  assert.equal((await eaglePreflight({fetchImpl:async()=>{throw new Error('private bearer token')}})).state,'unavailable');
  assert.equal((await eaglePreflight({fetchImpl:async()=>new Response('x'.repeat(70000))})).state,'unavailable');
});

test('single reviewed Eagle plans persist idempotently; no file copy or live execution', async t => {
  const {catalog,id}=await fixture(t);
  await assert.rejects(prepareEagle(catalog,id,{approveLocalCopy:true}),/Review/);
  catalog.review(id,{priority:'A',category:'CREATIVE',privacy:'PRIVATE',rights:'OWNED',tags:['reference']});
  await assert.rejects(prepareEagle(catalog,id),/approve-local-copy/);
  const first=await prepareEagle(catalog,id,{approveLocalCopy:true});
  assert.equal(first.bytesToCopy,9); assert.equal(first.executionEnabled,false);
  assert.equal(first.transport.method,'POST /api/item/addFromPath');
  assert.equal(eagleQueue(catalog)[0].state,'pending');
  assert.deepEqual(await prepareEagle(catalog,id,{approveLocalCopy:true}),first);
  assert.equal(eagleQueue(catalog).length,1);
});

test('unverified/transient/altered URLs cannot become Eagle bookmarks', async t => {
  const {catalog,id}=await fixture(t);
  catalog.review(id,{priority:'S',privacy:'PRIVATE',rights:'OWNED'});
  assert.equal(catalog.getItem(id).categoryReviewStatus,'suggested','priority review must not certify an inferred category');
  await assert.rejects(prepareEagle(catalog,id,{mode:'bookmark',verifiedUrl:'https://photos.google.com/photo/TEST_ONLY'}),/category/);
  catalog.review(id,{category:'CREATIVE'});
  await assert.rejects(prepareEagle(catalog,id,{mode:'bookmark'}),/manually verified/);
  for(const verifiedUrl of ['https://lh3.googleusercontent.com/transient','https://photos.google.com/photo/TEST_ONLY?token=bad','https://photos.google.com/photo/different']) await assert.rejects(prepareEagle(catalog,id,{mode:'bookmark',verifiedUrl}),/verified/);
  const plan=await prepareEagle(catalog,id,{mode:'bookmark',verifiedUrl:'https://photos.google.com/photo/TEST_ONLY'});
  assert.equal(plan.transport.method,'eagle.item.addBookmark'); assert.equal(plan.bytesToCopy,0); assert.equal(plan.executionEnabled,false);
});

test('source changes block previously reviewed Eagle preparation', async t => {
  const {catalog,id,source}=await fixture(t);
  catalog.review(id,{category:'CREATIVE',priority:'A',privacy:'PRIVATE',rights:'OWNED'});
  await writeFile(path.join(source,'sample.png'),'changed-data');
  await assert.rejects(prepareEagle(catalog,id,{approveLocalCopy:true}),/Source changed/);
});

test('rescan preserves classification but invalidates approval for changed bytes', async t => {
  const {catalog,id,source}=await fixture(t);
  catalog.review(id,{category:'CREATIVE',priority:'A',privacy:'PRIVATE',rights:'OWNED',tags:['keep-review']});
  const before=await prepareEagle(catalog,id,{approveLocalCopy:true});
  await writeFile(path.join(source,'sample.png'),'different synthetic content');
  await scanCatalog(source,{outDir:path.dirname(catalog.filename),limit:0});
  assert.equal(catalog.getItem(id).reviewStatus,'stale');
  assert.deepEqual(catalog.getItem(id).tags,['keep-review']);
  await assert.rejects(prepareEagle(catalog,id,{approveLocalCopy:true}),/Review current source/);
  catalog.review(id,{category:'CREATIVE',priority:'A',privacy:'PRIVATE',rights:'OWNED'});
  const next=await prepareEagle(catalog,id,{approveLocalCopy:true});
  assert.notEqual(next.fingerprint,before.fingerprint);assert.equal(next.executionEnabled,false);
});

test('Photos proposal opened state never becomes completed without explicit manual confirmation', async t => {
  const {catalog,id}=await fixture(t);
  const proposal=proposePhotosAction(catalog,id,'add-to-album','Review in native Photos');
  assert.equal(proposal.state,'proposed'); assert.equal(proposal.sourceUrlStatus,'export-supplied-unverified');
  assert.throws(()=>transitionPhotosAction(catalog,proposal.id,'completed'),/transition/);
  transitionPhotosAction(catalog,proposal.id,'opened');
  assert.throws(()=>transitionPhotosAction(catalog,proposal.id,'completed'),/transition/);
  assert.throws(()=>transitionPhotosAction(catalog,proposal.id,'manually-confirmed'),/confirmation/);
  transitionPhotosAction(catalog,proposal.id,'manually-confirmed','I checked the album in Photos');
  const completed=transitionPhotosAction(catalog,proposal.id,'completed');
  assert.equal(completed.evidenceType,'manual-user-report-only'); assert.equal(completed.state,'completed');
  assert.throws(()=>proposePhotosAction(catalog,id,'delete'),/Unsupported/);
});
