import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';
const { DEFAULT_HOME_DESIGN, HOME_DESIGN_STORAGE_KEY, HOME_DESIGN_FAVORITES_KEY } = await import('../src/data/homeDesignCombinations.ts');
const { emptyDashboardReferenceState, DASHBOARD_REFERENCE_STORAGE_KEY } = await import('../src/data/dashboardDesignReferences.ts');
const { DESIGN_DRAFT_KEY, DESIGN_IMPORT_BACKUP_KEY, parseDesignSnapshot, parseSharedDesign, readDesignBackup, importDesignSnapshot } = await import('../src/data/dashboardDesignSnapshot.ts');
const api=await import('../src/pages/api/dashboard/design-state.ts');
const { onRequest }=await import('../src/middleware.ts');
const { createDashboardSession }=await import('../src/lib/dashboardAuth.ts');
const snapshot=()=>({version:1,references:emptyDashboardReferenceState(),draft:{...DEFAULT_HOME_DESIGN},favorites:[]});
const context=(method='GET',body)=>({locals:{},request:new Request('https://dashboard.example.test/api/dashboard/design-state',{
  method,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})})});
test.beforeEach(()=>{
  for(const key of Object.keys(env))delete env[key];
  Object.assign(env,{DASHBOARD_PASSWORD:'design-test-secret',SUPABASE_URL:'https://supabase.example.test',SUPABASE_PUBLISHABLE_KEY:'test-only-key'});
});

test('snapshot sanitizes notes and favorites and rejects unsupported versions and configs',()=>{
  const value=snapshot();value.references.notes={shadcn:'a'.repeat(800),invalid:'remove'};value.references.favorites=['shadcn','invalid','shadcn'];
  value.favorites=[{id:'one',name:'保存案',config:{...DEFAULT_HOME_DESIGN,secret:'discard'}},{id:'one',name:'重複',config:DEFAULT_HOME_DESIGN}];
  const clean=parseDesignSnapshot({...value,owner:'discard'});
  assert.equal(clean.references.notes.shadcn.length,600);assert.deepEqual(clean.references.favorites,['shadcn']);
  assert.equal(clean.favorites.length,1);assert.equal(clean.favorites[0].config.secret,undefined);assert.equal(clean.owner,undefined);
  for(const v of [null,[],{...value,version:2},{...value,draft:{}},{...value,references:{}},{...value,favorites:{}}])assert.equal(parseDesignSnapshot(v),null);
  for(const v of [{snapshot:null,revision:1,updatedAt:null},{snapshot:value,revision:0,updatedAt:null},{snapshot:value,revision:-1,updatedAt:null},
    {snapshot:value,revision:1,updatedAt:'broken'},null])assert.equal(parseSharedDesign(v),null);
});

test('import backs up local work, survives reload and never changes applied home',()=>{
  const before=snapshot(),incoming=snapshot();before.references.notes={shadcn:'端末のメモ'};incoming.references.notes={catalyst:'別端末のメモ'};incoming.draft.style='orange';
  const map=new Map([[HOME_DESIGN_STORAGE_KEY,'existing-night-home']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  importDesignSnapshot(storage,incoming,before);
  assert.deepEqual(readDesignBackup(map.get(DESIGN_IMPORT_BACKUP_KEY)),before);
  assert.equal(map.get(HOME_DESIGN_STORAGE_KEY),'existing-night-home');assert.equal(JSON.parse(map.get(DESIGN_DRAFT_KEY)).style,'orange');
  importDesignSnapshot(storage,readDesignBackup(map.get(DESIGN_IMPORT_BACKUP_KEY)),incoming);
  assert.deepEqual(JSON.parse(map.get(DASHBOARD_REFERENCE_STORAGE_KEY)),before.references);
  assert.equal(map.get(HOME_DESIGN_STORAGE_KEY),'existing-night-home');
});

test('partial storage failure rolls back all local writes and preserves backup',()=>{
  const map=new Map([[DESIGN_IMPORT_BACKUP_KEY,'old-backup'],[HOME_DESIGN_FAVORITES_KEY,'old-favorites'],[DASHBOARD_REFERENCE_STORAGE_KEY,'old-references']]);
  const original=new Map(map);let failed=false;
  const storage={getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k),setItem:(k,v)=>{if(k===DESIGN_DRAFT_KEY&&!failed){failed=true;throw Error('quota');}map.set(k,v);}};
  assert.throws(()=>importDesignSnapshot(storage,snapshot(),snapshot()),/quota/);assert.deepEqual(map,original);
});

test('API uses server-derived owner and CAS revision, strips arbitrary client fields',async t=>{
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const args=JSON.parse(options.body);assert.match(args.p_owner_key,/^[a-f0-9]{64}$/);assert.notEqual(args.p_owner_key,'attacker');
    if(String(url).endsWith('/masa_design_state_get_v1'))return Response.json({snapshot:null,revision:0,updatedAt:null});
    assert.equal(args.p_expected_revision,0);assert.equal(args.p_snapshot.owner,undefined);
    return Response.json({snapshot:args.p_snapshot,revision:1,updatedAt:'2026-10-14T01:30:00Z'});
  });
  const read=await api.GET(context());assert.equal(read.status,200);assert.equal((await read.json()).snapshot,null);
  const write=await api.POST(context('POST',{snapshot:{...snapshot(),owner:'remove'},revision:0,p_owner_key:'attacker'}));
  assert.equal(write.status,200);const body=await write.json();assert.equal(body.revision,1);assert.equal(body.p_owner_key,undefined);
});

test('bad JSON, oversized streamed body and invalid revision never reach upstream',async t=>{
  const upstream=t.mock.method(globalThis,'fetch',()=>assert.fail('invalid request'));
  for(const body of ['broken','null',{snapshot:snapshot(),revision:null},{snapshot:snapshot(),revision:1.5},{snapshot:snapshot(),revision:-1},{snapshot:snapshot(),revision:2147483647},{snapshot:{},revision:0}])
    assert.equal((await api.POST(context('POST',body))).status,400);
  assert.equal((await api.POST(context('POST','x'.repeat(32001)))).status,413);assert.equal(upstream.mock.callCount(),0);
});

test('CAS conflict and storage outages keep stable errors without exposing server details',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({code:'40001',message:'revision_conflict',detail:'private detail'}),{status:400}));
  const conflict=await api.POST(context('POST',{snapshot:snapshot(),revision:0}));assert.equal(conflict.status,409);assert.deepEqual(await conflict.json(),{ok:false,error:'revision_conflict'});
  t.mock.method(globalThis,'fetch',async()=>new Response('private-key-and-details',{status:500}));
  assert.equal((await api.GET(context())).status,503);const write=await api.POST(context('POST',{snapshot:snapshot(),revision:0}));assert.equal(write.status,503);
  assert.doesNotMatch(JSON.stringify(await write.json()),/private-key/);
});

test('design API is protected by session and same-origin middleware before its handlers',async()=>{
  const url='https://dashboard.example.test/api/dashboard/design-state';
  const session=await createDashboardSession(env.DASHBOARD_PASSWORD,new URL(url).origin);
  let calls=0;
  const ctx=(method,cookie,headers={})=>({locals:{},request:new Request(url,{method,headers}),
    cookies:{get:()=>cookie?{value:cookie}:undefined,set:()=>{}}});
  const next=()=>{calls++;return Response.json({ok:true});};
  assert.equal((await onRequest(ctx('GET'),next)).status,401);
  assert.equal((await onRequest(ctx('POST',session,{Origin:'https://other.example.test'}),next)).status,403);
  assert.equal(calls,0);
  assert.equal((await onRequest(ctx('POST',session,{Origin:new URL(url).origin}),next)).status,200);
  assert.equal(calls,1);
});
