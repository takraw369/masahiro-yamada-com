import type { APIContext } from 'astro';
import { getDashboardOwnerKey,getSiteStorageEnv,supabaseRpc } from '../../../lib/siteStorage';
import { jsonResponse } from '../../../lib/security/request.mjs';
import { slugPattern } from '../../../lib/knowledgeShelf';

export const GET=async({locals}:APIContext)=>{
  try{const env=getSiteStorageEnv(locals);const data=await supabaseRpc(env,'masa_content_studio_snapshot_v1',{p_owner_key:await getDashboardOwnerKey(env)});return jsonResponse({ok:true,data});}
  catch{return jsonResponse({ok:false,error:'source_read_unavailable'},503);}
};
export const POST=async({request,locals}:APIContext)=>{
  if(Number(request.headers.get('content-length')||0)>200000)return jsonResponse({ok:false,error:'payload_too_large'},413);
  try{
    const text=await request.text();if(new TextEncoder().encode(text).length>200000)return jsonResponse({ok:false,error:'payload_too_large'},413);
    const body=JSON.parse(text);
    if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.slug!=='string'||!slugPattern.test(body.slug)
      ||typeof body.title!=='string'||body.title.trim().length<1||body.title.length>200
      ||typeof body.summary!=='string'||body.summary.length>2000
      ||typeof body.body!=='string'||body.body.length>100000
      ||!Number.isSafeInteger(body.priceYen)||body.priceYen<0||body.priceYen>1000000
      ||(body.sourceAssetId!==null&&typeof body.sourceAssetId!=='string')
      ||(body.expectedVersion!==null&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1)))return jsonResponse({ok:false,error:'invalid_product'},400);
    const env=getSiteStorageEnv(locals);
    // This endpoint saves drafts. Sale activation is a separate, deliberate release.
    const data=await supabaseRpc(env,'masa_shelf_product_save_v1',{p_owner_key:await getDashboardOwnerKey(env),
      p_slug:body.slug,p_title:body.title.trim(),p_summary:body.summary,p_body:body.body,
      p_source_asset_id:body.sourceAssetId,p_price_jpy:body.priceYen,p_expected_version:body.expectedVersion});
    return jsonResponse({ok:true,data},201);
  }catch(error){
    const message=String(error);
    if(message.includes('version_conflict'))return jsonResponse({ok:false,error:'version_conflict'},409);
    if(message.includes('live_product_requires_explicit_update'))return jsonResponse({ok:false,error:'live_product_update_requires_release'},409);
    return jsonResponse({ok:false,error:'product_save_unavailable'},503);
  }
};
