import type { APIContext } from 'astro';
import { getSiteStorageEnv, getDashboardOwnerKey } from '../../../lib/siteStorage';
import { moveTaskInSheet, readTaskStatuses, TaskSheetError } from '../../../lib/taskBoardSheetWriter';

// Middleware enforces Dashboard session, same-origin requests and private no-store.
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
type WriterEnv=ReturnType<typeof getSiteStorageEnv> & { GOOGLE_TASK_BOARD_WRITER_JSON?:string };
function writerSecret(locals:APIContext['locals']) {
  const env=getSiteStorageEnv(locals) as WriterEnv;
  return {env,secret:env.GOOGLE_TASK_BOARD_WRITER_JSON||''};
}
export const GET=async({locals}:APIContext)=>{
  const {env,secret}=writerSecret(locals);
  try {
    await getDashboardOwnerKey(env);
    if(!secret)return json({ok:true,writeEnabled:false,reason:'writer_not_configured'});
    // Source canonical is queried once on load to show fresh status even
    // while the one-way Sheets -> Supabase synchronization is delayed.
    const {statuses}=await readTaskStatuses(secret);
    return json({ok:true,writeEnabled:true,statuses,source:'MASA_TASK_BOARD/TASKS'});
  }catch(error){
    console.error('task_board_sheet_status_unavailable',error instanceof TaskSheetError?error.code:'failed');
    return json({ok:true,writeEnabled:false,reason:'writer_unavailable'});
  }
};

export const POST=async({request,locals}:APIContext)=>{
  if(!/application\/json/i.test(request.headers.get('content-type')||''))return json({ok:false,error:'json_required'},415);
  const declared=Number(request.headers.get('content-length')||'0');
  if(declared>2600)return json({ok:false,error:'payload_too_large'},413);
  let body:any;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>2600)return json({ok:false,error:'payload_too_large'},413);
    body=JSON.parse(raw);
    if(!body || typeof body!=='object' || Array.isArray(body))throw Error('bad body');
  }catch{return json({ok:false,error:'invalid_json'},400);}
  const {taskId,fromStatus,toStatus,expectedRevision,receipt}=body;
  if(typeof taskId!=='string'||typeof fromStatus!=='string'||typeof toStatus!=='string'||
     typeof expectedRevision!=='number'||(receipt!==undefined&&typeof receipt!=='string'))
    return json({ok:false,error:'invalid_task_move'},400);
  try{
    const {env,secret}=writerSecret(locals);
    await getDashboardOwnerKey(env);
    const saved=await moveTaskInSheet(secret,{taskId,fromStatus,toStatus,expectedRevision,receipt});
    return json({ok:true,...saved,canonical:'Google Sheets TASKS',verified:true});
  }catch(error){
    const known=error instanceof TaskSheetError?error:new TaskSheetError('task_sheet_unavailable',503);
    if(known.httpStatus>=500)console.error('task_move_unavailable',known.code);
    return json({ok:false,error:known.code},known.httpStatus);
  }
};
