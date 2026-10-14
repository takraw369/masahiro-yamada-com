import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {moveTaskInSheet,readTaskStatuses,TaskSheetError} from '../src/lib/taskBoardSheetWriter.ts';

test('Sheets canonical adapter verifies Task ID + revision, writes and reads back, DONE requires Receipt', async () => {
  if(!globalThis.crypto)globalThis.crypto=webcrypto;
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const credentials=JSON.stringify({client_email:'task-writer@example.iam.gserviceaccount.com',
    private_key:privateKey.export({format:'pem',type:'pkcs8'}),token_uri:'https://oauth2.googleapis.com/token'});
  const header=['Status','P','Task','Project','Due','Time','Next action','Notes','Task ID','Revision','Updated at','Updated by','Execution Lane','Execution Class'];
  const row1=['NEXT','P1','Test task','ACE','','','','','T0001',4,'','','AI_RUN','DELEGATE'];
  const row2=['WAIT','P2','Other task','SLF','','','','','T0002',1,'','','MASA_GATE','HUMAN_GATE'];
  const sheet=[header,row1,row2];
  const original=globalThis.fetch;
  let writes=0;
  globalThis.fetch=async(url,init={})=>{
    const target=String(url);
    if(target.includes('oauth2.googleapis.com/token')){
      assert.equal(init.method,'POST');return Response.json({access_token:'fake_service_token'});
    }
    if(target.includes('/values/')){
      assert.match(init.headers.Authorization,/^Bearer fake_service_token$/);
      const range=decodeURIComponent(target.split('/values/')[1]);
      if(range==='TASKS!A1:N1000')return Response.json({values:sheet.map(r=>[...r])});
      const match=/^TASKS!A(\d+):L\1$/.exec(range);
      assert.ok(match,'read-back must target one resolved physical row');
      return Response.json({values:[[...sheet[Number(match[1])-1].slice(0,12)]]});
    }
    if(target.endsWith(':batchUpdate')){
      writes++;
      assert.equal(init.method,'POST');
      const request=JSON.parse(init.body);
      assert.ok(!request.requests.some(x=>x.deleteDimension),'must never delete rows');
      for(const {updateCells} of request.requests){
        assert.equal(updateCells.start.sheetId,876127850);
        const row=sheet[updateCells.start.rowIndex];
        assert.ok(row,'resolved row must exist');
        updateCells.rows[0].values.forEach((v,i)=>{
          row[updateCells.start.columnIndex+i] = v.userEnteredValue.stringValue ?? v.userEnteredValue.numberValue;
        });
      }
      return Response.json({spreadsheetId:'canonical-test'});
    }
    throw Error('unexpected outbound fetch '+target);
  };
  try{
    const listed=await readTaskStatuses(credentials);
    assert.deepEqual(listed.statuses.T0001,{status:'NEXT',revision:4});
    assert.deepEqual(listed.statuses.T0002,{status:'WAIT',revision:1});
    const saved=await moveTaskInSheet(credentials,{taskId:'T0001',fromStatus:'NEXT',toStatus:'NOW',expectedRevision:4});
    assert.deepEqual({status:saved.status,revision:saved.sourceRevision},{status:'NOW',revision:5});
    assert.equal(sheet[1][0],'NOW');
    assert.equal(sheet[1][9],5);
    assert.equal(sheet[2][0],'WAIT','unrelated Task must remain unchanged');
    assert.equal(writes,1);
    await assert.rejects(()=>moveTaskInSheet(credentials,{taskId:'T0001',fromStatus:'NEXT',toStatus:'REVIEW',expectedRevision:4}),
      e=>e instanceof TaskSheetError&&e.code==='revision_conflict');
    await assert.rejects(()=>moveTaskInSheet(credentials,{taskId:'T0001',fromStatus:'NOW',toStatus:'DONE',expectedRevision:5}),
      e=>e instanceof TaskSheetError&&e.code==='completion_evidence_required');
    assert.equal(writes,1,'rejected moves do not attempt a write');
    const receipt='成果物 https://example.com/evidence 検証済み';
    const done=await moveTaskInSheet(credentials,{taskId:'T0001',fromStatus:'NOW',toStatus:'DONE',expectedRevision:5,receipt});
    assert.equal(done.status,'DONE');
    assert.equal(done.sourceRevision,6);
    assert.match(sheet[1][7],/https:\/\/example.com\/evidence/);
    assert.equal(sheet[1][9],6);
    assert.equal(writes,2);
    await assert.rejects(()=>moveTaskInSheet('',{taskId:'T0001',fromStatus:'DONE',toStatus:'NEXT',expectedRevision:6}),
      e=>e instanceof TaskSheetError&&e.code==='task_writer_not_configured');
  }finally{globalThis.fetch=original;}
});

test('Dashboard task writer endpoint uses private session gate and never writes Supabase task statuses directly',async()=>{
  const [route,helper,middleware]=await Promise.all([
    readFile(new URL('../src/pages/api/dashboard/task-move.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/lib/taskBoardSheetWriter.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/middleware.ts',import.meta.url),'utf8')
  ]);
  assert.match(route,/getDashboardOwnerKey/);
  assert.match(route,/GET=async/);
  assert.match(route,/POST=async/);
  assert.match(route,/readTaskStatuses/);
  assert.match(route,/moveTaskInSheet/);
  assert.match(route,/expectedRevision/);
  assert.match(route,/payload_too_large/);
  assert.match(helper,/Google service account with editor/);
  assert.match(helper,/task\.status!==fromStatus\|\|task\.revision!==expectedRevision/);
  assert.match(helper,/task_write_verification_failed/);
  assert.match(helper,/Google Sheets does not provide multi-cell compare-and-swap/);
  assert.doesNotMatch(helper,/supabaseRpc|os_tasks/);
  assert.match(middleware,/isDashboardApi/);
  assert.match(middleware,/isSameOriginRequest/);
  assert.match(middleware,/verifyDashboardSession/);
});
