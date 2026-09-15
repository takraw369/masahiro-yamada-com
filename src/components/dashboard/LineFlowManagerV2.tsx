import { useEffect, useMemo, useState } from 'react';
import { STARTER_RECIPES, type StarterRecipe } from '../../lib/line-flow-recipes';

type TriggerType = 'friend_add' | 'tag_added' | 'manual';
type DeliveryMode = 'relative' | 'elapsed' | 'absolute_time';
type MessageType = 'text' | 'image' | 'flex';
type MatchType = 'exact' | 'contains';
type LineAccount = { id: string; name?: string; displayName?: string };
type Tag = { id: string; name: string };
type Scenario = { id:string; name:string; description:string|null; triggerType:TriggerType; triggerTagId:string|null; lineAccountId?:string|null; isActive:boolean; deliveryMode?:DeliveryMode; stepCount?:number };
type ReplyRoute = { id?:string; fromStepId?:string; toStepId:string; matchType:MatchType; matchValue:string; priority:number; takenCount?:number };
type Step = { id:string; scenarioId:string; stepOrder:number; delayMinutes:number; offsetDays?:number|null; offsetMinutes?:number|null; deliveryTime?:string|null; messageType:MessageType; messageContent:string; conditionType?:string|null; conditionValue?:string|null; nextStepOnFalse?:number|null; onReachTagId?:string|null; replyRoutes?:ReplyRoute[] };
type Detail = Scenario & { steps: Step[] };
type StepStat = { stepOrder:number; reachedCount:number; reachRate:number; currentCount:number; waitingCount:number; cancelledCount:number; branchTakenCount:number };
type Stats = { enrolledTotal:number; activeNow:number; completed:number; paused:number; cancelled:number; steps:StepStat[] };
type Form = { delayMinutes:number; offsetDays:number; offsetMinutes:number; deliveryTime:string; messageType:MessageType; messageContent:string; onReachTagId:string; replyRoutes:ReplyRoute[] };

const emptyForm: Form = { delayMinutes:0, offsetDays:0, offsetMinutes:0, deliveryTime:'09:00', messageType:'text', messageContent:'', onReachTagId:'', replyRoutes:[] };
const BLOCKS = [
  { id:'safe', icon:'🫧', label:'安心', purpose:'警戒を下げる', text:'急いで変えなくて大丈夫。まず、今の自分の状態をひとつだけ観察してみよう。' },
  { id:'question', icon:'？', label:'問い', purpose:'本人の言葉を出す', text:'今いちばん整えたいのは「身体・思考・感情・行動」のどれに近いですか？' },
  { id:'notice', icon:'✨', label:'気づき', purpose:'見方を変える', text:'できない理由を探す前に、何が噛み合っていないかを見ると次の一手が変わります。' },
  { id:'experience', icon:'🌱', label:'体験', purpose:'小さく試す', text:'今日は1分だけ。呼吸・姿勢・足裏のどれかを観察して、変化をひとつ拾ってみてください。' },
  { id:'story', icon:'📖', label:'Story', purpose:'意味をつなぐ', text:'知識だけでは人は変わりません。体験が言葉になった時、次の選択が自分のものになります。' },
  { id:'quest', icon:'🧭', label:'Quest', purpose:'行動へ', text:'今日のQuestはひとつだけ。いちばん軽く始められる行動を選んでみよう。' },
  { id:'offer', icon:'🚪', label:'次の入口', purpose:'選択肢を渡す', text:'もう少し深めたいなら次の入口があります。今進む・あとで進む・ここで止める、どれでもOKです。' },
  { id:'return', icon:'🌿', label:'再開', purpose:'追わずに戻す', text:'止まったことは失敗ではありません。戻るなら、前回の続きではなく今いちばん軽いところから。' },
] as const;

function toForm(step: Step): Form {
  return { delayMinutes:step.delayMinutes??0, offsetDays:step.offsetDays??0, offsetMinutes:step.offsetMinutes??0, deliveryTime:step.deliveryTime||'09:00', messageType:step.messageType, messageContent:step.messageContent, onReachTagId:step.onReachTagId||'', replyRoutes:(step.replyRoutes||[]).map((r)=>({...r})) };
}

async function api<T>(path:string, init?:RequestInit):Promise<T> {
  const response=await fetch(`/api/line-harness/${path}`,{...init,headers:init?.body?{'Content-Type':'application/json',...(init.headers||{})}:init?.headers});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.success===false) throw new Error(payload?.message||payload?.error||'LINE API error');
  return (payload?.data??payload) as T;
}
async function v2<T>(body:Record<string,unknown>):Promise<T> {
  const response=await fetch('/api/dashboard/line-flow-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.success===false) throw new Error(payload?.message||payload?.error||'LINE Flow v2 error');
  return payload.data as T;
}
function accountName(a:LineAccount){return a.displayName||a.name||a.id;}
function timing(mode:DeliveryMode,s:Step){
  if(mode==='absolute_time')return `${s.offsetDays??0}日後 ${s.deliveryTime||'09:00'}`;
  const mins=mode==='elapsed'?((s.offsetDays??0)*1440+(s.offsetMinutes??0)):(s.delayMinutes??0);
  if(mins===0)return 'すぐ';
  const d=Math.floor(mins/1440),h=Math.floor((mins%1440)/60),m=mins%60;
  return `${d?`${d}日 `:''}${h?`${h}時間 `:''}${m?`${m}分`:''}後`.trim();
}

export default function LineFlowManagerV2(){
  const [accounts,setAccounts]=useState<LineAccount[]>([]),[tags,setTags]=useState<Tag[]>([]),[scenarios,setScenarios]=useState<Scenario[]>([]);
  const [accountId,setAccountId]=useState(''),[scenarioId,setScenarioId]=useState(''),[detail,setDetail]=useState<Detail|null>(null),[stats,setStats]=useState<Stats|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null),[form,setForm]=useState<Form>(emptyForm),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [showRecipes,setShowRecipes]=useState(false),[showNew,setShowNew]=useState(false),[dragId,setDragId]=useState<string|null>(null);
  const [newFlow,setNewFlow]=useState({name:'',description:'',triggerType:'friend_add' as TriggerType,deliveryMode:'elapsed' as DeliveryMode});
  const selected=detail?.steps.find((s)=>s.id===selectedId)||null;
  const mode=(detail?.deliveryMode||'elapsed') as DeliveryMode;
  const visible=useMemo(()=>scenarios.filter((s)=>!accountId||!s.lineAccountId||s.lineAccountId===accountId),[scenarios,accountId]);
  const statFor=(n:number)=>stats?.steps.find((s)=>s.stepOrder===n);
  const stepNo=(id:string)=>detail?.steps.find((s)=>s.id===id)?.stepOrder;
  const flash=(s:string)=>{setNotice(s);window.setTimeout(()=>setNotice(''),2400)};

  async function loadBase(){
    setBusy(true);setError('');
    try{
      const [a,t,s]=await Promise.all([api<LineAccount[]>('line-accounts'),api<Tag[]>('tags'),api<Scenario[]>('scenarios')]);
      setAccounts(a);setTags(t);setScenarios(s);
      const aid=accountId||a[0]?.id||'';setAccountId(aid);
      const allowed=s.filter((x)=>!aid||!x.lineAccountId||x.lineAccountId===aid);
      if(!scenarioId&&allowed[0])setScenarioId(allowed[0].id);
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false)}
  }
  async function loadScenario(id:string){
    if(!id)return;
    setBusy(true);setError('');
    try{
      const [d,r,a]=await Promise.all([
        api<Detail>(`scenarios/${id}`),
        v2<ReplyRoute[]>({action:'routes:list',scenarioId:id}),
        v2<Stats>({action:'analytics',scenarioId:id}),
      ]);
      const steps=[...(d.steps||[])].sort((x,y)=>x.stepOrder-y.stepOrder).map((s)=>({...s,replyRoutes:r.filter((q)=>q.fromStepId===s.id)}));
      const next={...d,steps};setDetail(next);setStats(a);
      const keep=steps.find((s)=>s.id===selectedId)||steps[0]||null;setSelectedId(keep?.id||null);setForm(keep?toForm(keep):emptyForm);
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false)}
  }
  useEffect(()=>{loadBase()},[]);
  useEffect(()=>{if(scenarioId)loadScenario(scenarioId)},[scenarioId]);
  useEffect(()=>{if(selected)setForm(toForm(selected))},[selectedId]);

  async function saveStep(){
    if(!detail||!selected)return;if(!form.messageContent.trim()){setError('本文を入れてください。');return;}
    if(detail.isActive&&!window.confirm('稼働中のFlowです。今後の配信に反映しますか？'))return;
    setBusy(true);setError('');
    try{
      const payload:Record<string,unknown>={messageType:form.messageType,messageContent:form.messageContent,onReachTagId:form.onReachTagId||null};
      if(mode==='relative')payload.delayMinutes=Math.max(0,form.delayMinutes);
      if(mode==='elapsed'){payload.offsetDays=Math.max(0,form.offsetDays);payload.offsetMinutes=Math.max(0,Math.min(1439,form.offsetMinutes));}
      if(mode==='absolute_time'){payload.offsetDays=Math.max(0,form.offsetDays);payload.deliveryTime=form.deliveryTime;}
      await api(`scenarios/${detail.id}/steps/${selected.id}`,{method:'PUT',body:JSON.stringify(payload)});
      await v2({action:'routes:replace',scenarioId:detail.id,stepId:selected.id,routes:form.replyRoutes.filter((r)=>r.matchValue.trim()&&r.toStepId).map((r,i)=>({...r,priority:(i+1)*10}))});
      await loadScenario(detail.id);flash('✓ 保存しました');
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false)}
  }
  async function addStep(content='ここにメッセージを書く。'){
    if(!detail)return;setBusy(true);setError('');
    try{
      const order=detail.steps.length?Math.max(...detail.steps.map((s)=>s.stepOrder))+1:1;
      const payload:Record<string,unknown>={stepOrder:order,messageType:'text',messageContent:content};
      if(mode==='relative')payload.delayMinutes=0;if(mode==='elapsed'){payload.offsetDays=0;payload.offsetMinutes=0;}if(mode==='absolute_time'){payload.offsetDays=0;payload.deliveryTime='09:00';}
      const created=await api<Step>(`scenarios/${detail.id}/steps`,{method:'POST',body:JSON.stringify(payload)});await loadScenario(detail.id);setSelectedId(created.id);flash('＋ Stepを追加しました');
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false)}
  }
  async function deleteStep(){if(!detail||!selected||!window.confirm('このStepを削除しますか？'))return;setBusy(true);try{await api(`scenarios/${detail.id}/steps/${selected.id}`,{method:'DELETE'});setSelectedId(null);await loadScenario(detail.id);flash('削除しました')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  async function reorder(ids:string[]){
    if(!detail||ids.length<2)return;setBusy(true);
    try{await api(`scenarios/${detail.id}/steps/reorder`,{method:'POST',body:JSON.stringify({orders:ids.map((id,i)=>({stepId:id,stepOrder:i+1}))})});await loadScenario(detail.id);flash('順番を更新しました')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false);setDragId(null)}
  }
  async function move(delta:number){if(!detail||!selected)return;const ids=detail.steps.map((s)=>s.id),i=ids.indexOf(selected.id),j=i+delta;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];await reorder(ids)}
  function dropOn(targetId:string){if(!detail||!dragId||dragId===targetId)return;const ids=detail.steps.map((s)=>s.id).filter((id)=>id!==dragId),idx=ids.indexOf(targetId);ids.splice(Math.max(0,idx),0,dragId);void reorder(ids)}
  async function toggle(){if(!detail)return;const next=!detail.isActive;if(next&&!window.confirm('このFlowを稼働しますか？'))return;setBusy(true);try{await api(`scenarios/${detail.id}`,{method:'PUT',body:JSON.stringify({isActive:next})});await Promise.all([loadScenario(detail.id),loadBase()]);flash(next?'● 稼働しました':'Ⅱ 停止しました')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  async function createFlow(){if(!newFlow.name.trim())return setError('Flow名を入れてください。');setBusy(true);try{const s=await api<Scenario>('scenarios',{method:'POST',body:JSON.stringify({...newFlow,name:newFlow.name.trim(),lineAccountId:accountId,isActive:false})});setShowNew(false);setNewFlow({name:'',description:'',triggerType:'friend_add',deliveryMode:'elapsed'});await loadBase();setScenarioId(s.id);flash('停止中で作成しました')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  async function createRecipe(recipe:StarterRecipe){if(!accountId)return;setBusy(true);try{const s=await api<Scenario>('scenarios',{method:'POST',body:JSON.stringify({name:recipe.name,description:recipe.purpose,triggerType:recipe.triggerType,lineAccountId:accountId,deliveryMode:'elapsed',isActive:false})});for(const [i,st] of recipe.steps.entries())await api(`scenarios/${s.id}/steps`,{method:'POST',body:JSON.stringify({stepOrder:i+1,offsetDays:st.offsetDays,offsetMinutes:st.offsetMinutes??0,messageType:'text',messageContent:st.message})});setShowRecipes(false);await loadBase();setScenarioId(s.id);flash('型からFlowを作りました')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}

  return <div className="lf2"><style>{css}</style>
    <header className="top"><div><a href="/dashboard">← MASA OS</a><h1><i>L</i> LINE Flow <b>2</b></h1><p>人の流れを見て、分岐を組み、詰まりを整える。</p></div><div className="top-actions"><select value={accountId} onChange={(e)=>setAccountId(e.target.value)}>{accounts.map((a)=><option key={a.id} value={a.id}>{accountName(a)}</option>)}</select><button onClick={()=>setShowRecipes(true)}>型から作る</button><button onClick={()=>setShowNew(true)}>＋ Flow</button><button onClick={loadBase}>↻</button></div></header>
    {notice&&<div className="toast">{notice}</div>}{error&&<div className="error">! {error}<button onClick={()=>setError('')}>×</button></div>}
    <main className="layout">
      <aside className="left"><div className="side-title"><span>FLOWS</span><b>{visible.length}</b></div>{visible.map((s)=><button className={`flow-item ${scenarioId===s.id?'on':''}`} key={s.id} onClick={()=>setScenarioId(s.id)}><i className={s.isActive?'live':''}/><span><b>{s.name}</b><small>{s.stepCount??0} steps · {s.triggerType}</small></span></button>)}
        <div className="side-title blocks-title"><span>CONTENT BLOCKS</span></div><div className="blocks">{BLOCKS.map((b)=><button key={b.id} title={b.purpose} onClick={()=>selected?setForm({...form,messageContent:b.text}):void addStep(b.text)}><span>{b.icon}</span><b>{b.label}</b><small>{b.purpose}</small></button>)}</div>
      </aside>

      <section className="canvas">{busy&&!detail?<div className="empty">読み込み中…</div>:!detail?<div className="empty">Flowを選んでください。</div>:<>
        <div className="flow-head"><div><span className={detail.isActive?'badge live':'badge'}>{detail.isActive?'● LIVE':'○ STOPPED'}</span><h2>{detail.name}</h2><p>{detail.description||'説明なし'}</p></div><button className={detail.isActive?'stop':'start'} onClick={toggle}>{detail.isActive?'Ⅱ 停止':'▶ 稼働'}</button></div>
        <div className="metrics"><div><span>登録</span><b>{stats?.enrolledTotal??'—'}</b></div><div><span>進行中</span><b>{stats?.activeNow??'—'}</b></div><div><span>完了</span><b>{stats?.completed??'—'}</b></div><div><span>離脱</span><b>{stats?.cancelled??'—'}</b></div></div>
        <div className="trigger">{detail.triggerType==='friend_add'?'👋':detail.triggerType==='tag_added'?'🏷️':'▶'} <b>START</b><small>{detail.triggerType}</small></div><div className="arrow">↓</div>
        <div className="steps">{detail.steps.map((s,i)=>{const st=statFor(s.stepOrder),sel=s.id===selectedId;return <div className="step-shell" key={s.id} data-step-id={s.id} onDragOver={(e)=>e.preventDefault()} onDrop={()=>dropOn(s.id)}>
          <button className={`step ${sel?'sel':''}`} onClick={()=>setSelectedId(s.id)}>
            <span className="handle" draggable onDragStart={(e)=>{setDragId(s.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',s.id)}} onDragEnd={()=>setDragId(null)} onClick={(e)=>e.stopPropagation()}>⠿</span>
            <span className="step-copy"><small>STEP {s.stepOrder} · {timing(mode,s)}</small><b>{s.messageContent.slice(0,88)||'(空)'}</b><em>{(s.replyRoutes||[]).map((r)=><i key={(r.id||'')+r.matchValue}>↗ {r.matchValue} → #{stepNo(r.toStepId)??'?'}</i>)}</em></span>
            <span className="step-stat"><b>👥 {st?.currentCount??0}</b><small>今ここ</small><i>到達 {st?.reachedCount??0} · {st?.reachRate??0}%</i>{(st?.cancelledCount??0)>0&&<i className="drop">離脱 {st?.cancelledCount}</i>}</span>
          </button>{i<detail.steps.length-1&&<div className="arrow"><span>↓</span><small>{(st?.waitingCount??0)>0?`待機 ${st?.waitingCount}人`:''}</small></div>}
        </div>})}</div>
        <button className="add" onClick={()=>addStep()}>＋ Stepを追加</button>
      </>}</section>

      <aside className="inspect">{!selected||!detail?<div className="inspect-empty">中央のStepを選ぶと編集できます。</div>:<>
        <div className="inspect-head"><span>INSPECTOR</span><h2>Step {selected.stepOrder}</h2><small>到達 {statFor(selected.stepOrder)?.reachedCount??0} / 今ここ {statFor(selected.stepOrder)?.currentCount??0} / 離脱 {statFor(selected.stepOrder)?.cancelledCount??0}</small></div>
        <fieldset><legend>💬 MESSAGE</legend><textarea rows={8} value={form.messageContent} onChange={(e)=>setForm({...form,messageContent:e.target.value})}/></fieldset>
        <fieldset><legend>⏱ TIMING</legend>{mode==='relative'?<label><span>前Stepから何分後</span><input type="number" min="0" value={form.delayMinutes} onChange={(e)=>setForm({...form,delayMinutes:Number(e.target.value)})}/></label>:mode==='elapsed'?<div className="grid"><label><span>登録から何日後</span><input type="number" min="0" value={form.offsetDays} onChange={(e)=>setForm({...form,offsetDays:Number(e.target.value)})}/></label><label><span>＋何分</span><input type="number" min="0" max="1439" value={form.offsetMinutes} onChange={(e)=>setForm({...form,offsetMinutes:Number(e.target.value)})}/></label></div>:<div className="grid"><label><span>何日後</span><input type="number" min="0" value={form.offsetDays} onChange={(e)=>setForm({...form,offsetDays:Number(e.target.value)})}/></label><label><span>時刻</span><input type="time" value={form.deliveryTime} onChange={(e)=>setForm({...form,deliveryTime:e.target.value})}/></label></div>}</fieldset>
        <fieldset className="routes"><legend>🔀 REPLY ROUTE</legend><p>このStepへの返信で次の行き先を変える。未一致なら通常どおり次のStepへ。</p>{form.replyRoutes.map((r,i)=><div className="route" key={i}><input value={r.matchValue} placeholder="例：身体" onChange={(e)=>{const a=[...form.replyRoutes];a[i]={...r,matchValue:e.target.value};setForm({...form,replyRoutes:a})}}/><select value={r.matchType} onChange={(e)=>{const a=[...form.replyRoutes];a[i]={...r,matchType:e.target.value as MatchType};setForm({...form,replyRoutes:a})}}><option value="exact">完全一致</option><option value="contains">含む</option></select><select value={r.toStepId} onChange={(e)=>{const a=[...form.replyRoutes];a[i]={...r,toStepId:e.target.value};setForm({...form,replyRoutes:a})}}><option value="">行き先</option>{detail.steps.filter((x)=>x.id!==selected.id).map((x)=><option key={x.id} value={x.id}>Step {x.stepOrder}</option>)}</select><button onClick={()=>setForm({...form,replyRoutes:form.replyRoutes.filter((_,j)=>j!==i)})}>×</button></div>)}<button className="mini-add" onClick={()=>{const next=detail.steps.find((s)=>s.stepOrder===selected.stepOrder+1)||detail.steps.find((s)=>s.id!==selected.id);if(next)setForm({...form,replyRoutes:[...form.replyRoutes,{matchType:'exact',matchValue:'',toStepId:next.id,priority:(form.replyRoutes.length+1)*10}]})}}>＋ キーワード分岐</button><small className="hint">例：「身体」→ BODY Step ／「思考」→ COGNITION Step。返信からの分岐はReply APIで即時遷移する設計。</small></fieldset>
        <fieldset><legend>🏷️ AFTER</legend><label><span>到達タグ</span><select value={form.onReachTagId} onChange={(e)=>setForm({...form,onReachTagId:e.target.value})}><option value="">なし</option>{tags.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></fieldset>
        <div className="inspect-actions"><button className="save" onClick={saveStep} disabled={busy}>{busy?'処理中…':'保存する'}</button><div><button onClick={()=>move(-1)}>↑</button><button onClick={()=>move(1)}>↓</button><button className="danger" onClick={deleteStep}>削除</button></div></div>
      </>}</aside>
    </main>

    {showRecipes&&<div className="modal-bg" onMouseDown={(e)=>e.currentTarget===e.target&&setShowRecipes(false)}><div className="modal"><header><div><span>FLOW RECIPE</span><h2>型を置いてから整える</h2></div><button onClick={()=>setShowRecipes(false)}>×</button></header><div className="recipe-grid">{STARTER_RECIPES.map((r)=><button key={r.id} onClick={()=>createRecipe(r)}><b>{r.icon} {r.name}</b><p>{r.purpose}</p><small>{r.steps.map((s)=>s.angle).join(' → ')}</small></button>)}</div></div></div>}
    {showNew&&<div className="modal-bg" onMouseDown={(e)=>e.currentTarget===e.target&&setShowNew(false)}><div className="modal small"><header><div><span>NEW FLOW</span><h2>停止中で作成</h2></div><button onClick={()=>setShowNew(false)}>×</button></header><label><span>Flow名</span><input value={newFlow.name} onChange={(e)=>setNewFlow({...newFlow,name:e.target.value})}/></label><label><span>説明</span><input value={newFlow.description} onChange={(e)=>setNewFlow({...newFlow,description:e.target.value})}/></label><div className="grid"><label><span>開始</span><select value={newFlow.triggerType} onChange={(e)=>setNewFlow({...newFlow,triggerType:e.target.value as TriggerType})}><option value="friend_add">友だち追加</option><option value="manual">手動</option></select></label><label><span>時間</span><select value={newFlow.deliveryMode} onChange={(e)=>setNewFlow({...newFlow,deliveryMode:e.target.value as DeliveryMode})}><option value="elapsed">登録基準</option><option value="relative">前Step基準</option><option value="absolute_time">時刻指定</option></select></label></div><button className="save" onClick={createFlow}>作成</button></div></div>}
  </div>
}

const css=`
*{box-sizing:border-box}.lf2{min-height:100vh;background:#f3f1ed;color:#24282c;font-family:'Zen Kaku Gothic New',system-ui,sans-serif}.top{min-height:94px;padding:16px 22px;background:#fff;border-bottom:1px solid #dedad2;display:flex;justify-content:space-between;gap:20px;align-items:center;position:sticky;top:0;z-index:20}.top a{font-size:11px;color:#6f767d;text-decoration:none}.top h1{margin:3px 0 0;font-size:23px}.top h1 i{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:7px;background:#06c755;color:#fff;font-style:normal;font-size:17px}.top h1 b{font-size:11px;background:#222;color:#fff;padding:2px 6px;border-radius:9px}.top p{margin:3px 0 0;color:#737980;font-size:11px}.top-actions{display:flex;gap:7px;align-items:center}.top-actions select,.top-actions button{height:38px;border:1px solid #d6d2ca;background:#fff;border-radius:8px;padding:0 11px;font:inherit;font-size:12px}.top-actions button{font-weight:700;cursor:pointer}.layout{display:grid;grid-template-columns:230px minmax(480px,1fr) 350px;min-height:calc(100vh - 94px)}.left{background:#fbfaf8;border-right:1px solid #dedad2;padding:14px 10px;overflow:auto}.side-title{display:flex;justify-content:space-between;padding:7px 7px;font-size:10px;letter-spacing:.13em;color:#8b7b63}.side-title b{background:#ece7de;border-radius:10px;padding:1px 7px}.flow-item{width:100%;border:0;background:transparent;padding:10px 8px;border-radius:9px;display:grid;grid-template-columns:9px 1fr;text-align:left;gap:8px;cursor:pointer}.flow-item.on{background:#eee8de}.flow-item>i{width:7px;height:7px;border-radius:50%;background:#bbb;margin-top:5px}.flow-item>i.live{background:#06c755}.flow-item span{display:grid;gap:2px}.flow-item b{font-size:12px}.flow-item small{font-size:9px;color:#81878d}.blocks-title{margin-top:20px;border-top:1px solid #e2ded7;padding-top:14px}.blocks{display:grid;grid-template-columns:1fr 1fr;gap:5px}.blocks button{border:1px solid #e1ddd5;background:#fff;border-radius:8px;padding:8px 5px;display:grid;gap:1px;text-align:left;cursor:pointer}.blocks button span{font-size:15px}.blocks button b{font-size:10px}.blocks button small{font-size:8px;color:#888}.canvas{padding:24px;overflow:auto}.empty{padding:60px;text-align:center;color:#777}.flow-head{display:flex;justify-content:space-between;gap:16px;max-width:760px;margin:0 auto 14px}.flow-head h2{font-size:24px;margin:6px 0 2px}.flow-head p{font-size:11px;color:#72777b;margin:0}.badge{font-size:9px;font-weight:900;color:#888}.badge.live{color:#06a747}.start,.stop{border:0;border-radius:8px;padding:8px 14px;font-weight:800}.start{background:#222;color:#fff}.stop{background:#eee3df;color:#8e3a27}.metrics{max-width:760px;margin:0 auto 22px;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #ddd8cf;background:#fff;border-radius:10px;overflow:hidden}.metrics div{padding:9px 12px;border-right:1px solid #eee9e1}.metrics div:last-child{border:0}.metrics span{display:block;font-size:9px;color:#898f93}.metrics b{font-size:18px}.trigger{max-width:620px;margin:auto;background:#252a2d;color:#fff;border-radius:9px;padding:10px 14px;display:flex;gap:8px;align-items:center}.trigger small{margin-left:auto;color:#aaa}.steps{max-width:620px;margin:auto}.arrow{height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#aaa;font-size:14px}.arrow small{font-size:8px}.step{width:100%;border:1px solid #dcd7ce;background:#fff;border-radius:12px;padding:13px;display:grid;grid-template-columns:30px 1fr 108px;gap:10px;text-align:left;cursor:pointer;box-shadow:0 1px 2px #00000008}.step.sel{border-color:#222;box-shadow:0 0 0 2px #2221}.handle{font-size:21px;color:#aaa;cursor:grab;display:flex;align-items:center;justify-content:center;user-select:none}.step-copy{display:grid;min-width:0}.step-copy>small{font-size:9px;color:#9a6b2d;font-weight:800}.step-copy>b{font-size:12px;line-height:1.55;margin-top:3px}.step-copy em{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.step-copy em i{font-style:normal;background:#edf5ef;color:#28723f;padding:2px 5px;border-radius:5px;font-size:8px}.step-stat{text-align:right;display:flex;flex-direction:column;align-items:flex-end;justify-content:center}.step-stat>b{font-size:14px}.step-stat>small{font-size:8px;color:#777}.step-stat>i{font-style:normal;font-size:8px;color:#777}.step-stat .drop{color:#a14732}.add{display:block;margin:18px auto;border:1px dashed #aaa;background:transparent;border-radius:9px;padding:9px 16px}.inspect{background:#fbfaf8;border-left:1px solid #dedad2;padding:18px 16px;overflow:auto}.inspect-empty{padding:40px 10px;text-align:center;color:#888}.inspect-head span{font-size:9px;letter-spacing:.14em;color:#9a6b2d;font-weight:900}.inspect-head h2{margin:3px 0;font-size:20px}.inspect-head small{color:#777;font-size:9px}fieldset{border:0;border-top:1px solid #e0ddd6;margin:16px 0 0;padding:13px 0 0}legend{font-size:10px;font-weight:900;letter-spacing:.08em}label{display:grid;gap:4px;margin:8px 0}label span{font-size:9px;color:#747a7e;font-weight:700}textarea,input,select{font-family:inherit}textarea,input,.inspect select,.modal select{width:100%;border:1px solid #d5d1ca;background:#fff;border-radius:7px;padding:8px;font-size:12px}textarea{resize:vertical}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.routes>p{font-size:9px;color:#777;line-height:1.5}.route{display:grid;grid-template-columns:1fr 82px 90px 28px;gap:4px;margin:6px 0}.route input,.route select{min-width:0;padding:6px;font-size:10px}.route button{border:0;background:#eee;border-radius:6px}.mini-add{border:1px dashed #aaa;background:transparent;border-radius:7px;padding:6px 9px;font-size:10px}.hint{display:block;margin-top:6px;color:#777;font-size:8px;line-height:1.5}.inspect-actions{display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid #ddd8d0;margin-top:18px;padding-top:14px}.inspect-actions>div{display:flex;gap:4px}.inspect-actions button{border:1px solid #d5d1ca;background:#fff;border-radius:7px;padding:7px 9px}.save{background:#222!important;color:#fff!important;border:0!important;border-radius:8px;padding:9px 15px!important;font-weight:800}.danger{color:#a13e2d!important}.toast{position:fixed;top:105px;left:50%;transform:translateX(-50%);z-index:100;background:#222;color:#fff;padding:8px 14px;border-radius:8px;font-size:11px}.error{position:fixed;top:98px;left:50%;transform:translateX(-50%);z-index:99;background:#fff1ed;color:#8d3f2f;border:1px solid #e7c3ba;padding:8px 12px;border-radius:8px;font-size:10px;max-width:90vw}.error button{border:0;background:transparent;margin-left:10px}.modal-bg{position:fixed;inset:0;background:#0006;z-index:80;display:grid;place-items:center;padding:16px}.modal{width:min(760px,96vw);max-height:88vh;overflow:auto;background:#fbfaf8;border-radius:14px;padding:18px}.modal.small{width:min(480px,96vw)}.modal header{display:flex;justify-content:space-between}.modal header span{font-size:9px;color:#9a6b2d;font-weight:900}.modal header h2{margin:3px 0 12px}.modal header button{border:0;background:transparent;font-size:22px}.recipe-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.recipe-grid button{background:#fff;border:1px solid #ded9d1;border-radius:10px;padding:12px;text-align:left}.recipe-grid b{font-size:12px}.recipe-grid p{font-size:9px;color:#666;line-height:1.5}.recipe-grid small{font-size:8px;color:#8b6f49}
@media(max-width:1120px){.layout{grid-template-columns:190px minmax(420px,1fr)}.inspect{grid-column:1/-1;border-left:0;border-top:1px solid #ddd8d0;max-width:none}.inspect>*{max-width:760px;margin-left:auto;margin-right:auto}}
@media(max-width:760px){.top{position:relative;display:block;padding:13px}.top-actions{margin-top:10px;overflow-x:auto;padding-bottom:2px}.top-actions select,.top-actions button{flex:0 0 auto}.layout{display:block}.left{border-right:0;border-bottom:1px solid #ddd8d0;padding:9px;max-height:none}.left>.flow-item{display:inline-grid;width:215px;vertical-align:top;margin-right:4px}.side-title{width:100%}.blocks-title{margin-top:10px}.blocks{display:flex;overflow-x:auto}.blocks button{min-width:112px}.canvas{padding:14px 10px}.flow-head{align-items:flex-start}.flow-head h2{font-size:20px}.metrics{grid-template-columns:repeat(4,1fr)}.metrics div{padding:7px}.metrics b{font-size:15px}.step{grid-template-columns:28px 1fr 82px;padding:11px 8px}.step-copy>b{font-size:11px}.step-stat>b{font-size:11px}.inspect{padding:14px 11px}.route{grid-template-columns:1fr 72px}.route select:nth-of-type(2){grid-column:1/2}.route button{grid-column:2/3}.recipe-grid{grid-template-columns:1fr}.modal{padding:14px}.toast{top:14px}}
`;
