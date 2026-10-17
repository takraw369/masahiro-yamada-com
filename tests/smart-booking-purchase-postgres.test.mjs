import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { bookingSchema } from './helpers/booking-schema.mjs';
import { env } from './helpers/worker-runtime.mjs';
const { POST } = await import('../src/pages/api/booking/stripe-webhook.ts');
const contact='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const offer='33333333-3333-4333-8333-333333333333', subject='U'+'a'.repeat(32), otherSubject='U'+'b'.repeat(32);
const request='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const migration=await readFile(new URL('../migrations/20261014_smart_booking_holds.sql',import.meta.url),'utf8');
async function fixture(t){
  const db=new PGlite({extensions:{btree_gist}});t.after(()=>db.close());
  await db.exec('create schema extensions;create role anon;create role authenticated;create role service_role;'+bookingSchema);
  await db.exec(migration);
  await db.query('insert into contacts values($1,$2,now()),($3,$4,now())',[contact,subject,other,otherSubject]);
  await db.query("insert into person_identities values($1,'line',$2)",[contact,subject]);
  await db.query("insert into offers values($1,'winning_os_90','active',19800)",[offer]);
  async function create(key=request,line=subject,days=3){
    const start=new Date(Date.now()+days*86400000).toISOString(),end=new Date(Date.parse(start)+90*60000).toISOString();
    // Fixed day values for deterministic replay within this fixture.
    const existing=(await db.query('select start_at,end_at from ace_booking_holds where request_key=$1',[key])).rows[0];
    return (await db.query('select ace_booking_hold_verified_v1($1,$2,$3,$4,$5,$6,$7) as r',[key,existing?.start_at??start,existing?.end_at??end,'online','online-private','kunitachi',line])).rows[0].r;
  }
  const attach=async id=>db.query('select ace_booking_attach_checkout_v1($1,$2)',[id,'cs_'+id]);
  const purchase=async(id,pi='pi_fixture',key=request,live=true)=>(await db.query('select ace_booking_purchase_v1($1,$2,$3,$4,$5) as r',[id,'cs_'+id,key,pi,live])).rows[0].r;
  const row=async id=>(await db.query('select * from ace_booking_holds where id=$1',[id])).rows[0];
  return {db,create,attach,purchase,row};
}
test('only unique consented LINE identity and fixed active offer can bind a hold',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.create(request,'U'+'c'.repeat(32)),/identity_ambiguous/);
  await f.db.query('update person_identities set person_id=$1',[other]);
  await assert.rejects(f.create(),/identity_ambiguous/);
  await f.db.query('update person_identities set person_id=$1',[contact]);
  await f.db.query('update contacts set consent_at=null where id=$1',[contact]);
  await assert.rejects(f.create(),/not_consented/);
  await f.db.query('update contacts set consent_at=now() where id=$1',[contact]);
  await f.db.query('update offers set price_jpy=1');
  await assert.rejects(f.create(),/offer_unavailable/);
  assert.equal((await f.db.query('select count(*)::int as n from ace_booking_holds')).rows[0].n,0);
});
test('bound request replay is stable and cannot be taken over by another verified contact',async t=>{
  const f=await fixture(t),h=await f.create();assert.equal(h.identityBound,true);
  assert.equal((await f.create()).id,h.id);
  await assert.rejects(f.create(request,otherSubject),/identity_collision/);
  assert.equal((await f.row(h.id)).contact_id,contact);
  await assert.rejects(f.db.query('update ace_booking_holds set contact_id=$1 where id=$2',[other,h.id]),/identity_immutable/);
});
test('paid receipt, duplicate events and confirmed replay create one canonical purchase and funnel receipt',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);
  const a=await f.purchase(h.id),b=await f.purchase(h.id);assert.equal(a.purchaseId,b.purchaseId);
  await f.db.query('select ace_booking_confirm_v1($1,$2)',[h.id,'calendar_fixture']);
  const replay=await f.purchase(h.id);assert.equal(replay.state,'confirmed');assert.equal(replay.purchaseId,a.purchaseId);
  const p=(await f.db.query('select * from purchases')).rows;assert.equal(p.length,1);
  assert.equal(p[0].contact_id,contact);assert.equal(p[0].offer_id,offer);assert.equal(p[0].external_payment_id,'pi_fixture');assert.equal(p[0].status,'paid');
  assert.equal((await f.db.query('select count(*)::int as n from funnel_events')).rows[0].n,1);
});
test('test mode, null mode and stale request/session/payment binding cannot mutate purchases',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);
  for(const live of [false,null])await assert.rejects(f.purchase(h.id,'pi_fixture',request,live),/live_payment_required/);
  await assert.rejects(f.purchase(h.id,'pi_fixture','aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff'),/binding_invalid/);
  assert.equal((await f.row(h.id)).state,'checkout_started');
  await f.purchase(h.id);await assert.rejects(f.purchase(h.id,'pi_other'),/payment_mismatch/);
  assert.equal((await f.row(h.id)).stripe_payment_intent_id,'pi_fixture');
});
test('historical or other-contact payment collision rolls back the booking transition',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);
  await f.db.query("insert into purchases(contact_id,offer_id,provider,external_payment_id,amount_jpy,status) values($1,$2,'stripe','pi_fixture',19800,'paid')",[other,offer]);
  await assert.rejects(f.purchase(h.id),/collision_or_review/);
  const row=await f.row(h.id);assert.equal(row.state,'checkout_started');assert.equal(row.stripe_payment_intent_id,null);assert.equal(row.purchase_id,null);
  assert.equal((await f.db.query('select contact_id from purchases')).rows[0].contact_id,other);
});
test('late payment records canonical paid money and refund review together, never loses the receipt',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);
  await f.db.query("update ace_booking_holds set expires_at=now()-interval '1 minute' where id=$1",[h.id]);
  const paid=await f.purchase(h.id);assert.equal(paid.state,'refund_required');assert.ok(paid.purchaseId);
  assert.equal((await f.purchase(h.id)).purchaseId,paid.purchaseId);
  assert.equal((await f.db.query('select status from purchases')).rows[0].status,'paid');
});
test('funnel write failure rolls back purchase and hold paid state as a single transaction',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);
  await f.db.exec("alter table funnel_events add constraint simulate_outage check(event_type <> 'booking_payment_received')");
  await assert.rejects(f.purchase(h.id),/simulate_outage/);
  assert.equal((await f.row(h.id)).state,'checkout_started');
  assert.equal((await f.db.query('select count(*)::int as n from purchases')).rows[0].n,0);
  await f.db.exec('alter table funnel_events drop constraint simulate_outage');assert.ok((await f.purchase(h.id)).purchaseId);
});
test('same payment cannot fund two bookings and refunded purchases never become paid on retry',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);await f.purchase(h.id);
  const key='aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff',second=await f.create(key,subject,5);await f.attach(second.id);
  await assert.rejects(f.purchase(second.id,'pi_fixture',key),/unique|duplicate/);
  assert.equal((await f.row(second.id)).state,'checkout_started');
  await f.db.exec("update purchases set status='refunded'");
  await assert.rejects(f.purchase(h.id),/collision_or_review/);
  assert.equal((await f.db.query('select status from purchases')).rows[0].status,'refunded');
});
test('browser roles cannot resolve identities or reconcile canonical purchases',async t=>{
  const f=await fixture(t);
  await f.db.exec('set role anon');
  await assert.rejects(f.db.query("select ace_booking_purchase_v1(null,null,null,'pi_fixture',true)"),/permission denied/);
  await assert.rejects(f.db.query("select ace_booking_hold_verified_v1(null,null,null,null,null,null,null)"),/permission denied/);
  await f.db.exec('reset role');
});
test('real signed handler executes actual purchase SQL before Calendar and reconciles confirmed retries',async t=>{
  const f=await fixture(t),h=await f.create();await f.attach(h.id);
  Object.assign(env,{SUPABASE_URL:'https://fixture.test',BOOKING_SUPABASE_SERVICE_KEY:'fixture',BOOKING_STRIPE_WEBHOOK_SECRET:'whsec_fixture',BOOKING_CONFIRM_CALENDAR_ID:'primary',BOOKING_GOOGLE_CALENDAR_IDS:'primary',BOOKING_GOOGLE_CLIENT_ID:'fixture',BOOKING_GOOGLE_CLIENT_SECRET:'fixture',BOOKING_GOOGLE_REFRESH_TOKEN:'fixture'});
  const google=[];
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    const u=new URL(url);
    if(u.pathname==='/rest/v1/ace_booking_holds')return Response.json([await f.row(h.id)]);
    if(u.pathname.startsWith('/rest/v1/rpc/')){
      const name=u.pathname.split('/').pop();assert.ok(['ace_booking_purchase_v1','ace_booking_confirm_v1'].includes(name));
      const args=Object.values(JSON.parse(init.body));
      const result=await f.db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as r`,args);
      return Response.json(result.rows[0].r);
    }
    google.push(url);
    assert.equal((await f.db.query("select count(*)::int as n from purchases where status='paid'")).rows[0].n,1);
    if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture'});
    assert.match(u.pathname,/calendar\/v3\/calendars\/primary\/events\//);
    return Response.json({id:'masa'+h.id.replaceAll('-',''),hangoutLink:'https://meet.google.com/fixture',extendedProperties:{private:{booking_id:h.id}}});
  });
  async function send(){
    const raw=JSON.stringify({livemode:true,type:'checkout.session.completed',data:{object:{id:'cs_'+h.id,mode:'payment',payment_status:'paid',amount_total:19800,currency:'jpy',payment_intent:'pi_fixture',customer_details:{email:'invitation@example.test'},metadata:{booking_flow:'smart_booking_v1',booking_id:h.id,booking_request_key:request}}}});
    const timestamp=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('whsec_fixture'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw));
    const signature=Array.from(new Uint8Array(mac),b=>b.toString(16).padStart(2,'0')).join('');
    return POST({locals:{},request:new Request('https://masahiroyamada.com/api/booking/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:raw})});
  }
  const response=await send();assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,confirmed:true});
  assert.equal((await f.row(h.id)).state,'confirmed');const before=google.length;
  const duplicate=await send();assert.equal(duplicate.status,200);assert.deepEqual(await duplicate.json(),{ok:true,duplicate:true});assert.equal(google.length,before);
  assert.equal((await f.db.query('select count(*)::int as n from purchases')).rows[0].n,1);
});
