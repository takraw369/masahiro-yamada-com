import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { deriveAccessKey,verifyStripeSignature,fulfillShelfEvent,sha256,renderProtectedMarkdown } from '../src/lib/knowledgeShelf.ts';

const webhookSecret='whsec_fixture_only_abcdefghijklmnopqrstuvwxyz';
const accessSecret='fixture-access-secret-not-used-in-production-abcdefghijklmnopqrstuvwxyz';
const sign=(raw,stamp=Math.floor(Date.now()/1000))=>`t=${stamp},v1=${createHmac('sha256',webhookSecret).update(`${stamp}.${raw}`).digest('hex')}`;
const event=(changes={})=>({id:'evt_fixture_12345678',type:'checkout.session.completed',livemode:true,data:{object:{id:'cs_live_fixture12345678',payment_intent:'pi_fixture12345678',currency:'jpy',amount_total:1980,payment_status:'paid',metadata:{knowledge_shelf_slug:'a3-decision-flow'},customer_details:{email:'fixture@example.invalid'},...changes}}});
const env={KNOWLEDGE_SHELF_WEBHOOK_SECRET:webhookSecret,KNOWLEDGE_SHELF_ACCESS_SECRET:accessSecret};

test('signature rejects modified bytes, expired timestamps, wrong key and absent signature',async()=>{
 const raw=JSON.stringify(event());assert.equal(await verifyStripeSignature(raw,sign(raw),webhookSecret),true);
 assert.equal(await verifyStripeSignature(raw+' ',sign(raw),webhookSecret),false);
 assert.equal(await verifyStripeSignature(raw,sign(raw,Math.floor(Date.now()/1000)-301),webhookSecret),false);
 assert.equal(await verifyStripeSignature(raw,sign(raw),'different'),false);assert.equal(await verifyStripeSignature(raw,null,webhookSecret),false);
});
test('purchase keys are stable, product-bound and independent of dashboard authentication',async()=>{
 const key=await deriveAccessKey(accessSecret,'cs_live_fixture12345678','a3-decision-flow');
 assert.match(key,/^KS_[0-9a-f]{64}$/);assert.equal(key,await deriveAccessKey(accessSecret,'cs_live_fixture12345678','a3-decision-flow'));
 assert.notEqual(key,await deriveAccessKey(accessSecret,'cs_live_fixture12345678','10sec-reset'));
 await assert.rejects(()=>deriveAccessKey('short','cs_live_fixture12345678','a3-decision-flow'));
});
test('completed and asynchronous events require payment_status paid before recording paid',async()=>{
 for(const type of ['checkout.session.completed','checkout.session.async_payment_succeeded']){
  for(const state of ['unpaid','paid']){const data=event({payment_status:state});data.type=type;const raw=JSON.stringify(data);let args;
   await fulfillShelfEvent(raw,sign(raw),env,'owner',async(name,input)=>{assert.equal(name,'masa_shelf_payment_record_v1');args=input;return {status:input.p_state};});
   assert.equal(args.p_state,state==='paid'?'paid':'pending');assert.match(args.p_key_hash,/^[0-9a-f]{64}$/);
  }
 }
});
test('tampered, non-library, wrong-currency and inconsistent-mode events cannot grant a key',async()=>{
 let writes=0;const rpc=async()=>{writes++;};const raw=JSON.stringify(event());
 await assert.rejects(()=>fulfillShelfEvent(raw+' ',sign(raw),env,'owner',rpc));assert.equal(writes,0);
 const foreign=JSON.stringify(event({metadata:{offer:'winning_os_90'}}));await fulfillShelfEvent(foreign,sign(foreign),env,'owner',rpc);assert.equal(writes,0);
 for(const object of [{currency:'usd'},{id:'cs_test_fixture12345678'},{amount_total:0}]){const bad=JSON.stringify(event(object));await assert.rejects(()=>fulfillShelfEvent(bad,sign(bad),env,'owner',rpc));}
 assert.equal(writes,0);
});
test('test payments are explicitly separated from live purchases',async()=>{
 const data=event({id:'cs_test_fixture12345678'});data.livemode=false;const raw=JSON.stringify(data);let args;
 await fulfillShelfEvent(raw,sign(raw),env,'owner',async(_name,input)=>{args=input;});assert.equal(args.p_test,true);
});
test('full refunds revoke access and partial refunds do not silently revoke',async()=>{
 const data={id:'evt_refund12345',livemode:true,type:'charge.refunded',data:{object:{payment_intent:'pi_fixture12345678',refunded:true}}};let called;
 let raw=JSON.stringify(data);await fulfillShelfEvent(raw,sign(raw),env,'owner',async(name,args)=>{called={name,args};});
 assert.equal(called.name,'masa_shelf_payment_revoke_v1');assert.equal(called.args.p_state,'refunded');
 called=null;data.data.object.refunded=false;raw=JSON.stringify(data);await fulfillShelfEvent(raw,sign(raw),env,'owner',async()=>{called=true;});assert.equal(called,null);
});
test('disputed payments invoke cancellation, without affecting foreign purchases in SQL',async()=>{
 const raw=JSON.stringify({id:'evt_dispute12345',livemode:true,type:'charge.dispute.created',data:{object:{payment_intent:'pi_fixture12345678'}}});let args;
 await fulfillShelfEvent(raw,sign(raw),env,'owner',async(_name,input)=>{args=input;});assert.equal(args.p_state,'cancelled');
});
test('customer Markdown cannot execute HTML, scripts, images or event handlers',()=>{
 const html=renderProtectedMarkdown('# Read\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n```\n</code><script>evil()</script>\n```');
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script'));assert.ok(!html.includes('<img'));assert.ok(html.includes('<h2>Read</h2>'));
});
test('key and hash values never enter URLs; public catalog has no protected body',()=>{
 const claim=readFileSync(new URL('../src/pages/api/library/claim-key.ts',import.meta.url),'utf8');
 assert.ok(claim.includes('cookies.set'));assert.ok(!claim.includes('?key='));
 const migration=readFileSync(new URL('../migrations/20261011224318_knowledge_shelf_purchase_keys.sql',import.meta.url),'utf8');
 const catalog=migration.split('function public.knowledge_shelf_catalog_v1()')[1].split('$$;')[0];assert.ok(!catalog.includes('body_markdown'));assert.ok(!catalog.includes('source_asset_id'));
});


test('private manuscript base schema is replayable before purchase-key extensions', () => {
  const baseName = '20261011000000_knowledge_shelf_protected_assets_base.sql';
  const extensionName = '20261011224318_knowledge_shelf_purchase_keys.sql';
  assert.ok(baseName < extensionName, 'base table migration must sort before purchase-key extension');
  const base = readFileSync(new URL('../migrations/' + baseName, import.meta.url), 'utf8');
  assert.match(base, /create table if not exists public\.knowledge_shelf_protected_assets/i);
  assert.match(base, /publication_status text not null default 'draft'/);
  assert.match(base, /enable row level security/);
  assert.match(base, /revoke all on public\.knowledge_shelf_protected_assets from public, anon, authenticated/i);
  assert.doesNotMatch(base, /create policy|create or replace function public\.knowledge_shelf_content_read_v1/i);
  const extension = readFileSync(new URL('../migrations/' + extensionName, import.meta.url), 'utf8');
  assert.match(extension, /alter table public\.knowledge_shelf_protected_assets/);
});
