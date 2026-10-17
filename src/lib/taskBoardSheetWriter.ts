/** Private RPC adapter. Google credentials remain inside the existing masa-flow-runner. */
export type TaskMoveInput = { taskId:string; fromStatus:string; toStatus:string; expectedRevision:number; receipt?:string };
export interface TaskBoardRunner {
  taskBoardStatuses(): Promise<unknown>;
  taskBoardMove(input:TaskMoveInput): Promise<unknown>;
}
export class TaskSheetError extends Error {
  code:string;
  httpStatus:number;
  constructor(code:string, httpStatus:number) { super(code); this.code=code; this.httpStatus=httpStatus; }
}
const allowed = ['NOW','NEXT','WAIT','REVIEW','DONE'];
const errors = new Set(['task_writer_identity_unverified','task_writer_auth_failed','task_sheet_permission_denied',
  'task_sheet_unavailable','task_sheet_schema_changed','invalid_task_revision','duplicate_task_id','task_not_found',
  'revision_conflict','invalid_task_move','completion_evidence_required','task_write_verification_failed',
  'task_notes_too_long','task_writer_busy']);
function object(value:unknown): Record<string,any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TaskSheetError('task_sheet_unavailable',503);
  return value as Record<string,any>;
}
function failure(result:Record<string,any>): never {
  const code = errors.has(result.error) ? result.error : 'task_sheet_unavailable';
  const status = [400,409,422,503].includes(result.status) ? result.status : 503;
  throw new TaskSheetError(code,status);
}
async function rpc(run:()=>Promise<unknown>) {
  try { return object(await run()); }
  catch(error) {
    if (error instanceof TaskSheetError) throw error;
    throw new TaskSheetError('task_sheet_unavailable',503);
  }
}
export async function readTaskStatuses(flow:TaskBoardRunner | undefined) {
  if (!flow) throw new TaskSheetError('flow_runner_unavailable',503);
  const result = await rpc(()=>flow.taskBoardStatuses());
  if (result.ok !== true || result.writeEnabled !== true) failure(result);
  const source = object(result.statuses);
  const statuses:Record<string,{status:string;revision:number}> = {};
  for (const [id,value] of Object.entries(source)) {
    const row = object(value);
    if (!/^T\d{4,6}$/.test(id) || typeof row.status !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 0)
      throw new TaskSheetError('task_sheet_unavailable',503);
    statuses[id] = {status:row.status,revision:row.revision};
  }
  return {statuses};
}
export async function moveTaskInSheet(flow:TaskBoardRunner | undefined,input:TaskMoveInput) {
  const {taskId,fromStatus,toStatus,expectedRevision,receipt=''} = input;
  if (typeof taskId !== 'string' || !/^T\d{4,6}$/.test(taskId) || !allowed.includes(fromStatus) || !allowed.includes(toStatus)
    || fromStatus === toStatus || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision > 1000000000
    || typeof receipt !== 'string' || receipt.length > 1200) throw new TaskSheetError('invalid_task_move',400);
  if (toStatus === 'DONE' && receipt.trim().length < 12) throw new TaskSheetError('completion_evidence_required',422);
  if (!flow) throw new TaskSheetError('flow_runner_unavailable',503);
  const result = await rpc(()=>flow.taskBoardMove(input));
  if (result.ok !== true) failure(result);
  if (result.verified !== true || result.taskId !== taskId || result.status !== toStatus
    || result.sourceRevision !== expectedRevision+1 || typeof result.sourceUpdatedAt !== 'string'
    || !Number.isFinite(Date.parse(result.sourceUpdatedAt)) || result.sourceEditBy !== 'MASA Dashboard')
    throw new TaskSheetError('task_write_verification_failed',409);
  return {taskId:result.taskId,status:result.status,sourceRevision:result.sourceRevision,
    sourceUpdatedAt:result.sourceUpdatedAt,sourceEditBy:result.sourceEditBy};
}
