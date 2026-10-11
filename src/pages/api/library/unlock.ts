import type { APIContext } from 'astro';
import { getSiteStorageEnv,supabaseRpc } from '../../../lib/siteStorage';
import { accessCookieName,accessCookieOptions,accessKeyPattern,sha256,slugPattern } from '../../../lib/knowledgeShelf';
import { isSameOriginRequest,jsonResponse } from '../../../lib/security/request.mjs';

export const POST=async({request,locals,cookies}:APIContext)=>{
  if(!isSameOriginRequest(request))return jsonResponse({ok:false,error:'same_origin_required'},403);
  if(Number(request.headers.get('content-length')||0)>2000)return jsonResponse({ok:false,error:'payload_too_large'},413);
  try{
    const raw=await request.text();if(raw.length>2000)return jsonResponse({ok:false,error:'payload_too_large'},413);
    const body=JSON.parse(raw);
    if(typeof body.slug!=='string'||!slugPattern.test(body.slug)||typeof body.key!=='string'||!accessKeyPattern.test(body.key.trim()))return jsonResponse({ok:false,error:'invalid_key'},403);
    const key=body.key.trim();
    const data=await supabaseRpc<{status:string}>(getSiteStorageEnv(locals),'knowledge_shelf_key_content_v1',{p_slug:body.slug,p_key_hash:await sha256(key)});
    if(data.status!=='ok')return jsonResponse({ok:false,error:'invalid_or_revoked_key'},403);
    cookies.set(accessCookieName(body.slug),key,accessCookieOptions);
    return jsonResponse({ok:true,readUrl:`/library/${body.slug}/read`});
  }catch{return jsonResponse({ok:false,error:'unlock_unavailable'},503);}
};
