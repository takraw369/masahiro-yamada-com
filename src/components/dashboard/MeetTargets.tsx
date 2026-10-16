import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createCrmSnapshot, getCrmContacts, upsertCrmContact, validateCrmBoardSnapshot,
  validateCrmContact, type CrmContact, type CrmSnapshot,
  MEET_TARGET_PRIORITIES, MEET_TARGET_STATUSES,
  type MeetTargetPriority, type MeetTargetStatus,
} from '../../lib/crm';
import {
  meetTargets, isMeetTarget, mergeMeetTarget, newMeetTarget,
  MEET_TARGET_STATUS_LABELS, MEET_TARGET_PRIORITY_LABELS,
} from '../../lib/meetTargets';
import '../../styles/meet-targets.css';

type TargetDraft = {
  name:string; organization:string;role:string;priority:MeetTargetPriority;
  status:MeetTargetStatus; purpose:string;introductionVia:string;
  referenceUrl:string;tags:string;nextAction:string;nextAt:string;
};
const emptyDraft:TargetDraft={
  name:'',organization:'',role:'',priority:'A',status:'WISH',purpose:'',
  introductionVia:'',referenceUrl:'',tags:'',nextAction:'',nextAt:'',
};
function draftFromContact(contact:CrmContact):TargetDraft {
  return {
    name:contact.name,organization:contact.organization,role:contact.role,
    priority:contact.meetTarget?.priority||'A',status:contact.meetTarget?.status||'WISH',
    purpose:contact.meetTarget?.purpose||'',introductionVia:contact.meetTarget?.introductionVia||'',
    referenceUrl:contact.referenceUrl,tags:contact.tags.join(', '),
    nextAction:contact.nextAction,nextAt:contact.nextAt,
  };
}
function makeId():string {
  const random=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  return 'crm:'+random;
}
function readError(status:number):string {
  if(status===409)return '別画面で人物データが更新されました。最新情報を読み込みました。入力内容を確認して保存し直してください。';
  if(status===401||status===403)return 'セッションが切れました。Dashboardにログインし直してください。';
  return 'Supabaseとの通信に失敗しました。変更は保存されていません。';
}
export default function MeetTargets(){
  const [snapshot,setSnapshot]=useState<CrmSnapshot|null>(null);
  const [revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('読み込み中…');
  const [error,setError]=useState(false);
  const [selectedId,setSelectedId]=useState('');
  const [form,setForm]=useState<TargetDraft>({...emptyDraft});
  const [promoteId,setPromoteId]=useState('');
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState<MeetTargetStatus|'ALL'>('ALL');
  const [priorityFilter,setPriorityFilter]=useState<MeetTargetPriority|'ALL'>('ALL');
  const contacts=useMemo(()=>snapshot?getCrmContacts(snapshot):[],[snapshot]);
  const targets=useMemo(()=>meetTargets(contacts),[contacts]);
  const existingContacts=useMemo(()=>contacts.filter(c=>!isMeetTarget(c)),[contacts]);
  const filtered=useMemo(()=>targets.filter(c=>{
    const m=c.meetTarget!;
    if(statusFilter!=='ALL'&&m.status!==statusFilter)return false;
    if(priorityFilter!=='ALL'&&m.priority!==priorityFilter)return false;
    const q=query.trim().toLocaleLowerCase('ja');
    return !q||[c.name,c.organization,c.role,c.tags.join(' '),m.purpose,m.introductionVia,c.nextAction].join(' ').toLocaleLowerCase('ja').includes(q);
  }),[targets,query,statusFilter,priorityFilter]);
  const active=targets.filter(c=>c.meetTarget!.status!=='MET'&&c.meetTarget!.status!=='PAUSED').length;
  const scheduled=targets.filter(c=>c.meetTarget!.status==='SCHEDULED').length;
  const met=targets.filter(c=>c.meetTarget!.status==='MET').length;

  async function readBoard(preserveDraft=false){
    setLoading(true);setError(false);setMessage('保存済みの人物情報を読み込み中…');
    try{
      const res=await fetch('/api/dashboard/board?scene=crm',{credentials:'same-origin',headers:{Accept:'application/json'}});
      const json=await res.json();
      if(!res.ok||json.ok!==true||!json.data)throw new Error(String(res.status));
      const raw=json.data.snapshot&&typeof json.data.snapshot==='object'?json.data.snapshot:createCrmSnapshot();
      const next:CrmSnapshot={viewport:{x:0,y:0,zoom:1},...raw};
      validateCrmBoardSnapshot(next);
      if(!Number.isSafeInteger(json.data.revision)||json.data.revision<0)throw new Error('invalid_revision');
      setSnapshot(next);setRevision(json.data.revision);setMessage('Supabase同期済み');setError(false);
      if(!preserveDraft){setSelectedId('');setForm({...emptyDraft});}
    }catch(err){
      console.error('meet_target_read_failed',err instanceof Error?err.message:'unknown');
      setError(true);setMessage('人物データを読み込めません。登録・保存は停止しています。');
      setSnapshot(null);
    }finally{setLoading(false)}
  }
  useEffect(()=>{void readBoard();},[]);
  function select(contact:CrmContact){setSelectedId(contact.id);setForm(draftFromContact(contact));setMessage(contact.name+'を編集中');setError(false)}
  function newEntry(){setSelectedId('');setForm({...emptyDraft});setMessage('新しいMeet Targetを作成');setError(false)}
  function promote(){
    const found=existingContacts.find(c=>c.id===promoteId);
    if(!found)return;
    setSelectedId(found.id);setForm(draftFromContact(found));setPromoteId('');
    setMessage('既存の人物を選択しました。保存すると「会いたい」に追加されます。');
    setError(false);
  }
  const update=(key:keyof TargetDraft,value:string)=>setForm(old=>({...old,[key]:value}));
  async function save(e:FormEvent){
    e.preventDefault();if(!snapshot||loading||saving)return;
    const name=form.name.trim();
    if(!name){setError(true);setMessage('名前を入力してください。');return}
    if(!selectedId&&contacts.some(c=>c.name.toLocaleLowerCase('ja')===name.toLocaleLowerCase('ja'))){
      setError(true);setMessage('同名の人物がRelationship OSに登録されています。既存の人物から選ぶか、同一人物か確認してください。');return;
    }
    const old=contacts.find(c=>c.id===selectedId);
    const base=old||newMeetTarget(makeId());
    const contact=mergeMeetTarget(base,{
      ...form,name,tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10),
    });
    let updated:CrmSnapshot;
    try{
      validateCrmContact(contact);
      updated=upsertCrmContact(snapshot,contact);
    }catch(err){
      setError(true);setMessage('入力内容を確認してください。文字数・URL・日付の形式に問題があります。');return;
    }
    setSaving(true);setMessage('Supabaseへ保存中…');setError(false);
    try{
      const res=await fetch('/api/dashboard/board',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({sceneKey:'crm',snapshot:updated,expectedRevision:revision,actor:'human'}),
      });
      const json=await res.json();
      if(!res.ok||json.ok!==true){
        if(res.status===409){
          await readBoard(true);
          setError(true);setMessage(readError(409));return;
        }
        throw new Error(String(res.status));
      }
      if(!Number.isSafeInteger(json.data?.revision)||json.data.revision<=revision)throw new Error('invalid_save_revision');
      setSnapshot(updated);setRevision(json.data.revision);setSelectedId(contact.id);
      setMessage('保存しました。Relationship OSと同じ人物レコードを使っています。');setError(false);
    }catch(err){
      const code=Number(err instanceof Error?err.message:0);
      setError(true);setMessage(readError(code));
    }finally{setSaving(false)}
  }
  const mapTargets=filtered.slice(0,24);
  return <section className="meet-target-page" aria-label="会いたい人・Meet Target">
    <header className="meet-target-head">
      <div><p className="mt-kicker">ACE PEOPLE GRAPH · MEET TARGET</p><h1>まだ会っていない人にも、未来の接点を。</h1>
        <p>会いたい理由・優先度・紹介候補・次の行動を、既存Relationship OSへ保存。紹介経路は本人が確認するまでは「候補」です。</p></div>
      <a href="/dashboard/people">← People Graphへ</a>
    </header>
    <div className="mt-stats" aria-label="Meet Target集計">
      <div><span>登録済み</span><strong>{targets.length}</strong></div>
      <div><span>これから会いたい</span><strong>{active}</strong></div>
      <div><span>面会予定</span><strong>{scheduled}</strong></div>
      <div><span>面会済み</span><strong>{met}</strong></div>
    </div>
    <div className="mt-workspace">
      <div className="mt-main">
        <div className="mt-section-head"><h2>会いたい人のマップ</h2><span>オレンジ＝優先度S / 点線＝希望（面識・紹介は未確認）</span></div>
        <svg className="mt-map" viewBox="0 0 760 365" role="img" aria-label="会いたい人の希望マップ。点線は実際の人脈関係を示しません。">
          <circle cx="380" cy="175" r="40" fill="#ee7800" fillOpacity=".16" stroke="#ee7800" strokeWidth="1.5"/>
          <text x="380" y="170" fill="#ffffff" textAnchor="middle" fontSize="15" fontWeight="700">会いたい</text>
          <text x="380" y="190" fill="#ffd8b1" textAnchor="middle" fontSize="11">希望マップ</text>
          {mapTargets.map((c,i)=>{
            const angle=i/Math.max(1,mapTargets.length)*Math.PI*2-Math.PI/2;
            const radius=mapTargets.length<=6?125:mapTargets.length<=12?135+(i%2)*40:120+(i%3)*44;
            const x=380+Math.cos(angle)*radius*1.55,y=175+Math.sin(angle)*radius*.86;
            const priority=c.meetTarget?.priority;
            const color=priority==='S'?'#ee7800':priority==='A'?'#e1b266':priority==='B'?'#5eb4ae':'#8d99a9';
            return <g key={c.id}>
              <line x1="380" y1="175" x2={x} y2={y} stroke={color} strokeWidth="1.3" strokeDasharray="3 7" opacity=".52"/>
              <g role="button" tabIndex={0} aria-label={c.name+'を編集'} onClick={()=>select(c)}
                onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(c)}}}
                style={{cursor:'pointer'}} transform={'translate('+x+','+y+')'}>
                <circle r={selectedId===c.id?15:10} fill={color} stroke={selectedId===c.id?'#fff':'#13232f'} strokeWidth={selectedId===c.id?3:1.5}/>
                <text textAnchor="middle" y="28" fontSize="11" fill="#f1f5f9" paintOrder="stroke" stroke="#13212d" strokeWidth="3.5">{c.name.length>11?c.name.slice(0,10)+'…':c.name}</text>
              </g>
            </g>
          })}
          {mapTargets.length===0&&<text x="380" y="325" textAnchor="middle" fill="#9cabbc" fontSize="14">{loading?'読み込み中…':'まだ表示する会いたい人がいません'}</text>}
        </svg>
        <p className="mt-map-note">※希望の点線は「会いたい」ことを示すだけ。本人との実際の関係や紹介可能性を推測したものではありません。最大24人を表示。</p>
        <div className="mt-filters">
          <input aria-label="Meet Target検索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="名前・分野・会いたい理由で検索"/>
          <select aria-label="優先度で絞る" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value as MeetTargetPriority|'ALL')}>
            <option value="ALL">全優先度</option>{MEET_TARGET_PRIORITIES.map(p=><option value={p} key={p}>{MEET_TARGET_PRIORITY_LABELS[p]}</option>)}
          </select>
          <select aria-label="進捗で絞る" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as MeetTargetStatus|'ALL')}>
            <option value="ALL">全ステータス</option>{MEET_TARGET_STATUSES.map(st=><option value={st} key={st}>{MEET_TARGET_STATUS_LABELS[st]}</option>)}
          </select>
        </div>
        <div className="mt-list" aria-label="会いたい人一覧">
          {filtered.length===0?<p className="mt-empty">{loading?'読み込み中…':'条件に合うMeet Targetがいません。右側から新しく登録できるで。'}</p>:
            filtered.map(c=><button key={c.id} type="button" className={'mt-person-card'+(c.id===selectedId?' is-selected':'')} onClick={()=>select(c)}>
              <span className="mt-person-name"><strong>{c.name}</strong><small>{c.organization||c.role||'分野未登録'}</small></span>
              <span className="mt-person-tags"><b className={'mt-priority mt-priority-'+c.meetTarget!.priority}>{c.meetTarget!.priority}</b><em>{MEET_TARGET_STATUS_LABELS[c.meetTarget!.status]}</em></span>
              <span className="mt-person-purpose">{c.meetTarget!.purpose||'会いたい理由を記入'}</span>
              <span className="mt-person-action">{c.nextAction?'次：'+c.nextAction:'次のアクション未設定'}{c.nextAt?' · '+c.nextAt:''}</span>
            </button>)}
        </div>
      </div>
      <aside className="mt-editor">
        <div className="mt-editor-heading"><div><p className="mt-kicker">MEET TARGET EDITOR</p><h2>{selectedId?'会いたい人を編集':'新しく登録'}</h2></div>
          <button type="button" className="mt-secondary" onClick={newEntry}>＋ 新規</button></div>
        {existingContacts.length>0&&<div className="mt-reuse">
          <label htmlFor="mt-existing">Relationship OSにすでにいる人を使う</label>
          <div><select id="mt-existing" value={promoteId} onChange={e=>setPromoteId(e.target.value)}><option value="">既存人物を選択</option>{existingContacts.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>
            <button type="button" onClick={promote} disabled={!promoteId}>選ぶ</button></div>
        </div>}
        <form className="mt-form" onSubmit={save}>
          <label>名前・呼び名 *<input value={form.name} onChange={e=>update('name',e.target.value)} required maxLength={160} placeholder="例：いつか会いたい教育者"/></label>
          <div className="mt-form-two">
            <label>優先度<select value={form.priority} onChange={e=>update('priority',e.target.value)}>{MEET_TARGET_PRIORITIES.map(p=><option key={p} value={p}>{MEET_TARGET_PRIORITY_LABELS[p]}</option>)}</select></label>
            <label>進捗<select value={form.status} onChange={e=>update('status',e.target.value)}>{MEET_TARGET_STATUSES.map(st=><option key={st} value={st}>{MEET_TARGET_STATUS_LABELS[st]}</option>)}</select></label>
          </div>
          <div className="mt-form-two">
            <label>所属・団体<input value={form.organization} onChange={e=>update('organization',e.target.value)} maxLength={200} placeholder="組織・チーム"/></label>
            <label>分野・役割<input value={form.role} onChange={e=>update('role',e.target.value)} maxLength={160} placeholder="研究者・選手・経営者"/></label>
          </div>
          <label>なぜ会いたい？<textarea value={form.purpose} onChange={e=>update('purpose',e.target.value)} maxLength={600} rows={3} placeholder="この人との出会いで何を学び、何を実現したい？"/></label>
          <label>紹介してくれそうな人（未確認の候補）<input value={form.introductionVia} onChange={e=>update('introductionVia',e.target.value)} maxLength={200} placeholder="候補名・接点。確認済みとは限らない"/></label>
          <label>次にできる一手<textarea value={form.nextAction} onChange={e=>update('nextAction',e.target.value)} maxLength={600} rows={2} placeholder="例：公開イベントを探す・紹介の許可を確認"/></label>
          <div className="mt-form-two">
            <label>実行する日<input type="date" value={form.nextAt} onChange={e=>update('nextAt',e.target.value)}/></label>
            <label>カテゴリー（カンマ区切り）<input value={form.tags} onChange={e=>update('tags',e.target.value)} placeholder="教育, アスリート" maxLength={400}/></label>
          </div>
          <label>公開プロフィール・参考URL<input type="url" value={form.referenceUrl} onChange={e=>update('referenceUrl',e.target.value)} maxLength={1500} placeholder="https://"/></label>
          <div className="mt-form-actions">
            <button type="submit" className="mt-primary" disabled={!snapshot||loading||saving}>{saving?'保存中…':selectedId?'変更を保存':'Meet Targetを登録'}</button>
            <button type="button" className="mt-secondary" onClick={()=>void readBoard(true)} disabled={saving||loading}>再読込</button>
          </div>
        </form>
        <p className={'mt-message'+(error?' is-error':'')} role="status" aria-live="polite">{message}</p>
        <p className="mt-private-note">既存の認証付きRelationship OSへ保存。名前だけで他のSNSアカウントと自動的に同一人物とは判定しません。紹介先への自動連絡は行いません。</p>
        <a className="mt-related" href="/dashboard/relationships">Relationship OSで人物情報を確認 →</a>
      </aside>
    </div>
  </section>;
}
