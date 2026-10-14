import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {'Content-Type':'application/json','Cache-Control':'no-store'}
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LENSES = new Set(['core','alt','2035','challenge']);
const bounded = (v: unknown, n: number) => typeof v === 'string' && v.length <= n;
type Item = {id:string;title:string;lens:string;stage:string;prediction_text:string;rationale_text:string;actual_text?:string};
const validatedOutput = (data: any, mode: string) => {
  if (!data?.ok || !data?.data || typeof data.data !== 'object') return false;
  const f: Record<string,number> = mode === 'compose'
    ? {context_text:6000,options_text:3000,prediction_text:6000,rationale_text:4000} : {difference_text:4000};
  return Object.entries(f).every(([k,n]) => bounded(data.data[k],n) && !!data.data[k].trim());
};
export const POST = async ({request,locals}:APIContext) => {
  if (Number(request.headers.get('content-length')||0) > 15000) return json({ok:false,error:'payload_too_large'},413);
  let body: Record<string,unknown>;
  try {
    const raw = await request.text();
    if(raw.length > 15000) return json({ok:false,error:'payload_too_large'},413);
    const parsed:unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
    body = parsed as Record<string,unknown>;
  } catch {return json({ok:false,error:'invalid_json'},400);}
  const mode = body.mode === 'compare' ? 'compare' : body.mode === 'compose' ? 'compose' : '';
  const title = body.title, lens = body.lens;
  if (!mode || !bounded(title,180) || title.trim().length<3 ||
    !LENSES.has(String(lens)) ||
    (body.context_text !== undefined && !bounded(body.context_text,6000)) ||
    (body.options_text !== undefined && !bounded(body.options_text,3000))) {
    return json({ok:false,error:'invalid_input'},400);
  }
  if (mode === 'compare' && (typeof body.id !== 'string' || !UUID.test(body.id)
    || !bounded(body.actual_text,6000) || !body.actual_text.trim())) {
    return json({ok:false,error:'invalid_actual'},400);
  }
  try {
    const env = getSiteStorageEnv(locals);
    const owner = await getDashboardOwnerKey(env);
    let existing:Item|undefined;
    if(mode==='compare') {
      const items = await supabaseRpc<Item[]>(env,'masa_cognitive_cases_list_v1',{p_owner_key:owner,p_limit:50});
      existing = items.find(i=>i.id===body.id && i.stage==='locked');
      if(!existing || existing.title!==title || existing.lens!==lens) return json({ok:false,error:'case_not_found_or_unlocked'},409);
    }
    if (!env.SUPABASE_URL) return json({ok:false,error:'ai_unavailable'},503);
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(),50_000);
    let response:Response;
    try {
      response = await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/cognitive-compose',{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        signal:ctrl.signal,
        body:JSON.stringify({owner_key:owner,mode,title,lens,
          ...(mode==='compose'
            ? {context_text:body.context_text||'',options_text:body.options_text||''}
            : {actual_text:body.actual_text,prediction_text:existing?.prediction_text,rationale_text:existing?.rationale_text})
        })
      });
    } finally {clearTimeout(timer);}
    const result = await response.json().catch(()=>null);
    if(!response.ok || !validatedOutput(result,mode)) return json({ok:false,error:'ai_generation_unavailable'},503);
    if(mode==='compare') {
      const saved = await supabaseRpc(env,'masa_cognitive_case_save_v1',{
        p_owner_key:owner,p_action:'actual',p_case:{id:body.id,actual_text:body.actual_text,difference_text:result.data.difference_text}
      });
      return json({ok:true,item:saved,ai:true,model:result.model});
    }
    const draft = await supabaseRpc<Item>(env,'masa_cognitive_case_save_v1',{
      p_owner_key:owner,p_action:'draft',
      p_case:{title,lens,context_text:result.data.context_text,options_text:result.data.options_text}
    });
    try {
      const fixed = await supabaseRpc(env,'masa_cognitive_case_save_v1',{
        p_owner_key:owner,p_action:'lock',
        p_case:{id:draft.id,prediction_text:result.data.prediction_text,
          rationale_text:result.data.rationale_text + '\n[AI生成: '+String(result.model||'unspecified').slice(0,80)+']'}
      });
      return json({ok:true,item:fixed,ai:true,model:result.model});
    } catch {
      return json({ok:false,error:'prediction_lock_failed',partial_id:draft.id},503);
    }
  } catch {
    return json({ok:false,error:'decision_ai_unavailable'},503);
  }
};
