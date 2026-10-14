import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from './helpers/worker-runtime.mjs';
const { POST } = await import('../src/pages/api/booking/stripe-webhook.ts');

const secret = 'whsec_test_only_123';
const id = '550e8400-e29b-41d4-a716-446655440000';
const requestKey = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const start = new Date(Date.now() + 48 * 3600000).toISOString();
const end = new Date(Date.parse(start) + 90 * 60000).toISOString();
const record = {
  id, request_key: requestKey, stripe_session_id: 'cs_test_case', start_at: start, end_at: end,
  mode: 'online', location_id: 'online-private', state: 'checkout_started',
};
const event = {
  type: 'checkout.session.completed',
  data: { object: {
    id: 'cs_test_case', mode: 'payment', payment_status: 'paid', amount_total: 19800,
    currency: 'jpy', payment_intent: 'pi_test_one',
    customer_details: { email: 'booking-test@example.com' },
    metadata: { booking_flow: 'smart_booking_v1', booking_id: id, booking_request_key: requestKey },
  } },
};
const googleEventId = 'masa' + id.replace(/-/g, '');
test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    BOOKING_STRIPE_WEBHOOK_SECRET: secret,
    BOOKING_SUPABASE_SERVICE_KEY: 'test-service-key',
    SUPABASE_URL: 'https://example.supabase.co',
    BOOKING_GOOGLE_CALENDAR_IDS: 'primary',
    BOOKING_CONFIRM_CALENDAR_ID: 'primary',
    BOOKING_GOOGLE_CLIENT_ID: 'client-test',
    BOOKING_GOOGLE_CLIENT_SECRET: 'secret-test',
    BOOKING_GOOGLE_REFRESH_TOKEN: 'refresh-test',
  });
});
async function sign(payload = event, signingSecret = secret) {
  const raw = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name:'HMAC',hash:'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + raw));
  const sig = Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, '0')).join('');
  return { raw, signature: 't=' + t + ',v1=' + sig };
}
async function invoke(payload = event, overriddenSignature) {
  const { raw, signature } = await sign(payload);
  return await POST({
    locals: {},
    request: new Request('https://masahiroyamada.com/api/booking/stripe-webhook', {
      method:'POST',headers:{ 'stripe-signature':overriddenSignature ?? signature },body:raw,
    }),
  });
}
function fakeServices(t, opts={}) {
  const history = [];
  t.mock.method(globalThis,'fetch',async (url,init={}) => {
    const target = String(url);
    history.push({url:target,method:init.method||'GET'});
    if (target.includes('/rest/v1/ace_booking_holds')) return Response.json(opts.badRef ? [{...record,request_key:'wrong'}] : [{...record,state:opts.state||record.state,stripe_payment_intent_id:opts.intent||null}]);
    if (target.includes('/rest/v1/rpc/ace_booking_paid_v1')) return Response.json({state:opts.paidState||'paid'});
    if (target.includes('/rest/v1/rpc/ace_booking_confirm_v1')) return Response.json({state:'confirmed'});
    if (target.includes('/rest/v1/rpc/ace_booking_review_v1')) return Response.json({state:'needs_review'});
    if (target.includes('oauth2.googleapis.com/token')) return Response.json({ access_token:'test-oauth' });
    if (target.includes('/calendar/v3/freeBusy')) return Response.json({
      calendars:{primary:{busy:opts.busy||[]}},
    });
    if (target.includes('/calendar/v3/calendars/primary/events/') && (!init.method || init.method==='GET')) {
      if (opts.state==='confirmed' || opts.eventExists) return Response.json({id:googleEventId,hangoutLink:opts.meetPending ? undefined : 'https://meet.google.com/test-only',extendedProperties:{private:{booking_id:id}}});
      return new Response(null,{status:404});
    }
    if (target.includes('/calendar/v3/calendars/primary/events?')) {
      const obj=JSON.parse(init.body);
      assert.equal(obj.id,googleEventId);
      assert.equal(obj.attendees[0].email,'booking-test@example.com');
      return Response.json({id:googleEventId,hangoutLink:'https://meet.google.com/test-only'});
    }
    throw new Error('unexpected_url:' + target);
  });
  return history;
}
test('valid paid webhook creates calendar event and records confirmation',async t=>{
  const calls=fakeServices(t);
  const res=await invoke();
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,confirmed:true});
  assert.ok(calls.some(x=>x.url.includes('/calendar/v3/freeBusy')));
  assert.ok(calls.some(x=>x.url.includes('/rest/v1/rpc/ace_booking_paid_v1')));
  assert.ok(calls.some(x=>x.url.includes('/rest/v1/rpc/ace_booking_confirm_v1')));
  assert.equal(calls.filter(x=>x.method==='POST' && x.url.includes('/calendars/primary/events?')).length,1);
});
test('duplicate webhook is idempotent and never creates another meeting',async t=>{
  const calls=fakeServices(t,{state:'confirmed'});
  const res=await invoke();
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,duplicate:true});
  assert.ok(!calls.some(x=>x.url.includes('oauth2.googleapis.com')));
});
test('conflicting event after payment triggers review, not automatic invitation',async t=>{
  const calls=fakeServices(t,{busy:[{start,end}]});
  const res=await invoke();
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,needsReview:true});
  assert.ok(calls.some(x=>x.url.includes('ace_booking_review_v1')));
  assert.ok(!calls.some(x=>x.method==='POST' && x.url.includes('/calendars/primary/events?')));
});
test('expired hold paid late never creates an invitation',async t=>{
  const calls=fakeServices(t,{paidState:'refund_required'});
  const res=await invoke();
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,needsReview:true});
  assert.ok(!calls.some(x=>x.url.includes('/calendar/v3/')));
});
test('bad signature never reads or mutates booking records',async t=>{
  const calls=fakeServices(t);
  const res=await invoke(event,'t=1,v1=' + '0'.repeat(64));
  assert.equal(res.status,400);
  assert.equal(calls.length,0);
});
test('incorrect request binding blocks fulfillment',async t=>{
  const calls=fakeServices(t,{badRef:true});
  const res=await invoke();
  assert.equal(res.status,503);
  assert.ok(!calls.some(x=>x.url.includes('ace_booking_paid_v1')));
});
test('forwarded original endpoint signature works only with its separately configured secret', async t => {
  const calls = fakeServices(t);
  const legacySecret = 'whsec_legacy_test_only';
  const { raw, signature } = await sign(event, legacySecret);
  const request = () => new Request('https://masahiroyamada.com/api/booking/stripe-webhook', {
    method: 'POST', headers: { 'stripe-signature': signature }, body: raw,
  });
  assert.equal((await POST({ locals: {}, request: request() })).status, 400);
  assert.equal(calls.length, 0);
  env.BOOKING_LEGACY_STRIPE_WEBHOOK_SECRET = legacySecret;
  assert.deepEqual(await (await POST({ locals: {}, request: request() })).json(), { ok: true, confirmed: true });
});
test('existing contact-based payment is ignored before DB and Google calls', async t => {
  const calls = fakeServices(t);
  const payload = structuredClone(event);
  payload.data.object.metadata = {};
  payload.data.object.client_reference_id = id;
  assert.deepEqual(await (await invoke(payload)).json(), { ok: true, ignored: true });
  assert.equal(calls.length, 0);
});
test('confirmed booking rejects a different payment intent before acknowledging duplicate', async t => {
  const calls = fakeServices(t, { state: 'confirmed', intent: 'pi_other' });
  assert.equal((await invoke()).status, 503);
  assert.equal(calls.length, 1);
});
test('Calendar created before DB confirmation is reused on retry without another invitation', async t => {
  const calls = fakeServices(t, { eventExists: true });
  assert.deepEqual(await (await invoke()).json(), { ok: true, confirmed: true });
  assert.equal(calls.filter(x => x.method === 'POST' && x.url.includes('/calendars/primary/events?')).length, 0);
  assert.ok(calls.some(x => x.url.includes('ace_booking_confirm_v1')));
});
test('pending Meet creation returns retry and never confirms or creates another event', async t => {
  const calls = fakeServices(t, { eventExists: true, meetPending: true });
  assert.equal((await invoke()).status, 503);
  assert.ok(!calls.some(x => x.url.includes('ace_booking_confirm_v1')));
  assert.equal(calls.filter(x => x.method === 'POST' && x.url.includes('/calendars/primary/events?')).length, 0);
});
