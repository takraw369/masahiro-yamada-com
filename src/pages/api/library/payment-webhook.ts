import type { APIContext } from 'astro';
import { getDashboardOwnerKey,getSiteStorageEnv,supabaseRpc } from '../../../lib/siteStorage';
import { fulfillShelfEvent,type KnowledgeShelfEnv } from '../../../lib/knowledgeShelf';
import { jsonResponse } from '../../../lib/security/request.mjs';

export const POST=async({request,locals}:APIContext)=>{
  if(Number(request.headers.get('content-length')||0)>256000)return jsonResponse({ok:false,error:'payload_too_large'},413);
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>256000)return jsonResponse({ok:false,error:'payload_too_large'},413);
  const env=getSiteStorageEnv(locals) as KnowledgeShelfEnv;
  try{
    const ownerKey=await getDashboardOwnerKey(env);
    const result=await fulfillShelfEvent(raw,request.headers.get('stripe-signature'),env,ownerKey,
      (name,args)=>supabaseRpc(env,name,args));
    return jsonResponse(result);
  }catch(error){
    const reason=error instanceof Error?error.message:'';
    if(reason==='invalid_signature')return jsonResponse({ok:false,error:'invalid_signature'},401);
    console.error('library_webhook_failed',{category:reason.startsWith('invalid_')?'invalid_event':'processing_failed'});
    return jsonResponse({ok:false,error:'payment_processing_unavailable'},503);
  }
};
