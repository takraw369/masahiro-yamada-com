import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {moveTaskInSheet,readTaskStatuses,TaskSheetError} from '../src/lib/taskBoardSheetWriter.ts';

const input={taskId:'T0001',fromStatus:'NEXT',toStatus:'NOW',expectedRevision:4};
const success={ok:true,verified:true,taskId:'T0001',status:'NOW',sourceRevision:5,sourceUpdatedAt:'2026-10-14T20:00:00+09:00',sourceEditBy:'MASA Dashboard'};
test('existing private Runner RPC is the only writer and returns sanitized canonical data',async()=>{
  let calls=0;
  const flow={taskBoardStatuses:async()=>({ok:true,writeEnabled:true,statuses:{T0001:{status:'NEXT',revision:4}}}),
    taskBoardMove:async(body)=>{calls++;assert.deepEqual(body,input);return {...success,private_key:'must never reach response'};}};
  assert.deepEqual(await readTaskStatuses(flow),{statuses:{T0001:{status:'NEXT',revision:4}}});
  const saved=await moveTaskInSheet(flow,input);
  assert.deepEqual(saved,{taskId:'T0001',status:'NOW',sourceRevision:5,sourceUpdatedAt:success.sourceUpdatedAt,sourceEditBy:'MASA Dashboard'});
  assert.equal(calls,1);
});
test('missing binding, conflict, invalid IDs and DONE evidence fail closed',async()=>{
  await assert.rejects(()=>readTaskStatuses(undefined),e=>e.code==='flow_runner_unavailable');
  await assert.rejects(()=>moveTaskInSheet(undefined,input),e=>e.code==='flow_runner_unavailable');
  const flow={taskBoardMove:async()=>({ok:false,error:'revision_conflict',status:409})};
  await assert.rejects(()=>moveTaskInSheet(flow,input),e=>e.code==='revision_conflict'&&e.httpStatus===409);
  await assert.rejects(()=>moveTaskInSheet(flow,{...input,taskId:'T-001'}),e=>e.httpStatus===400);
  await assert.rejects(()=>moveTaskInSheet(flow,{...input,toStatus:'DONE'}),e=>e.code==='completion_evidence_required');
  await assert.rejects(()=>moveTaskInSheet(flow,{...input,expectedRevision:NaN}),e=>e.httpStatus===400);
});
test('unverified or mismatched Runner receipt must never be reported as saved',async()=>{
  for(const delta of [{verified:false},{taskId:'T0002'},{status:'WAIT'},{sourceRevision:4},{sourceUpdatedAt:'bad'},{sourceEditBy:'unknown'}]) {
    const flow={taskBoardMove:async()=>({...success,...delta})};
    await assert.rejects(()=>moveTaskInSheet(flow,input),e=>e.code==='task_write_verification_failed');
  }
  await assert.rejects(()=>moveTaskInSheet({taskBoardMove:async()=>{throw Error('secret');}},input),e=>e.code==='task_sheet_unavailable');
  await assert.rejects(()=>moveTaskInSheet({taskBoardMove:async()=>({ok:false,error:'secret',status:401})},input),e=>e.code==='task_sheet_unavailable'&&e.httpStatus===503);
});
test('endpoint uses existing FLOW_RUNNER and retains private session/origin gates',async()=>{
  const [route,helper,middleware,config]=await Promise.all([
    readFile(new URL('../src/pages/api/dashboard/task-move.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/lib/taskBoardSheetWriter.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/middleware.ts',import.meta.url),'utf8'),
    readFile(new URL('../wrangler.toml',import.meta.url),'utf8')
  ]);
  assert.match(route,/getDashboardOwnerKey/);assert.match(route,/FLOW_RUNNER/);
  assert.match(route,/payload_too_large/);assert.match(route,/GET=async/);assert.match(route,/POST=async/);
  assert.match(helper,/taskBoardStatuses/);assert.match(helper,/taskBoardMove/);
  assert.doesNotMatch(route+helper,/GOOGLE_TASK_BOARD_WRITER_JSON|private_key|oauth2\.googleapis|sheets\.googleapis/);
  assert.doesNotMatch(helper,/await\s+supabaseRpc\s*\(/);
  assert.match(config,/binding = "FLOW_RUNNER"\s+service = "masa-flow-runner"/);
  assert.match(middleware,/isDashboardApi/);assert.match(middleware,/isSameOriginRequest/);assert.match(middleware,/verifyDashboardSession/);
});

test('actual route forwards sanitized input through private binding and maps failures',async()=>{
  let source=await readFile(new URL('../src/pages/api/dashboard/task-move.ts',import.meta.url),'utf8');
  source=source.replace(/import \{ getSiteStorageEnv, getDashboardOwnerKey \}[^;]+;/,
    'const getSiteStorageEnv=()=>globalThis.__taskMoveTestEnv;const getDashboardOwnerKey=async()=>"owner-test";');
  source=source.replace("'../../../lib/taskBoardSheetWriter'",JSON.stringify(new URL('../src/lib/taskBoardSheetWriter.ts',import.meta.url).href));
  const route=await import('data:text/javascript;base64,'+Buffer.from((await import('node:module')).stripTypeScriptTypes(source)).toString('base64'));
  const context=(body)=>({locals:{},request:new Request('https://example.com/api/dashboard/task-move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  try{
    globalThis.__taskMoveTestEnv={FLOW_RUNNER:{taskBoardStatuses:async()=>({ok:true,writeEnabled:true,statuses:{T0001:{status:'NEXT',revision:4}}}),taskBoardMove:async(body)=>{assert.deepEqual(body,{...input,receipt:undefined});return success;}}};
    let res=await route.GET({locals:{}});assert.equal(res.headers.get('Cache-Control'),'no-store');assert.equal((await res.json()).writeEnabled,true);
    res=await route.POST(context({...input,unexpected:'never forwarded'}));assert.equal(res.status,200);assert.equal((await res.json()).verified,true);
    globalThis.__taskMoveTestEnv.FLOW_RUNNER.taskBoardMove=async()=>({ok:false,error:'revision_conflict',status:409});
    res=await route.POST(context(input));assert.equal(res.status,409);assert.deepEqual(await res.json(),{ok:false,error:'revision_conflict'});
    res=await route.POST(context({...input,expectedRevision:'4'}));assert.equal(res.status,400);
    res=await route.POST(context({...input,receipt:'x'.repeat(2800)}));assert.equal(res.status,413);
    globalThis.__taskMoveTestEnv={};res=await route.GET({locals:{}});assert.equal((await res.json()).writeEnabled,false);
    res=await route.POST(context(input));assert.equal(res.status,503);
  }finally{delete globalThis.__taskMoveTestEnv;}
});
