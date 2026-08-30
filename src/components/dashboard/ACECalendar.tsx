import { useEffect, useMemo, useRef, useState } from 'react';

type Kind = 'action' | 'quest' | 'learn';

type Task = {
  id: string;
  label: string;
  xp: number;
  done: boolean;
  kind?: Kind;
};

type Theme = {
  id: string;
  label: string;
  color: string;
  tasks: Task[];
};

type FeedbackItem = {
  id: number;
  page: string;
  message: string;
  context?: string | null;
  status: string;
  created_at: string;
};

const COLORS = ['#3B82F6', '#22c55e', '#A78BFA', '#F59E0B', '#EC4899', '#F97316'];

const DEFAULT_6: Theme[] = [
  {
    id: 't1', label: '🧠 脳', color: '#3B82F6', tasks: [
      { id: 't1a', label: '前頭前野トレーニング', xp: 15, done: false, kind: 'action' },
      { id: 't1b', label: '集中セッション60分', xp: 20, done: false, kind: 'quest' },
      { id: 't1c', label: '読書・インプット', xp: 10, done: false, kind: 'learn' },
    ],
  },
  {
    id: 't2', label: '💪 体', color: '#22c55e', tasks: [
      { id: 't2a', label: '朝の呼吸ルーティン', xp: 10, done: false, kind: 'action' },
      { id: 't2b', label: '神経系アクティベーション', xp: 15, done: false, kind: 'quest' },
      { id: 't2c', label: 'コンディション記録', xp: 5, done: false, kind: 'learn' },
    ],
  },
  {
    id: 't3', label: '🔮 メンタル', color: '#A78BFA', tasks: [
      { id: 't3a', label: 'ZONEジャーナル', xp: 10, done: false, kind: 'learn' },
      { id: 't3b', label: 'Core Values接続', xp: 20, done: false, kind: 'quest' },
      { id: 't3c', label: '夜の振り返り', xp: 5, done: false, kind: 'action' },
    ],
  },
  {
    id: 't4', label: '⚡ 仕事', color: '#F59E0B', tasks: [
      { id: 't4a', label: 'ACEコンテンツ作成', xp: 25, done: false, kind: 'quest' },
      { id: 't4b', label: 'X投稿3本', xp: 15, done: false, kind: 'action' },
      { id: 't4c', label: '売上振り返り', xp: 10, done: false, kind: 'learn' },
    ],
  },
  {
    id: 't5', label: '💚 関係', color: '#EC4899', tasks: [
      { id: 't5a', label: 'リアンフォロー', xp: 20, done: false, kind: 'quest' },
      { id: 't5b', label: 'メンタリング記録', xp: 15, done: false, kind: 'learn' },
      { id: 't5c', label: 'コミュニティ投稿', xp: 10, done: false, kind: 'action' },
    ],
  },
  {
    id: 't6', label: '🌀 習慣', color: '#F97316', tasks: [
      { id: 't6a', label: '睡眠7h確保', xp: 15, done: false, kind: 'quest' },
      { id: 't6b', label: '食事記録', xp: 5, done: false, kind: 'action' },
      { id: 't6c', label: 'デジタルデトックス', xp: 10, done: false, kind: 'learn' },
    ],
  },
];

const DEFAULT_3: Theme[] = [
  {
    id: 't1', label: '🧠 脳・体', color: '#3B82F6', tasks: [
      { id: 't1a', label: '前頭前野トレーニング', xp: 15, done: false, kind: 'action' },
      { id: 't1b', label: '朝の呼吸ルーティン', xp: 10, done: false, kind: 'action' },
      { id: 't1c', label: 'コンディション記録', xp: 5, done: false, kind: 'learn' },
    ],
  },
  {
    id: 't2', label: '⚡ メンタル・仕事', color: '#F59E0B', tasks: [
      { id: 't2a', label: 'ZONEジャーナル', xp: 10, done: false, kind: 'learn' },
      { id: 't2b', label: 'ACEコンテンツ作成', xp: 25, done: false, kind: 'quest' },
      { id: 't2c', label: 'X投稿3本', xp: 15, done: false, kind: 'action' },
    ],
  },
  {
    id: 't3', label: '💚 関係・習慣', color: '#EC4899', tasks: [
      { id: 't3a', label: 'リアンフォロー', xp: 20, done: false, kind: 'quest' },
      { id: 't3b', label: '睡眠7h確保', xp: 15, done: false, kind: 'quest' },
      { id: 't3c', label: '夜の振り返り', xp: 5, done: false, kind: 'action' },
    ],
  },
];

const ACTION_LIBRARY = [
  '5分だけ始める',
  '10分だけ練習する',
  '1人に連絡する',
  '必要な情報を1つ調べる',
  '今日の気づきを1行残す',
  '次の一手を1つ決める',
  '外に出て5分歩く',
  '3呼吸だけ整える',
  '水を1杯飲む',
  '不要なものを1つ消す',
  '1ページだけ読む',
  '感謝を1人に伝える',
];

const KIND_META: Record<Kind, { label: string; icon: string; description: string }> = {
  action: { label: 'Action', icon: '⚡', description: '今すぐできる一歩' },
  quest: { label: 'Quest', icon: '🗺️', description: '目的に向かうまとまり' },
  learn: { label: 'Learn', icon: '📚', description: '理解・気づきを深める' },
};

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function normalizeThemes(themes: Theme[]): Theme[] {
  return themes.map((theme) => ({
    ...theme,
    tasks: theme.tasks.map((task) => ({ ...task, kind: task.kind || 'action' })),
  }));
}

function load(): { themes: Theme[]; cols: 3 | 6 } {
  if (typeof window === 'undefined') return { themes: DEFAULT_6, cols: 6 };
  try {
    const stored = localStorage.getItem('ace-themes-v2');
    if (stored) {
      const parsed = JSON.parse(stored) as { themes: Theme[]; cols: 3 | 6 };
      return { ...parsed, themes: normalizeThemes(parsed.themes) };
    }
  } catch {}
  return { themes: DEFAULT_6, cols: 6 };
}

function save(themes: Theme[], cols: 3 | 6) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ace-themes-v2', JSON.stringify({ themes, cols }));
  }
}

function slotId(themeId: string, taskId: string) {
  return `${themeId}:${taskId}`;
}

function playTone(type: 'start' | 'complete' | 'quest') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass();
    const notes = type === 'start' ? [392] : type === 'quest' ? [523, 659, 784] : [523, 659];
    notes.forEach((frequency: number, index: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + index * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.09 + 0.23);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + index * 0.09);
      oscillator.stop(context.currentTime + index * 0.09 + 0.25);
    });
    window.setTimeout(() => context.close(), 800);
  } catch {}
}

export default function ACECalendar() {
  const stored = useMemo(() => load(), []);
  const [themes, setThemes] = useState<Theme[]>(stored.themes);
  const [cols, setCols] = useState<3 | 6>(stored.cols);
  const [activeKind, setActiveKind] = useState<Kind>('action');
  const [activeTaskKey, setActiveTaskKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragTaskRef = useRef<{ themeId: string; taskId: string } | null>(null);
  const [celebration, setCelebration] = useState<{ label: string; xp: number; quest: boolean } | null>(null);
  const [quickText, setQuickText] = useState('');
  const [quickThemeId, setQuickThemeId] = useState(stored.themes[0]?.id || 't1');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);

  const updateThemes = (next: Theme[], nextCols = cols) => {
    setThemes(next);
    save(next, nextCols);
  };

  useEffect(() => {
    fetch('/api/dashboard/state')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.checked) return;
        setThemes((current) => {
          const next = current.map((theme) => ({
            ...theme,
            tasks: theme.tasks.map((task) => ({
              ...task,
              done: task.done || Boolean(data.checked[slotId(theme.id, task.id)]),
            })),
          }));
          save(next, cols);
          return next;
        });
      })
      .catch(() => {});

    fetch('/api/dashboard/feedback')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.items) setFeedbackItems(data.items);
      })
      .catch(() => {});
  }, []);

  const allTasks = themes.flatMap((theme) => theme.tasks);
  const totalXP = allTasks.reduce((sum, task) => sum + task.xp, 0);
  const earnedXP = allTasks.filter((task) => task.done).reduce((sum, task) => sum + task.xp, 0);
  const pct = totalXP ? Math.round((earnedXP / totalXP) * 100) : 0;
  const stage = pct >= 90
    ? { name: 'Bloom', icon: '🌸', message: '積み重ねが花になっている' }
    : pct >= 70
      ? { name: 'Bud', icon: '🌷', message: 'もうすぐ次の開花' }
      : pct >= 45
        ? { name: 'Leaf', icon: '🌿', message: '行動が習慣へ変わり始めた' }
        : pct >= 15
          ? { name: 'Sprout', icon: '🌱✨', message: '小さな一歩が芽を出した' }
          : { name: 'Seed', icon: '✨', message: '今日の一歩が未来の種になる' };

  const activeTask = useMemo(() => {
    if (!activeTaskKey) return null;
    for (const theme of themes) {
      const task = theme.tasks.find((item) => slotId(theme.id, item.id) === activeTaskKey);
      if (task) return { theme, task };
    }
    return null;
  }, [activeTaskKey, themes]);

  const persistChecked = (themeId: string, task: Task, checked: boolean) => {
    fetch('/api/dashboard/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slotId(themeId, task.id), checked, xp: task.xp }),
    }).catch(() => {});
  };

  const startTask = (theme: Theme, task: Task) => {
    if (task.done) return;
    setActiveTaskKey(slotId(theme.id, task.id));
    playTone('start');
  };

  const setTaskDone = (themeId: string, taskId: string, done: boolean) => {
    let target: Task | undefined;
    const next = themes.map((theme) => {
      if (theme.id !== themeId) return theme;
      return {
        ...theme,
        tasks: theme.tasks.map((task) => {
          if (task.id !== taskId) return task;
          target = task;
          return { ...task, done };
        }),
      };
    });
    updateThemes(next);
    if (target) persistChecked(themeId, target, done);
    if (!done) return;

    const isQuest = (target?.kind || 'action') === 'quest';
    playTone(isQuest ? 'quest' : 'complete');
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(isQuest ? [50, 40, 80] : 45);
    }
    setCelebration({ label: target?.label || '完了', xp: target?.xp || 0, quest: isQuest });
    setActiveTaskKey(null);
    window.setTimeout(() => setCelebration(null), isQuest ? 2400 : 1600);
  };

  const addTask = (themeId: string) => {
    const next = themes.map((theme) => theme.id !== themeId ? theme : {
      ...theme,
      tasks: [...theme.tasks, { id: genId(), label: '新しいAction', xp: 10, done: false, kind: 'action' as Kind }],
    });
    updateThemes(next);
  };

  const updateTask = (themeId: string, taskId: string, patch: Partial<Task>) => {
    updateThemes(themes.map((theme) => theme.id !== themeId ? theme : {
      ...theme,
      tasks: theme.tasks.map((task) => task.id !== taskId ? task : { ...task, ...patch }),
    }));
  };

  const deleteTask = (themeId: string, taskId: string) => {
    updateThemes(themes.map((theme) => theme.id !== themeId ? theme : {
      ...theme,
      tasks: theme.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const updateTheme = (themeId: string, patch: Partial<Theme>) => {
    updateThemes(themes.map((theme) => theme.id === themeId ? { ...theme, ...patch } : theme));
  };

  const addTheme = () => {
    const color = COLORS[themes.length % COLORS.length];
    updateThemes([...themes, { id: genId(), label: '新テーマ', color, tasks: [] }]);
  };

  const deleteTheme = (themeId: string) => {
    const next = themes.filter((theme) => theme.id !== themeId);
    updateThemes(next);
    if (!next.some((theme) => theme.id === quickThemeId)) setQuickThemeId(next[0]?.id || '');
  };

  const switchCols = (nextCols: 3 | 6) => {
    setCols(nextCols);
    save(themes, nextCols);
  };

  const onDropTask = (themeId: string, targetTaskId: string) => {
    const source = dragTaskRef.current;
    if (!source || source.themeId !== themeId || source.taskId === targetTaskId) return;
    const next = themes.map((theme) => {
      if (theme.id !== themeId) return theme;
      const tasks = [...theme.tasks];
      const from = tasks.findIndex((task) => task.id === source.taskId);
      const to = tasks.findIndex((task) => task.id === targetTaskId);
      if (from < 0 || to < 0) return theme;
      const [moved] = tasks.splice(from, 1);
      tasks.splice(to, 0, moved);
      return { ...theme, tasks };
    });
    updateThemes(next);
    dragTaskRef.current = null;
    setDragOver(null);
  };

  const addQuickAction = (label: string) => {
    const text = label.trim();
    if (!text || !quickThemeId) return;
    const next = themes.map((theme) => theme.id !== quickThemeId ? theme : {
      ...theme,
      tasks: [...theme.tasks, { id: genId(), label: text, xp: 5, done: false, kind: 'action' as Kind }],
    });
    updateThemes(next);
    setQuickText('');
    setActiveKind('action');
    setLibraryOpen(false);
  };

  const sendFeedback = async () => {
    const message = feedbackText.trim();
    if (!message) return;
    setFeedbackStatus('sending');
    try {
      const response = await fetch('/api/dashboard/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: '/dashboard',
          message,
          context: JSON.stringify({ activeKind, stage: stage.name, seed: earnedXP, progress: pct }),
        }),
      });
      if (!response.ok) throw new Error('feedback_failed');
      const payload = await response.json();
      setFeedbackItems((items) => [{
        id: payload.id || Date.now(),
        page: '/dashboard',
        message,
        context: null,
        status: 'new',
        created_at: new Date().toISOString(),
      }, ...items].slice(0, 20));
      setFeedbackText('');
      setFeedbackStatus('sent');
      window.setTimeout(() => setFeedbackStatus('idle'), 1800);
    } catch {
      setFeedbackStatus('error');
    }
  };

  return (
    <div className="ace-growth-shell">
      <style>{`
        .ace-growth-shell{padding-bottom:80px;color:#D4C5A9;font-family:'Zen Kaku Gothic New',sans-serif;--surface:#1A1612;--elev:#241F1A;--border:#2E2822;--gold:#C9A96E;--muted:#7A6F5F;--void:#0D0B08}
        .ace-hero{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;margin-bottom:16px}.ace-card{background:var(--surface);border:1px solid var(--border);padding:18px}.ace-kicker{font-family:'Cormorant Garamond',serif;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-size:.72rem}.ace-seed{font-family:'Cormorant Garamond',serif;font-size:2.6rem;color:var(--gold);line-height:1;margin:9px 0}.ace-seed small{font-size:1rem;color:var(--muted);margin-left:7px}.ace-bar{height:5px;background:#2E2822;overflow:hidden;border-radius:99px}.ace-bar>span{display:block;height:100%;background:linear-gradient(90deg,#8B7355,#C9A96E);transition:width .35s ease}.ace-stage{display:flex;align-items:center;gap:15px;height:100%}.ace-stage-icon{font-size:3.2rem;filter:drop-shadow(0 0 12px rgba(201,169,110,.18))}.ace-stage-name{font-family:'Cormorant Garamond',serif;font-size:1.7rem;color:var(--gold)}.ace-stage p{font-size:.78rem;color:var(--muted);margin-top:3px}
        .ace-focus{margin-bottom:16px;background:linear-gradient(135deg,rgba(201,169,110,.09),rgba(34,197,94,.04));border:1px solid rgba(201,169,110,.35);padding:20px;position:relative;overflow:hidden}.ace-focus::after{content:'';position:absolute;width:190px;height:190px;border-radius:50%;right:-70px;top:-100px;background:radial-gradient(circle,rgba(201,169,110,.18),transparent 70%);animation:pulseGlow 2.2s infinite}.ace-focus-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;position:relative;z-index:1}.ace-focus-title{font-size:1.2rem;margin-top:5px}.ace-work-visual{margin-top:16px;border:1px solid var(--border);background:rgba(13,11,8,.65);padding:15px;display:grid;grid-template-columns:74px 1fr;gap:14px;align-items:center;position:relative;z-index:1}.ace-orb{width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#DCC69B,#8B7355 45%,#241F1A 72%);box-shadow:0 0 28px rgba(201,169,110,.18);animation:orbBreath 2.4s ease-in-out infinite}.ace-steps{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}.ace-step{font-size:.7rem;color:var(--muted);border:1px solid var(--border);padding:4px 7px}.ace-step.on{color:var(--gold);border-color:rgba(201,169,110,.45)}
        .ace-actions{display:flex;gap:8px;flex-wrap:wrap}.ace-btn{border:1px solid var(--border);background:transparent;color:#D4C5A9;padding:9px 13px;cursor:pointer;font:inherit;font-size:.8rem;min-height:40px}.ace-btn:hover{border-color:#8B7355}.ace-btn.primary{background:var(--gold);color:#0D0B08;border-color:var(--gold);font-weight:600}.ace-btn.soft{border-color:rgba(201,169,110,.35);color:var(--gold);background:rgba(201,169,110,.06)}.ace-btn.danger{color:#E85D4A;border-color:rgba(232,93,74,.25)}
        .ace-kind-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.ace-kind{padding:13px;border:1px solid var(--border);background:var(--surface);color:var(--muted);text-align:left;cursor:pointer}.ace-kind.active{border-color:rgba(201,169,110,.48);background:rgba(201,169,110,.07);color:#D4C5A9}.ace-kind strong{display:block;font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:inherit}.ace-kind span{font-size:.67rem}
        .ace-quick{margin-bottom:16px}.ace-quick-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.ace-quick h3{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.2rem}.ace-quick-row{display:grid;grid-template-columns:180px 1fr auto;gap:8px}.ace-input,.ace-select{width:100%;background:#0D0B08;border:1px solid var(--border);color:#D4C5A9;padding:10px 11px;font:inherit;font-size:.82rem;outline:none}.ace-input:focus,.ace-select:focus{border-color:#8B7355}.ace-suggestions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.ace-chip{border:1px solid var(--border);background:#0D0B08;color:var(--muted);padding:7px 10px;cursor:pointer;font:inherit;font-size:.74rem}.ace-chip:hover{color:var(--gold);border-color:#8B7355}
        .ace-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:18px 0 10px}.ace-grid{display:grid;gap:11px}.ace-grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.ace-grid.cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}.ace-theme{background:var(--surface);border:1px solid var(--border);padding:13px;min-width:0}.ace-theme-title{font-family:'Cormorant Garamond',serif;font-size:1rem;margin-bottom:9px}.ace-theme-meta{font-size:.68rem;color:var(--muted);margin:5px 0 8px}.ace-theme-progress{height:3px;background:#2E2822;overflow:hidden}.ace-theme-progress span{display:block;height:100%;transition:width .3s}.ace-task{border-top:1px solid var(--border);padding:10px 0}.ace-task:first-of-type{border-top:0}.ace-task-row{display:flex;align-items:center;gap:8px}.ace-task-label{font-size:.79rem;line-height:1.35;flex:1;min-width:0}.ace-task-label.done{color:var(--muted);text-decoration:line-through}.ace-seed-mini{font-size:.67rem;color:var(--muted);white-space:nowrap}.ace-kind-pill{font-size:.58rem;border:1px solid var(--border);padding:2px 5px;color:var(--muted);white-space:nowrap}.ace-task-actions{display:flex;gap:6px;margin-top:7px}.ace-mini{border:1px solid var(--border);background:transparent;color:var(--muted);padding:5px 8px;cursor:pointer;font:inherit;font-size:.66rem}.ace-mini.start{color:var(--gold);border-color:rgba(201,169,110,.35)}.ace-mini.done{color:#69c98b;border-color:rgba(105,201,139,.3)}.ace-empty{color:var(--muted);font-size:.75rem;padding:10px 0}.ace-edit-row{display:grid;grid-template-columns:1fr 68px 80px auto;gap:5px;margin-top:6px}.ace-color-row{display:flex;gap:5px;margin:7px 0}.ace-color{width:17px;height:17px;border:0;cursor:pointer}
        .ace-feedback-button{position:fixed;right:26px;bottom:24px;z-index:70;width:52px;height:52px;border-radius:50%;background:var(--gold);color:#0D0B08;border:0;font-size:1.15rem;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35)}.ace-feedback{position:fixed;right:24px;bottom:86px;z-index:70;width:min(390px,calc(100vw - 32px));max-height:72vh;overflow:auto;background:#17130f;border:1px solid rgba(201,169,110,.35);padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.5)}.ace-feedback textarea{min-height:110px;resize:vertical}.ace-feedback-history{margin-top:14px;border-top:1px solid var(--border);padding-top:10px}.ace-feedback-item{padding:8px 0;border-bottom:1px solid var(--border);font-size:.72rem;color:var(--muted)}.ace-feedback-item strong{display:block;color:#D4C5A9;font-weight:400;margin-bottom:2px}.ace-status{font-size:.7rem;color:var(--muted);margin-left:8px}
        .ace-celebration{position:fixed;inset:0;z-index:100;pointer-events:none;display:flex;align-items:center;justify-content:center;background:rgba(13,11,8,.18);animation:fadeOut 1.6s forwards}.ace-celebration-box{background:rgba(26,22,18,.94);border:1px solid rgba(201,169,110,.55);padding:24px 30px;text-align:center;box-shadow:0 20px 70px rgba(0,0,0,.45);animation:pop .35s ease-out}.ace-celebration-icon{font-size:3rem}.ace-celebration-title{font-family:'Cormorant Garamond',serif;color:var(--gold);font-size:1.65rem;margin-top:4px}.ace-confetti{position:fixed;top:-20px;width:7px;height:14px;background:var(--gold);animation:fall 1.8s linear forwards}
        @keyframes orbBreath{0%,100%{transform:scale(.88);opacity:.78}50%{transform:scale(1.06);opacity:1}}@keyframes pulseGlow{0%,100%{transform:scale(.8);opacity:.5}50%{transform:scale(1.1);opacity:1}}@keyframes pop{from{transform:scale(.82);opacity:0}to{transform:scale(1);opacity:1}}@keyframes fadeOut{0%,72%{opacity:1}100%{opacity:0}}@keyframes fall{to{transform:translateY(105vh) rotate(540deg);opacity:.2}}
        @media(max-width:1100px){.ace-grid.cols-6{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:760px){.ace-hero{grid-template-columns:1fr}.ace-kind-tabs{grid-template-columns:1fr}.ace-quick-row{grid-template-columns:1fr}.ace-grid.cols-3,.ace-grid.cols-6{grid-template-columns:1fr}.ace-focus-top{flex-direction:column}.ace-toolbar{align-items:flex-start;flex-direction:column}.ace-edit-row{grid-template-columns:1fr 60px 72px auto}.ace-feedback-button{right:18px;bottom:18px}.ace-feedback{right:16px;bottom:80px}}
      `}</style>

      <div className="ace-hero">
        <section className="ace-card">
          <div className="ace-kicker">Growth Energy</div>
          <div className="ace-seed">{earnedXP}<small>/ {totalXP} SEED</small></div>
          <div className="ace-bar"><span style={{ width: `${pct}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: '.7rem', color: '#7A6F5F' }}>
            <span>行動した分だけ育つ</span><span>{pct}%</span>
          </div>
        </section>
        <section className="ace-card">
          <div className="ace-stage">
            <div className="ace-stage-icon">{stage.icon}</div>
            <div><div className="ace-kicker">Current Stage</div><div className="ace-stage-name">{stage.name}</div><p>{stage.message}</p></div>
          </div>
        </section>
      </div>

      {activeTask && (
        <section className="ace-focus">
          <div className="ace-focus-top">
            <div>
              <div className="ace-kicker">実行中 · {KIND_META[activeTask.task.kind || 'action'].label}</div>
              <div className="ace-focus-title">{activeTask.task.label}</div>
              <div style={{ fontSize: '.74rem', color: '#7A6F5F', marginTop: 3 }}>{activeTask.theme.label} · +{activeTask.task.xp} SEED</div>
            </div>
            <div className="ace-actions">
              <button className="ace-btn" onClick={() => setActiveTaskKey(null)}>中断</button>
              <button className="ace-btn primary" onClick={() => setTaskDone(activeTask.theme.id, activeTask.task.id, true)}>できた！</button>
            </div>
          </div>
          <div className="ace-work-visual">
            <div className="ace-orb" />
            <div>
              <div className="ace-kicker">Visual Work</div>
              <div style={{ fontSize: '.83rem', marginTop: 2 }}>見るだけで終わらず、その場で身体を動かす。</div>
              <div className="ace-steps"><span className="ace-step on">選ぶ ✓</span><span className="ace-step on">実行中</span><span className="ace-step">完了</span></div>
            </div>
          </div>
        </section>
      )}

      <div className="ace-kind-tabs">
        {(Object.keys(KIND_META) as Kind[]).map((kind) => (
          <button key={kind} className={`ace-kind ${activeKind === kind ? 'active' : ''}`} onClick={() => setActiveKind(kind)}>
            <strong>{KIND_META[kind].icon} {KIND_META[kind].label}</strong>
            <span>{KIND_META[kind].description}</span>
          </button>
        ))}
      </div>

      <section className="ace-card ace-quick">
        <div className="ace-quick-head">
          <div><div className="ace-kicker">Today</div><h3>今日、そのために何をした？</h3></div>
          <button className="ace-btn" onClick={() => setLibraryOpen((value) => !value)}>{libraryOpen ? '候補を閉じる' : '一歩を探す'}</button>
        </div>
        <div className="ace-quick-row">
          <select className="ace-select" value={quickThemeId} onChange={(event) => setQuickThemeId(event.target.value)}>
            {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
          <input className="ace-input" value={quickText} onChange={(event) => setQuickText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addQuickAction(quickText); }} placeholder="自分の一歩を書く" />
          <button className="ace-btn primary" onClick={() => addQuickAction(quickText)}>＋ Action</button>
        </div>
        <div className="ace-suggestions">
          {(libraryOpen ? ACTION_LIBRARY : ACTION_LIBRARY.slice(0, 3)).map((item) => <button key={item} className="ace-chip" onClick={() => addQuickAction(item)}>{item}</button>)}
        </div>
      </section>

      <div className="ace-toolbar">
        <div className="ace-actions">
          <button className={`ace-btn ${cols === 3 ? 'soft' : ''}`} onClick={() => switchCols(3)}>3列</button>
          <button className={`ace-btn ${cols === 6 ? 'soft' : ''}`} onClick={() => switchCols(6)}>6列</button>
        </div>
        <div className="ace-actions">
          {editing && <button className="ace-btn" onClick={addTheme}>＋ テーマ</button>}
          <button className={`ace-btn ${editing ? 'soft' : ''}`} onClick={() => setEditing((value) => !value)}>{editing ? '✓ 編集完了' : '✎ 編集'}</button>
        </div>
      </div>

      <div className={`ace-grid cols-${cols}`}>
        {themes.map((theme) => {
          const visibleTasks = theme.tasks.filter((task) => (task.kind || 'action') === activeKind);
          const doneCount = theme.tasks.filter((task) => task.done).length;
          const progress = theme.tasks.length ? Math.round((doneCount / theme.tasks.length) * 100) : 0;
          return (
            <section key={theme.id} className="ace-theme">
              {editing ? (
                <>
                  <input className="ace-input" value={theme.label} onChange={(event) => updateTheme(theme.id, { label: event.target.value })} />
                  <div className="ace-color-row">{COLORS.map((color) => <button key={color} className="ace-color" style={{ background: color, outline: theme.color === color ? '2px solid #D4C5A9' : 'none' }} onClick={() => updateTheme(theme.id, { color })} />)}</div>
                  <button className="ace-mini" style={{ color: '#E85D4A' }} onClick={() => deleteTheme(theme.id)}>テーマ削除</button>
                </>
              ) : <div className="ace-theme-title" style={{ color: theme.color }}>{theme.label}</div>}

              <div className="ace-theme-progress"><span style={{ width: `${progress}%`, background: theme.color }} /></div>
              <div className="ace-theme-meta">{doneCount}/{theme.tasks.length} 完了 · {theme.tasks.filter((task) => task.done).reduce((sum, task) => sum + task.xp, 0)} SEED</div>

              {visibleTasks.length === 0 && <div className="ace-empty">この種類はまだありません。</div>}
              {visibleTasks.map((task) => (
                <div key={task.id} className="ace-task" draggable={!editing} onDragStart={() => { dragTaskRef.current = { themeId: theme.id, taskId: task.id }; }} onDragOver={(event) => { event.preventDefault(); setDragOver(task.id); }} onDrop={() => onDropTask(theme.id, task.id)} style={{ background: dragOver === task.id ? '#241F1A' : 'transparent' }}>
                  <div className="ace-task-row">
                    <span className="ace-kind-pill">{KIND_META[task.kind || 'action'].label}</span>
                    <span className={`ace-task-label ${task.done ? 'done' : ''}`}>{task.label}</span>
                    <span className="ace-seed-mini">+{task.xp}</span>
                  </div>
                  {editing ? (
                    <div className="ace-edit-row">
                      <input className="ace-input" value={task.label} onChange={(event) => updateTask(theme.id, task.id, { label: event.target.value })} />
                      <input className="ace-input" type="number" value={task.xp} onChange={(event) => updateTask(theme.id, task.id, { xp: Number(event.target.value) })} />
                      <select className="ace-select" value={task.kind || 'action'} onChange={(event) => updateTask(theme.id, task.id, { kind: event.target.value as Kind })}><option value="action">Action</option><option value="quest">Quest</option><option value="learn">Learn</option></select>
                      <button className="ace-mini" style={{ color: '#E85D4A' }} onClick={() => deleteTask(theme.id, task.id)}>✕</button>
                    </div>
                  ) : (
                    <div className="ace-task-actions">
                      {task.done ? <button className="ace-mini done" onClick={() => setTaskDone(theme.id, task.id, false)}>✓ できた</button> : <button className="ace-mini start" onClick={() => startTask(theme, task)}>▶ はじめる</button>}
                    </div>
                  )}
                </div>
              ))}
              {editing && <button className="ace-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => addTask(theme.id)}>＋ 項目追加</button>}
            </section>
          );
        })}
      </div>

      <button className="ace-feedback-button" aria-label="改善フィードバック" onClick={() => setFeedbackOpen((value) => !value)}>💬</button>
      {feedbackOpen && (
        <aside className="ace-feedback">
          <div className="ace-quick-head"><div><div className="ace-kicker">Agile Feedback</div><h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400 }}>改善点を残す</h3></div><button className="ace-mini" onClick={() => setFeedbackOpen(false)}>✕</button></div>
          <textarea className="ace-input" value={feedbackText} onChange={(event) => { setFeedbackText(event.target.value); if (feedbackStatus === 'error') setFeedbackStatus('idle'); }} placeholder="ここが使いづらい／こんな機能が欲しい／この表現が良い…" />
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}><button className="ace-btn primary" onClick={sendFeedback} disabled={feedbackStatus === 'sending'}>{feedbackStatus === 'sending' ? '保存中…' : 'フィードバック保存'}</button><span className="ace-status">{feedbackStatus === 'sent' ? '✓ 保存しました' : feedbackStatus === 'error' ? '保存に失敗しました' : '現在地も一緒に記録'}</span></div>
          {feedbackItems.length > 0 && <div className="ace-feedback-history"><div className="ace-kicker">Recent</div>{feedbackItems.slice(0, 5).map((item) => <div className="ace-feedback-item" key={item.id}><strong>{item.message}</strong><span>{new Date(item.created_at).toLocaleString('ja-JP')} · {item.status}</span></div>)}</div>}
        </aside>
      )}

      {celebration && (
        <div className="ace-celebration">
          {Array.from({ length: celebration.quest ? 32 : 18 }).map((_, index) => <i key={index} className="ace-confetti" style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 7) * 0.06}s`, transform: `rotate(${index * 23}deg)` }} />)}
          <div className="ace-celebration-box">
            <div className="ace-celebration-icon">{celebration.quest ? '🎉' : '✨'}</div>
            <div className="ace-celebration-title">{celebration.quest ? 'Quest Clear!' : 'できた！'}</div>
            <div style={{ marginTop: 6 }}>{celebration.label}</div>
            <div style={{ color: '#C9A96E', marginTop: 5 }}>+{celebration.xp} SEED 🌱✨</div>
          </div>
        </div>
      )}
    </div>
  );
}
