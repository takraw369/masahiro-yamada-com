import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/worker-runtime.mjs';
const { evaluateTravelAroundAppointment, identifyArea } = await import('../src/lib/smartBookingAdjacentEvents.ts');

const time = new Date(Date.now() + 48 * 3600000).getTime();
const start = new Date(time).toISOString(), end = new Date(time + 90 * 60000).toISOString();
const prevEnd = new Date(time - 30 * 60000).toISOString();
const prevStart = new Date(time - 90 * 60000).toISOString();
const keys = {
  BOOKING_GOOGLE_CLIENT_ID: 'test',
  BOOKING_GOOGLE_CLIENT_SECRET: 'fake',
  BOOKING_GOOGLE_REFRESH_TOKEN: 'fake',
  BOOKING_GOOGLE_CALENDAR_IDS: 'primary',
  BOOKING_MAPS_ROUTES_KEY: 'fake',
};
const now = () => new Date(time - 48 * 3600000);
function httpWithEvents(events, duration='2700s') {
  return async (url) => {
    const path=String(url);
    if(path.includes('/token')) return Response.json({access_token:'dummy'});
    if(path.includes('/calendar/v3/calendars/primary/events?')) return Response.json({items:events});
    if(path.includes('/distanceMatrix/v2:computeRouteMatrix')) return Response.json([{
      originIndex:0,destinationIndex:0,condition:'ROUTE_EXISTS',duration,status:{},
    }]);
    throw new Error('unexpected_service');
  };
}
const event = {
  status:'confirmed',
  transparency:'opaque',
  location:'新宿駅 南口',
  start:{dateTime:prevStart},end:{dateTime:prevEnd},
};
test('location is inferred only from recognizable, unambiguous area',()=>{
  assert.equal(identifyArea('新宿駅 南口'),'shinjuku');
  assert.equal(identifyArea('矢川駅前'),'kunitachi');
  assert.equal(identifyArea('横浜駅 すぐ'),'yokohama');
  assert.equal(identifyArea('東京都立川市'),'tachikawa');
  assert.equal(identifyArea('会議室A'),null);
  assert.equal(identifyArea('新宿駅と横浜駅の中間'),null);
});
test('verified 45 minute transit plus 20 minute buffer prevents a 30 minute transfer',async()=>{
  const result=await evaluateTravelAroundAppointment(keys,start,end,'kunitachi',{
    http:httpWithEvents([event]),now,
  });
  assert.equal(result.complete,true);
  assert.equal(result.calendarsChecked,1);
  assert.equal(result.feasible,false);
  assert.equal(result.priorTransitMinutes,45);
  assert.ok(result.reasons.some(x=>x.includes('時間不足')));
});
test('unrecognized preceding meeting venue never yields a proof of feasible transit',async()=>{
  const result=await evaluateTravelAroundAppointment(keys,start,end,'kunitachi',{
    http:httpWithEvents([{...event,location:'会議室A'}]),now,
  });
  assert.equal(result.feasible,null);
  assert.equal(result.priorTransitMinutes,null);
});
test('event detail access failure blocks travel verification',async()=>{
  const http=async url=>String(url).includes('/token')
    ? Response.json({access_token:'test'})
    : new Response('{}',{status:403});
  await assert.rejects(
    ()=>evaluateTravelAroundAppointment(keys,start,end,'kunitachi',{http,now}),
    /calendar_detail_access_unavailable/,
  );
});
test('no nearby events still requires explicit origin confirmation',async()=>{
  const result=await evaluateTravelAroundAppointment(keys,start,end,'kunitachi',{http:httpWithEvents([]),now});
  assert.equal(result.feasible,true);
  assert.ok(result.reasons.some(x=>x.includes('出発拠点')));
});
