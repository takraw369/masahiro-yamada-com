import { useEffect, useState } from 'react';
import { dashboardDesignReferences } from '../../data/dashboardDesignReferences';
import { describeHomeDesign } from '../../data/homeDesignCombinations';
import { parseDesignSnapshot, parseSharedDesign, type DashboardDesignSnapshot, type SharedDesign } from '../../data/dashboardDesignSnapshot';
import '../../styles/dashboard-design-handoff.css';

type Props={snapshot:DashboardDesignSnapshot;ready:boolean;canImport:boolean;hasBackup:boolean;
  onImport:(snapshot:DashboardDesignSnapshot)=>boolean;onRestore:()=>boolean};
export default function DashboardDesignHandoff({snapshot,ready,canImport,hasBackup,onImport,onRestore}:Props){
  const [shared,setShared]=useState<SharedDesign|null>(null);
  const [busy,setBusy]=useState(false);
  const [conflict,setConflict]=useState(false);
  const [message,setMessage]=useState('共有の保存状況を確認しています。');

  async function request(method:'GET'|'POST',signal?:AbortSignal){
    const response=await fetch('/api/dashboard/design-state',{method,credentials:'same-origin',signal,
      ...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot,revision:shared?.revision})}:{}),});
    if(response.status===409){setConflict(true);throw new Error('conflict');}
    if(response.status===401)throw new Error('login');
    if(!response.ok)throw new Error('unavailable');
    const data=await response.json(),next=parseSharedDesign(data);
    if(!data.ok || !next)throw new Error('unavailable');
    return next;
  }
  function report(error:unknown){
    setMessage(error instanceof Error && error.message==='conflict'
      ?'別の端末で更新されています。「最新を確認」で内容を確認してから保存してください。'
      :error instanceof Error && error.message==='login'
      ?'ログインが切れています。再ログインしてから共有してください。この端末の案は残っています。'
      :'共有に接続できません。この端末の案は残っています。接続後にもう一度お試しください。');
  }
  useEffect(()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    setBusy(true);
    request('GET',controller.signal).then(next=>{
      setShared(next);setMessage(next.snapshot?'共有案があります。内容を確認して読み込めます。':'まだ共有案はありません。この端末の案を共有保存できます。');
    }).catch(error=>{if(!controller.signal.aborted)report(error);else setMessage('共有を確認できませんでした。「最新を確認」で再接続できます。');})
      .finally(()=>{clearTimeout(timer);setBusy(false);});
    return()=>{clearTimeout(timer);controller.abort();};
  },[]);
  async function transfer(method:'GET'|'POST'){
    if(busy || (method==='POST' && (!shared || conflict)))return;
    setBusy(true);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const next=await request(method,controller.signal);setShared(next);setConflict(false);
      setMessage(method==='POST'?'共有保存しました。別の端末でこのページを開いて読み込めます。':next.snapshot?'最新の共有案を取得しました。読み込むまでこの端末の案は変わりません。':'共有案はまだありません。');
    }catch(error){report(error);}finally{clearTimeout(timer);setBusy(false);}
  }
  const same=!!shared?.snapshot && JSON.stringify(shared.snapshot)===JSON.stringify(parseDesignSnapshot(snapshot));
  return <details className="design-handoff">
    <summary><span>別の端末へ引き継ぐ</span><small>{busy?'確認中':conflict?'別端末の更新あり':same?'共有保存済み':shared?.snapshot?'共有案と違いあり':'共有保存'}</small></summary>
    <div className="handoff-content">
      <p>お気に入り・メモ・保存した組み合わせ・プレビューを引き継ぎます。ホームへの適用は各端末で選べます。</p>
      <div className="handoff-actions"><button type="button" className="handoff-save" disabled={!ready||busy||!shared||conflict} onClick={()=>transfer('POST')}>この端末の案を共有保存</button><button type="button" disabled={!ready||busy} onClick={()=>transfer('GET')}>最新を確認</button></div>
      <p className="handoff-status" role="status" aria-live="polite">{message}</p>
      {shared?.snapshot && <section className="handoff-shared" aria-label="共有の内容">
        <h3>共有の内容</h3><p>{describeHomeDesign(shared.snapshot.draft)}</p>
        <dl><div><dt>お気に入り</dt><dd>{shared.snapshot.references.favorites.map(id=>dashboardDesignReferences.find(item=>item.id===id)?.name).join('・')||'なし'}</dd></div>
          <div><dt>保存した組み合わせ</dt><dd>{shared.snapshot.favorites.map(item=>item.name).join('・')||'なし'}</dd></div></dl>
        {dashboardDesignReferences.filter(item=>shared.snapshot!.references.notes[item.id]).map(item=><p className="handoff-note" key={item.id}><strong>{item.name}</strong>{shared.snapshot!.references.notes[item.id]}</p>)}
        {shared.updatedAt && <small>更新：{new Date(shared.updatedAt).toLocaleString('ja-JP')}</small>}
        <p>読み込み前に、この端末の案を控えます。読み込んだだけではホームは変わりません。</p>
        <button type="button" disabled={!ready||busy||!canImport} onClick={()=>{if(shared.snapshot)setMessage(onImport(shared.snapshot)?'共有案を読み込みました。ホームへの適用はプレビューから選べます。':'読み込めませんでした。この端末の保存領域を確認してください。');}}>この内容を読み込む</button>
      </section>}
      {hasBackup && <button type="button" disabled={!ready||busy||!canImport} onClick={()=>{setMessage(onRestore()?'読み込み前の案に戻しました。ホームの表示は変わりません。':'控えた案を読み込めませんでした。保存領域を確認してください。');}}>読み込み前の案に戻す</button>}
    </div>
  </details>;
}
