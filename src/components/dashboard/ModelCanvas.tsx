import { useState } from 'react';
import model from '../../data/modelCanvas.json';

type View = 'concept' | 'er' | 'screens';
const viewNames: Record<View, string> = {
  concept: '01 概念図', er: '02 ERモデル', screens: '03 画面'
};
const lanes = [
  {id:'private',label:'PRIVATE｜管理・思考'},
  {id:'experience',label:'EXPERIENCE｜学習体験'},
  {id:'public',label:'PUBLIC｜価値提供'}
] as const;
const byId = new Map(model.objects.map(object => [object.id, object]));
const byScreen = new Map(model.screens.map(screen => [screen.id, screen]));
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ja');

export default function ModelCanvas() {
  const [view, setView] = useState<View>('concept');
  const [selectedId, setSelectedId] = useState<string>('knowledge');
  const [query, setQuery] = useState('');
  const selected = byId.get(selectedId);
  const connections = model.relations.filter(rel => rel.from === selectedId || rel.to === selectedId);
  const neighborIds = new Set(connections.flatMap(rel => [rel.from, rel.to]));
  const affected = model.screens.filter(screen => screen.objects.includes(selectedId));
  const matchesObject = (object: (typeof model.objects)[number]) =>
    !query || normalize([object.id,object.label,object.jp,object.desc,object.source].join(' ')).includes(normalize(query));
  const matchesScreen = (screen: (typeof model.screens)[number]) =>
    !query || normalize([screen.label,screen.subtitle,...screen.objects.map(id=>byId.get(id)?.jp || id)].join(' ')).includes(normalize(query));
  const isDim = (id: string) => Boolean(selectedId && selectedId !== id && !neighborIds.has(id));
  const chooseScreen = (screenId: string) => {
    const screen = byScreen.get(screenId);
    if (!screen) return;
    setView('screens');
    if (!screen.objects.includes(selectedId)) setSelectedId(screen.objects[0]);
  };
  const clear = () => {setQuery('');setSelectedId('');};
  return (
    <main className="mc" aria-label="MASA Model Canvas">
      <header className="mc-hero">
        <div>
          <p className="mc-overline">MASA DESIGN LAB / STRUCTURAL LENS</p>
          <h1>構造が見えると、次の一手が見える。</h1>
          <p>同じモデルから「概念・関係」「ERの考え方」「関係する画面」を行き来する。</p>
          <p className="mc-status">設計モデル v{model.version} ・ 読み取り専用 ・ 実DBのスキーマではありません</p>
        </div>
        <nav className="mc-related" aria-label="関連ツール">
          <a href="/dashboard/graph">Brain Graph ↗</a>
          <a href="/dashboard/design-lab">Design Lab ↗</a>
          <a href="/dashboard/apps">App Library ↗</a>
        </nav>
      </header>
      <div className="mc-toolbar">
        <div className="mc-tabs" role="tablist" aria-label="モデルの表示形式">
          {(Object.keys(viewNames) as View[]).map(key => (
            <button type="button" role="tab" id={'mc-tab-' + key} aria-controls="mc-stage"
              aria-selected={view === key} className={'mc-tab' + (view === key ? ' is-active' : '')}
              key={key} onClick={() => setView(key)}>{viewNames[key]}</button>
          ))}
        </div>
        <label className="mc-search">
          <span className="mc-sr">オブジェクト・画面を検索</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="オブジェクト・画面を検索" />
        </label>
        <button type="button" className="mc-clear" onClick={clear}>選択解除</button>
      </div>
      <div className="mc-workspace">
        <section className="mc-stage" id="mc-stage" role="tabpanel" aria-labelledby={'mc-tab-' + view}>
          {view === 'concept' && <>
            <div className="mc-stage-head"><h2>概念と関係の地図</h2><span>{model.objects.length} Objects</span></div>
            <p className="mc-note">1つ選ぶと関連オブジェクト・影響画面が右側に現れる。</p>
            <div className="mc-group-grid">
              {model.groups.map(group => <div className="mc-group" key={group.id}>
                <h3><i style={{backgroundColor:group.color}} />{group.label}</h3>
                {model.objects.filter(object => object.group === group.id && matchesObject(object)).map(object => (
                  <button type="button" key={object.id} aria-pressed={selectedId === object.id}
                    className={'mc-object' + (selectedId === object.id?' is-selected':'') + (isDim(object.id)?' is-dim':'')}
                    onClick={() => setSelectedId(object.id)}>
                    <strong>{object.label}</strong><small>{object.jp}</small>
                  </button>
                ))}
                {!model.objects.some(object => object.group === group.id && matchesObject(object)) && <small>該当なし</small>}
              </div>)}
            </div>
            <div className="mc-relations">
              <h3>関係の流れ <small>{selected ? selected.jp + ' の接続' : '全関係'}</small></h3>
              <div className="mc-relation-list">
                {(selected ? connections : model.relations).map((rel,index) => (
                  <button type="button" key={index} className="mc-relation"
                    onClick={() => setSelectedId(rel.to)}>
                    {byId.get(rel.from)?.jp} <span>→ {rel.label} →</span> {byId.get(rel.to)?.jp}
                  </button>
                ))}
              </div>
            </div>
          </>}
          {view === 'er' && <>
            <div className="mc-stage-head"><h2>ERモデル（概念属性）</h2><span>Schema Candidate</span></div>
            <p className="mc-note mc-warn">ここにある項目は概念上の属性候補。実テーブル名・主キー・外部キー・RLSの確認結果ではありません。</p>
            <div className="mc-er-grid">
              {model.objects.filter(matchesObject).map(object => (
                <button type="button" key={object.id} aria-pressed={selectedId === object.id}
                  className={'mc-er-card' + (selectedId === object.id?' is-selected':'') + (isDim(object.id)?' is-dim':'')}
                  onClick={() => setSelectedId(object.id)}>
                  <strong>{object.label}<small>{object.jp}</small></strong>
                  <ul>{object.attributes.map(attr => <li key={attr}>{attr}</li>)}</ul>
                </button>
              ))}
            </div>
          </>}
          {view === 'screens' && <>
            <div className="mc-stage-head"><h2>画面とオブジェクトの対応</h2><span>{model.screens.length} Surfaces</span></div>
            <p className="mc-note">画面のURLが確認できたものと、将来の構想を分けて表示。対応関係は設計モデルであり、実装上の依存関係の検証ではない。</p>
            <div className="mc-screen-grid">
              {lanes.map(lane => <div className="mc-screen-lane" key={lane.id}>
                <h3>{lane.label}</h3>
                {model.screens.filter(screen => screen.lane === lane.id && matchesScreen(screen)).map(screen => (
                  <article className={'mc-screen-card' + (selectedId && !screen.objects.includes(selectedId) ? ' is-dim' : '')}
                    key={screen.id}>
                    <button type="button" onClick={() => chooseScreen(screen.id)}>
                      <strong>{screen.label}</strong>
                      <small>{screen.implementation === 'verified' ? '画面の経路を確認済み' : '設計段階・画面未確認'}</small>
                      <span>{screen.subtitle}</span>
                    </button>
                    <div className="mc-chips">{screen.objects.map(id => <button type="button" key={id} onClick={() => setSelectedId(id)} className={id===selectedId?'is-selected':''}>{byId.get(id)?.jp}</button>)}</div>
                    {screen.href && <a href={screen.href}>実際の画面を開く ↗</a>}
                  </article>
                ))}
                {!model.screens.some(screen => screen.lane === lane.id && matchesScreen(screen)) && <small>該当なし</small>}
              </div>)}
            </div>
          </>}
          <p className="mc-disclaimer">Drive＝思想・判断の正本 / GitHub＝コードの正本 / Supabase＝状態・派生関係 / Dashboard＝操作面。モデルの変更によって実DB・実画面・決済が自動変更されることはありません。</p>
        </section>
        <aside className="mc-inspector" aria-label="選択中のオブジェクト">
          {selected ? <>
            <p className="mc-overline">SELECTED OBJECT</p>
            <h2>{selected.label}</h2><p className="mc-jp">{selected.jp}</p>
            <p>{selected.desc}</p>
            <h3>出典・正本候補</h3><p className="mc-source">{selected.source}</p>
            <h3>つながり · {connections.length}</h3>
            <div className="mc-inspector-links">{connections.map((rel,index) => {
              const other = rel.from === selectedId ? rel.to : rel.from;
              return <button type="button" key={index} onClick={() => setSelectedId(other)}>
                {rel.from === selectedId ? '→' : '←'} {byId.get(other)?.jp} <small>{rel.label}</small>
              </button>;
            })}</div>
            <h3>関連する画面 · {affected.length}</h3>
            <div className="mc-inspector-links">{affected.map(screen => (
              <button key={screen.id} type="button" onClick={() => chooseScreen(screen.id)}>↗ {screen.label} <small>{screen.implementation==='verified'?'経路を確認':'構想'}</small></button>
            ))}</div>
            <p className="mc-check">変更前チェック：正本 → 実DB / 実装照合 → 関連画面 → 権限と影響 → Human Gate</p>
          </> : <>
            <p className="mc-overline">RELATION INSPECTOR</p><h2>対象を選択</h2>
            <p>オブジェクトを選ぶと、接続する概念と影響する画面を表示。</p>
          </>}
        </aside>
      </div>
      <footer className="mc-summary">
        <span>{model.objects.length} オブジェクト</span><span>{model.relations.length} 関係</span><span>{model.screens.length} 画面</span><span>選択: {selected?.jp || 'なし'}</span><span>設計図 / Read-only</span>
      </footer>
    </main>
  );
}
