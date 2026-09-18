import { useEffect, useMemo, useState, type DragEvent } from 'react';

type WidgetId = 'project' | 'wait' | 'command' | 'evidence' | 'calendar' | 'output' | 'decision';
type Width = 1 | 2;
type LayoutState = { version: 1; order: WidgetId[]; hidden: WidgetId[]; widths: Record<WidgetId, Width> };

type TaskItem = {
  taskId: string;
  status: string | null;
  priority: string | null;
  task: string | null;
  project: string | null;
  dueDate: string | null;
  timeHint: string | null;
  nextAction: string | null;
  executionLane: string | null;
  executionClass: string | null;
  updatedAt: string | null;
  phase: string | null;
};

type TaskPayload = {
  ok: boolean;
  items: TaskItem[];
  summary: Record<string, unknown>;
  rule?: string;
  aiApiCalls?: number;
};

type EvidenceItem = {
  id: string;
  title: string;
  evidenceType?: string;
  evidenceQuality?: string;
  status?: string;
  tags?: string[];
  occurredAt?: string | null;
  updatedAt?: string | null;
};

type EvidencePayload = { ok:boolean; items:EvidenceItem[] };

const STORAGE_KEY = 'masa-dashboard-cockpit-v1';
const widgetMeta: Array<{ id:WidgetId; label:string }> = [
  { id:'project', label:'PROJECT' },
  { id:'wait', label:'WAIT / 詰まり' },
  { id:'command', label:'QUICK INPUT' },
  { id:'evidence', label:'EVIDENCE' },
  { id:'calendar', label:'CALENDAR' },
  { id:'output', label:'OUTPUT' },
  { id:'decision', label:'DECISION' },
];
const widgetIds = widgetMeta.map(item => item.id);
const DEFAULT_STATE: LayoutState = {
  version: 1,
  order: [...widgetIds],
  hidden: ['decision'],
  widths: { project:2, wait:1, command:1, evidence:1, calendar:1, output:1, decision:1 },
};

function readLayout(raw: string | null): LayoutState {
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id): id is WidgetId => widgetIds.includes(id as WidgetId))
      : [];
    for (const id of widgetIds) if (!order.includes(id)) order.push(id);
    const hidden = Array.isArray(parsed.hidden)
      ? parsed.hidden.filter((id): id is WidgetId => widgetIds.includes(id as WidgetId))
      : [];
    const widths = { ...DEFAULT_STATE.widths };
    if (parsed.widths && typeof parsed.widths === 'object') {
      for (const id of widgetIds) widths[id] = parsed.widths[id] === 2 ? 2 : 1;
    }
    return { version:1, order, hidden, widths };
  } catch {
    return DEFAULT_STATE;
  }
}

const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const shortDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ja-JP', { month:'numeric', day:'numeric' }).format(date)
    : value;
};
const isOverdue = (task: TaskItem) => {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = new Date(`${task.dueDate}T23:59:59+09:00`).getTime();
  return Number.isFinite(due) && due < Date.now();
};

export default function DashboardCockpit() {
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [tasks, setTasks] = useState<TaskPayload | null>(null);
  const [evidence, setEvidence] = useState<EvidencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMode, setInputMode] = useState<'instruction'|'comment'|'create'|'evidence'>('instruction');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [inputStatus, setInputStatus] = useState('');

  useEffect(() => {
    setLayout(readLayout(localStorage.getItem(STORAGE_KEY)));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout, hydrated]);

  const load = async () => {
    setLoading(true);
    try {
      const [taskResult, evidenceResult] = await Promise.allSettled([
        fetch('/api/dashboard/task-execution?limit=80', { cache:'no-store' }),
        fetch('/api/dashboard/evidence', { cache:'no-store' }),
      ]);

      if (taskResult.status === 'fulfilled' && taskResult.value.ok) {
        const body = await taskResult.value.json();
        setTasks(body?.ok ? body : null);
      } else setTasks(null);

      if (evidenceResult.status === 'fulfilled' && evidenceResult.value.ok) {
        const body = await evidenceResult.value.json();
        setEvidence(body?.ok ? body : null);
      } else setEvidence(null);
    } catch {
      setTasks(null);
      setEvidence(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => layout.order.filter(id => !layout.hidden.includes(id)), [layout]);
  const hiddenWidgets = useMemo(() => widgetMeta.filter(item => layout.hidden.includes(item.id)), [layout]);
  const taskItems = tasks?.items ?? [];
  const nowTasks = useMemo(() => taskItems.filter(item => item.status === 'NOW'), [taskItems]);
  const nextTasks = useMemo(() => taskItems.filter(item => item.status === 'NEXT'), [taskItems]);
  const waitTasks = useMemo(() => taskItems.filter(item => item.status === 'WAIT'), [taskItems]);
  const reviewTasks = useMemo(() => taskItems.filter(item => item.status === 'REVIEW'), [taskItems]);
  const masaGateTasks = useMemo(() => taskItems.filter(item => item.executionLane === 'MASA_GATE' && item.status !== 'DONE'), [taskItems]);
  const overdueTasks = useMemo(() => taskItems.filter(isOverdue), [taskItems]);
  const primaryTask = nowTasks[0] ?? nextTasks[0] ?? taskItems[0] ?? null;
  const bottleneck = masaGateTasks[0] ?? waitTasks[0] ?? reviewTasks[0] ?? null;

  const move = (id: WidgetId, delta: number) => setLayout(current => {
    const order = [...current.order];
    const from = order.indexOf(id);
    const to = Math.max(0, Math.min(order.length - 1, from + delta));
    if (from < 0 || from === to) return current;
    order.splice(from, 1);
    order.splice(to, 0, id);
    return { ...current, order };
  });

  const dropOn = (target: WidgetId) => {
    if (!dragging || dragging === target) return setDragging(null);
    setLayout(current => {
      const order = current.order.filter(id => id !== dragging);
      const targetIndex = order.indexOf(target);
      order.splice(Math.max(0, targetIndex), 0, dragging);
      return { ...current, order };
    });
    setDragging(null);
  };

  const hide = (id: WidgetId) => setLayout(current => ({ ...current, hidden:[...new Set([...current.hidden, id])] }));
  const show = (id: WidgetId) => setLayout(current => ({ ...current, hidden:current.hidden.filter(item => item !== id) }));
  const toggleWidth = (id: WidgetId) => setLayout(current => ({
    ...current,
    widths:{ ...current.widths, [id]:current.widths[id] === 2 ? 1 : 2 },
  }));

  const submitInput = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInputStatus('保存中…');
    try {
      if (inputMode === 'evidence') {
        const response = await fetch('/api/dashboard/evidence', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            title:text.slice(0, 72),
            body:text,
            sourceKind:'manual',
            evidenceType:'observation',
            evidenceQuality:'raw',
            tags:['dashboard-cockpit'],
            metadata:{ source:'dashboard-cockpit-v1' },
          }),
        });
        if (!response.ok) throw new Error('evidence_save_failed');
        setInputStatus('Evidenceに追加した');
        await load();
      } else {
        const response = await fetch('/api/dashboard/feedback', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            page:'/dashboard',
            message:text,
            context:JSON.stringify({ kind:'dashboard_cockpit', intent:inputMode, version:1, createdAt:new Date().toISOString() }),
          }),
        });
        if (!response.ok) throw new Error('inbox_save_failed');
        setInputStatus(inputMode === 'comment'
          ? 'コメントを残した'
          : inputMode === 'create'
            ? '制作依頼をInboxへ置いた'
            : '指示をInboxへ置いた');
      }
      setInput('');
    } catch {
      setInputStatus('保存できなかった。詳細ページから再試行して。');
    } finally {
      setSending(false);
    }
  };

  const renderWidget = (id: WidgetId) => {
    if (id === 'project') return <>
      <div className="widget-head"><div><span>PROJECT / TASK</span><h2>今、実行するもの</h2></div><a href="/dashboard/tasks">詳細 →</a></div>
      {loading ? <p className="loading">Task Flowを読んでる…</p> : primaryTask ? <>
        <article className="primary-focus">
          <div className="project-meta"><b>{primaryTask.priority || '—'}</b><span>{primaryTask.status || primaryTask.phase || 'STATE'}</span>{primaryTask.dueDate && <em>期限 {shortDate(primaryTask.dueDate)}</em>}</div>
          <h3>{primaryTask.task || 'Untitled Task'}</h3>
          <p>{primaryTask.nextAction || 'Next Action未設定'}</p>
        </article>
        <div className="focus-list">
          {[...nowTasks.slice(1), ...nextTasks].slice(0, 3).map(item => <article key={item.taskId}>
            <div><b>{item.priority || '—'}</b><strong>{item.task || item.project || item.taskId}</strong></div>
            <span>{item.status || item.phase || 'STATE'}</span>
          </article>)}
        </div>
      </> : <div className="empty"><strong>Task Flow unavailable</strong><span>正本は変更せず、詳細ページから確認。</span></div>}
    </>;

    if (id === 'wait') return <>
      <div className="widget-head"><div><span>WAIT / BOTTLENECK</span><h2>止まってる所だけ</h2></div><a href="/dashboard/tasks">Tasks →</a></div>
      <div className="metric-grid">
        <div><b>{numeric(tasks?.summary?.wait ?? waitTasks.length)}</b><span>WAIT</span></div>
        <div><b>{numeric(tasks?.summary?.review ?? reviewTasks.length)}</b><span>REVIEW</span></div>
        <div><b>{numeric(tasks?.summary?.masaGate ?? masaGateTasks.length)}</b><span>MASA GATE</span></div>
      </div>
      {overdueTasks.length > 0 && <p className="overdue">期限超過 {overdueTasks.length}件</p>}
      {bottleneck && <article className="bottleneck"><span>{bottleneck.executionLane === 'MASA_GATE' ? 'HUMAN GATE' : bottleneck.status || 'BOTTLENECK'}</span><strong>{bottleneck.task || bottleneck.project || bottleneck.taskId}</strong><p>{bottleneck.nextAction || 'Next Action未設定'}</p></article>}
    </>;

    if (id === 'command') return <>
      <div className="widget-head"><div><span>QUICK INPUT</span><h2>ここで軽く動かす</h2></div></div>
      <div className="mode-row">
        {([['instruction','指示'],['comment','コメント'],['create','つくる'],['evidence','Evidence']] as const).map(([value,label]) =>
          <button key={value} type="button" className={inputMode === value ? 'active' : ''} onClick={() => setInputMode(value)}>{label}</button>)}
      </div>
      <textarea value={input} onChange={event => setInput(event.target.value)} placeholder={inputMode === 'evidence' ? '起きたこと・結果・気づきをそのまま書く' : inputMode === 'create' ? '「X用にこれ1本作る」など' : '「これProjectに追加」「ここ直して」など'} />
      <div className="input-foot"><span>{inputStatus || 'Inboxへ置く。正式変更・公開は自動実行しない。'}</span><button type="button" onClick={submitInput} disabled={!input.trim() || sending}>{sending ? '保存中…' : '置く →'}</button></div>
    </>;

    if (id === 'evidence') return <>
      <div className="widget-head"><div><span>EVIDENCE</span><h2>最近、現実から返ったもの</h2></div><a href="/dashboard/evidence">詳細 →</a></div>
      <div className="evidence-list">
        {(evidence?.items || []).slice(0, 4).map(item => <article key={item.id || item.title}><div><strong>{item.title}</strong><small>{item.evidenceType || item.status || 'evidence'} · {shortDate(item.updatedAt || item.occurredAt)}</small></div><span>{item.evidenceQuality || 'raw'}</span></article>)}
        {!loading && !evidence?.items?.length && <div className="empty"><strong>まだ表示するEvidenceなし</strong><span>QUICK INPUTから追加できる。</span></div>}
      </div>
    </>;

    if (id === 'calendar') return <>
      <div className="widget-head"><div><span>CALENDAR</span><h2>時間へ落とす</h2></div><a href="/dashboard/schedule">開く →</a></div>
      <p className="widget-copy">固定予定・締切・家族時間はCalendar側を正本にして、ここでは今日触る入口だけ置く。</p>
      <a className="big-door" href="/dashboard/schedule"><span>今日と今週を見る</span><b>↗</b></a>
    </>;

    if (id === 'output') return <>
      <div className="widget-head"><div><span>OUTPUT</span><h2>外へ流す</h2></div></div>
      <div className="door-list"><a href="/dashboard/post"><b>X / Social</b><span>仮説・体験を出す →</span></a><a href="/dashboard/line"><b>LINE Flow</b><span>関係・教育を動かす →</span></a><a href="/dashboard/ace-assets"><b>ACE Assets</b><span>教材へ変える →</span></a></div>
    </>;

    return <>
      <div className="widget-head"><div><span>DECISION · EXCEPTION</span><h2>横断判断が必要な時だけ</h2></div><a href="/dashboard/choice-lab">Choice Lab →</a></div>
      <p className="widget-copy">ProjectやTaskを見れば済むことは質問にしない。複数の場所を跨ぐ未決定だけChoice Labへ。</p>
      <a className="big-door quiet" href="/dashboard/choice-lab"><span>NOW 5 / 判断待ちを見る</span><b>↗</b></a>
    </>;
  };

  return <section className="cockpit" aria-label="Daily cockpit">
    <style>{`
      .cockpit{margin-top:20px}.cockpit-top{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:10px}.cockpit-title span,.widget-head span{color:#8b5b2c;font-size:.72rem;letter-spacing:.1em;font-weight:800}.cockpit-title h2{margin:3px 0 0;font-size:1.15rem}.cockpit-actions{display:flex;gap:7px;flex-wrap:wrap}.cockpit button{font:inherit}.edit-btn,.reset-btn,.add-btn{min-height:38px;padding:0 11px;border:1px solid #d8d4cd;border-radius:10px;background:#fff;color:#59636e;cursor:pointer;font-size:.78rem}.edit-btn.active{border-color:#b79c75;background:#f7f1e8;color:#754a16}.cockpit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}.widget-cell{min-width:0;padding:18px;border:1px solid #dedad4;border-radius:18px;background:rgba(255,255,255,.88);box-shadow:0 10px 30px rgba(52,47,41,.045)}.widget-cell.span-2{grid-column:span 2}.widget-cell.dragging{opacity:.55}.edit-tools{display:flex;align-items:center;gap:5px;padding-bottom:10px;margin-bottom:12px;border-bottom:1px dashed #ddd7cf}.edit-tools button{min-width:31px;min-height:31px;border:1px solid #ddd7cf;border-radius:8px;background:#faf9f7;color:#707780;cursor:pointer;font-size:.72rem}.edit-tools .drag{margin-right:auto;cursor:grab}.widget-head{display:flex;align-items:start;justify-content:space-between;gap:14px;margin-bottom:14px}.widget-head h2{margin:3px 0 0;font-size:1rem;line-height:1.35}.widget-head a{flex-shrink:0;color:#8b5b2c;text-decoration:none;font-size:.76rem}.primary-focus{padding:16px;border:1px solid #d8d2c8;border-radius:14px;background:linear-gradient(145deg,#fff,#faf6ef)}.project-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.project-meta b{color:#8b5b2c}.project-meta span,.project-meta em{padding:3px 7px;border-radius:999px;background:#f0ede8;color:#68717b;font-size:.68rem;font-style:normal}.primary-focus h3{margin-top:9px;font-size:1rem}.primary-focus p,.bottleneck p,.widget-copy{margin-top:7px;color:#68717b;font-size:.8rem;line-height:1.65}.focus-list{display:grid;gap:6px;margin-top:9px}.focus-list article,.evidence-list article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px solid #ebe7e1}.focus-list article div{min-width:0;display:flex;align-items:center;gap:7px}.focus-list b{color:#8b5b2c;font-size:.7rem}.focus-list strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem}.focus-list span,.evidence-list>article>span{flex-shrink:0;color:#7c858e;font-size:.68rem}.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.metric-grid div{padding:11px;border-radius:12px;background:#f7f5f1}.metric-grid b{display:block;font-size:1.5rem;line-height:1}.metric-grid span{display:block;margin-top:5px;color:#747d86;font-size:.67rem}.overdue{margin:8px 0 0;color:#9b5a47;font-size:.7rem}.bottleneck{margin-top:10px;padding:12px;border-left:3px solid #c8944d;background:#fbf7f0}.bottleneck>span{color:#9c6a2d;font-size:.65rem;font-weight:800;letter-spacing:.1em}.bottleneck strong{display:block;margin-top:4px;font-size:.8rem}.mode-row{display:flex;gap:5px;flex-wrap:wrap}.mode-row button{min-height:32px;padding:0 9px;border:1px solid #ddd7cf;border-radius:999px;background:#fff;color:#68717b;cursor:pointer;font-size:.7rem}.mode-row button.active{border-color:#b69a72;background:#f7f1e8;color:#754a16}.cockpit textarea{width:100%;min-height:112px;margin-top:9px;padding:11px 12px;border:1px solid #d8d4cd;border-radius:12px;background:#fff;color:#20242a;resize:vertical;font:inherit;font-size:.84rem;line-height:1.6}.input-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}.input-foot span{color:#7c858e;font-size:.68rem}.input-foot button{flex-shrink:0;min-height:38px;padding:0 13px;border:0;border-radius:10px;background:#20242a;color:#fff;cursor:pointer;font-weight:700;font-size:.76rem}.input-foot button:disabled{opacity:.45;cursor:not-allowed}.evidence-list article>div{min-width:0}.evidence-list strong,.evidence-list small{display:block}.evidence-list strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem}.evidence-list small{margin-top:2px;color:#858d95;font-size:.67rem}.door-list{display:grid;gap:7px}.door-list a,.big-door{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #e0dcd6;border-radius:11px;background:#fbfaf8;color:inherit;text-decoration:none}.door-list b{font-size:.78rem}.door-list span,.big-door span{color:#68717b;font-size:.72rem}.big-door{margin-top:12px}.big-door b{color:#8b5b2c}.big-door.quiet{background:#f8f6fb}.empty,.loading{padding:18px 4px;color:#7c858e;font-size:.78rem}.empty strong,.empty span{display:block}.empty span{margin-top:3px;font-size:.7rem}.widget-add{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px dashed #d8d4cd;border-radius:12px}.widget-add>span{margin-right:4px;color:#7c858e;font-size:.7rem}.reset-btn{color:#8b5b2c}@media(max-width:1050px){.cockpit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.widget-cell.span-2{grid-column:span 2}}@media(max-width:680px){.cockpit-top{align-items:flex-start;flex-direction:column}.cockpit-grid{grid-template-columns:1fr}.widget-cell.span-2{grid-column:span 1}.widget-cell{border-radius:14px;padding:15px}.metric-grid{grid-template-columns:repeat(3,1fr)}.input-foot{align-items:flex-start;flex-direction:column}.input-foot button{width:100%}}@media(prefers-reduced-motion:reduce){.widget-cell,*{scroll-behavior:auto!important;transition:none!important}}
    `}</style>

    <div className="cockpit-top">
      <div className="cockpit-title"><span>DAILY COCKPIT</span><h2>左は地図。ここは、今日触るものだけ。</h2></div>
      <div className="cockpit-actions"><button type="button" className={`edit-btn ${editing ? 'active' : ''}`} onClick={() => setEditing(value => !value)}>{editing ? '編集を閉じる' : '並べ替える'}</button>{editing && <button type="button" className="reset-btn" onClick={() => setLayout(DEFAULT_STATE)}>初期配置</button>}</div>
    </div>

    <div className="cockpit-grid">
      {visible.map(id => <article key={id} className={`widget-cell span-${layout.widths[id]} ${dragging === id ? 'dragging' : ''}`} draggable={editing} onDragStart={(event:DragEvent<HTMLElement>) => { setDragging(id); event.dataTransfer.effectAllowed='move'; }} onDragOver={event => { if (editing) event.preventDefault(); }} onDrop={() => dropOn(id)}>
        {editing && <div className="edit-tools"><button type="button" className="drag" title="ドラッグして移動">⇅ {widgetMeta.find(item => item.id === id)?.label}</button><button type="button" onClick={() => move(id,-1)} title="前へ">←</button><button type="button" onClick={() => move(id,1)} title="後ろへ">→</button><button type="button" onClick={() => toggleWidth(id)} title="幅を変更">幅 {layout.widths[id]}</button><button type="button" onClick={() => hide(id)} title="隠す">×</button></div>}
        {renderWidget(id)}
      </article>)}
    </div>

    {editing && hiddenWidgets.length > 0 && <div className="widget-add"><span>隠しているWidget</span>{hiddenWidgets.map(item => <button type="button" className="add-btn" key={item.id} onClick={() => show(item.id)}>＋ {item.label}</button>)}</div>}
  </section>;
}
