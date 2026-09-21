import { useEffect, useMemo, useState } from 'react';
import { STARTER_RECIPES, type StarterRecipe } from '../../lib/line-flow-recipes';

type AudienceId = 'new' | 'discover' | 'quest' | 'learn' | 'support' | 'return';
type ConceptId = 'nature' | 'quest' | 'minimal';
type RecipeId = StarterRecipe['id'];

type Audience = {
  id: AudienceId;
  code: string;
  label: string;
  state: string;
  menuGoal: string;
  recipeId: RecipeId;
  next: string;
  rule: string;
};

type Concept = {
  id: ConceptId;
  code: string;
  name: string;
  mood: string;
  hero: string;
  sub: string;
  note: string;
};

type AssignmentDraft = {
  conceptId: ConceptId;
  recipeId: RecipeId;
  selected: boolean;
};

type AssignmentMap = Record<AudienceId, AssignmentDraft>;

type RouteItem = { icon: string; title: string; sub: string };

const AUDIENCES: Audience[] = [
  { id: 'new', code: 'NEW', label: '新規登録', state: 'まだ世界観も自分の現在地も分からない', menuGoal: '安心 + 最初の小さな発見', recipeId: 'welcome', next: 'DISCOVER', rule: 'friend_add → 診断・Quest未完了' },
  { id: 'discover', code: 'DISCOVER', label: '診断・発見中', state: 'Flow Checkや自己理解に触れている', menuGoal: '現在地 → 小さな実験', recipeId: 'diagnosis', next: 'QUEST / LEARN', rule: 'Flow Check / diagnosis event' },
  { id: 'quest', code: 'QUEST', label: 'Quest中', state: '実践中。継続・再開しやすさが必要', menuGoal: '今日の一歩 + 記録 + 戻りやすさ', recipeId: 'quest-soft-return', next: 'REFLECTION', rule: 'quest_start → complete前 / restart候補' },
  { id: 'learn', code: 'LEARN', label: '学び中', state: 'TIPS・知識・体験を深めている', menuGoal: '理解を実践へ接続', recipeId: 'education', next: 'QUEST / SUPPORT', rule: 'education / content engagement' },
  { id: 'support', code: 'SUPPORT', label: '相談・伴走', state: '一人では整理しにくい / 話したい', menuGoal: '相談 + 次の選択肢', recipeId: 'offer-soft', next: 'SESSION / COMMUNITY', rule: 'consult request / operator assignment' },
  { id: 'return', code: 'RETURN', label: '休眠・再接続', state: 'しばらく反応がない / 距離を置いている', menuGoal: '追わない + 軽い再入口', recipeId: 'reactivate', next: 'NEW / DISCOVER', rule: 'meaningful actionなし 7日+ / manual' },
];

const CONCEPTS: Concept[] = [
  { id: 'nature', code: 'A', name: 'Nature / Flow', mood: '自然・光・水・余白', hero: 'まだ知らない自分へ。', sub: '自然とつながり、自分がめぐる。', note: 'SLFの母体。朝の光、水、緑、道。安心と好奇心を同時につくる。' },
  { id: 'quest', code: 'B', name: 'Quest / Adventure', mood: '地図・旅・小さな冒険', hero: '次の一歩を、見つける。', sub: '人生は、最高の冒険だ。', note: 'Questフェーズ向け。現在地、道、旗、分岐で「進みたくなる」をつくる。' },
  { id: 'minimal', code: 'C', name: 'Minimal / Future Education', mood: '洗練・知性・静かな未来', hero: 'シンプルに、深く、生きていく。', sub: '知る・整える・つながる・広げる。', note: '学習フェーズ向け。情報を読みやすく、教育OSとしての信頼感を上げる。' },
];

const ROUTES: Record<AudienceId, RouteItem[]> = {
  new: [
    { icon: '⌖', title: '自分を知る', sub: 'DISCOVERY' }, { icon: '⚑', title: 'QUEST', sub: 'PLAY' }, { icon: '◫', title: 'ACE TIPS', sub: 'LEARN' },
    { icon: '◎', title: 'つながる', sub: 'COMMUNITY' }, { icon: '◌', title: 'MASAに相談', sub: 'TALK' }, { icon: '→', title: 'START', sub: 'NEXT STEP' },
  ],
  discover: [
    { icon: '⌖', title: 'MY RESULT', sub: 'RESULT' }, { icon: '⚑', title: '小さな実験', sub: 'TRY' }, { icon: '◫', title: '学ぶ', sub: 'LEARN' },
    { icon: '◎', title: '共有する', sub: 'CONNECT' }, { icon: '◌', title: '相談', sub: 'TALK' }, { icon: '→', title: '次へ', sub: 'NEXT' },
  ],
  quest: [
    { icon: '⚑', title: '今日のQuest', sub: 'TODAY' }, { icon: '✎', title: '記録する', sub: 'LOG' }, { icon: '↺', title: 'やさしく再開', sub: 'RETURN' },
    { icon: '◫', title: 'ヒント', sub: 'TIPS' }, { icon: '◌', title: '困ったら相談', sub: 'TALK' }, { icon: '→', title: '次のQuest', sub: 'NEXT' },
  ],
  learn: [
    { icon: '◫', title: '今日のTIPS', sub: 'LEARN' }, { icon: '⚑', title: '試してみる', sub: 'TRY' }, { icon: '⌖', title: '自分に戻す', sub: 'REFLECT' },
    { icon: '◎', title: 'つながる', sub: 'CONNECT' }, { icon: '◌', title: '話して整理', sub: 'TALK' }, { icon: '→', title: '次のテーマ', sub: 'NEXT' },
  ],
  support: [
    { icon: '◌', title: 'MASAに相談', sub: 'TALK' }, { icon: '⌖', title: '現在地を見る', sub: 'NOW' }, { icon: '⚑', title: '次の入口', sub: 'NEXT' },
    { icon: '◎', title: '仲間を見る', sub: 'CONNECT' }, { icon: '◫', title: '参考を見る', sub: 'LEARN' }, { icon: '○', title: 'いったん休む', sub: 'PAUSE' },
  ],
  return: [
    { icon: '⌖', title: '今の自分を見る', sub: 'NOW' }, { icon: '↺', title: '1分だけ再開', sub: 'RESTART' }, { icon: '◫', title: '軽く読む', sub: 'LIGHT' },
    { icon: '◎', title: '近況を見る', sub: 'CONNECT' }, { icon: '◌', title: '必要なら話す', sub: 'TALK' }, { icon: '→', title: 'また始める', sub: 'NEXT' },
  ],
};

const ASSIGNMENT_STORAGE_KEY = 'masa:line-experience:assignments:v2';

function buildRecommendedAssignments(selected = false): AssignmentMap {
  return AUDIENCES.reduce((result, audience) => {
    result[audience.id] = {
      conceptId: audience.id === 'quest' ? 'quest' : audience.id === 'learn' ? 'minimal' : 'nature',
      recipeId: audience.recipeId,
      selected,
    };
    return result;
  }, {} as AssignmentMap);
}

function isConceptId(value: unknown): value is ConceptId {
  return typeof value === 'string' && CONCEPTS.some((concept) => concept.id === value);
}

function isRecipeId(value: unknown): value is RecipeId {
  return typeof value === 'string' && STARTER_RECIPES.some((recipe) => recipe.id === value);
}

function restoreAssignments(): AssignmentMap {
  const defaults = buildRecommendedAssignments();
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<AudienceId, Partial<AssignmentDraft>>>;
    for (const audience of AUDIENCES) {
      const candidate = parsed[audience.id];
      if (!candidate) continue;
      defaults[audience.id] = {
        conceptId: isConceptId(candidate.conceptId) ? candidate.conceptId : defaults[audience.id].conceptId,
        recipeId: isRecipeId(candidate.recipeId) ? candidate.recipeId : defaults[audience.id].recipeId,
        selected: candidate.selected === true,
      };
    }
  } catch {
    // Human Gate preview only.
  }
  return defaults;
}

export default function LineExperienceStudio() {
  const defaults = useMemo(() => buildRecommendedAssignments(), []);
  const [assignments, setAssignments] = useState<AssignmentMap>(defaults);
  const [audienceId, setAudienceId] = useState<AudienceId>('new');
  const [conceptId, setConceptId] = useState<ConceptId>(defaults.new.conceptId);
  const [recipeId, setRecipeId] = useState<RecipeId>(defaults.new.recipeId);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const restored = restoreAssignments();
    setAssignments(restored);
    setConceptId(restored.new.conceptId);
    setRecipeId(restored.new.recipeId);
  }, []);

  const audience = useMemo(() => AUDIENCES.find((item) => item.id === audienceId) ?? AUDIENCES[0], [audienceId]);
  const concept = useMemo(() => CONCEPTS.find((item) => item.id === conceptId) ?? CONCEPTS[0], [conceptId]);
  const recipe = useMemo(() => STARTER_RECIPES.find((item) => item.id === recipeId), [recipeId]);
  const savedAssignment = assignments[audienceId];
  const isDirty = savedAssignment.conceptId !== conceptId || savedAssignment.recipeId !== recipeId;
  const confirmedCount = AUDIENCES.filter((item) => assignments[item.id].selected).length;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }

  function persist(next: AssignmentMap) {
    setAssignments(next);
    try { window.localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(next)); } catch { /* local gate only */ }
  }

  function chooseAudience(nextId: AudienceId) {
    const nextAssignment = assignments[nextId];
    setAudienceId(nextId);
    setConceptId(nextAssignment.conceptId);
    setRecipeId(nextAssignment.recipeId);
  }

  function saveAssignment() {
    const next = { ...assignments, [audienceId]: { conceptId, recipeId, selected: true } };
    persist(next);
    flash(`${audience.code} を ${concept.code} ${concept.name} で保存`);
  }

  function applyRecommended() {
    const next = buildRecommendedAssignments(true);
    persist(next);
    setConceptId(next[audienceId].conceptId);
    setRecipeId(next[audienceId].recipeId);
    flash('おすすめ構成を6状態へ一括セット');
  }

  async function copyAssignmentJson() {
    const payload = JSON.stringify({ version: 2, production: false, assignments }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      flash('割当Draft JSONをコピー');
    } catch {
      flash('コピーできませんでした');
    }
  }

  return (
    <section className="line-exp" aria-labelledby="line-exp-title">
      <style>{styles}</style>

      <header className="line-exp-head">
        <div>
          <p className="kicker">LINE EXPERIENCE CONTROL PLANE</p>
          <h1 id="line-exp-title">世界観ごと、見る人ごとに選ぶ</h1>
          <p className="intro">A＝SLFの母体、B＝Quest、C＝学習。USER STATE → RICH MENU → MESSAGE / STEP → NEXT STATEを一画面で決める。</p>
        </div>
        <div className="candidate-state">
          <small>HUMAN GATE DRAFT</small>
          <b>{confirmedCount} / {AUDIENCES.length} 状態を選択済み</b>
          <span>ここでの保存はブラウザだけ。LINE本番・Supabase・配信は変えません。</span>
        </div>
      </header>

      {notice && <div className="notice">✓ {notice}</div>}

      <div className="toolbar">
        <div className="audience-tabs" role="tablist" aria-label="ユーザー状態">
          {AUDIENCES.map((item) => (
            <button key={item.id} type="button" className={audienceId === item.id ? 'active' : ''} onClick={() => chooseAudience(item.id)}>
              <small>{item.code}{assignments[item.id].selected ? ' · SET' : ''}</small>
              <b>{item.label}</b>
            </button>
          ))}
        </div>
        <button type="button" className="bulk-button" onClick={applyRecommended}>おすすめ6状態を一括セット</button>
      </div>

      <div className="experience-spine">
        <FlowCell number="01" label="USER STATE" value={audience.label} sub={audience.state} />
        <span className="arrow">→</span>
        <FlowCell number="02" label="RICH MENU" value={`${concept.code} ${concept.name}`} sub={audience.menuGoal} />
        <span className="arrow">→</span>
        <FlowCell number="03" label="MESSAGE / STEP" value={recipe?.name ?? '未設定'} sub={`${recipe?.steps.length ?? 0} messages`} />
        <span className="arrow">→</span>
        <FlowCell number="04" label="NEXT STATE" value={audience.next} sub="反応・行動で切替" />
      </div>

      <div className="rule-note">
        <small>AUTO RULE CANDIDATE</small><b>{audience.rule}</b><span>属性ではなく、行動・時間・関係性イベントで切替。</span>
      </div>

      <div className="concept-grid" aria-label="リッチメニュー3案">
        {CONCEPTS.map((item) => (
          <button key={item.id} type="button" className={`concept-choice ${conceptId === item.id ? 'selected' : ''}`} onClick={() => setConceptId(item.id)}>
            <MenuPreview concept={item} audience={audience} compact />
            <div className="concept-choice-copy">
              <span className="concept-code">{item.code}</span>
              <div><b>{item.name}</b><small>{item.mood}</small></div>
              <span className="choose-mark">{conceptId === item.id ? 'SELECTED ✓' : '選ぶ →'}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="studio-grid">
        <div className="visual-panel">
          <div className="section-head">
            <div><small>SELECTED MENU</small><h2>{concept.code}｜{concept.name}</h2></div>
            <span>{concept.mood}</span>
          </div>
          <MenuPreview concept={concept} audience={audience} />
          <div className="concept-footer">
            <p><small>狙い</small>{concept.note}</p>
            <span className={`draft-chip ${savedAssignment.selected && !isDirty ? 'saved' : ''}`}>{savedAssignment.selected && !isDirty ? 'この状態に保存済み' : isDirty ? '未保存の変更あり' : 'まだ未確定'}</span>
          </div>
        </div>

        <aside className="delivery-panel">
          <div className="section-head compact">
            <div><small>MESSAGE / STEP DELIVERY</small><h2>その後の配信</h2></div>
            <a href="#line-flow-builder">Flow編集へ ↓</a>
          </div>
          <label className="flow-select">
            <span>この状態に割り当てるStep Flow</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value as RecipeId)}>
              {STARTER_RECIPES.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
            </select>
          </label>
          <div className="recipe-card">
            <span>{recipe?.icon ?? '↗'}</span>
            <div><small>{recipe?.triggerType === 'friend_add' ? 'AUTO / FRIEND ADD' : 'MANUAL / EVENT'}</small><b>{recipe?.name ?? '未設定'}</b><p>{recipe?.purpose ?? 'この状態に対応するFlowを設定します。'}</p></div>
          </div>
          <div className="step-list">
            {(recipe?.steps ?? []).map((step, index) => (
              <div className="step" key={`${recipe?.id}-${index}`}>
                <i>{index + 1}</i>
                <div><small>{step.offsetDays === 0 ? (step.offsetMinutes ? `${step.offsetMinutes}分後` : 'すぐ') : `${step.offsetDays}日後`} · {step.angle}</small><p>{step.message}</p></div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="draft-actions">
        <div><small>HUMAN GATE DRAFT</small><b>{audience.code}｜{concept.code} {concept.name} × {recipe?.name ?? '未設定'}</b><span>選択後にSafe Publishへ渡すためのDraft。Productionにはまだ触れません。</span></div>
        <button type="button" className="secondary" onClick={copyAssignmentJson}>設定JSONをコピー</button>
        <button type="button" className="primary-save" onClick={saveAssignment}>この状態に割り当てる</button>
      </div>

      <div className="assignment-board">
        <div className="section-head compact"><div><small>AUDIENCE × EXPERIENCE</small><h2>誰に何を出すか</h2></div><span>状態を押すと上のPreviewへ</span></div>
        <div className="rows">
          {AUDIENCES.map((item) => {
            const assignment = assignments[item.id];
            const itemConcept = CONCEPTS.find((candidate) => candidate.id === assignment.conceptId);
            const itemRecipe = STARTER_RECIPES.find((candidate) => candidate.id === assignment.recipeId);
            return (
              <button key={item.id} type="button" className={audienceId === item.id ? 'active' : ''} onClick={() => chooseAudience(item.id)}>
                <span><small>{item.code}</small><b>{item.label}</b></span>
                <span><small>MENU</small><b>{itemConcept ? `${itemConcept.code} ${itemConcept.name}` : '—'}</b></span>
                <span><small>MESSAGE / STEP</small><b>{itemRecipe?.name ?? '—'}</b></span>
                <span><small>RULE</small><b>{item.rule}</b></span>
                <span className={`row-status ${assignment.selected ? 'saved' : ''}`}><small>STATUS</small><b>{assignment.selected ? 'SELECTED' : 'SUGGESTED'}</b></span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FlowCell({ number, label, value, sub }: { number: string; label: string; value: string; sub: string }) {
  return <div className="flow-cell"><small>{number} {label}</small><b>{value}</b><span>{sub}</span></div>;
}

function MenuPreview({ concept, audience, compact = false }: { concept: Concept; audience: Audience; compact?: boolean }) {
  return (
    <div className={`menu-preview concept-${concept.id} ${compact ? 'compact' : ''}`}>
      <div className="menu-sky" />
      <div className="menu-land land-one" />
      <div className="menu-land land-two" />
      <div className="map-lines"><i /><i /><i /></div>
      <div className="leaf-shadow" />
      <div className="preview-brand"><b>ACE / Sun Loves Flow</b><span>{audience.code}</span></div>
      <div className="preview-hero"><small>{concept.sub}</small><h3>{concept.hero}</h3><p>{audience.menuGoal}</p></div>
      <div className="routes-six">
        {ROUTES[audience.id].map((route) => (
          <div className="route-tile" key={`${concept.id}-${route.title}`}><i>{route.icon}</i><b>{route.title}</b><small>{route.sub}</small></div>
        ))}
      </div>
      <div className="preview-signature">Play. Learn. Connect. Grow. <span>For a Brighter Tomorrow.</span></div>
    </div>
  );
}

const styles = `
.line-exp{max-width:1440px;margin:18px auto 30px;padding:0 22px;color:#27342d;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif}.line-exp *{box-sizing:border-box}.line-exp button,.line-exp select{font:inherit}.line-exp button{cursor:pointer}.line-exp-head{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;align-items:end;margin-bottom:15px}.kicker,.section-head small,.flow-cell small,.candidate-state small,.recipe-card small,.step small,.rows small,.rule-note small,.draft-actions small,.flow-select span{font-size:10px;font-weight:800;letter-spacing:.12em;color:#8b7553}.line-exp-head h1{font-family:Georgia,"Yu Mincho",serif;font-size:31px;font-weight:500;line-height:1.25;margin:5px 0 7px}.intro{margin:0;max-width:880px;font-size:13px;line-height:1.75;color:#6b746e}.candidate-state{border:1px solid #ddd6cb;border-radius:18px;background:rgba(255,255,255,.86);padding:14px 16px;box-shadow:0 12px 30px rgba(59,55,45,.05)}.candidate-state b{display:block;margin:5px 0;font-size:15px;color:#51432f}.candidate-state span{font-size:10px;line-height:1.5;color:#888178}.notice{position:sticky;top:10px;z-index:20;width:max-content;max-width:100%;margin:0 0 10px auto;padding:8px 13px;border-radius:999px;background:#294838;color:#fff;font-size:11px}.toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:stretch;margin-bottom:10px}.audience-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}.audience-tabs button{min-height:62px;border:1px solid #dcd6cd;border-radius:13px;background:#fbfaf7;padding:8px 10px;text-align:left;color:#5d655f;transition:.2s}.audience-tabs small{display:block;font-size:9px;letter-spacing:.1em;color:#9a8a73}.audience-tabs b{display:block;margin-top:4px;font-size:12px}.audience-tabs button.active{background:#294838;color:#fff;border-color:#294838;transform:translateY(-1px)}.audience-tabs button.active small{color:#dbe8df}.bulk-button{border:1px solid #c8a55f;border-radius:13px;background:#fff9ea;color:#6e5327;padding:0 15px;font-size:11px;font-weight:800;white-space:nowrap}.experience-spine{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:7px;align-items:stretch;margin-bottom:9px}.flow-cell{min-width:0;border:1px solid #ded9d1;border-radius:12px;background:#efede8;padding:10px 11px}.flow-cell b{display:block;margin:4px 0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.flow-cell span{display:block;font-size:10px;line-height:1.4;color:#77776f}.arrow{align-self:center;color:#a99a86}.rule-note{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin:0 0 14px;padding:9px 12px;border:1px dashed #d5cec3;border-radius:11px;background:#f7f4ef}.rule-note b{font-size:11px}.rule-note span{font-size:10px;color:#837d73}.concept-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}.concept-choice{min-width:0;border:1px solid #d9d2c7;border-radius:20px;background:#fff;padding:0;overflow:hidden;text-align:left;box-shadow:0 10px 28px rgba(57,49,38,.06);transition:.22s}.concept-choice:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(57,49,38,.1)}.concept-choice.selected{border:2px solid #6d8d76;box-shadow:0 0 0 4px rgba(109,141,118,.12),0 18px 42px rgba(57,49,38,.1)}.concept-choice-copy{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:10px 12px;background:#fff}.concept-code{display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#eee9e0;font-family:Georgia,serif;font-size:15px}.concept-choice-copy b{display:block;font-family:Georgia,"Yu Mincho",serif;font-size:13px}.concept-choice-copy small{display:block;margin-top:2px;font-size:9px;color:#8b857c}.choose-mark{font-size:9px;font-weight:900;letter-spacing:.06em;color:#63806c}.studio-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(350px,.85fr);gap:14px}.visual-panel,.delivery-panel,.assignment-board{border:1px solid #ddd7ce;border-radius:20px;background:rgba(255,255,255,.82);padding:16px;box-shadow:0 10px 30px rgba(63,55,43,.04)}.section-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:12px}.section-head h2{margin:3px 0 0;font-family:Georgia,"Yu Mincho",serif;font-size:21px;font-weight:500}.section-head>span,.section-head a{font-size:10px;color:#8a8277;text-decoration:none}.section-head.compact{align-items:center}.menu-preview{position:relative;min-height:500px;overflow:hidden;border-radius:22px;border:1px solid rgba(35,45,39,.12);background:#f5f2e8;isolation:isolate}.menu-preview.compact{min-height:350px;border-radius:0;border:0}.menu-sky,.menu-land,.map-lines,.leaf-shadow{position:absolute;inset:0;pointer-events:none}.concept-nature{background:linear-gradient(180deg,#cfe7f3 0%,#f8e7bd 44%,#9cbf9c 70%,#3f7058 100%)}.concept-nature .menu-sky{background:radial-gradient(circle at 73% 21%,rgba(255,241,167,.95) 0 4%,rgba(255,220,133,.35) 5% 18%,transparent 36%),linear-gradient(180deg,rgba(255,255,255,.35),transparent 55%)}.concept-nature .land-one{clip-path:polygon(0 61%,17% 49%,32% 60%,45% 42%,62% 57%,78% 43%,100% 55%,100% 100%,0 100%);background:linear-gradient(180deg,rgba(56,103,78,.2),rgba(28,84,59,.75))}.concept-nature .land-two{clip-path:polygon(0 76%,18% 63%,34% 72%,49% 59%,64% 69%,81% 54%,100% 66%,100% 100%,0 100%);background:linear-gradient(180deg,rgba(88,127,100,.2),rgba(37,91,67,.82))}.concept-nature .leaf-shadow{background:radial-gradient(ellipse at 8% 10%,rgba(40,92,56,.22),transparent 28%),radial-gradient(ellipse at 92% 18%,rgba(44,103,61,.17),transparent 23%)}.concept-quest{background:#e7d2a7;background-image:linear-gradient(rgba(113,83,44,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(113,83,44,.05) 1px,transparent 1px),radial-gradient(circle at 50% 22%,rgba(255,249,221,.7),transparent 36%);background-size:34px 34px,34px 34px,100% 100%}.concept-quest .menu-land.land-one{clip-path:polygon(0 65%,12% 52%,25% 63%,42% 44%,56% 64%,71% 50%,100% 62%,100% 100%,0 100%);background:rgba(77,91,54,.2)}.concept-quest .menu-land.land-two{clip-path:polygon(0 82%,20% 68%,38% 78%,57% 63%,73% 78%,100% 64%,100% 100%,0 100%);background:rgba(69,92,57,.28)}.concept-quest .map-lines i{position:absolute;width:34%;height:20%;border-bottom:3px dashed rgba(70,53,31,.42);border-radius:50%;transform:rotate(-12deg)}.concept-quest .map-lines i:nth-child(1){left:7%;top:29%}.concept-quest .map-lines i:nth-child(2){left:34%;top:42%;transform:rotate(16deg)}.concept-quest .map-lines i:nth-child(3){left:59%;top:26%;transform:rotate(-22deg)}.concept-minimal{background:linear-gradient(145deg,#fbfcfa,#f2f3ef)}.concept-minimal .leaf-shadow{background:radial-gradient(ellipse at 100% 0%,rgba(71,111,74,.16),transparent 25%),radial-gradient(ellipse at 0% 100%,rgba(77,99,75,.12),transparent 22%)}.preview-brand{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:17px 18px 0;font-family:Georgia,"Yu Mincho",serif}.preview-brand b{font-size:14px;font-weight:500}.preview-brand span{font:800 9px -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.12em;border:1px solid rgba(40,50,44,.22);border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.45)}.preview-hero{position:relative;z-index:3;padding:26px 20px 14px;max-width:78%}.preview-hero small{font-size:10px;letter-spacing:.08em;color:#54675a}.preview-hero h3{margin:6px 0;font-family:Georgia,"Yu Mincho",serif;font-size:29px;font-weight:500;line-height:1.25}.preview-hero p{margin:0;font-size:11px;color:#637068}.routes-six{position:absolute;z-index:4;left:14px;right:14px;bottom:43px;display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.route-tile{min-height:105px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.55);border-radius:14px;background:rgba(255,255,255,.72);backdrop-filter:blur(7px);box-shadow:0 8px 24px rgba(38,49,42,.08);text-align:center;padding:8px}.route-tile i{font-style:normal;font-size:22px;line-height:1}.route-tile b{margin-top:6px;font-family:Georgia,"Yu Mincho",serif;font-size:13px;font-weight:600}.route-tile small{margin-top:3px;font-size:8px;letter-spacing:.1em;color:#768079}.concept-quest .route-tile{background:rgba(244,226,187,.88);border-color:rgba(114,83,43,.16);border-radius:19px 13px 18px 12px}.concept-minimal .route-tile{background:rgba(255,255,255,.9);border-color:#e4e6e0;border-radius:12px}.concept-minimal .route-tile:last-child{background:linear-gradient(145deg,#fff9e7,#f7e4a7)}.preview-signature{position:absolute;z-index:3;left:0;right:0;bottom:12px;text-align:center;font-family:Georgia,serif;font-size:9px;letter-spacing:.06em;color:rgba(38,49,42,.72)}.preview-signature span{font-style:italic}.compact .preview-brand{padding:12px 13px 0}.compact .preview-brand b{font-size:10px}.compact .preview-hero{padding:16px 13px 8px;max-width:88%}.compact .preview-hero small{font-size:7px}.compact .preview-hero h3{font-size:18px;margin:4px 0}.compact .preview-hero p{font-size:8px}.compact .routes-six{left:8px;right:8px;bottom:26px;gap:4px}.compact .route-tile{min-height:65px;border-radius:9px;padding:5px}.compact .route-tile i{font-size:14px}.compact .route-tile b{font-size:8px;margin-top:3px}.compact .route-tile small{font-size:6px}.compact .preview-signature{bottom:8px;font-size:6px}.concept-footer{display:grid;grid-template-columns:1fr auto;gap:13px;align-items:center;margin-top:11px;padding-top:11px;border-top:1px solid #e4dfd7}.concept-footer p{margin:0;font-size:11px;line-height:1.55;color:#70736e}.concept-footer p small{display:block;margin-bottom:2px;font-weight:800;color:#8d806d}.draft-chip{border:1px solid #d8d1c7;border-radius:999px;padding:7px 10px;font-size:10px;color:#7c746b;background:#f7f4ef;white-space:nowrap}.draft-chip.saved{border-color:#9caf9e;background:#edf4ed;color:#3e6547}.flow-select{display:block;margin-bottom:9px}.flow-select span{display:block;margin-bottom:5px}.flow-select select{width:100%;min-height:42px;border:1px solid #d9d3ca;border-radius:10px;background:#fff;padding:0 10px;color:#434b46}.recipe-card{display:flex;gap:10px;padding:12px;border-radius:14px;background:#f0ede7;margin-bottom:10px}.recipe-card>span{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:11px;background:#fff;font-size:18px}.recipe-card b{display:block;margin:3px 0;font-size:13px}.recipe-card p{margin:0;font-size:10px;line-height:1.5;color:#77756e}.step-list{display:flex;flex-direction:column;gap:6px;max-height:500px;overflow:auto}.step{display:grid;grid-template-columns:27px 1fr;gap:9px;padding:9px;border:1px solid #e2ddd5;border-radius:11px;background:#fff}.step>i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#e7ede7;font-style:normal;font-size:10px;font-weight:900}.step p{margin:3px 0 0;font-size:11px;line-height:1.5;color:#575c58}.draft-actions{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px;align-items:center;margin-top:14px;padding:13px 15px;border:1px solid #cfc7bc;border-radius:16px;background:#efe9df}.draft-actions b{display:block;margin:3px 0;font-size:12px}.draft-actions span{font-size:10px;color:#7a756c}.draft-actions button{min-height:42px;border-radius:999px;padding:0 14px;font-size:11px;font-weight:800}.draft-actions .secondary{border:1px solid #cabda9;background:#fffaf3;color:#6c604e}.primary-save{border:0;background:#294838;color:#fff}.assignment-board{margin-top:14px}.rows{display:flex;flex-direction:column;gap:6px}.rows button{display:grid;grid-template-columns:120px 1fr 1fr 1.15fr 105px;gap:9px;align-items:center;border:1px solid #e1dcd4;border-radius:11px;background:#fbfaf8;padding:9px 11px;text-align:left;color:#505751}.rows button.active{border-color:#768a79;background:#eef3ed}.rows span{min-width:0}.rows b{display:block;margin-top:2px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row-status b{color:#8c7d68}.row-status.saved b{color:#477252}
@media(max-width:1100px){.concept-grid{grid-template-columns:1fr 1fr 1fr}.menu-preview.compact{min-height:300px}.compact .route-tile{min-height:55px}.studio-grid{grid-template-columns:1fr}.rows button{grid-template-columns:110px 1fr 1fr 1fr}.rows button span:last-child{display:none}}
@media(max-width:820px){.line-exp-head{grid-template-columns:1fr}.toolbar{grid-template-columns:1fr}.audience-tabs{grid-template-columns:repeat(3,1fr)}.bulk-button{min-height:44px}.experience-spine{grid-template-columns:1fr 1fr}.experience-spine>.arrow{display:none}.rule-note{grid-template-columns:1fr}.concept-grid{grid-template-columns:1fr}.menu-preview.compact{min-height:390px}.concept-choice-copy{grid-template-columns:auto 1fr auto}.draft-actions{grid-template-columns:1fr 1fr}.draft-actions>div{grid-column:1/-1}.rows button{grid-template-columns:1fr 1fr}.rows button span:nth-child(4),.rows button span:nth-child(5){display:none}}
@media(max-width:640px){.line-exp{padding:0 12px}.line-exp-head h1{font-size:24px}.intro{font-size:12px}.audience-tabs{display:flex;overflow:auto;padding-bottom:3px}.audience-tabs button{min-width:118px}.experience-spine{grid-template-columns:1fr}.visual-panel,.delivery-panel,.assignment-board{padding:12px;border-radius:16px}.menu-preview{min-height:455px}.preview-hero{max-width:92%;padding:22px 15px 10px}.preview-hero h3{font-size:24px}.routes-six{left:9px;right:9px;bottom:38px;gap:5px}.route-tile{min-height:92px;padding:5px}.route-tile b{font-size:11px}.concept-footer{grid-template-columns:1fr}.draft-actions{grid-template-columns:1fr}.draft-actions button{width:100%}.rows button{grid-template-columns:1fr}.rows button span{display:block!important}.rule-note span{display:block}}
`;