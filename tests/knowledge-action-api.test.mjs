import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from './helpers/worker-runtime.mjs';
const { POST, GET } = await import('../src/pages/api/dashboard/knowledge-action.ts');
import { parsePracticeFeedback } from '../src/lib/knowledgeAction.mjs';
const id='f996c42c-dfbe-4b32-8e69-d63b371e151d';
const raw={items:[{id,title:'実資料の知識',source_key:'source01',canonical_url:'https://docs.google.com/spreadsheets/d/example/edit',metadata:{knowledge_action:{visibility:'private',assetId:'source01',summary:'経験を記録する',reviewStatus:'ai_candidate',projects:['ACE'],rights:'確認前'}}}],edges:[]};
const context=(body)=>({locals:{},request:new Request('https://dashboard.example.test/api/dashboard/knowledge-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
test.beforeEach(()=>{for(const key of Object.keys(env))delete env[key];Object.assign(env,{DASHBOARD_PASSWORD:'local-test-secret',SUPABASE_URL:'https://supabase.example.test',SUPABASE_PUBLISHABLE_KEY:'test-only-key'});});
test('proposal fetches trusted current sources and ignores forged client source content',async(t)=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,init)=>{const args=JSON.parse(init.body);calls.push(args);assert.match(args.p_owner_key,/^[0-9a-f]{64}$/);return Response.json(String(url).endsWith('library_v1')?raw:{feedbackId:'receipt01'});});
 const r=await POST(context({action:'propose',eventId:'event01',nodeIds:[id],destination:'ACE',ownerKey:'forged',title:'forged',sources:[]}));const p=await r.json();assert.equal(r.status,201);assert.equal(p.data.proposal.sources[0].title,'実資料の知識');assert.equal(calls[1].p_payload.visibility,'private');assert.equal(calls[1].p_payload.reviewStatus,'ai_candidate');
});
test('oversized body without content-length and duplicate sources fail before storage',async(t)=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error();});
 assert.equal((await POST(context({note:'あ'.repeat(30000)}))).status,413);assert.equal((await POST(context({action:'propose',eventId:'event02',nodeIds:[id,id],destination:'ACE'}))).status,400);assert.equal(calls,0);
});
test('outcome imports retain stable source and proposal identity for idempotent replay',()=>{
 const file={schema:'masa-knowledge-action-feedback/v1',eventId:'ace-log01',proposalId:'event01',sourceNodeIds:[id],reflection:{outcome:'1行を書いた',learning:'短い方が書けた',nextAction:'明日も試す'},occurredAt:'2026-10-12T00:00:00Z'};
 const record=parsePracticeFeedback(file,[{id}]);assert.equal(record.eventId,'ace-log01');assert.equal(record.proposalId,'event01');assert.match(record.note,/実践結果：1行を書いた/);assert.throws(()=>parsePracticeFeedback({...file,sourceNodeIds:['invalid']},[{id}]));assert.throws(()=>parsePracticeFeedback({...file,reflection:{...file.reflection,outcome:''}},[{id}]));
});
test('empty outcome and malformed body are rejected, storage failure never reports saved',async(t)=>{
 assert.equal((await POST(context({action:'outcome',eventId:'event03',nodeIds:[id],note:''}))).status,400);
 t.mock.method(globalThis,'fetch',async()=>new Response('unavailable',{status:503}));const r=await POST(context({action:'review',eventId:'event04',nodeIds:[id]}));assert.equal(r.status,503);assert.equal((await r.json()).ok,false);
});
test('library response is uncached and never exposes raw unrelated metadata',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({...raw,items:raw.items.map(n=>({...n,metadata:{...n.metadata,secret:'unrelated'}}))}));const r=await GET({locals:{},request:new Request('https://dashboard.example.test/api/dashboard/knowledge-action')});const p=await r.json();assert.match(r.headers.get('Cache-Control'),/no-store/);assert.equal(JSON.stringify(p).includes('unrelated'),false);
});
