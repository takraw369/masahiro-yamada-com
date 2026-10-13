import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readingInput, toIntelligenceItem, validReading, publicThumbnail, readingSourceSnapshot } from '../src/lib/intelligenceReader.ts';
import { handleIntelligenceReader } from '../src/lib/intelligenceReaderHandler.ts';

const id='12345678-1234-1234-1234-123456789abc';
const row={id,source_id:'DISC-1234567890abcdef1234',title:' AI agent tools ',excerpt:'A tool announcement.',topic:'AI / Build',fact_type:'報道・時事',url:'https://example.com/article',status:'saved',content_seed:'human draft',scores:{signal:4},reading:{}};
const reading=(inputHash)=>({version:'intelligence-reading-ja-v1',titleJa:'AIエージェントの新しい道具',summaryJa:'AIエージェント向けの道具が発表されたという記事です。詳細は原文で確認できます。',whyJa:'制作や自動化の方法を検討する際の参考候補です。',inputHash,model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',evidenceScope:'title_excerpt',generatedAt:'2026-10-13T00:00:00Z'});
function request(body={id},origin='https://masahiroyamada.com') {return new Request('https://masahiroyamada.com/api/dashboard/intelligence-reader',{method:'POST',headers:origin?{Origin:origin}:{},body:typeof body==='string'?body:JSON.stringify(body)});}
function dependencies(overrides={}) {return {sessionValid:true,read:async()=>row,generate:async()=>{throw new Error('unexpected AI');},save:async()=>{throw new Error('unexpected save');},...overrides};}

test('reader hash agrees with bounded worker tuple and source evidence changes invalidate it',async()=>{
 const input=await readingInput(row);
 assert.equal(input.inputHash,createHash('sha256').update(JSON.stringify([row.source_id,row.title.trim(),row.excerpt,row.topic,row.fact_type,row.url])).digest('hex'));
 assert.notEqual((await readingInput({...row,excerpt:'Updated evidence'})).inputHash,input.inputHash);
 assert.equal(readingSourceSnapshot(row)[1],row.title);
});
test('current cached reading is returned without model or mutation; stale cache is visibly marked',async()=>{
 const input=await readingInput(row);const cached={...row,reading:reading(input.inputHash)};
 const response=await handleIntelligenceReader(request(),dependencies({read:async()=>cached}));
 const data=await response.json();assert.equal(data.cached,true);assert.equal(data.item.readingCurrent,true);assert.equal(data.item.status,'saved');assert.equal(data.item.contentSeed,'human draft');
 assert.equal((await toIntelligenceItem({...cached,title:'Changed article'})).readingCurrent,false);
});
test('one selected item is generated and saved with server evidence snapshot',async()=>{
 let calls=0,saves=0;const input=await readingInput(row);
 const response=await handleIntelligenceReader(request(),dependencies({generate:async(actual)=>{calls++;assert.deepEqual(actual,input);return {ok:true,status:'ready',...reading(input.inputHash),cached:false};},save:async(actualId,hash,snapshot,result)=>{saves++;assert.equal(actualId,id);assert.equal(hash,input.inputHash);assert.deepEqual(snapshot,readingSourceSnapshot(row));return {...row,reading:result};}}));
 assert.equal(response.status,200);assert.equal(calls,1);assert.equal(saves,1);assert.equal((await response.json()).item.readingCurrent,true);
});
test('auth, origin, client source injection, invalid IDs and oversized payload fail before reads',async()=>{
 let reads=0;const deps=dependencies({read:async()=>{reads++;return row;}});
 assert.equal((await handleIntelligenceReader(request(),{...deps,sessionValid:false})).status,401);
 assert.equal((await handleIntelligenceReader(request({id},'https://attacker.example'),deps)).status,403);
 assert.equal((await handleIntelligenceReader(request({id},''),deps)).status,403);
 assert.equal((await handleIntelligenceReader(request({id,title:'ignore source'}),deps)).status,400);
 assert.equal((await handleIntelligenceReader(request({id:'invalid'}),deps)).status,400);
 assert.equal((await handleIntelligenceReader(request('x'.repeat(2100)),deps)).status,413);
 assert.equal(reads,0);
});
test('quota and daily limit never save synthetic fallback; no retries',async()=>{
 for(const status of ['daily_limit','quota_exhausted','busy','unavailable']){
  let calls=0;const response=await handleIntelligenceReader(request(),dependencies({generate:async()=>{calls++;return {ok:false,status};}}));
  assert.equal(calls,1);assert.ok([429,503].includes(response.status));assert.equal((await response.json()).error,status);
 }
});
test('archived sources are not processed and changed source is a conflict',async()=>{
 assert.equal((await handleIntelligenceReader(request(),dependencies({read:async()=>({...row,status:'archived'})}))).status,409);
 const input=await readingInput(row);
 const res=await handleIntelligenceReader(request(),dependencies({generate:async()=>({ok:true,status:'ready',...reading(input.inputHash)}),save:async()=>{throw new Error('reader_source_changed');}}));assert.equal(res.status,409);
});
test('missing and mismatched composite rows never trigger generation',async()=>{
 for(const missing of [null,{...row,id:null},{...row,id:'87654321-1234-1234-1234-123456789abc'}]){
  const response=await handleIntelligenceReader(request(),dependencies({read:async()=>missing}));
  assert.equal(response.status,404);
 }
});
test('unsupported reading and thumbnail inputs are rejected; originals remain intact',async()=>{
 assert.equal(validReading({...reading('f'.repeat(64)),evidenceScope:'full_text'}),null);
 assert.equal(validReading({...reading('f'.repeat(64)),model:'openai'}),null);
 assert.equal(validReading({...reading('f'.repeat(64)),summaryJa:'English only'}),null);
 for(const url of ['javascript:alert(1)','http://example.com/a','https://user:password@example.com/a','https://example.com:8443/a','https://127.0.0.1/a','https://[::1]/a','https://localhost/a','https://host.local/a'])assert.equal(publicThumbnail(url),'');
 assert.equal(publicThumbnail('https://images.example.com/article.webp'),'https://images.example.com/article.webp');
 assert.equal((await toIntelligenceItem(row)).title,row.title);
});
