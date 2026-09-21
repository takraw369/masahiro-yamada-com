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
  note: string;
};

type AssignmentDraft = {
  conceptId: ConceptId;
  recipeId: RecipeId;
  selected: boolean;
};

type AssignmentMap = Record<AudienceId, AssignmentDraft>;

const AUDIENCES: Audience[] = [
  { id: 'new', code: 'NEW', label: '新規登録', state: 'まだ世界観も自分の現在地も分からない', menuGoal: '安心 + 最初の小さな発見', recipeId: 'welcome', next: 'DISCOVER', rule: 'friend_add → 診断・Quest未完了' },
  { id: 'discover', code: 'DISCOVER', label: '診断・発見中', state: 'Flow Checkや自己理解に触れている', menuGoal: '現在地 → 小さな実験', recipeId: 'diagnosis', next: 'QUEST / LEARN', rule: 'Flow Check / diagnosis event' },
  { id: 'quest', code: 'QUEST', label: 'Quest中', state: '実践中。継続・再開しやすさが必要', menuGoal: '今日の一歩 + 記録 + 戻りやすさ', recipeId: 'quest-soft-return', next: 'REFLECTION', rule: 'quest_start → complete前 / restart候補' },
  { id: 'learn', code: 'LEARN', label: '学び中', state: 'TIPS・知識・体験を深めている', menuGoal: '理解を実践へ接続', recipeId: 'education', next: 'QUEST / SUPPORT', rule: 'education / content engagement' },
  { id: 'support', code: 'SUPPORT', label: '相談・伴走', state: '一人では整理しにくい / 話したい', menuGoal: '相談 + 次の選択肢', recipeId: 'offer-soft', next: 'SESSION / COMMUNITY', rule: 'consult request / operator assignment' },
  { id: 'return', code: 'RETURN', label: '休眠・再接続', state: 'しばらく反応がない / 距離を置いている', menuGoal: '追わない + 軽い再入口', recipeId: 'reactivate', next: 'NEW / DISCOVER', rule: 'meaningful actionなし 7日+ / manual' },
];

const CONCEPTS: Concept[] = [
  { id: 'nature', code: 'A', name: 'Nature / Flow', mood: '静か・余白・朝の光', hero: 'まだ知らない自分へ。', note: 'SLFの母体感を最も強く。光・水・道で「触りたくなる」入口。#164のFIELD MAPはこの方向の実寸候補。' },
  { id: 'quest', code: 'B', name: 'Quest / Map', mood: '探索・地図・小さな冒険', hero: '次の一歩を、見つける。', note: '現在地から次の地点へ進む感覚を強くし、Journeyと分岐を直感的に見せる。' },
  { id: 'minimal', code: 'C', name: 'Future Education', mood: '明快・知的・静かな未来感', hero: '今の自分から、次の一歩へ。', note: '情報量を最小化し、読みやすさ・行動の明確さ・教育OS感を優先する。' },
];

const ROUTES: Record<AudienceId, string[]> = {
  new: ['自分を知る', 'やってみる', '整える', '話してみる'],
  discover: ['MY RESULT', '小さな実験', '学ぶ', '相談'],
  quest: ['今日のQuest', '記録する', 'やさしく再開', '困ったら相談'],
  learn: ['今日のTIPS', '試してみる', '自分に戻す', '話して整理'],
  support: ['MASAに相談', '現在地を見る', '次の入口', 'いったん休む'],
  return: ['今の自分を見る', '1分だけ再開', '軽く読む', '必要なら話す'],
};

const ASSIGNMENT_STORAGE_KEY = 'masa:line-experience:assignments:v1';
const LEGACY_CONCEPT_STORAGE_KEY = 'masa:line-experience:concept';

function buildDefaultAssignments(): AssignmentMap {
  return AUDIENCES.reduce((result, audience) => {
    result[audience.id] = {
      conceptId: audience.id === 'quest' ? 'quest' : audience.id === 'learn' ? 'minimal' : 'nature',
      recipeId: audience.recipeId,
      selected: false,
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
  const defaults = buildDefaultAssignments();
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
    if (raw) {
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
      return defaults;
    }

    const legacy = window.localStorage.getItem(LEGACY_CONCEPT_STORAGE_KEY);
    if (isConceptId(legacy)) {
      defaults.new = { ...defaults.new, conceptId: legacy, selected: true };
    }
  } catch {
    // Draft persistence is best-effort only and must never block LINE operations.
  }
  return defaults;
}

export default function LineExperienceStudio() {
  const defaults = useMemo(() => buildDefaultAssignments(), []);
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
    window.setTimeout(() => setNotice(''), 2400);
  }

  function chooseAudience(nextId: AudienceId) {
    const nextAssignment = assignments[nextId];
    setAudienceId(nextId);
    setConceptId(nextAssignment.conceptId);
    setRecipeId(nextAssignment.recipeId);
  }

  function saveAssignment() {
    const nextAssignments: AssignmentMap = {
      ...assignments,
      [audienceId]: { conceptId, recipeId, selected: true },
    };
    setAssignments(nextAssignments);
    try {
      window.localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(nextAssignments));
    } catch {
      // Human Gate draft only.
    }
    flash(`${audience.code} の MENU + STEP を割当Draftへ保存`);
  }

  async function copyAssignmentJson() {
    const payload = JSON.stringify({ version: 1, production: false, assignments }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      flash('割当Draft JSONをコピー');
    } catch {
      flash('コピーできませんでした。ブラウザ権限を確認してください');
    }
  }

  return (
    <section className="line-exp" aria-labelledby="line-exp-title">
      <style>{styles}</style>

      <header className="line-exp-head">
        <div>
          <p className="kicker">LINE EXPERIENCE CONTROL PLANE</p>
          <h1 id="line-exp-title">誰に、どのメニューと配信を見せるか</h1>
          <p className="intro">USER STATE → RICH MENU → MESSAGE / STEP DELIVERY → NEXT STATEを一つの体験として設計する。見る人ごとに別のMenu + Flowを持てる。</p>
        </div>
        <div className="candidate-state">
          <small>ASSIGNMENT DRAFT</small>
          <b>{confirmedCount} / {AUDIENCES.length} 状態を選択済み</b>
          <span>保存先はこのブラウザだけ。LINE本番・Supabase・配信設定は変更しません。</span>
        </div>
      </header>

      {notice && <div className="notice">✓ {notice}</div>}

      <div className="audience-tabs" role="tablist" aria-label="ユーザー状態">
        {AUDIENCES.map((item) => (
          <button key={item.id} type="button" className={audienceId === item.id ? 'active' : ''} onClick={() => chooseAudience(item.id)}>
            <small>{item.code}{assignments[item.id].selected ? ' · SET' : ''}</small>
            <b>{item.label}</b>
          </button>
        ))}
      </div>

      <div className="experience-spine">
        <FlowCell number="01" label="USER STATE" value={audience.label} sub={audience.state} />
        <span className="arrow">→</span>
        <FlowCell number="02" label="RICH MENU" value={audience.menuGoal} sub={`${concept.code} ${concept.name}`} />
        <span className="arrow">→</span>
        <FlowCell number="03" label="MESSAGE / STEP" value={recipe?.name ?? '未設定'} sub={`${recipe?.steps.length ?? 0} messages`} />
        <span className="arrow">→</span>
        <FlowCell number="04" label="NEXT STATE" value={audience.next} sub="反応・行動で切替" />
      </div>

      <div className="rule-note">
        <small>AUTO RULE CANDIDATE</small>
        <b>{audience.rule}</b>
        <span>固定人格ではなく、行動・時間・関係性イベントで更新する前提。</span>
      </div>

      <div className="studio-grid">
        <div className="visual-panel">
          <div className="section-head">
            <div><small>RICH MENU DIRECTIONS</small><h2>この人に見せるメニュー</h2></div>
            <span>Aは#164の実寸FIELD MAPへ接続</span>
          </div>

          <div className="concept-tabs">
            {CONCEPTS.map((item) => (
              <button key={item.id} type="button" className={conceptId === item.id ? 'active' : ''} onClick={() => setConceptId(item.id)}>
                <i>{item.code}</i>
                <span><b>{item.name}</b><small>{item.mood}</small></span>
              </button>
            ))}
          </div>

          <MenuPreview concept={concept} audience={audience} />

          <div className="concept-footer">
            <p><small>狙い</small>{concept.note}</p>
            <span className={`draft-chip ${savedAssignment.selected && !isDirty ? 'saved' : ''}`}>
              {savedAssignment.selected && !isDirty ? 'この状態に保存済み' : isDirty ? '未保存の変更あり' : 'まだ未確定'}
            </span>
          </div>
        </div>

        <aside className="delivery-panel">
          <div className="section-head compact">
            <div><small>MESSAGE / STEP DELIVERY</small><h2>その後の投稿・配信</h2></div>
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
                <div>
                  <small>{step.offsetDays === 0 ? (step.offsetMinutes ? `${step.offsetMinutes}分後` : 'すぐ') : `${step.offsetDays}日後`} · {step.angle}</small>
                  <p>{step.message}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="draft-actions">
        <div>
          <small>HUMAN GATE DRAFT</small>
          <b>{audience.code}｜{concept.code} {concept.name} × {recipe?.name ?? '未設定'}</b>
          <span>ここで保存してもProductionには反映されません。選択後にSafe Publishへ渡すための設計Draftです。</span>
        </div>
        <button type="button" className="secondary" onClick={copyAssignmentJson}>設定JSONをコピー</button>
        <button type="button" className="primary-save" onClick={saveAssignment}>この状態に割り当てる</button>
      </div>

      <div className="assignment-board">
        <div className="section-head compact">
          <div><small>AUDIENCE × EXPERIENCE</small><h2>誰に何を出すか、一覧で確認</h2></div>
          <span>状態を押すと上のPreviewへ戻る</span>
        </div>
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
                <span className={`row-status ${assignment.selected ? 'saved' : ''}`}><small>STATUS</small><b>{assignment.selected ? 'SELECTED DRAFT' : 'SUGGESTED'}</b></span>
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

function MenuPreview({ concept, audience }: { concept: Concept; audience: Audience }) {
  return (
    <div className={`menu-preview concept-${concept.id}`}>
      <div className="preview-top"><b>SLF / ACE</b><span>{audience.code}</span></div>
      <div className="world">
        <div className="light" />
        <div className="trail" />
        <div className="hero"><small>{audience.label}</small><h3>{concept.hero}</h3><p>{audience.menuGoal}</p></div>
        <button type="button" className="primary">今の自分を見る <span>→</span></button>
        <div className="routes">
          {ROUTES[audience.id].map((route, index) => <button type="button" key={route}><i>{['◉', '↗', '○', '⌁'][index]}</i><b>{route}</b></button>)}
        </div>
      </div>
      <div className="preview-bottom">MAP <span>•</span> EXPLORE</div>
    </div>
  );
}

const styles = `
  .line-exp{max-width:1440px;margin:18px auto 26px;padding:0 22px;color:#303b35;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif}.line-exp *{box-sizing:border-box}.line-exp button,.line-exp select{font:inherit}.line-exp button{cursor:pointer}.line-exp-head{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;align-items:end;margin-bottom:16px}.kicker,.section-head small,.flow-cell small,.candidate-state small,.recipe-card small,.step small,.rows small,.rule-note small,.draft-actions small,.flow-select span{font-size:10px;font-weight:800;letter-spacing:.11em;color:#8c785c}.line-exp-head h1{font-size:29px;line-height:1.25;margin:5px 0 7px}.intro{margin:0;max-width:860px;font-size:13px;line-height:1.7;color:#6f756f}.candidate-state{border:1px solid #ddd7ce;border-radius:16px;background:#fff;padding:14px 16px}.candidate-state b{display:block;margin:5px 0;font-size:15px;color:#57452e}.candidate-state span{font-size:10px;line-height:1.45;color:#888179}.notice{position:sticky;top:10px;z-index:20;width:max-content;max-width:100%;margin:0 0 10px auto;padding:8px 12px;border-radius:999px;background:#31483b;color:#fff;font-size:11px}.audience-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:10px}.audience-tabs button{min-height:62px;border:1px solid #dcd6cd;border-radius:12px;background:#fbfaf8;padding:8px 10px;text-align:left;color:#5f655f}.audience-tabs small{display:block;font-size:9px;letter-spacing:.1em;color:#9b8c78}.audience-tabs b{display:block;margin-top:4px;font-size:12px}.audience-tabs button.active{background:#34483c;color:#fff;border-color:#34483c}.audience-tabs button.active small{color:#d5ded8}.experience-spine{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:7px;align-items:stretch;margin-bottom:9px}.flow-cell{min-width:0;border:1px solid #ded9d1;border-radius:12px;background:#efede8;padding:10px 11px}.flow-cell b{display:block;margin:4px 0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.flow-cell span{display:block;font-size:10px;line-height:1.4;color:#77776f}.arrow{align-self:center;color:#a99a86}.rule-note{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin:0 0 15px;padding:9px 12px;border:1px dashed #d5cec3;border-radius:11px;background:#f7f4ef}.rule-note b{font-size:11px}.rule-note span{font-size:10px;color:#837d73}.studio-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(350px,.85fr);gap:14px}.visual-panel,.delivery-panel,.assignment-board{border:1px solid #ddd7ce;border-radius:20px;background:rgba(255,255,255,.78);padding:16px;box-shadow:0 10px 30px rgba(63,55,43,.04)}.section-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:12px}.section-head h2{margin:3px 0 0;font-size:19px}.section-head>span,.section-head a{font-size:10px;color:#8a8277;text-decoration:none}.section-head.compact{align-items:center}.concept-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.concept-tabs button{display:flex;gap:8px;align-items:flex-start;border:1px solid #ddd7ce;border-radius:12px;background:#f7f5f1;padding:9px;text-align:left;color:#5b625c}.concept-tabs i{display:grid;place-items:center;width:25px;height:25px;flex:none;border-radius:50%;background:#e8e3da;font-style:normal;font-size:11px;font-weight:900}.concept-tabs b{display:block;font-size:11px}.concept-tabs small{display:block;margin-top:2px;font-size:9px;color:#948b80}.concept-tabs button.active{border-color:#6f8272;background:#eef2ed;color:#34483c}.concept-tabs button.active i{background:#405548;color:#fff}.menu-preview{overflow:hidden;border:7px solid #2b2d2c;border-radius:25px;background:#f4f0e7;box-shadow:0 16px 38px rgba(30,31,29,.14)}.preview-top,.preview-bottom{height:34px;display:flex;justify-content:space-between;align-items:center;padding:0 14px;background:rgba(255,255,255,.75);font-size:9px;letter-spacing:.1em}.preview-bottom{justify-content:center;gap:7px;color:#887f73}.world{position:relative;min-height:370px;padding:27px 21px 19px;overflow:hidden;background:linear-gradient(145deg,#f6f2e8,#eaf1eb 54%,#e7efee)}.light{position:absolute;width:180px;height:180px;right:-50px;top:-72px;border-radius:50%;background:radial-gradient(circle,rgba(241,200,105,.48),rgba(241,200,105,.08) 55%,transparent 72%)}.trail{position:absolute;left:26%;top:120px;width:62%;height:220px;border-left:2px solid rgba(88,116,93,.22);border-radius:50%;transform:rotate(-28deg)}.hero{position:relative;z-index:2;max-width:75%}.hero small{font-size:9px;font-weight:800;letter-spacing:.12em;color:#778479}.hero h3{margin:6px 0;font-size:24px;line-height:1.32}.hero p{margin:0;font-size:11px;color:#797b73}.primary{position:relative;z-index:2;margin-top:16px;border:0;border-radius:999px;background:#3b5144;color:#fff;padding:10px 13px;font-size:11px;font-weight:800}.primary span{margin-left:12px}.routes{position:absolute;z-index:2;left:16px;right:16px;bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.routes button{min-height:65px;display:flex;align-items:center;gap:8px;border:1px solid rgba(105,115,105,.2);border-radius:14px;background:rgba(255,255,255,.8);padding:9px;text-align:left;color:#424b45}.routes i{font-style:normal;font-size:16px}.routes b{font-size:11px}.concept-quest .world{background:linear-gradient(145deg,#ecefe4,#e8e0ce)}.concept-quest .trail{left:9%;top:80px;width:80%;height:265px;border-left:0;border-bottom:3px dashed rgba(99,103,80,.24);transform:rotate(-16deg)}.concept-quest .routes button{border-radius:8px;background:rgba(252,248,238,.9)}.concept-minimal .world{background:#f7f8f5}.concept-minimal .light,.concept-minimal .trail{display:none}.concept-minimal .hero{max-width:90%}.concept-minimal .hero h3{font-size:26px}.concept-minimal .primary{border-radius:9px;background:#273b32}.concept-minimal .routes button{border-radius:9px;background:#fff;border-color:#dfe5df}.concept-footer{display:grid;grid-template-columns:1fr auto;gap:13px;align-items:center;margin-top:11px;padding-top:11px;border-top:1px solid #e4dfd7}.concept-footer p{margin:0;font-size:11px;line-height:1.55;color:#70736e}.concept-footer p small{display:block;margin-bottom:2px;font-weight:800;color:#8d806d}.draft-chip{border:1px solid #d8d1c7;border-radius:999px;padding:7px 10px;font-size:10px;color:#7c746b;background:#f7f4ef;white-space:nowrap}.draft-chip.saved{border-color:#9caf9e;background:#edf4ed;color:#3e6547}.flow-select{display:block;margin-bottom:9px}.flow-select span{display:block;margin-bottom:5px}.flow-select select{width:100%;min-height:42px;border:1px solid #d9d3ca;border-radius:10px;background:#fff;padding:0 10px;color:#434b46}.recipe-card{display:flex;gap:10px;padding:12px;border-radius:14px;background:#f0ede7;margin-bottom:10px}.recipe-card>span{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:11px;background:#fff;font-size:18px}.recipe-card b{display:block;margin:3px 0;font-size:13px}.recipe-card p{margin:0;font-size:10px;line-height:1.5;color:#77756e}.step-list{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}.step{display:grid;grid-template-columns:27px 1fr;gap:9px;padding:9px;border:1px solid #e2ddd5;border-radius:11px;background:#fff}.step>i{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#e7ede7;font-style:normal;font-size:10px;font-weight:900}.step p{margin:3px 0 0;font-size:11px;line-height:1.5;color:#575c58}.draft-actions{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px;align-items:center;margin-top:14px;padding:13px 15px;border:1px solid #cfc7bc;border-radius:16px;background:#efe9df}.draft-actions b{display:block;margin:4px 0;font-size:13px}.draft-actions span{display:block;font-size:10px;line-height:1.45;color:#7e776e}.draft-actions button{min-height:42px;border-radius:999px;padding:0 13px;font-size:11px;font-weight:800}.draft-actions .secondary{border:1px solid #cfc7bc;background:#fff;color:#61594f}.draft-actions .primary-save{border:0;background:#6d5437;color:#fff}.assignment-board{margin-top:14px}.rows{display:flex;flex-direction:column;gap:6px}.rows button{display:grid;grid-template-columns:120px .9fr 1fr 1.15fr 118px;gap:9px;align-items:center;border:1px solid #e1dcd4;border-radius:11px;background:#fbfaf8;padding:9px 11px;text-align:left;color:#505751}.rows button.active{border-color:#768a79;background:#eef3ed}.rows span{min-width:0}.rows b{display:block;margin-top:2px;font-size:10.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rows span:first-child b{font-size:12px}.row-status b{font-size:9px;color:#8d8171}.row-status.saved b{color:#39704a}
  @media(max-width:1080px){.rows button{grid-template-columns:115px .8fr 1fr 1fr}.rows button span:last-child{display:none}}
  @media(max-width:980px){.line-exp-head{grid-template-columns:1fr}.audience-tabs{grid-template-columns:repeat(3,1fr)}.experience-spine{grid-template-columns:1fr 1fr}.experience-spine>.arrow{display:none}.rule-note{grid-template-columns:1fr}.studio-grid{grid-template-columns:1fr}.draft-actions{grid-template-columns:1fr 1fr}.draft-actions>div{grid-column:1/-1}.draft-actions button{width:100%}.rows button{grid-template-columns:130px 1fr 1fr}.rows button span:nth-child(4),.rows button span:nth-child(5){display:none}}
  @media(max-width:640px){.line-exp{padding:0 12px}.line-exp-head h1{font-size:22px}.intro{font-size:12px}.audience-tabs{display:flex;overflow:auto;padding-bottom:3px}.audience-tabs button{min-width:118px}.experience-spine{grid-template-columns:1fr}.concept-tabs{display:flex;overflow:auto}.concept-tabs button{min-width:150px}.visual-panel,.delivery-panel,.assignment-board{padding:12px;border-radius:16px}.menu-preview{border-width:5px;border-radius:21px}.world{min-height:335px;padding:22px 15px 15px}.hero{max-width:84%}.hero h3{font-size:21px}.routes{left:11px;right:11px;bottom:11px}.routes button{min-height:62px;padding:7px}.concept-footer{grid-template-columns:1fr}.draft-chip{white-space:normal}.draft-actions{grid-template-columns:1fr}.draft-actions>div{grid-column:auto}.rows button{grid-template-columns:1fr}.rows button span{display:block!important;padding-top:2px}.section-head>span{display:none}.flow-select select{font-size:16px}}
`;