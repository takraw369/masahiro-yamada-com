import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { env } from './helpers/worker-runtime.mjs';

const api = await import('../src/pages/api/dashboard/decision-lens.ts');
const endpoint = 'https://dashboard.example.test/api/dashboard/decision-lens';
const context = (method = 'GET', body) => ({
  locals: {},
  request: new Request(endpoint, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  }),
});
const draft = {
  title:'既存商品か新企画か',
  context_text:'今週、どちらを優先するか。本人の答えは未確認。',
  options_text:'A: 既存商品 / B: 新企画',
  lens:'core',
};
test.beforeEach(() => {
  for(const k of Object.keys(env)) delete env[k];
  Object.assign(env, {
    DASHBOARD_PASSWORD: 'test-only-decision-secret',
    SUPABASE_URL:'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY:'safe-publishable-test-key',
  });
});

test('GET is owner-scoped, returns private cases, does not expose owner key', async (t) => {
  t.mock.method(globalThis,'fetch',async (url,opts) => {
    assert.ok(String(url).endsWith('/masa_cognitive_cases_list_v1'));
    const args=JSON.parse(opts.body);
    assert.match(args.p_owner_key,/^[0-9a-f]{64}$/);
    assert.equal(args.p_limit,25);
    assert.doesNotMatch(JSON.stringify(opts.headers),/service_role/i);
    return Response.json([{id:'123',title:'Example',stage:'draft'}]);
  });
  const res=await api.GET(context());
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.items[0].title,'Example');
  assert.equal(data.ok,true);
  assert.doesNotMatch(JSON.stringify(data),/owner_key/);
});

test('valid draft is saved by owner-gated RPC and returns the case', async (t) => {
  t.mock.method(globalThis,'fetch',async (url,opts)=>{
    assert.ok(String(url).endsWith('/masa_cognitive_case_save_v1'));
    const sent=JSON.parse(opts.body);
    assert.equal(sent.p_action,'draft');
    assert.equal(sent.p_case.title,draft.title);
    assert.equal(sent.p_case.actual_text,undefined);
    assert.match(sent.p_owner_key,/^[0-9a-f]{64}$/);
    return Response.json({...draft,id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',stage:'draft'});
  });
  const res=await api.POST(context('POST',{action:'draft',case:draft}));
  assert.equal(res.status,200);
  assert.equal((await res.json()).item.stage,'draft');
});

test('lock submits prediction only and cannot preload an actual judgment', async (t) => {
  t.mock.method(globalThis,'fetch',async (_url,opts)=>{
    const sent=JSON.parse(opts.body);
    assert.equal(sent.p_action,'lock');
    assert.equal(sent.p_case.prediction_text,'CORE predicts A');
    assert.equal(sent.p_case.actual_text,undefined);
    assert.equal(sent.p_case.context_text,undefined);
    return Response.json({id:sent.p_case.id,stage:'locked',prediction_text:sent.p_case.prediction_text});
  });
  const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const res=await api.POST(context('POST',{action:'lock',case:{id,prediction_text:'CORE predicts A',actual_text:'B',rationale_text:'理由'}}));
  assert.equal(res.status,200);
  assert.equal((await res.json()).item.stage,'locked');
});

test('rejects malformed, oversized and missing transition input before touching storage', async (t)=>{
  const upstream=t.mock.method(globalThis,'fetch',()=>assert.fail('no upstream call expected'));
  assert.equal((await api.POST(context('POST','bad-json'))).status,400);
  assert.equal((await api.POST(context('POST',{action:'nope',case:{}}))).status,400);
  assert.equal((await api.POST(context('POST',{action:'draft',case:{...draft,lens:'invalid'}}))).status,400);
  assert.equal((await api.POST(context('POST',{action:'lock',case:{prediction_text:'x'}}))).status,400);
  assert.equal((await api.POST(context('POST',{action:'actual',case:{id:'aaaa'}}))).status,400);
  assert.equal((await api.POST(context('POST',{action:'draft',case:{...draft,context_text:'x'.repeat(24100)}}))).status,413);
  assert.equal(upstream.mock.callCount(),0);
});

test('database failure does not leak internal details',async (t)=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('private table and owner key', {status:500}));
  const result=await api.GET(context());
  assert.equal(result.status,503);
  assert.doesNotMatch(JSON.stringify(await result.json()),/private table and owner key/);
  const save=await api.POST(context('POST',{action:'draft',case:draft}));
  assert.equal(save.status,503);
  assert.doesNotMatch(JSON.stringify(await save.json()),/private table and owner key/);
});

test('migration protects stage sequence, source boundaries and RLS',()=>{
  const sql=readFileSync(new URL('../migrations/20261014_cognitive_decision_lens_v1.sql',import.meta.url),'utf8');
  const route=readFileSync(new URL('../src/pages/dashboard/decision-lens.astro',import.meta.url),'utf8');
  const layout=readFileSync(new URL('../src/layouts/DashboardLayout.astro',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on private\.masa_cognitive_cases from public, anon, authenticated/i);
  assert.match(sql,/private\.masa_dashboard_owner_keys/i);
  assert.match(sql,/locked_prediction_immutable/);
  assert.match(sql,/prediction_must_be_locked/);
  assert.match(sql,/actual_must_be_recorded/);
  assert.match(route,/予測を確定（後から変更不可）/);
  for(const lens of ['core','alt','2035','challenge'])assert.match(route,new RegExp("id:'"+lens+"'"));
  assert.match(layout,/\/dashboard\/decision-lens/);
});
