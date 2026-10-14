import { dashboardDesignReferences, type DashboardReferenceId, type DashboardReferenceState } from '../../data/dashboardDesignReferences';
import '../../styles/dashboard-design-references.css';

type Props={state:DashboardReferenceState; ready:boolean; canSave:boolean; onPreview:(id:DashboardReferenceId)=>void; onSave:(state:DashboardReferenceState)=>void};
export default function DashboardDesignReferenceGallery({state,ready,canSave,onPreview,onSave}:Props) {
  return <div className="reference-gallery">
    <div className="reference-intro"><div><h2>5つの参考から、しっくりくる画面へ。</h2><p>気になる案を試す。選ぶのは、あとでいい。</p></div><span className="reference-brand"><i aria-hidden="true"/>#EE7800</span></div>
    <div className="reference-grid">{dashboardDesignReferences.map((item,index)=>{
      const saved=state.favorites.includes(item.id), active=state.previewId===item.id;
      return <article key={item.id} className="reference-card" data-reference={item.id} data-selected={active}>
        <div className="reference-card-head"><span>0{index+1} · {item.tag}</span><button type="button" className="reference-star" aria-label={`${item.name}を${saved?'お気に入りから外す':'お気に入りに残す'}`} aria-pressed={saved} disabled={!ready||!canSave}
          onClick={()=>onSave({...state,favorites:saved?state.favorites.filter(id=>id!==item.id):[...state.favorites,item.id]})}>{saved?'★':'☆'}</button></div>
        <div className="reference-copy"><p className="reference-source">{item.name}</p><h3>{item.title}</h3><p>{item.summary}</p></div>
        <div className="reference-actions"><button type="button" className="reference-try" aria-pressed={active} disabled={!ready} onClick={()=>onPreview(item.id)}>{active?'もう一度プレビュー':'この案を試す'} <span aria-hidden="true">→</span></button><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.name}の参考デモを新しいタブで開く`}>参考デモ ↗</a></div>
        <button type="button" className="reference-thumbnail" onClick={()=>onPreview(item.id)} disabled={!ready} aria-label={`${item.name}のMASA案をプレビュー`}><img src={`/assets/dashboard-reference-presets/${item.id}.svg`} alt="" width={720} height={440}/></button>
        <details className="reference-details"><summary>採用したい要素・メモ</summary><dl><div><dt>構造</dt><dd>{item.structure}</dd></div><div><dt>配色</dt><dd>白と濃色文字。オレンジは主要操作に。</dd></div><div><dt>余白</dt><dd>{item.spacing}</dd></div><div><dt>導線</dt><dd>{item.navigation}</dd></div><div><dt>スマホ</dt><dd>{item.mobile}</dd></div></dl>
          <label htmlFor={`reference-note-${item.id}`}>あとで選ぶためのメモ</label><textarea id={`reference-note-${item.id}`} rows={3} maxLength={600} value={state.notes[item.id]||''} disabled={!ready||!canSave} placeholder="好きなところ、変えたいところ…" onChange={event=>onSave({...state,notes:{...state.notes,[item.id]:event.target.value}})}/>
        </details>
      </article>;
    })}</div>
    <p className="reference-footnote">5案と参考URLはいつでもここに。お気に入り・メモはこのブラウザに保存し、「共有保存」で別の端末へ引き継げます。ホームへの適用は端末ごとに選べます。プレビューは参考の構造をMASA向けに組み直したものです。</p>
  </div>;
}
