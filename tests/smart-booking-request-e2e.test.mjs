import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from './helpers/worker-runtime.mjs';
const { POST } = await import('../src/pages/api/booking/request.ts');

function futureJstDay() {
  return new Date(Date.now() + 4 * 86400000 + 9 * 3600000).toISOString().slice(0,10);
}
function makeRequest(fields={}) {
  const day=futureJstDay();
  return new Request('https://masahiroyamada.com/api/booking/request',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      start:day+'T10:00:00+09:00', end:day+'T11:30:00+09:00',
      requestKey:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      clientArea:'kunitachi',turnstileToken:'test-turnstile',...fields,
    }),
  });
}
const baseConfig={
  BOOKING_PUBLIC_ENABLED:'true',
  BOOKING_PAYMENT_WEBHOOK_READY:'true',
  BOOKING_LEGACY_STRIPE_ROUTER_READY:'true',
  BOOKING_REVENUE_RECONCILIATION_READY:'true',
  BOOKING_ONLINE_VENUE_CONFIRMED:'true',
  BOOKING_ONLINE_VENUE_AREA:'kunitachi',
  BOOKING_TURNSTILE_SECRET:'fake-turnstile',
  BOOKING_GOOGLE_CLIENT_ID:'test-client',
  BOOKING_GOOGLE_CLIENT_SECRET:'test-secret',
  BOOKING_GOOGLE_REFRESH_TOKEN:'test-refresh',
  BOOKING_GOOGLE_CALENDAR_IDS:'primary',
  BOOKING_CONFIRM_CALENDAR_ID:'primary',
  BOOKING_MAPS_ROUTES_KEY:'test-routing',
  BOOKING_SUPABASE_SERVICE_KEY:'test-db-secret',
  SUPABASE_URL:'https://example.supabase.co',
  BOOKING_STRIPE_SECRET_KEY:'test-stripe-key',
  BOOKING_STRIPE_ACCOUNT_ID:'acct_approved_test',
  BOOKING_STRIPE_PRICE_ID:'price_existing_test',
  BOOKING_STRIPE_WEBHOOK_SECRET:'whsec_test_only',
};
test.beforeEach(()=>{ for(const k of Object.keys(env))delete env[k]; });
function fakeDependencies(t, opts={}) {
  const seen=[];
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    const address=String(url);
    seen.push({address,method:init.method||'GET'});
    if(address.includes('turnstile/v0/siteverify'))return Response.json({success:opts.human!==false});
    if(address.includes('/ace_booking_holds?request_key='))return Response.json([]);
    if(address.includes('oauth2.googleapis.com/token'))return Response.json({access_token:'test-google-token'});
    if(address.includes('/calendar/v3/freeBusy'))return Response.json({
      calendars:{primary:{busy:opts.busy||[]}},
    });
    if(address.includes('/calendar/v3/calendars/primary/events?'))return Response.json({items:[]});
    if(address.includes('/rest/v1/rpc/ace_booking_hold_create_v1'))return Response.json({
      id:'550e8400-e29b-41d4-a716-446655440000',state:'held',
    });
    if(address.includes('/rest/v1/rpc/ace_booking_attach_checkout_v1'))return Response.json({
      id:'550e8400-e29b-41d4-a716-446655440000',state:'checkout_started',
    });
    if(address.endsWith('/v1/account'))return Response.json({id:opts.account||'acct_approved_test'});
    if(address.includes('/v1/prices/'))return Response.json({
      unit_amount:opts.price??19800,currency:'jpy',active:true,recurring:null,
    });
    if(address.endsWith('/v1/checkout/sessions'))return Response.json({
      id:'cs_test_only',url:'https://checkout.stripe.com/c/pay/test',
    });
    throw new Error('unexpected mock request:'+address);
  });
  return seen;
}
test('public requests are closed until all independent provider gates are approved',async t=>{
  const seen=fakeDependencies(t);
  const response=await POST({locals:{},request:makeRequest()});
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{ok:false,error:'booking_not_activated'});
  assert.equal(seen.length,0);
});
test('anti-bot rejection happens before calendar/checkout calls',async t=>{
  Object.assign(env,baseConfig);
  const seen=fakeDependencies(t,{human:false});
  const res=await POST({locals:{},request:makeRequest()});
  assert.equal(res.status,403);
  assert.ok(!seen.some(x=>x.address.includes('checkout')));
});
test('fresh calendar conflict blocks checkout even if bot verification succeeds',async t=>{
  Object.assign(env,baseConfig);
  const day=futureJstDay();
  const seen=fakeDependencies(t,{busy:[{start:day+'T09:50:00+09:00',end:day+'T10:10:00+09:00'}]});
  const res=await POST({locals:{},request:makeRequest()});
  assert.equal(res.status,409);
  assert.deepEqual(await res.json(),{ok:false,error:'slot_no_longer_available'});
  assert.ok(!seen.some(x=>x.address.includes('/v1/checkout/sessions')));
});
test('only matching original merchant and amount can create Stripe-hosted checkout',async t=>{
  Object.assign(env,baseConfig);
  const seen=fakeDependencies(t);
  const res=await POST({locals:{},request:makeRequest()});
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.ok,true);
  assert.ok(body.checkoutUrl.startsWith('https://checkout.stripe.com/'));
  assert.ok(seen.some(x=>x.address.includes('/calendar/v3/freeBusy')));
  assert.ok(seen.some(x=>x.address.includes('/calendar/v3/calendars/primary/events?')));
  assert.ok(seen.some(x=>x.address.includes('/rest/v1/rpc/ace_booking_hold_create_v1')));
  assert.ok(seen.some(x=>x.address.includes('/rest/v1/rpc/ace_booking_attach_checkout_v1')));
});
test('wrong Stripe merchant refuses checkout after hold, no funds captured',async t=>{
  Object.assign(env,baseConfig);
  const seen=fakeDependencies(t,{account:'acct_wrong'});
  const res=await POST({locals:{},request:makeRequest()});
  assert.equal(res.status,503);
  assert.ok(!seen.some(x=>x.address.endsWith('/v1/checkout/sessions')));
});

test('router approval alone cannot activate booking without verified canonical purchase reconciliation', async t => {
  Object.assign(env, baseConfig);
  delete env.BOOKING_REVENUE_RECONCILIATION_READY;
  const seen = fakeDependencies(t);
  const response = await POST({ locals: {}, request: makeRequest() });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'booking_not_activated' });
  assert.equal(seen.length, 0);
});
