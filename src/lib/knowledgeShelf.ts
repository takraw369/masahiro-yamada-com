import type { SiteStorageEnv } from './siteStorage';

export interface KnowledgeShelfEnv extends SiteStorageEnv {
  KNOWLEDGE_SHELF_ACCESS_SECRET?: string;
  KNOWLEDGE_SHELF_WEBHOOK_SECRET?: string;
}
export const slugPattern = /^[a-z0-9-]{2,80}$/;
export const sessionPattern = /^cs_(live|test)_[a-zA-Z0-9_]{8,180}$/;
export const accessKeyPattern = /^KS_[0-9a-f]{64}$/;
const encoder = new TextEncoder();
const hex = (value: ArrayBuffer) => [...new Uint8Array(value)].map(b => b.toString(16).padStart(2,'0')).join('');
export const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(text)));
}
function constantEqual(a: string,b: string) {
  if(a.length!==b.length)return false;
  let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
export async function deriveAccessKey(secret: string|undefined, session: string,slug: string) {
  if(!secret||secret.length<32)throw new Error('library_access_secret_missing');
  if(!sessionPattern.test(session)||!slugPattern.test(slug))throw new Error('invalid_key_context');
  return 'KS_'+await hmac(secret,`knowledge-shelf:purchase-key:v1:${session}:${slug}`);
}
export async function verifyStripeSignature(raw: string,header: string|null,secret: string|undefined,now=Date.now()) {
  if(!secret||!header||header.length>2048)return false;
  const parts=header.split(',').map(p=>p.trim());
  const stamp=parts.find(p=>p.startsWith('t='))?.slice(2);
  if(!stamp||!/^\d{10}$/.test(stamp)||Math.abs(Math.floor(now/1000)-Number(stamp))>300)return false;
  const expected=await hmac(secret,`${stamp}.${raw}`);
  return parts.filter(p=>p.startsWith('v1=')).some(p=>constantEqual(p.slice(3),expected));
}
export type ShelfRpc = (name: string,args: Record<string,unknown>)=>Promise<unknown>;
export async function fulfillShelfEvent(raw: string,signature: string|null,env: KnowledgeShelfEnv,ownerKey: string,rpc: ShelfRpc) {
  if(!env.KNOWLEDGE_SHELF_WEBHOOK_SECRET)throw new Error('library_webhook_unconfigured');
  if(!await verifyStripeSignature(raw,signature,env.KNOWLEDGE_SHELF_WEBHOOK_SECRET))throw new Error('invalid_signature');
  const event=JSON.parse(raw);
  if(typeof event.id!=='string'||!/^evt_[a-zA-Z0-9_]{3,180}$/.test(event.id)||typeof event.livemode!=='boolean')throw new Error('invalid_event');
  const object=event.data?.object;
  if(!object||typeof object!=='object')throw new Error('invalid_event');
  const isTest=!event.livemode;
  if(event.type==='charge.refunded'||event.type==='charge.dispute.created'){
    if(event.type==='charge.refunded'&&object.refunded!==true)return {received:true,ignored:true};
    if(typeof object.payment_intent!=='string')return {received:true,ignored:true};
    const data=await rpc('masa_shelf_payment_revoke_v1',{p_owner_key:ownerKey,p_payment_id:object.payment_intent,
      p_state:event.type==='charge.refunded'?'refunded':'cancelled',p_event_id:event.id,p_test:isTest});
    return {received:true,data};
  }
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type))return {received:true,ignored:true};
  const slug=object.metadata?.knowledge_shelf_slug;
  if(typeof slug!=='string'||!slugPattern.test(slug))return {received:true,ignored:true};
  if(typeof object.id!=='string'||!sessionPattern.test(object.id)||isTest!==object.id.startsWith('cs_test_'))throw new Error('invalid_session');
  if(object.currency!=='jpy'||!Number.isSafeInteger(object.amount_total)||object.amount_total<50)throw new Error('invalid_payment_currency_or_amount');
  const state=event.type==='checkout.session.async_payment_failed'?'failed':object.payment_status==='paid'?'paid':'pending';
  // A completion/return URL alone is never proof of payment.
  if(typeof object.payment_intent!=='string'){
    if(state==='pending')return {received:true,pending:true};
    throw new Error('payment_intent_missing');
  }
  const email=object.customer_details?.email||object.customer_email;
  if(typeof email!=='string'||email.length>320)throw new Error('customer_email_missing');
  const key=await deriveAccessKey(env.KNOWLEDGE_SHELF_ACCESS_SECRET,object.id,slug);
  const data=await rpc('masa_shelf_payment_record_v1',{p_owner_key:ownerKey,p_session_id:object.id,
    p_payment_id:object.payment_intent,p_slug:slug,p_email:email,p_amount_jpy:object.amount_total,
    p_state:state,p_test:isTest,p_event_id:event.id,p_key_hash:await sha256(key)});
  return {received:true,data};
}
export const accessCookieName = (slug: string) => `ks-key-${slug}`;
export const accessCookieOptions = {path:'/library',httpOnly:true,secure:true,sameSite:'lax' as const,maxAge:60*60*24*30};
const escapeHtml=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderProtectedMarkdown(markdown:string){
  let inCode=false;let result='';
  for(const block of markdown.replace(/\r\n/g,'\n').split('\n')){
    if(block.startsWith('```')){result+=inCode?'</code></pre>':'<pre><code>';inCode=!inCode;continue;}
    if(inCode){result+=escapeHtml(block)+'\n';continue;}
    const heading=/^(#{1,4})\s+(.+)$/.exec(block);
    if(heading){const level=Math.min(heading[1].length+1,5);result+=`<h${level}>${escapeHtml(heading[2])}</h${level}>`;}
    else if(block.trim()){result+=`<p>${escapeHtml(block)}</p>`;}
  }
  return result+(inCode?'</code></pre>':'');
}
