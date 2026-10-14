/**
 * MASA_TASK_BOARD / TASKS is the single write authority.
 * The existing Supabase os_tasks and dashboard task execution RPC remain read models.
 *
 * This adapter requires a DEDICATED Cloudflare Worker secret
 * GOOGLE_TASK_BOARD_WRITER_JSON containing a Google service account with editor
 * permission on the single TASK_BOARD spreadsheet. Do NOT reuse the
 * read-only Sheet Sync runner credential or expose it to the browser.
 *
 * Google Sheets does not provide multi-cell compare-and-swap. Fresh read,
 * immutable Task ID + Revision check, one batchUpdate, and read-back reduce
 * stale-row errors, but simultaneous external Sheets edits in the race window
 * cannot be made fully atomic without a Sheet-side locking writer.
 */

const TASK_BOARD_ID = '12GCdg88OfKmyxP4HGikqfKmvxiQBXASvUkkyD4I2svk';
const TASKS_SHEET_ID = 876127850;
const TASKS_RANGE = 'TASKS!A1:N1000';
export const TASK_STATUSES = ['NOW', 'NEXT', 'WAIT', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

type Credentials = {client_email:string;private_key:string;token_uri?:string};
export class TaskSheetError extends Error {
  constructor(public code:string, public httpStatus:number) { super(code); }
}

function credentialsFrom(secret: string | undefined): Credentials {
  if (!secret) throw new TaskSheetError('task_writer_not_configured',503);
  try {
    const parsed = JSON.parse(secret) as Credentials;
    if (!parsed.client_email?.includes('@') || !parsed.private_key?.includes('PRIVATE KEY')) throw Error('invalid credentials');
    if (parsed.token_uri && parsed.token_uri !== 'https://oauth2.googleapis.com/token') throw Error('unexpected issuer');
    return parsed;
  } catch {
    throw new TaskSheetError('task_writer_not_configured',503);
  }
}

function b64url(bytes: Uint8Array) {
  let binary='';
  for (const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function googleToken(secret: string) {
  const c=credentialsFrom(secret);
  const now=Math.floor(Date.now()/1000);
  const encode=(v:unknown)=>b64url(new TextEncoder().encode(JSON.stringify(v)));
  const input=encode({alg:'RS256',typ:'JWT'})+'.'+encode({
    iss:c.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',
    aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+900
  });
  const base64=c.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const binary=atob(base64);
  const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  let privateKey:CryptoKey;
  try {
    privateKey=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  } catch { throw new TaskSheetError('task_writer_not_configured',503); }
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(input));
  const assertion=input+'.'+b64url(new Uint8Array(signature));
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok) throw new TaskSheetError('task_writer_auth_failed',503);
  const data=await response.json() as {access_token?:string};
  if(!data.access_token) throw new TaskSheetError('task_writer_auth_failed',503);
  return data.access_token;
}

async function googleJson(token:string,endpoint:string,init:RequestInit={}):Promise<any>{
  const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+TASK_BOARD_ID+endpoint,{
    ...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(init.headers||{})},
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok) {
    if(response.status===403 || response.status===401) throw new TaskSheetError('task_sheet_permission_denied',503);
    throw new TaskSheetError('task_sheet_unavailable',503);
  }
  return response.json();
}

const statusOK=(s:string):s is TaskStatus=>TASK_STATUSES.includes(s as TaskStatus);
const readRow=(r:any[],row:number)=>{
  const status=String(r[0]??'').trim().toUpperCase();
  const id=String(r[8]??'').trim();
  const raw=String(r[9]??'').trim();
  const revision=raw===''?0:Number(raw);
  if(!Number.isSafeInteger(revision)||revision<0)throw new TaskSheetError('invalid_task_revision',409);
  return {id,status,revision,row,notes:String(r[7]??'')};
};
export async function readTaskStatuses(secret:string){
  const token=await googleToken(secret);
  const sheet=await googleJson(token,'/values/'+encodeURIComponent(TASKS_RANGE));
  const rows:Array<any[]>=Array.isArray(sheet.values)?sheet.values:[];
  if(rows[0]?.[8]!=='Task ID'||rows[0]?.[9]!=='Revision'||rows[0]?.[0]!=='Status')throw new TaskSheetError('task_sheet_schema_changed',503);
  const statuses:Record<string,{status:string;revision:number}>={};
  const seen=new Set<string>();
  for(let i=1;i<rows.length;i++){
    if(!rows[i]?.[8])continue;
    const item=readRow(rows[i],i+1);
    if(!/^T\d{4,6}$/.test(item.id))continue;
    if(seen.has(item.id))throw new TaskSheetError('duplicate_task_id',409);
    seen.add(item.id);
    statuses[item.id]={status:item.status,revision:item.revision};
  }
  return {token,rows,statuses};
}

export async function moveTaskInSheet(secret:string,input:{
  taskId:string;fromStatus:string;toStatus:string;expectedRevision:number;receipt?:string
}){
  const {taskId,fromStatus,toStatus,expectedRevision,receipt=''}=input;
  if(!/^T\d{4,6}$/.test(taskId)||!statusOK(fromStatus)||!statusOK(toStatus)||fromStatus===toStatus||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>1000000000)
    throw new TaskSheetError('invalid_task_move',400);
  const evidence=receipt.trim();
  if(toStatus==='DONE'&&(evidence.length<12||evidence.length>1200))
    throw new TaskSheetError('completion_evidence_required',422);
  const current=await readTaskStatuses(secret);
  const candidates=current.rows.slice(1).map((row,i)=>readRow(row,i+2)).filter(row=>row.id===taskId);
  if(candidates.length!==1)throw new TaskSheetError(candidates.length?'duplicate_task_id':'task_not_found',409);
  const task=candidates[0];
  if(task.status!==fromStatus||task.revision!==expectedRevision)
    throw new TaskSheetError('revision_conflict',409);
  const updatedAt=new Date().toISOString();
  const editedBy='MASA Dashboard';
  const updatedNotes=toStatus==='DONE'
    ?(task.notes+(task.notes?'\n':'')+'[Receipt '+updatedAt+'] '+evidence).slice(0,14000)
    :null;
  const rowIndex=task.row-1;
  const requests:any[]=[
    {updateCells:{start:{sheetId:TASKS_SHEET_ID,rowIndex,columnIndex:0},rows:[{values:[{userEnteredValue:{stringValue:toStatus}}]}],fields:'userEnteredValue'}},
    {updateCells:{start:{sheetId:TASKS_SHEET_ID,rowIndex,columnIndex:9},rows:[{values:[
      {userEnteredValue:{numberValue:task.revision+1}},
      {userEnteredValue:{stringValue:updatedAt}},
      {userEnteredValue:{stringValue:editedBy}}
    ]}],fields:'userEnteredValue'}}
  ];
  if(updatedNotes!==null)requests.push({updateCells:{start:{sheetId:TASKS_SHEET_ID,rowIndex,columnIndex:7},rows:[{values:[{userEnteredValue:{stringValue:updatedNotes}}]}],fields:'userEnteredValue'}});
  await googleJson(current.token,':batchUpdate',{method:'POST',body:JSON.stringify({requests})});
  const checked=await googleJson(current.token,'/values/'+encodeURIComponent('TASKS!A'+task.row+':L'+task.row));
  const after=readRow(checked.values?.[0]||[],task.row);
  if(after.id!==taskId||after.status!==toStatus||after.revision!==task.revision+1)
    throw new TaskSheetError('task_write_verification_failed',409);
  if(toStatus==='DONE'&&!after.notes.includes(evidence))
    throw new TaskSheetError('task_write_verification_failed',409);
  return {taskId,status:after.status,sourceRevision:after.revision,sourceUpdatedAt:updatedAt,sourceEditBy:editedBy};
}
