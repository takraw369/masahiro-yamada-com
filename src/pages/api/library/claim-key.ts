import type { APIContext } from 'astro';
import { getDashboardOwnerKey,getSiteStorageEnv,supabaseRpc } from '../../../lib/siteStorage';
import { accessCookieName,accessCookieOptions,deriveAccessKey,sha256,type KnowledgeShelfEnv } from '../../../lib/knowledgeShelf';
import { isSameOriginRequest,jsonResponse } from '../../../lib/security/request.mjs';

export const POST=async({request,locals,cookies}:APIContext)=>{
  if(!isSameOriginRequest(request))return jsonResponse({ok:false,error:'same_origin_required'},403);
  if(Number(request.headers.get('content-length')||0)>2000)return jsonResponse({ok:false,error:'payload_too_large'},413);
  try{
    const raw=await request.text();if(raw.length>2000)return jsonResponse({ok:false,error:'payload_too_large'},413);
    const body=JSON.parse(raw);
    if(typeof body.sessionId!=='string'||!/^cs_live_[a-zA-Z0-9_]{8,180}$/.test(body.sessionId))return jsonResponse({ok:false,error:'payment_pending'},202);
    const env=getSiteStorageEnv(locals) as KnowledgeShelfEnv;
    const record=await supabaseRpc<{status:string;slug?:string;key_hash?:string}>(env,'masa_shelf_key_claim_v1',{
      p_owner_key:await getDashboardOwnerKey(env),p_session_id:body.sessionId,
    });
    if(record.status!=='ok'||!record.slug)return jsonResponse({ok:false,error:'payment_pending'},202);
    const key=await deriveAccessKey(env.KNOWLEDGE_SHELF_ACCESS_SECRET,body.sessionId,record.slug);
    if(await sha256(key)!==record.key_hash)throw new Error('key_secret_mismatch');
    cookies.set(accessCookieName(record.slug),key,accessCookieOptions);
    return jsonResponse({ok:true,key,slug:record.slug,readUrl:`/library/${record.slug}/read`});
  }catch{
    return jsonResponse({ok:false,error:'key_claim_unavailable'},503);
  }
};
