import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyBookingLineIdentity } from '../src/lib/smartBookingIdentity.ts';
const proof={aud:'2009606403',iss:'https://access.line.me',exp:Math.floor(Date.now()/1000)+300,sub:'U'+'a'.repeat(32)};
test('LINE provider checks the original token and fixed existing channel; caller email/UUID never selects a customer',async()=>{
  const subject=await verifyBookingLineIdentity('fixture-long-id-token',async(url,init)=>{
    assert.equal(url,'https://api.line.me/oauth2/v2.1/verify');
    assert.equal(init.body.get('client_id'),'2009606403');assert.equal(init.body.get('id_token'),'fixture-long-id-token');
    assert.equal(init.redirect,'error');return Response.json(proof);
  });assert.equal(subject,proof.sub);
});
test('wrong channel, expired, malformed, forged or missing LINE proof fails closed',async()=>{
  for(const bad of [{...proof,aud:'other'},{...proof,iss:'other'},{...proof,exp:0},{...proof,sub:'client_uuid'},{}])
    assert.equal(await verifyBookingLineIdentity('fixture-long-id-token',async()=>Response.json(bad)),null);
  assert.equal(await verifyBookingLineIdentity('fixture-long-id-token',async()=>new Response(null,{status:401})),null);
  assert.equal(await verifyBookingLineIdentity(null,async()=>{throw new Error('must not fetch')}),null);
});
