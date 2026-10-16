import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';
import { parseDesignSnapshot, parseSharedDesign } from '../../../data/dashboardDesignSnapshot';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Authentication, rolling session and same-origin checks live in middleware.
export const GET=async({locals}:APIContext)=>{
  try {
    const env=getSiteStorageEnv(locals);
    const shared=parseSharedDesign(await supabaseRpc(env,'masa_design_state_get_v1',{p_owner_key:await getDashboardOwnerKey(env)}));
    if(!shared)throw new Error('invalid_storage_response');
    return json({ok:true,...shared});
  } catch {return json({ok:false,error:'design_storage_unavailable'},503);}
};

export const POST=async({request,locals}:APIContext)=>{
  // Bound the body before JSON decoding, including chunked requests.
  const reader=request.body?.getReader();
  if(!reader)return json({ok:false,error:'invalid_json'},400);
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
      if(size>32000){await reader.cancel();return json({ok:false,error:'snapshot_too_large'},413);}chunks.push(value);}
  }catch{return json({ok:false,error:'invalid_json'},400);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:unknown;
  try {body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({ok:false,error:'invalid_json'},400);}
  if(!body || typeof body!=='object' || Array.isArray(body))return json({ok:false,error:'invalid_snapshot'},400);
  const input=body as Record<string,unknown>,snapshot=parseDesignSnapshot(input.snapshot);
  if(!snapshot || !Number.isSafeInteger(input.revision) || Number(input.revision)<0 || Number(input.revision)>=2147483647)
    return json({ok:false,error:'invalid_snapshot'},400);
  try {
    const env=getSiteStorageEnv(locals);
    const shared=parseSharedDesign(await supabaseRpc(env,'masa_design_state_save_v1',{
      p_owner_key:await getDashboardOwnerKey(env),p_snapshot:snapshot,p_expected_revision:input.revision,
    }));
    if(!shared)throw new Error('invalid_storage_response');
    return json({ok:true,...shared});
  }catch(error){
    return String(error).includes('revision_conflict')?json({ok:false,error:'revision_conflict'},409):json({ok:false,error:'design_storage_unavailable'},503);
  }
};
