import { useEffect, useMemo, useState } from 'react';
import {
  otsu6Categories,
  otsu6Questions,
  type Otsu6Category,
  type Otsu6Question,
} from '../data/otsu6Questions';

type AnswerRecord = {
  attempts: number;
  correct: number;
  wrong: number;
  lastCorrect: boolean;
  streakCorrect: number;
  lastAt: string;
};

type PersistedState = {
  answers: Record<string, AnswerRecord>;
  bookmarks: string[];
  legacy: {
    answered: number;
    total: number;
    wrong: number;
    bookmarks: number;
  };
};

type View = 'home' | 'subjects' | 'session' | 'stats' | 'exam-result';

type Session = {
  title: string;
  ids: string[];
  index: number;
  exam: boolean;
  startedAt: number;
};

const STORAGE_KEY = 'masa-otsu6-study-v1';

const defaultState: PersistedState = {
  answers: {},
  bookmarks: [],
  legacy: {
    answered: 50,
    total: 300,
    wrong: 35,
    bookmarks: 1,
  },
};

function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function safeLoad(): PersistedState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      answers: parsed.answers ?? {},
      bookmarks: parsed.bookmarks ?? [],
      legacy: parsed.legacy ?? defaultState.legacy,
    };
  } catch {
    return defaultState;
  }
}

function formatElapsed(startedAt: number) {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${String(min).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function markAnswer(
  state: PersistedState,
  questionId: string,
  correct: boolean,
): PersistedState {
  const current = state.answers[questionId] ?? {
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastCorrect: false,
    streakCorrect: 0,
    lastAt: '',
  };
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: {
        attempts: current.attempts + 1,
        correct: current.correct + (correct ? 1 : 0),
        wrong: current.wrong + (correct ? 0 : 1),
        lastCorrect: correct,
        streakCorrect: correct ? current.streakCorrect + 1 : 0,
        lastAt: new Date().toISOString(),
      },
    },
  };
}

function buildExamIds(): string[] {
  const take = (category: Otsu6Category, count: number) =>
    shuffle(otsu6Questions.filter((q) => q.category === category))
      .slice(0, count)
      .map((q) => q.id);

  return [
    ...take('消防関係法令（共通）', 6),
    ...take('消防関係法令（6類）', 4),
    ...take('機械に関する基礎的知識', 5),
    ...take('構造・機能・整備', 15),
    ...take('鑑別等', 5),
  ];
}

export default function Otsu6StudyApp() {
  const [view, setView] = useState<View>('home');
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<string, number>>({});
  const [examResult, setExamResult] = useState<null | {
    total: number;
    correct: number;
    law: number;
    basics: number;
    structure: number;
    practical: number;
    passedGuide: boolean;
  }>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setState(safeLoad());
    setHydrated(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/otsu6/sw.js', { scope: '/otsu6/' }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // LocalStorage can be unavailable in private browsing. The app remains usable in-memory.
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (!session?.exam) return undefined;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session?.exam, session?.startedAt]);

  const byId = useMemo(
    () => new Map<string, Otsu6Question>(otsu6Questions.map((q) => [q.id, q])),
    [],
  );

  const answeredCount = Object.keys(state.answers).filter((id) => byId.has(id)).length;
  const unanswered = otsu6Questions.filter((q) => !state.answers[q.id]);
  const wrong = otsu6Questions
    .filter((q) => {
      const record = state.answers[q.id];
      return record && record.wrong > 0 && record.streakCorrect < 2;
    })
    .sort((a, b) => (state.answers[b.id]?.wrong ?? 0) - (state.answers[a.id]?.wrong ?? 0));
  const bookmarked = otsu6Questions.filter((q) => state.bookmarks.includes(q.id));

  const attempts = Object.values(state.answers).reduce((sum, r) => sum + r.attempts, 0);
  const correctAttempts = Object.values(state.answers).reduce((sum, r) => sum + r.correct, 0);
  const accuracy = attempts ? Math.round((correctAttempts / attempts) * 100) : 0;
  const progress = Math.round((answeredCount / otsu6Questions.length) * 100);

  const currentQuestion = session ? byId.get(session.ids[session.index]) ?? null : null;
  const isBookmarked = currentQuestion ? state.bookmarks.includes(currentQuestion.id) : false;

  function startSession(title: string, ids: string[], exam = false) {
    if (ids.length === 0) return;
    setSession({ title, ids, index: 0, exam, startedAt: Date.now() });
    setSelected(null);
    setRevealed(false);
    setExamAnswers({});
    setExamResult(null);
    setView('session');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startRandom() {
    const first = shuffle(unanswered).map((q) => q.id);
    const later = shuffle(otsu6Questions.filter((q) => state.answers[q.id])).map((q) => q.id);
    startSession('ランダム学習', [...first, ...later]);
  }

  function toggleBookmark(id: string) {
    setState((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.includes(id)
        ? prev.bookmarks.filter((item) => item !== id)
        : [...prev.bookmarks, id],
    }));
  }

  function choose(index: number) {
    if (!currentQuestion || revealed) return;
    setSelected(index);
    if (session?.exam) return;
    const correct = index === currentQuestion.answer;
    setState((prev) => markAnswer(prev, currentQuestion.id, correct));
    setRevealed(true);
    if ('vibrate' in navigator) navigator.vibrate(correct ? 20 : [20, 35, 20]);
  }

  function goNext() {
    if (!session || !currentQuestion) return;

    if (session.exam) {
      if (selected === null) return;
      const nextAnswers = { ...examAnswers, [currentQuestion.id]: selected };
      setExamAnswers(nextAnswers);
      if (session.index === session.ids.length - 1) {
        finishExam(nextAnswers);
        return;
      }
    }

    if (!session.exam && !revealed) return;
    if (session.index === session.ids.length - 1) {
      setView('home');
      setSession(null);
      setSelected(null);
      setRevealed(false);
      return;
    }

    setSession({ ...session, index: session.index + 1 });
    setSelected(null);
    setRevealed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finishExam(answers: Record<string, number>) {
    if (!session) return;
    let correct = 0;
    let law = 0;
    let basics = 0;
    let structure = 0;
    let practical = 0;

    let nextState = state;
    session.ids.forEach((id) => {
      const q = byId.get(id);
      if (!q) return;
      const ok = answers[id] === q.answer;
      if (ok) {
        correct += 1;
        if (q.category.startsWith('消防関係法令')) law += 1;
        else if (q.category === '機械に関する基礎的知識') basics += 1;
        else if (q.category === '構造・機能・整備') structure += 1;
        else if (q.category === '鑑別等') practical += 1;
      }
      nextState = markAnswer(nextState, id, ok);
    });
    setState(nextState);

    const written = law + basics + structure;
    const passedGuide =
      law >= 4 && basics >= 2 && structure >= 6 && written >= 18 && practical >= 3;
    setExamResult({
      total: session.ids.length,
      correct,
      law,
      basics,
      structure,
      practical,
      passedGuide,
    });
    setView('exam-result');
  }

  function goHome() {
    setView('home');
    setSession(null);
    setSelected(null);
    setRevealed(false);
    setExamAnswers({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function categoryStats(category: Otsu6Category) {
    const questions = otsu6Questions.filter((q) => q.category === category);
    const records = questions.map((q) => state.answers[q.id]).filter(Boolean);
    const tries = records.reduce((sum, r) => sum + r.attempts, 0);
    const hits = records.reduce((sum, r) => sum + r.correct, 0);
    return {
      answered: records.length,
      total: questions.length,
      accuracy: tries ? Math.round((hits / tries) * 100) : 0,
    };
  }

  if (view === 'home') {
    return (
      <main className="otsu6-shell">
        <header className="hero">
          <div className="hero-kicker">9/27 本番まで、取れる点から潰す</div>
          <div className="hero-title-row">
            <div>
              <div className="hero-title">消防設備士 乙6</div>
              <div className="hero-subtitle">MASA SPRINT</div>
            </div>
            <button className="icon-button" onClick={() => setView('stats')} aria-label="学習状況">
              📊
            </button>
          </div>
          <div className="progress-label">
            <span>このアプリ</span>
            <strong>{answeredCount} / {otsu6Questions.length}問</strong>
          </div>
          <div className="progress-track" aria-label={`進捗 ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="hero-stats">
            <span>正答率 {accuracy}%</span>
            <span>弱点 {wrong.length}問</span>
            <span>未回答 {unanswered.length}問</span>
          </div>
        </header>

        <section className="legacy-note">
          <span>移行メモ</span>
          <strong>旧アプリ 50 / 300問</strong>
          <small>誤答35問・ブックマーク1問。ここから広告なしで再構築。</small>
        </section>

        <section className="dashboard-grid">
          <button className="dash-card" onClick={() => setView('subjects')}>
            <span className="dash-icon">📚</span>
            <strong>科目別学習</strong>
            <small>法令・基礎・構造・鑑別</small>
          </button>
          <button className="dash-card" onClick={startRandom}>
            <span className="dash-icon">🔀</span>
            <strong>ランダム学習</strong>
            <small>未回答を先にシャッフル</small>
          </button>
          <button
            className="dash-card danger"
            disabled={wrong.length === 0}
            onClick={() => startSession('間違えた問題', wrong.map((q) => q.id))}
          >
            <span className="dash-icon">✕</span>
            <strong>間違えた問題</strong>
            <small>{wrong.length}問・2連続正解で卒業</small>
          </button>
          <button
            className="dash-card"
            disabled={bookmarked.length === 0}
            onClick={() => startSession('ブックマーク', bookmarked.map((q) => q.id))}
          >
            <span className="dash-icon">⭐</span>
            <strong>ブックマーク</strong>
            <small>{bookmarked.length}問</small>
          </button>
          <button
            className="dash-card"
            disabled={unanswered.length === 0}
            onClick={() => startSession('未回答の問題', shuffle(unanswered).map((q) => q.id))}
          >
            <span className="dash-icon">NEW</span>
            <strong>未回答の問題</strong>
            <small>{unanswered.length}問</small>
          </button>
          <button className="dash-card exam" onClick={() => startSession('本試験配分 30＋5', buildExamIds(), true)}>
            <span className="dash-icon">⏱</span>
            <strong>模擬試験</strong>
            <small>筆記30＋鑑別5・一括採点</small>
          </button>
        </section>

        <section className="today-focus">
          <div>
            <span className="eyebrow">最優先</span>
            <h2>間違いを消す ＞ 新問を増やす</h2>
          </div>
          <p>安全栓・封印、腐食・変形、薬剤適応、粉末作用、CO₂・泡・水系、法令・規格を短い反復で固める。</p>
        </section>

        <footer className="app-footer">
          個人学習用のオリジナル問題バンク。公式問題の転載ではありません。法令改正時は内容を更新します。
        </footer>
      </main>
    );
  }

  if (view === 'subjects') {
    return (
      <main className="otsu6-shell">
        <header className="topbar">
          <button className="back" onClick={goHome}>‹</button>
          <strong>科目別学習</strong>
          <span />
        </header>
        <section className="subject-list">
          {otsu6Categories.map((category) => {
            const stats = categoryStats(category);
            const ids = otsu6Questions.filter((q) => q.category === category).map((q) => q.id);
            return (
              <button key={category} className="subject-card" onClick={() => startSession(category, shuffle(ids))}>
                <div>
                  <strong>{category}</strong>
                  <small>{stats.answered}/{stats.total}問 ・ 正答率 {stats.accuracy}%</small>
                </div>
                <span>›</span>
              </button>
            );
          })}
        </section>
      </main>
    );
  }

  if (view === 'stats') {
    return (
      <main className="otsu6-shell">
        <header className="topbar">
          <button className="back" onClick={goHome}>‹</button>
          <strong>学習状況</strong>
          <span />
        </header>
        <section className="stats-summary">
          <div><strong>{answeredCount}</strong><span>回答済み</span></div>
          <div><strong>{attempts}</strong><span>総回答</span></div>
          <div><strong>{accuracy}%</strong><span>正答率</span></div>
        </section>
        <section className="subject-list">
          {otsu6Categories.map((category) => {
            const stats = categoryStats(category);
            return (
              <div key={category} className="subject-card static">
                <div>
                  <strong>{category}</strong>
                  <small>{stats.answered}/{stats.total}問 ・ 正答率 {stats.accuracy}%</small>
                </div>
                <span>{stats.accuracy}%</span>
              </div>
            );
          })}
        </section>
        <section className="legacy-note compact">
          <span>旧アプリ記録</span>
          <strong>{state.legacy.answered}/{state.legacy.total}問</strong>
          <small>誤答 {state.legacy.wrong}問・ブックマーク {state.legacy.bookmarks}問</small>
        </section>
      </main>
    );
  }

  if (view === 'exam-result' && examResult && session) {
    const written = examResult.law + examResult.basics + examResult.structure;
    return (
      <main className="otsu6-shell">
        <header className="topbar">
          <button className="back" onClick={goHome}>‹</button>
          <strong>模擬試験 結果</strong>
          <span />
        </header>
        <section className={`result-hero ${examResult.passedGuide ? 'pass' : 'retry'}`}>
          <span>{examResult.passedGuide ? '合格基準クリア目安' : '復習ポイントあり'}</span>
          <strong>{examResult.correct} / {examResult.total}</strong>
          <small>所要 {formatElapsed(session.startedAt)}</small>
        </section>
        <section className="result-grid">
          <div><span>法令</span><strong>{examResult.law}/10</strong><small>目安 4以上</small></div>
          <div><span>基礎</span><strong>{examResult.basics}/5</strong><small>目安 2以上</small></div>
          <div><span>構造等</span><strong>{examResult.structure}/15</strong><small>目安 6以上</small></div>
          <div><span>筆記全体</span><strong>{written}/30</strong><small>目安 18以上</small></div>
          <div><span>鑑別等</span><strong>{examResult.practical}/5</strong><small>目安 3以上</small></div>
        </section>
        <button className="primary-wide" onClick={() => startSession('間違えた問題', wrong.map((q) => q.id))} disabled={wrong.length === 0}>
          今の誤答をすぐ復習する
        </button>
        <button className="secondary-wide" onClick={() => startSession('本試験配分 30＋5', buildExamIds(), true)}>
          もう一度 30＋5
        </button>
      </main>
    );
  }

  if (view === 'session' && session && currentQuestion) {
    const q = currentQuestion;
    const answerRecord = state.answers[q.id];
    const examSelected = session.exam ? examAnswers[q.id] : undefined;
    const chosen = selected ?? examSelected ?? null;
    return (
      <main className="otsu6-shell question-page">
        <header className="question-header">
          <button className="back" onClick={goHome}>‹</button>
          <div>
            <strong>{session.title}</strong>
            <small>{q.category}</small>
          </div>
          <button className={`star ${isBookmarked ? 'active' : ''}`} onClick={() => toggleBookmark(q.id)} aria-label="ブックマーク">
            ☆
          </button>
        </header>

        <div className="question-progress-row">
          <span>{session.index + 1} / {session.ids.length}</span>
          {session.exam ? <strong>⏱ {formatElapsed(session.startedAt)}</strong> : <strong>{answerRecord ? `挑戦 ${answerRecord.attempts}回` : 'NEW'}</strong>}
        </div>
        <div className="question-progress-track">
          <span style={{ width: `${((session.index + 1) / session.ids.length) * 100}%` }} />
        </div>

        <section className="question-card">
          <span className="qmark">Q.</span>
          <h1>{q.prompt}</h1>
        </section>

        <section className="choice-list">
          {q.choices.map((choice, index) => {
            const isChosen = chosen === index;
            const isCorrect = index === q.answer;
            let cls = 'choice';
            if (!session.exam && revealed && isCorrect) cls += ' correct';
            if (!session.exam && revealed && isChosen && !isCorrect) cls += ' wrong';
            if ((session.exam && isChosen) || (!session.exam && !revealed && isChosen)) cls += ' selected';
            return (
              <button key={`${q.id}-${index}`} className={cls} onClick={() => choose(index)} disabled={!session.exam && revealed}>
                <span className="choice-number">{index + 1}</span>
                <span>{choice}</span>
                {!session.exam && revealed && isCorrect ? <b>✓</b> : null}
                {!session.exam && revealed && isChosen && !isCorrect ? <b>×</b> : null}
              </button>
            );
          })}
        </section>

        {!session.exam && revealed ? (
          <section className="explanation">
            <div className="explanation-title">💡 解説</div>
            <p>{q.explanation}</p>
            {q.memory ? <div className="memory">覚え方：{q.memory}</div> : null}
          </section>
        ) : null}

        {session.exam ? (
          <div className="exam-note">模擬試験中は正解を表示しません。35問終了後に一括採点します。</div>
        ) : null}

        <button
          className="next-button"
          disabled={session.exam ? selected === null : !revealed}
          onClick={goNext}
        >
          {session.index === session.ids.length - 1 ? (session.exam ? '採点する' : '終了する') : '次の問題へ →'}
        </button>
      </main>
    );
  }

  return null;
}
