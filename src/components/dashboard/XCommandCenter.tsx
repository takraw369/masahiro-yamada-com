import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { motionPresets } from '../../data/motionPresetCatalog';
import { LAST_X_ACCOUNT_KEY } from '../../lib/xAccountPlaybook';
import { getXConnectionIssue, type XConnectionIssue } from '../../lib/xConnectionIssue';
import { X_COMPOSER_MAX_CHARS as MAX_CHARS, findConnectedXAccount, prepareXComposeReview, isCurrentXComposeReview, type XComposeAccount, type XComposeReview } from '../../lib/xComposerReview';

const CATEGORIES = [
  { id: 'brain', label: '脳科学', keywords: ['前頭前野', 'ドーパミン', '神経可塑性', '集中力', 'ADHD', '記憶定着', 'ワーキングメモリ', '睡眠と脳', 'フロー状態', '認知科学'] },
  { id: 'health', label: '健康', keywords: ['呼吸法', '自律神経', 'パフォーマンス', '食事設計', '睡眠最適化', '体のリズム', '筋肉と脳', '回復力', 'バイオハック', 'コンディション'] },
  { id: 'relation', label: 'リレーション', keywords: ['コーチング', '信頼構築', '心理的安全性', 'コミュニティ', '選手との関係', '傾聴力', '影響力', 'チーム設計', '共感', 'メンター'] },
] as const;
type CategoryId = (typeof CATEGORIES)[number]['id'];
type ScheduledPost = { id: string; xAccountId: string; text: string; scheduledAt: string; status: string };
// Reuse PR #303's canonical grammar; only user-triggered feedback moves.
const motionStyle = Object.fromEntries(['quiet-fade', 'press', 'success'].flatMap(id => {
  const preset = motionPresets.find(item => item.id === id)!;
  return [[`--x-${id}-duration`, `${preset.duration}ms`], [`--x-${id}-easing`, preset.easing]];
})) as CSSProperties;

export default function XCommandCenter() {
  const [accounts, setAccounts] = useState<XComposeAccount[]>([]);
  const [accountState, setAccountState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [accountIssue, setAccountIssue] = useState<XConnectionIssue>(getXConnectionIssue());
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeCat, setActiveCat] = useState<CategoryId | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [scheduleState, setScheduleState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [scheduleIssue, setScheduleIssue] = useState<XConnectionIssue>(getXConnectionIssue());
  const [status, setStatus] = useState<'idle' | 'posting' | 'ok' | 'err'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [tab, setTab] = useState<'compose' | 'scheduled'>('compose');
  const [review, setReview] = useState<XComposeReview | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const draftField = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const requestedHandle = useRef<string | null>(null);
  const unavailableAccountMessage = '指定されたアカウントは接続一覧にありません。接続を確認してください。本文は保持しています。';

  async function loadAccounts() {
    setAccountState('loading');
    try {
      const res = await fetch('/api/x-harness/x-accounts');
      const data = await res.json().catch(() => null) as { data?: XComposeAccount[] } | null;
      if (!res.ok) { setAccountIssue(getXConnectionIssue(res.status, data)); setAccountState('error'); return; }
      if (!data) throw new Error('accounts_unavailable');
      if (!Array.isArray(data.data)) throw new Error('accounts_unavailable');
      const active = data.data.filter(a => a.isActive === true);
      setAccounts(active);
      let last: string | null = null;
      try { last = localStorage.getItem(LAST_X_ACCOUNT_KEY); } catch {}
      if (requestedHandle.current) {
        const requested = findConnectedXAccount(active, requestedHandle.current);
        setSelectedAccount(requested?.id || '');
        if (!requested) { setStatus('err'); setStatusMsg(unavailableAccountMessage); }
        else { setStatus('idle'); setStatusMsg(''); }
      } else {
        setSelectedAccount(current => active.some(a => a.id === current) ? current : (active.find(a => a.username === last)?.id || active[0]?.id || ''));
      }
      setAccountState('ready');
    } catch { setAccountIssue(getXConnectionIssue()); setAccountState('error'); }
  }
  async function loadScheduled() {
    setScheduleState('loading');
    try {
      const res = await fetch('/api/x-harness/posts/scheduled');
      const data = await res.json().catch(() => null) as { data?: ScheduledPost[] } | null;
      if (!res.ok) { setScheduleIssue(getXConnectionIssue(res.status, data)); setScheduleState('error'); return; }
      if (!data) throw new Error('scheduled_unavailable');
      if (!Array.isArray(data.data)) throw new Error('scheduled_unavailable');
      setScheduled(data.data); setScheduleState('ready');
    } catch { setScheduleIssue(getXConnectionIssue()); setScheduleState('error'); }
  }
  useEffect(() => {
    void loadAccounts(); void loadScheduled();
  }, []);
  useEffect(() => {
    const openComposer = (event: Event) => {
      setTab('compose'); setReview(null);
      const username = (event as CustomEvent<{ username?: string }>).detail?.username;
      if (typeof username !== 'string' || !username) return;
      requestedHandle.current = username;
      const requested = findConnectedXAccount(accounts, username);
      setSelectedAccount(requested?.id || '');
      if (!requested && accountState === 'ready') { setStatus('err'); setStatusMsg(unavailableAccountMessage); }
      else { setStatus('idle'); setStatusMsg(''); }
    };
    window.addEventListener('masa:x-compose', openComposer);
    return () => window.removeEventListener('masa:x-compose', openComposer);
  }, [accounts, accountState]);
  useEffect(() => { setReview(null); }, [text, selectedAccount, mode, scheduledAt]);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);

  const value = { text, accountId: selectedAccount, mode, scheduledAt };
  const remaining = MAX_CHARS - text.length;
  const cat = CATEGORIES.find(c => c.id === activeCat);
  const canReview = Boolean(text.trim() && remaining >= 0 && selectedAccount && accountState === 'ready');
  function showReview() {
    try { setReview(prepareXComposeReview(value, accounts)); setStatus('idle'); setStatusMsg(''); }
    catch (error) { setStatus('err'); setStatusMsg(error instanceof Error ? error.message : '内容を確認してください。'); }
  }
  async function handlePost() {
    if (sending.current || !review) return;
    if (!isCurrentXComposeReview(review, value, accounts)) {
      setReview(null); setStatus('err'); setStatusMsg('内容か日時が変わりました。もう一度確認してください。'); return;
    }
    sending.current = true; setStatus('posting');
    try {
      const res = await fetch(mode === 'now' ? '/api/x-harness/posts' : '/api/x-harness/posts/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xAccountId: review.accountId, text: review.text, ...(mode === 'schedule' ? { scheduledAt: review.scheduledAt } : {}) }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || '送信できませんでした。本文は保持しています。');
      setStatus('ok'); setStatusMsg(mode === 'now' ? '投稿しました。' : '予約しました。'); setText(''); setReview(null);
      if (mode === 'schedule') void loadScheduled();
    } catch (error) { setStatus('err'); setStatusMsg(error instanceof Error ? error.message : '送信できませんでした。'); }
    finally { sending.current = false; }
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(text); setStatus('ok'); setStatusMsg('本文をコピーしました。'); }
    catch { setStatus('err'); setStatusMsg('コピーできませんでした。本文を選択してコピーしてください。'); }
  }

  return (
    <section className="x-composer" aria-label="X本文の編集" style={motionStyle}>
      <div className="x-tabs" aria-label="本文と予約一覧">
        <button type="button" aria-pressed={tab === 'compose'} onClick={() => setTab('compose')}>本文を編集</button>
        <button type="button" aria-pressed={tab === 'scheduled'} onClick={() => setTab('scheduled')}>予約済み{scheduleState === 'ready' ? ` (${scheduled.length})` : ''}</button>
      </div>
      <div hidden={tab !== 'compose'}>
        <div className="x-edit-layout">
          <div className="x-writing">
            <div className="x-account-field">
              <label htmlFor="x-account">届けるアカウント</label>
              <div className="x-account-controls">
              <select id="x-account" value={selectedAccount} disabled={status === 'posting' || accountState !== 'ready' || !accounts.length} onChange={e => { requestedHandle.current = null; setSelectedAccount(e.target.value); setStatus('idle'); setStatusMsg(''); }}>
                {!!accounts.length && !selectedAccount && <option value="">接続先を選択してください</option>}
                {!accounts.length && <option value="">{accountState === 'loading' ? '接続先を確認中…' : accountState === 'error' ? '接続先を確認できません' : '送信できる接続先がありません'}</option>}
                {accounts.map(a => <option key={a.id} value={a.id}>@{a.username}</option>)}
              </select>
              {accountState === 'error' && <button type="button" onClick={() => void loadAccounts()}>{accountIssue.retryLabel}</button>}
              </div>
              {accountState === 'error' && <p className="x-muted" role="status">{accountIssue.message}</p>}
              {accountState === 'ready' && !accounts.length && <p className="x-muted">本文は編集できます。送信には接続先が必要です。</p>}
            </div>
            <label htmlFor="x-publish-text" className="x-body-label">投稿本文</label>
            <textarea ref={draftField} id="x-publish-text" value={text} onChange={e => setText(e.target.value)} placeholder="今日の気づきをシェアする…" maxLength={MAX_CHARS} disabled={status === 'posting'} aria-describedby="x-character-count x-draft-note" />
            <div className="x-count-row"><span id="x-draft-note">編集中の本文</span><span id="x-character-count" aria-live="polite">{text.length} / {MAX_CHARS}文字</span></div>
            <div className="x-mode" aria-label="届けるタイミング">
              <button type="button" aria-pressed={mode === 'now'} disabled={status === 'posting'} onClick={() => setMode('now')}>今届ける</button>
              <button type="button" aria-pressed={mode === 'schedule'} disabled={status === 'posting'} onClick={() => setMode('schedule')}>日時を決める</button>
            </div>
            {mode === 'schedule' && <div className="x-date"><label htmlFor="x-scheduled-at">予約日時（この端末の時間）</label><input id="x-scheduled-at" type="datetime-local" value={scheduledAt} disabled={status === 'posting'} onChange={e => setScheduledAt(e.target.value)} /></div>}
            {!review && <div className="x-editor-actions"><button type="button" className="x-primary" onClick={showReview} disabled={!canReview || status === 'posting'}>送信前の確認へ →</button><button type="button" onClick={() => void copyDraft()} disabled={!text || status === 'posting'}>本文をコピー</button></div>}
            {!review && <p className="x-action-hint">次に本文・投稿先・日時を確認します。</p>}
            {(status === 'ok' || status === 'err') && <p className={`x-status x-status-${status}`} role={status === 'err' ? 'alert' : 'status'}>{statusMsg}</p>}
          </div>
          {review && <section className="x-review" aria-label="送信前の確認">
            <h2 ref={reviewHeading} tabIndex={-1}>この内容で届ける</h2>
            <dl><div><dt>投稿先</dt><dd>@{review.username}</dd></div><div><dt>タイミング</dt><dd>{review.mode === 'now' ? '確認後、今すぐ' : new Date(review.scheduledAt).toLocaleString('ja-JP')}</dd></div></dl>
            <div className="x-preview-text">{review.text}</div>
            <p className="x-muted">言葉・事実・投稿先を確認してください。</p>
            <div className="x-review-actions"><button type="button" className="x-primary" onClick={() => void handlePost()} disabled={status === 'posting'}>{status === 'posting' ? '送信中…' : review.mode === 'now' ? '確認して投稿する' : '確認して予約する'}</button><button type="button" onClick={() => { setReview(null); draftField.current?.focus(); }} disabled={status === 'posting'}>編集へ戻る</button></div>
          </section>}
        </div>
        <details className="x-keywords"><summary>ハッシュタグを添える<span aria-hidden="true">＋</span></summary>
          <div className="x-keyword-body"><div className="x-chips">{CATEGORIES.map(c => <button key={c.id} type="button" aria-pressed={activeCat === c.id} onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}>{c.label}</button>)}</div>
          {cat && <div className="x-chips">{cat.keywords.map(kw => <button key={kw} type="button" disabled={status === 'posting' || text.length + kw.length + (text ? 2 : 1) > MAX_CHARS} onClick={() => setText(prev => prev ? `${prev} #${kw}` : `#${kw}`)}>#{kw}</button>)}</div>}</div>
        </details>
      </div>
      <div hidden={tab !== 'scheduled'} className="x-scheduled">
        {scheduleState === 'loading' && <p role="status">予約一覧を読み込み中…</p>}
        {scheduleState === 'error' && <p role="status">予約一覧を読み込めませんでした。{scheduleIssue.message}<button type="button" onClick={() => void loadScheduled()}>{scheduleIssue.retryLabel}</button></p>}
        {scheduleState === 'ready' && !scheduled.length && <p>予約した投稿は、ここに並びます。</p>}
        {scheduled.map(p => <article key={p.id}><p>{p.text}</p><small>{new Date(p.scheduledAt).toLocaleString('ja-JP')} · {p.status}</small></article>)}
      </div>
    </section>
  );
}
