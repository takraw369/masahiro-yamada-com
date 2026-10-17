import { useMemo, useState } from 'react';
import { makeMotionRequest, motionCategories, motionPresets, type MotionPreset, type MotionUse } from '../../data/motionPresetCatalog';

const targets = [
  { value: '/dashboard (MASA Dashboard)', label: 'MASA Dashboard' },
  { value: '/otsu4 (乙4学習アプリ)', label: '乙4学習アプリ' },
  { value: '/dashboard/note-harness (発信・出版)', label: '発信・出版' },
  { value: '/dashboard/visual-structures (教材・図解)', label: '教材・図解' },
  { value: 'その他（希望欄に画面を記入）', label: 'その他の画面' },
];
function Sample({ motion, replay }: { motion: MotionPreset; replay: number }) {
  return (
    <div className="mp-stage" aria-hidden="true">
      <div
        className="mp-sample"
        data-effect={motion.id}
        key={motion.id + '-' + replay}
        style={{ animationDuration: motion.duration + 'ms', animationTimingFunction: motion.easing }}
      >
        {motion.id === 'progress' ?
          <div className="mp-progress"><div className="mp-progress-fill" /></div> :
          <div className="mp-token">
            <strong>{motion.id === 'success' ? '✓' : motion.id === 'step' ? '02' : 'FLOW'}</strong>
            <small>{motion.id === 'success' ? '完了' : motion.id === 'step' ? '次へ' : 'MASA'}</small>
          </div>}
      </div>
    </div>
  );
}

export default function MotionPicker() {
  const [category, setCategory] = useState<MotionUse | 'all'>('all');
  const [selectedId, setSelectedId] = useState(motionPresets[0].id);
  const [replays, setReplays] = useState<Record<string, number>>({});
  const [target, setTarget] = useState(targets[0].value);
  const [note, setNote] = useState('');
  const [request, setRequest] = useState('');
  const [status, setStatus] = useState('');
  const selected = motionPresets.find(m => m.id === selectedId) || motionPresets[0];
  const visible = useMemo(() => motionPresets.filter(m => category === 'all' || m.category === category), [category]);
  const replay = (id: string) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStatus('端末の「動きを減らす」設定により、動きの再生は抑制しています。');
      return;
    }
    setReplays(current => ({ ...current, [id]: (current[id] || 0) + 1 }));
  };
  const choose = (motion: MotionPreset) => {
    setSelectedId(motion.id);
    setRequest('');
    setStatus('選択しました。適用先を指定して依頼文を作成できます。');
    replay(motion.id);
  };
  const generate = () => {
    setRequest(makeMotionRequest(selected, target, note));
    setStatus('依頼文を作成しました。コピーしてCodexへ渡してください。');
  };
  const copy = async () => {
    if (!request) {
      setStatus('先に「依頼文をつくる」を押してください。');
      return;
    }
    try {
      await navigator.clipboard.writeText(request);
      setStatus('依頼文をコピーしました。');
    } catch {
      const field = document.getElementById('mp-request') as HTMLTextAreaElement | null;
      field?.focus(); field?.select();
      setStatus('自動コピーできませんでした。選択中の文面を手動でコピーしてください。');
    }
  };

  return (
    <main className="mp-shell">
      <header className="mp-header">
        <div>
          <p className="mp-kicker">DESIGN STUDIO / MOTION</p>
          <h1>動きを選んで、<em>AIに頼む。</em></h1>
          <p>動きの意味から選び、既存画面に適用する依頼文まで作る。独自の12パターンからスタート。</p>
        </div>
        <nav aria-label="関連ページ">
          <a href="/dashboard/design-templates">← Design Studio</a>
          <a href="https://motion-reference.takayustudio.jp/" target="_blank" rel="noopener noreferrer">参考辞典 ↗</a>
        </nav>
      </header>
      <div className="mp-flow" aria-label="利用手順">
        <span>01 動きを試す</span><span>02 適用先を選ぶ</span><span>03 AIへ依頼</span><span>04 Previewで判断</span>
      </div>
      <div className="mp-workspace">
        <section className="mp-picker" aria-label="モーション一覧">
          <div className="mp-section-head"><div><p className="mp-kicker">01 / CHOOSE</p><h2>動きを見て選ぶ</h2></div><small>{visible.length} patterns</small></div>
          <div className="mp-filters" role="group" aria-label="用途で絞り込む">
            {motionCategories.map(item =>
              <button key={item.id} type="button" className={category === item.id ? 'active' : ''} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
          </div>
          <div className="mp-cards">
            {visible.map(motion =>
              <article key={motion.id} className={'mp-card' + (selectedId === motion.id ? ' selected' : '')}>
                <div className="mp-card-meta"><span>{motion.category.toUpperCase()}</span><span>{motion.duration}ms</span></div>
                <Sample motion={motion} replay={replays[motion.id] || 0} />
                <h3>{motion.label}</h3><p>{motion.purpose}</p><p className="mp-hint">{motion.guidance}</p>
                <div className="mp-card-actions">
                  <button type="button" aria-label={motion.label + 'を再生'} onClick={() => replay(motion.id)}>再生 ↻</button>
                  <button type="button" aria-pressed={selectedId === motion.id} onClick={() => choose(motion)}>{selectedId === motion.id ? '選択中' : 'この動きを選ぶ'}</button>
                </div>
              </article>)}
          </div>
        </section>
        <aside className="mp-request" aria-labelledby="mp-request-title">
          <div className="mp-request-inner">
            <p className="mp-kicker">02 / REQUEST</p><h2 id="mp-request-title">AIに実装を頼む</h2>
            <p className="mp-current">選択中：<strong>{selected.label}</strong></p>
            <label htmlFor="mp-target">適用先</label>
            <select id="mp-target" value={target} onChange={event => {setTarget(event.target.value);setRequest('');}}>
              {targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label htmlFor="mp-note">どこに・どう使いたい？ <small>任意</small></label>
            <textarea id="mp-note" rows={3} value={note} onChange={event => {setNote(event.target.value);setRequest('');}} placeholder="例：乙4で正解した瞬間、静かに完了を表示" />
            <button type="button" className="mp-primary" onClick={generate}>依頼文をつくる →</button>
            <label htmlFor="mp-request">完成した依頼文</label>
            <textarea id="mp-request" readOnly rows={9} value={request} aria-label="生成した実装依頼文" />
            <div className="mp-request-actions"><button type="button" onClick={copy}>依頼文をコピー</button><a href="/dashboard/codex">Codex画面へ ↗</a></div>
            <p className="mp-status" role="status" aria-live="polite">{status}</p>
            <p className="mp-foot">現段階は依頼文を作成・コピーする機能です。自動送信や本番画面の変更はせず、既存のPreviewとHuman Gateを通して適用します。</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
