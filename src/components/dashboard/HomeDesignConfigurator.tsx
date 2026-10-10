import { useEffect, useState } from 'react';
import { homeDesignPresets, isHomeDesignPreset, HOME_PRESET_STORAGE_KEY } from '../../data/homeDesignPresets';
import {
  DEFAULT_HOME_DESIGN, HOME_DESIGN_FAVORITES_KEY,
  homeComponentPresets, homeLayoutPresets, describeHomeDesign, isHomeDesignConfig, loadHomeDesign,
  resetHomeDesign, writeHomeDesign, type HomeDesignConfig,
} from '../../data/homeDesignCombinations';
import '../../styles/dashboard-design-studio.css';

type Favorite = { id:string; name:string; config:HomeDesignConfig };
const maxFavorites = 12;
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
      localStorage.removeItem(HOME_PRESET_STORAGE_KEY);
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

  return <div className="design-studio" id="home-design-studio">
    <header className="studio-header">
      <p className="overline">MASA DESIGN INTELLIGENCE · DESIGN STUDIO</p>
      <h1>見て、選んで、<em>組み合わせる。</em></h1>
      <p>好きなスタイルだけでなく、情報の構成・配置とボタンなどのパーツを選べる。サムネイルをタップして比較し、よければホームへ適用。</p>
      <nav className="studio-jumps" aria-label="デザイン選択の各セクション">
        <a href="#studio-style">01 STYLE</a><a href="#studio-layout">02 LAYOUT</a><a href="#studio-parts">03 COMPONENTS</a><a href="#studio-preview">04 PREVIEW</a>
      </nav>
    </header>

    <section id="studio-style" className="studio-section" aria-labelledby="style-title">
      <div className="section-heading"><div><span className="overline">01 / STYLE</span><h2 id="style-title">色・空気感・質感</h2></div><p>元サイトの画像を転載せず、MASA向けのオリジナル見本から選ぶ。</p></div>
      <div className="style-grid">
        {homeDesignPresets.map(preset=><button key={preset.id} type="button" className="style-option"
            aria-pressed={choice.style===preset.id} onClick={()=>update('style',preset.id)}>
          <span className="thumb"><img src={`/assets/dashboard-style-presets/${preset.id}.svg`} alt={`${preset.name} デザインのサンプル`} width={720} height={440} loading="lazy"/></span>
          <span className="option-body"><span className="option-top"><strong>{preset.name}</strong><b>{choice.style===preset.id?'✓ 選択中':'選ぶ'}</b></span><small>{preset.subtitle}</small></span>
        </button>)}
      </div>
    </section>

    <section id="studio-layout" className="studio-section" aria-labelledby="layout-title">
      <div className="section-heading"><div><span className="overline">02 / LAYOUT</span><h2 id="layout-title">構成・配置・情報の順番</h2></div><p>ここは色違いではない。実際のホーム内の4つの大きなセクションを配置し直す。</p></div>
      <div className="layout-grid">
        {homeLayoutPresets.map(preset=><button key={preset.id} type="button" className="layout-option" aria-pressed={choice.layout===preset.id} onClick={()=>update('layout',preset.id)}>
          <img src={`/assets/dashboard-layout-presets/${preset.id}.svg`} alt={`${preset.name} の配置図`} width={720} height={440} loading="lazy"/>
          <span className="option-body"><span className="option-top"><strong>{preset.name}</strong><b>{choice.layout===preset.id?'✓ 選択中':'選ぶ'}</b></span><small>{preset.description}</small></span>
        </button>)}
      </div>
    </section>

    <section id="studio-parts" className="studio-section" aria-labelledby="parts-title">
      <div className="section-heading"><div><span className="overline">03 / COMPONENTS</span><h2 id="parts-title">ボタン・カード・ナビ・CTA</h2></div><p>パーツも独立に選択。4カテゴリー × 3種類。</p></div>
      <div className="part-groups">
        {componentGroups.map(group=><section key={group.key} className="part-group" aria-label={group.title}>
          <div className="part-title"><span>{group.label}</span><h3>{group.title}</h3><small>{group.hint}</small></div>
          <div className="part-grid">
            {homeComponentPresets[group.key].map(preset=><button key={preset.id} type="button" className="part-option"
              aria-pressed={choice[group.key]===preset.id}
              onClick={()=>update(group.key,preset.id)}>
              <span className={`part-specimen part-${group.key} part-${preset.id}`} aria-hidden="true">
                {group.key==='cards' ? <span className="sample-card"><i></i><b></b><em></em></span>
                  :group.key==='navigation' ? <span className="sample-nav"><i>Home</i><i>Quest</i><i>Flow</i></span>
                  :<span className="sample-button">次へ <i>→</i></span>}
              </span>
              <span className="option-body"><span className="option-top"><strong>{preset.name}</strong><b>{choice[group.key]===preset.id?'✓':'＋'}</b></span><small>{preset.description}</small></span>
            </button>)}
          </div>
        </section>)}
      </div>
    </section>

    <section id="studio-preview" className="studio-section" aria-labelledby="preview-title">
      <div className="section-heading"><div><span className="overline">04 / LIVE PREVIEW</span><h2 id="preview-title">組み合わせて確認</h2></div><p>見本データによるプレビュー。適用前に色・構成・パーツをまとめて比較。</p></div>
      <div className="preview-stage" data-style={choice.style} data-layout={choice.layout} data-buttons={choice.buttons} data-cards={choice.cards} data-navigation={choice.navigation} data-cta={choice.cta}>
        <header className="demo-header"><strong>MASA OS</strong><small>DESIGN PREVIEW</small></header>
        <nav className="demo-nav" aria-label="プレビュー専用ナビ"><span>Today</span><span>Capture</span><span>Output</span><span>Review</span></nav>
        <div className="demo-layout">
          <section className="demo-block demo-focus">
            <span className="demo-caption">FOCUS / TODAY</span><h3>今日の一歩を、自分で選ぶ。</h3>
            <p>判断を整理し、今必要なことに集中する。</p>
            <span className="demo-button">次の一手へ <span>→</span></span>
            <div className="demo-line-bars"><i/><i/><i/></div>
          </section>
          <section className="demo-block demo-offer"><span className="demo-caption">OFFER / REVENUE</span><h3>届ける価値を、形に。</h3><p>Offer → 決済 → 顧客化</p><div className="demo-line-bars"><i/><i/></div></section>
          <section className="demo-block demo-flow"><span className="demo-caption">FLOW / JOURNEY</span><h3>残す → 考える → 届ける</h3><p>学びを次の行動へつなぐ。</p></section>
          <section className="demo-block demo-output"><span className="demo-caption">OUTPUT / ACTION</span><h3>外へ流す。</h3><p>X · LINE · ACE</p><span className="demo-link">今のアウトプットを見る →</span></section>
        </div>
      </div>
      <div className="studio-actions">
        <div className="current-design">
          <span className="overline">CURRENT MIX</span>
          <h3>{describeHomeDesign(choice)}</h3>
          <p>ボタン：{choice.buttons} / カード：{choice.cards} / ナビ：{choice.navigation} / CTA：{choice.cta}</p>
          <p className="applied-note">{applied?'この端末に適用中：'+describeHomeDesign(applied):'現在は標準デザインを表示中。'}</p>
        </div>
        <div className="action-buttons">
          <button type="button" className="primary-action" onClick={apply} disabled={!storageReady || !hydrated}>この組み合わせをホームに適用</button>
          <a className="secondary-action" href="/dashboard">ホームを確認 ↗</a>
          <button type="button" className="secondary-action" onClick={reset} disabled={!storageReady || !hydrated}>標準デザインに戻す</button>
        </div>
      </div>
      <p className="studio-status" role="status" aria-live="polite">{status}</p>
    </section>

    <section className="studio-section" aria-labelledby="favorites-title">
      <div className="section-heading"><div><span className="overline">05 / SAVE FOR REUSE</span><h2 id="favorites-title">お気に入りの組み合わせ</h2></div><p>保存と適用は別。端末内に最大12案。あとで再選択できる。</p></div>
      <div className="favorite-creator">
        <label htmlFor="design-favorite-name">案の名前（任意）</label>
        <input id="design-favorite-name" type="text" maxLength={48} value={favoriteName} onChange={event=>setFavoriteName(event.target.value)} placeholder="例：ACEトップ用・静かな構成" />
        <button type="button" onClick={saveFavorite} disabled={!storageReady || !hydrated}>この組み合わせを保存</button>
      </div>
      {favorites.length>0 ? <div className="favorite-list">{favorites.map(item=><article key={item.id} className="favorite-item"><div><strong>{item.name}</strong><small>{describeHomeDesign(item.config)}</small></div><div><button type="button" onClick={()=>{setChoice(item.config);setStatus('保存案をプレビューに読み込みました。ホームには未適用です。');document.getElementById('studio-preview')?.scrollIntoView({behavior:'smooth',block:'start'});}}>読み込む</button><button type="button" className="remove" onClick={()=>deleteFavorite(item.id)} aria-label={`${item.name}を削除`}>削除</button></div></article>)}</div>
      : <p className="empty-favorites">まだ保存した案はありません。気に入った組み合わせを残しておけます。</p>}
    </section>

    <footer className="studio-foot">
      <a href="/dashboard/design-lab">25の好み選択（既存Design Lab） ↗</a>
      <a href="/dashboard/visual-structures">図解20型（Visual Structures） ↗</a>
      <p>このページは非公開Dashboard内。設定は今のブラウザだけに保存。現段階ではホームの大きな区画と表示パーツの変更で、他サービス・決済・データの内容は変更しません。</p>
    </footer>
  </div>;
}
