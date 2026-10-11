import { useEffect, useState } from 'react';
import { homeDesignPresets, isHomeDesignPreset } from '../../data/homeDesignPresets';
import {
  DEFAULT_HOME_DESIGN, MASA_SELECTED_HOME_DESIGN, HOME_DESIGN_FAVORITES_KEY,
  homeComponentPresets, homeLayoutPresets, describeHomeDesign, isHomeDesignConfig, loadHomeDesign,
  resetHomeDesign, writeHomeDesign, type HomeDesignConfig,
} from '../../data/homeDesignCombinations';
import '../../styles/dashboard-design-studio.css';
import HomeDesignPreview from './HomeDesignPreview';

type Favorite = { id:string; name:string; config:HomeDesignConfig };
const maxFavorites = 12;
const layoutNames:Record<string,string> = {focus:'一つに集中',split:'行動と収益',journey:'流れから選ぶ',tiles:'すぐに届ける',editorial:'考えを編む',studio:'全体を見渡す'};
const styleNames:Record<string,string> = {dawn:'朝の余白',night:'夜の集中',ocean:'澄んだ流れ',glass:'軽やかな層',editorial:'紙とインク',quest:'前へ進む'};
const partNames:Record<string,Record<string,string>>={buttons:{sharp:'まっすぐ',soft:'やわらか',pill:'丸く'},cards:{outline:'輪郭で分ける',soft:'面でまとめる',float:'奥行きで分ける'},navigation:{tabs:'横に並べる',chips:'小さくまとめる',dock:'手元に集める'},cta:{solid:'はっきり',outline:'控えめに',minimal:'言葉と矢印'}};
const panels = [{id:'layout',name:'構成'},{id:'style',name:'見た目'},{id:'parts',name:'部品'}] as const;
type Panel = (typeof panels)[number]['id'];
const componentGroups = [
  { key:'buttons', label:'BUTTON', title:'ボタンの輪郭', hint:'タップの気持ちよさを選ぶ。' },
  { key:'cards', label:'CARD', title:'カードの情報整理', hint:'境界と奥行きのつけ方を選ぶ。' },
  { key:'navigation', label:'NAVBAR', title:'ホーム内のクイック導線', hint:'Tabs・Chips・Dockから選ぶ。' },
  { key:'cta', label:'CTA', title:'次の行動への導線', hint:'主張の強さを選ぶ。' },
] as const;

function readFavorites():Favorite[] {
  try {
    const raw = localStorage.getItem(HOME_DESIGN_FAVORITES_KEY);
    if (!raw) return [];
    const parsed:unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0,maxFavorites).filter((item):item is Favorite => !!item && typeof item==='object'
      && typeof item.id==='string' && item.id.length<60
      && typeof item.name==='string' && item.name.length<=48 && item.name.length>0
      && isHomeDesignConfig(item.config))
      .map(item=>({ id:item.id, name:item.name, config:item.config }));
  } catch { return []; }
}

export default function HomeDesignConfigurator() {
  const [panel,setPanel] = useState<Panel>('layout');
  const [frameSize,setFrameSize] = useState<'fit'|'phone'>('phone');
  const [previewChoice,setPreviewChoice] = useState<HomeDesignConfig>(DEFAULT_HOME_DESIGN);
  const [choice,setChoice] = useState<HomeDesignConfig>(DEFAULT_HOME_DESIGN);
  const [applied,setApplied] = useState<HomeDesignConfig|null>(null);
  const [favorites,setFavorites] = useState<Favorite[]>([]);
  const [favoriteName,setFavoriteName] = useState('');
  const [status,setStatus] = useState('スタイル・構成・部品を試して、気に入った組み合わせだけ適用しよう。');
  const [storageReady,setStorageReady] = useState(true);
  const [hydrated,setHydrated] = useState(false);

  useEffect(()=>{
    try {
      const existing = loadHomeDesign(localStorage);
      const saved = readFavorites();
      const queryStyle = new URLSearchParams(window.location.search).get('style');
      setApplied(existing);
      setChoice({
        ...(existing || DEFAULT_HOME_DESIGN),
        style:isHomeDesignPreset(queryStyle) ? queryStyle : (existing?.style ?? DEFAULT_HOME_DESIGN.style),
      });
      setFavorites(saved);
    } catch {
      setStorageReady(false);
      setStatus('このブラウザでは保存領域を利用できません。プレビューのみ可能です。');
    }
    setHydrated(true);
  },[]);

  function update<K extends keyof HomeDesignConfig>(key:K, value:HomeDesignConfig[K]) {
    setChoice(previous=>({ ...previous, [key]:value }));
    setStatus('選択内容をプレビュー中。適用するまでホームは変更されません。');
  }
  function apply() {
    if (!storageReady) return;
    try {
      writeHomeDesign(localStorage,choice);
      setApplied(choice);
      setStatus('ホームに適用しました。この端末で確認できます。');
    } catch {
      setStatus('保存できませんでした。ホームの表示設定は変更されていません。');
    }
  }
  function reset() {
    try {
      resetHomeDesign(localStorage);
      setApplied(null);
      setChoice(DEFAULT_HOME_DESIGN);
      setStatus('標準のDashboardに戻しました。これまでの保存デザイン案は残しています。');
    } catch {
      setStatus('設定を戻せませんでした。保存領域を確認してください。');
    }
  }
  function saveFavorite() {
    if (!storageReady) return;
    const name=favoriteName.trim().slice(0,48) || describeHomeDesign(choice);
    const next:Favorite[]=[{id:String(Date.now())+'-'+String(favorites.length),name,config:{...choice}},...favorites].slice(0,maxFavorites);
    try {
      localStorage.setItem(HOME_DESIGN_FAVORITES_KEY,JSON.stringify(next));
      setFavorites(next);
      setFavoriteName('');
      setStatus('「'+name+'」を保存しました。適用とは別なので、いつでも読み戻せます。');
    } catch { setStatus('デザイン案を保存できませんでした。'); }
  }
  function deleteFavorite(id:string) {
    const next=favorites.filter(item=>item.id!==id);
    try {
      localStorage.setItem(HOME_DESIGN_FAVORITES_KEY,JSON.stringify(next));
      setFavorites(next);
      setStatus('保存したデザイン案を削除しました。現在のホームには影響しません。');
    } catch { setStatus('デザイン案を削除できませんでした。'); }
  }

  useEffect(()=>{
    const timer=window.setTimeout(()=>setPreviewChoice(choice),150);
    return ()=>window.clearTimeout(timer);
  },[choice]);
  const previewUrl='/dashboard?design-preview='+encodeURIComponent(JSON.stringify(previewChoice));
  const selectionName=styleNames[choice.style]+' · '+layoutNames[choice.layout];

  return <div className="design-studio" id="home-design-studio">
    <header className="studio-header studio-header-v3">
      <div><p className="overline">DESIGN STUDIO</p><h1>自分の動きに、<br/><em>合う画面を。</em></h1></div>
      <p>まず配置を選ぶ。見た目と部品はあとから。<br/>画面を見ながら、しっくりくる形を探そう。</p>
    </header>
    <div className="studio-adopted"><div><span>選んだ組み合わせ</span><strong>夜の集中 × すぐに届ける</strong><small>やわらかい面・チップの導線・はっきりした一手</small></div><button type="button" onClick={()=>{setChoice({...MASA_SELECTED_HOME_DESIGN});setStatus('選んだ組み合わせを読み込みました。適用するまでホームは変わりません。');}}>この組み合わせを試す</button></div>
    <div className="studio-workbench">
      <div className="studio-picker" id="studio-choices">
        <div className="studio-tabs" role="tablist" aria-label="デザインを選ぶ順番">
          {panels.map((item,index)=><button type="button" key={item.id} id={'tab-'+item.id} role="tab" aria-selected={panel===item.id} aria-controls={'studio-'+item.id} tabIndex={panel===item.id?0:-1}
            onClick={()=>setPanel(item.id)} onKeyDown={event=>{
              const keys=['ArrowRight','ArrowLeft','Home','End']; if(!keys.includes(event.key))return;
              event.preventDefault();
              const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;
              setPanel(panels[next].id);document.getElementById('tab-'+panels[next].id)?.focus();
            }}><span>0{index+1}</span>{item.name}</button>)}
        </div>
        <section id="studio-layout" className="studio-panel" role="tabpanel" aria-labelledby="tab-layout" hidden={panel!=='layout'}>
          <div className="picker-heading"><h2>何から始めたい？</h2><p>最初に見るものと、次へ進む順番が変わります。</p></div>
          <div className="layout-grid">
            {homeLayoutPresets.map(preset=><button key={preset.id} type="button" className="layout-option" aria-pressed={choice.layout===preset.id} onClick={()=>update('layout',preset.id)}>
              <img src={`/assets/dashboard-layout-presets/${preset.id}.svg`} alt="" width={720} height={440}/>
              <span className="option-body"><span className="option-top"><strong>{layoutNames[preset.id]}</strong><b>{choice.layout===preset.id?'✓':'＋'}</b></span><small>{preset.description}</small></span>
            </button>)}
          </div>
        </section>
        <section id="studio-style" className="studio-panel" role="tabpanel" aria-labelledby="tab-style" hidden={panel!=='style'}>
          <div className="picker-heading"><h2>どんな空気で使いたい？</h2><p>選んだ配置を保ったまま、色と質感を比べます。</p></div>
          <div className="style-grid">
            {homeDesignPresets.map(preset=><button key={preset.id} type="button" className="style-option" aria-pressed={choice.style===preset.id} onClick={()=>update('style',preset.id)}>
              <span className="thumb"><img src={`/assets/dashboard-style-presets/${preset.id}.svg`} alt="" width={720} height={440}/></span>
              <span className="option-body"><span className="option-top"><strong>{styleNames[preset.id]}</strong><b>{choice.style===preset.id?'✓':'＋'}</b></span><small>{preset.subtitle}</small></span>
            </button>)}
          </div>
        </section>
        <section id="studio-parts" className="studio-panel" role="tabpanel" aria-labelledby="tab-parts" hidden={panel!=='parts'}>
          <div className="picker-heading"><h2>触り心地を整える。</h2><p>よく使う操作だけ、形と強さを選びます。</p></div>
          <div className="part-groups">
            {componentGroups.map(group=><section key={group.key} className="part-group" aria-label={group.title}>
              <div className="part-title"><h3>{group.title}</h3></div>
              <div className="part-grid">{homeComponentPresets[group.key].map(preset=><button key={preset.id} type="button" className="part-option" aria-pressed={choice[group.key]===preset.id} onClick={()=>update(group.key,preset.id)}>
                <span className={`part-specimen part-${group.key} part-${preset.id}`} aria-hidden="true">
                  {group.key==='cards'?<span className="sample-card"><i/><b/><em/></span>:group.key==='navigation'?<span className="sample-nav"><i>今日</i><i>残す</i><i>届ける</i></span>:<span className="sample-button">進める <i>→</i></span>}
                </span><span className="option-body"><strong>{partNames[group.key][preset.id]}</strong><small>{preset.description}</small><b>{choice[group.key]===preset.id?'✓ 選択中':'選ぶ'}</b></span>
              </button>)}</div>
            </section>)}
          </div>
        </section>
        <div className="picker-current"><span>いま選んでいる画面</span><strong>{selectionName}</strong><small>{JSON.stringify(applied)===JSON.stringify(choice)?'ホームに適用中':'プレビュー中 · ホームへは未適用'}</small></div>
      </div>
      <section className="studio-live" id="studio-preview" aria-labelledby="preview-title">
        <div className="live-toolbar"><div><span className="live-dot" aria-hidden="true"/><h2 id="preview-title">実際のホームで確認</h2></div>
          <div className="preview-size" role="group" aria-label="プレビューの画面幅"><button type="button" aria-pressed={frameSize==='phone'} onClick={()=>setFrameSize('phone')}>スマホ</button><button type="button" aria-pressed={frameSize==='fit'} onClick={()=>setFrameSize('fit')}>広く見る</button></div>
        </div>
        <div className="actual-preview" data-size={frameSize} data-style={choice.style} data-layout={choice.layout} data-buttons={choice.buttons} data-cards={choice.cards} data-navigation={choice.navigation} data-cta={choice.cta}>
          <div className="preview-viewport" role="region" aria-label="選んだ構成のホーム（閲覧用）" tabIndex={0}><HomeDesignPreview config={previewChoice}/></div>
        </div>
        <div className="preview-note"><span>ホームと同じ部品。中の画面は閲覧用です。</span><a href={previewUrl} target="_blank" rel="noreferrer">別画面で大きく見る ↗</a></div>
        <div className="studio-apply-bar"><div><strong>{selectionName}</strong><p>{applied?'適用中：'+styleNames[applied.style]+' · '+layoutNames[applied.layout]:'ホームは標準デザインです。'}</p></div>
          <button type="button" className="primary-action" onClick={apply} disabled={!storageReady||!hydrated}>この画面をホームに使う <span>→</span></button>
        </div>
        <div className="studio-secondary"><a href="/dashboard">ホームを開く ↗</a><button type="button" onClick={reset} disabled={!storageReady||!hydrated}>標準に戻す</button></div>
        <p className="studio-status" role="status" aria-live="polite">{status}</p>
      </section>
    </div>
    <nav className="studio-mobile-jumps" aria-label="選択と結果を行き来する">
      <a href="#studio-choices">構成を選ぶ ↓</a><a href="#studio-preview">選んだ画面を見る ↑</a>
    </nav>
    <details className="studio-saved" id="studio-favorites">
      <summary><span>気に入った組み合わせを残す</span><span>{favorites.length} / 12 <b aria-hidden="true">＋</b></span></summary>
      <div className="saved-content"><p>保存はこのブラウザだけ。ホームへの適用とは別です。</p>
        <div className="favorite-creator"><label htmlFor="design-favorite-name">案の名前</label><input id="design-favorite-name" type="text" maxLength={48} value={favoriteName} onChange={event=>setFavoriteName(event.target.value)} placeholder="例：朝に集中する画面"/>
          <button type="button" onClick={saveFavorite} disabled={!storageReady||!hydrated}>この組み合わせを保存</button></div>
        {favorites.length>0?<div className="favorite-list">{favorites.map(item=><article key={item.id} className="favorite-item"><div><strong>{item.name}</strong><small>{describeHomeDesign(item.config)}</small></div><div><button type="button" onClick={()=>{setChoice(item.config);setStatus('保存案を読み込みました。ホームへは未適用です。');document.getElementById('studio-preview')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}}>読み込む</button><button type="button" className="remove" onClick={()=>deleteFavorite(item.id)} aria-label={`${item.name}を削除`}>削除</button></div></article>)}</div>:<p className="empty-favorites">まだ保存した案はありません。</p>}
      </div>
    </details>
    <footer className="studio-foot"><a href="/dashboard/design-lab">好みの選択を続ける ↗</a><a href="/dashboard/visual-structures">図解の構成を選ぶ ↗</a><p>この段階ではホームの大きな区画と導線を比較します。各機能の細かな操作画面は、実際に使った感想をもとに次の段階で整えます。</p></footer>
  </div>;
}
