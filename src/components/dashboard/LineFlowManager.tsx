import { useEffect, useMemo, useState } from 'react';

type LineAccount = { id: string; name?: string; displayName?: string; channelId?: string; isActive?: boolean };
type Tag = { id: string; name: string; color?: string };
type TriggerType = 'friend_add' | 'tag_added' | 'manual';
type DeliveryMode = 'relative' | 'elapsed' | 'absolute_time';
type MessageType = 'text' | 'image' | 'flex';
type ConditionType = '' | 'tag_exists' | 'tag_not_exists' | 'metadata_equals' | 'metadata_not_equals';

type Scenario = {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerTagId: string | null;
  lineAccountId?: string | null;
  isActive: boolean;
  deliveryMode?: DeliveryMode;
  stepCount?: number;
  createdAt: string;
  updatedAt: string;
};

type ScenarioStep = {
  id: string;
  scenarioId: string;
  stepOrder: number;
  delayMinutes: number;
  offsetDays?: number | null;
  offsetMinutes?: number | null;
  deliveryTime?: string | null;
  messageType: MessageType;
  messageContent: string;
  conditionType: string | null;
  conditionValue: string | null;
  nextStepOnFalse: number | null;
  templateId?: string | null;
  onReachTagId?: string | null;
  createdAt: string;
};

type ScenarioDetail = Scenario & { steps: ScenarioStep[] };
type ScenarioStats = {
  enrolledTotal: number;
  activeNow: number;
  completed: number;
  paused: number;
  steps: Array<{ stepOrder: number; reachedCount: number; reachRate: number }>;
};

type ApiResponse<T> = { success: boolean; data: T; error?: string };

type StepForm = {
  delayMinutes: number;
  offsetDays: number;
  offsetMinutes: number;
  deliveryTime: string;
  messageType: MessageType;
  messageContent: string;
  conditionType: ConditionType;
  conditionValue: string;
  nextStepOnFalse: string;
  onReachTagId: string;
};

const EMPTY_STEP: StepForm = {
  delayMinutes: 0,
  offsetDays: 0,
  offsetMinutes: 0,
  deliveryTime: '09:00',
  messageType: 'text',
  messageContent: '',
  conditionType: '',
  conditionValue: '',
  nextStepOnFalse: '',
  onReachTagId: '',
};

const triggerMeta: Record<TriggerType, { icon: string; label: string; detail: string }> = {
  friend_add: { icon: '👋', label: '友だち追加', detail: 'friend_add' },
  tag_added: { icon: '🏷️', label: 'タグ付与', detail: 'tag_added' },
  manual: { icon: '▶', label: '手動スタート', detail: 'manual' },
};

const messageMeta: Record<MessageType, { icon: string; label: string }> = {
  text: { icon: '💬', label: 'Text' },
  image: { icon: '🖼️', label: 'Image' },
  flex: { icon: '▦', label: 'Flex' },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/line-harness/${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
  });
  const payload = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload.data as T;
}

function accountName(account: LineAccount) {
  return account.name || account.displayName || account.channelId || account.id;
}

function scheduleLabel(mode: DeliveryMode, step: ScenarioStep) {
  if (mode === 'elapsed') {
    const days = step.offsetDays ?? 0;
    const minutes = step.offsetMinutes ?? 0;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (days === 0 && minutes === 0) return 'すぐ';
    return `${days ? `${days}日 ` : ''}${hours ? `${hours}時間 ` : ''}${rest ? `${rest}分 ` : ''}後`.trim();
  }
  if (mode === 'absolute_time') {
    return `${step.offsetDays ?? 0}日後 ${step.deliveryTime || '09:00'}`;
  }
  const minutes = step.delayMinutes ?? 0;
  if (minutes === 0) return 'すぐ';
  if (minutes < 60) return `${minutes}分後`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ''}後`;
  const days = Math.floor(minutes / 1440);
  const rem = minutes % 1440;
  return `${days}日${rem ? `${Math.floor(rem / 60)}時間` : ''}後`;
}

function stepToForm(step: ScenarioStep): StepForm {
  return {
    delayMinutes: step.delayMinutes ?? 0,
    offsetDays: step.offsetDays ?? 0,
    offsetMinutes: step.offsetMinutes ?? 0,
    deliveryTime: step.deliveryTime || '09:00',
    messageType: step.messageType,
    messageContent: step.messageContent,
    conditionType: (step.conditionType || '') as ConditionType,
    conditionValue: step.conditionValue || '',
    nextStepOnFalse: step.nextStepOnFalse ? String(step.nextStepOnFalse) : '',
    onReachTagId: step.onReachTagId || '',
  };
}

export default function LineFlowManager() {
  const [accounts, setAccounts] = useState<LineAccount[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [accountId, setAccountId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [stats, setStats] = useState<ScenarioStats | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [form, setForm] = useState<StepForm>(EMPTY_STEP);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newScenario, setNewScenario] = useState({ name: '', description: '', triggerType: 'friend_add' as TriggerType, triggerTagId: '', deliveryMode: 'elapsed' as DeliveryMode });

  const visibleScenarios = useMemo(() => {
    if (!accountId) return scenarios;
    return scenarios.filter((item) => item.lineAccountId == null || item.lineAccountId === accountId);
  }, [scenarios, accountId]);

  const selectedStep = scenario?.steps.find((step) => step.id === selectedStepId) ?? null;
  const deliveryMode: DeliveryMode = (scenario?.deliveryMode || 'relative') as DeliveryMode;

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2600);
  };

  const loadBase = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountData, tagData, scenarioData] = await Promise.all([
        request<LineAccount[]>('line-accounts'),
        request<Tag[]>('tags'),
        request<Scenario[]>('scenarios'),
      ]);
      setAccounts(accountData ?? []);
      setTags(tagData ?? []);
      setScenarios(scenarioData ?? []);
      const nextAccount = accountId || accountData?.[0]?.id || '';
      setAccountId(nextAccount);
      const eligible = (scenarioData ?? []).filter((item) => !nextAccount || item.lineAccountId == null || item.lineAccountId === nextAccount);
      if (!scenarioId && eligible[0]) setScenarioId(eligible[0].id);
    } catch (e) {
      setError(`LINE Harnessを読み込めませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadScenario = async (id: string) => {
    if (!id) {
      setScenario(null);
      setStats(null);
      return;
    }
    setDetailLoading(true);
    setError('');
    try {
      const [detail, scenarioStats] = await Promise.all([
        request<ScenarioDetail>(`scenarios/${id}`),
        request<ScenarioStats>(`scenarios/${id}/stats`).catch(() => null),
      ]);
      const sorted = { ...detail, steps: [...(detail.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder) };
      setScenario(sorted);
      setStats(scenarioStats);
      const keep = sorted.steps.find((step) => step.id === selectedStepId);
      const next = keep || sorted.steps[0] || null;
      setSelectedStepId(next?.id ?? null);
      setForm(next ? stepToForm(next) : EMPTY_STEP);
    } catch (e) {
      setError(`Flowを読み込めませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (scenarioId) loadScenario(scenarioId); }, [scenarioId]);
  useEffect(() => {
    if (!accountId) return;
    const eligible = scenarios.filter((item) => item.lineAccountId == null || item.lineAccountId === accountId);
    if (!eligible.some((item) => item.id === scenarioId)) setScenarioId(eligible[0]?.id || '');
  }, [accountId, scenarios]);
  useEffect(() => { if (selectedStep) setForm(stepToForm(selectedStep)); }, [selectedStepId]);

  const saveStep = async () => {
    if (!scenario || !selectedStep) return;
    if (!form.messageContent.trim()) {
      setError('メッセージ内容を入れてください。');
      return;
    }
    if (scenario.isActive && !window.confirm('このFlowは稼働中です。変更は今後の配信に影響する可能性があります。保存しますか？')) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        messageType: form.messageType,
        messageContent: form.messageContent,
        templateId: null,
        conditionType: form.conditionType || null,
        conditionValue: form.conditionType ? form.conditionValue : null,
        nextStepOnFalse: form.nextStepOnFalse ? Number(form.nextStepOnFalse) : null,
        onReachTagId: form.onReachTagId || null,
      };
      if (deliveryMode === 'relative') payload.delayMinutes = Math.max(0, Number(form.delayMinutes) || 0);
      if (deliveryMode === 'elapsed') {
        payload.offsetDays = Math.max(0, Number(form.offsetDays) || 0);
        payload.offsetMinutes = Math.max(0, Math.min(1439, Number(form.offsetMinutes) || 0));
      }
      if (deliveryMode === 'absolute_time') {
        payload.offsetDays = Math.max(0, Number(form.offsetDays) || 0);
        payload.deliveryTime = form.deliveryTime;
      }
      await request(`scenarios/${scenario.id}/steps/${selectedStep.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      await loadScenario(scenario.id);
      flash('✓ Stepを保存しました');
    } catch (e) {
      setError(`保存できませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setSaving(false);
    }
  };

  const addStep = async () => {
    if (!scenario) return;
    if (scenario.isActive && !window.confirm('このFlowは稼働中です。新しいStepを追加しますか？')) return;
    setSaving(true);
    setError('');
    try {
      const nextOrder = scenario.steps.length ? Math.max(...scenario.steps.map((step) => step.stepOrder)) + 1 : 1;
      const payload: Record<string, unknown> = { stepOrder: nextOrder, messageType: 'text', messageContent: '新しいメッセージ' };
      if (deliveryMode === 'relative') payload.delayMinutes = 0;
      if (deliveryMode === 'elapsed') { payload.offsetDays = 0; payload.offsetMinutes = 0; }
      if (deliveryMode === 'absolute_time') { payload.offsetDays = 0; payload.deliveryTime = '09:00'; }
      const created = await request<ScenarioStep>(`scenarios/${scenario.id}/steps`, { method: 'POST', body: JSON.stringify(payload) });
      await loadScenario(scenario.id);
      setSelectedStepId(created.id);
      flash('＋ Stepを追加しました');
    } catch (e) {
      setError(`Stepを追加できませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteStep = async () => {
    if (!scenario || !selectedStep) return;
    const warning = scenario.isActive ? 'このFlowは稼働中です。選択中のStepを削除します。よろしいですか？' : '選択中のStepを削除します。よろしいですか？';
    if (!window.confirm(warning)) return;
    setSaving(true);
    setError('');
    try {
      await request(`scenarios/${scenario.id}/steps/${selectedStep.id}`, { method: 'DELETE' });
      setSelectedStepId(null);
      await loadScenario(scenario.id);
      flash('Stepを削除しました');
    } catch (e) {
      setError(`削除できませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setSaving(false);
    }
  };

  const moveStep = async (direction: -1 | 1) => {
    if (!scenario || !selectedStep) return;
    const sorted = [...scenario.steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const index = sorted.findIndex((step) => step.id === selectedStep.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;
    const other = sorted[swapIndex];
    setSaving(true);
    setError('');
    try {
      await request(`scenarios/${scenario.id}/steps/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orders: [
          { stepId: selectedStep.id, stepOrder: other.stepOrder },
          { stepId: other.id, stepOrder: selectedStep.stepOrder },
        ] }),
      });
      await loadScenario(scenario.id);
      flash('順番を入れ替えました');
    } catch (e) {
      setError(`並び替えできませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!scenario) return;
    const next = !scenario.isActive;
    if (next && !window.confirm('このFlowを稼働させます。条件に合う友だちに自動配信される可能性があります。稼働しますか？')) return;
    setSaving(true);
    setError('');
    try {
      await request(`scenarios/${scenario.id}`, { method: 'PUT', body: JSON.stringify({ isActive: next }) });
      await Promise.all([loadScenario(scenario.id), loadBase()]);
      flash(next ? '● Flowを稼働しました' : 'Ⅱ Flowを停止しました');
    } catch (e) {
      setError(`状態を変更できませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setSaving(false);
    }
  };

  const createScenario = async () => {
    if (!newScenario.name.trim()) {
      setError('Flow名を入れてください。');
      return;
    }
    if (newScenario.triggerType === 'tag_added' && !newScenario.triggerTagId) {
      setError('タグ付与トリガーではタグを選んでください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await request<Scenario>('scenarios', {
        method: 'POST',
        body: JSON.stringify({
          name: newScenario.name.trim(),
          description: newScenario.description.trim() || null,
          triggerType: newScenario.triggerType,
          triggerTagId: newScenario.triggerType === 'tag_added' ? newScenario.triggerTagId : null,
          lineAccountId: accountId || undefined,
          deliveryMode: newScenario.deliveryMode,
          isActive: false,
        }),
      });
      setCreateOpen(false);
      setNewScenario({ name: '', description: '', triggerType: 'friend_add', triggerTagId: '', deliveryMode: 'elapsed' });
      await loadBase();
      setScenarioId(created.id);
      flash('新しいFlowを「停止中」で作成しました');
    } catch (e) {
      setError(`Flowを作成できませんでした: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setSaving(false);
    }
  };

  const statFor = (order: number) => stats?.steps.find((item) => item.stepOrder === order);
  const tagName = (id: string | null | undefined) => tags.find((tag) => tag.id === id)?.name || id || '—';

  return (
    <div className="line-flow-app">
      <style>{styles}</style>
      <header className="app-header">
        <div className="brand-block">
          <a href="/dashboard/ui-v2-2" className="back">← MASA OS</a>
          <div className="brand-row"><span className="line-logo">L</span><div><p>OUTPUT · LINE</p><h1>LINE Flow</h1></div></div>
          <p className="brand-desc">顧客が動く流れを、見て・触って・整える。</p>
        </div>
        <div className="header-actions">
          <label className="account-select"><span>LINE ACCOUNT</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountName(account)}</option>)}</select></label>
          <button className="ghost" onClick={loadBase} disabled={loading || saving}>↻ 更新</button>
          <button className="primary" onClick={() => setCreateOpen(true)} disabled={saving}>＋ Flow</button>
        </div>
      </header>

      {status && <div className="toast">{status}</div>}
      {error && <div className="error-banner"><span>!</span><p>{error}</p><button onClick={() => setError('')} aria-label="閉じる">×</button></div>}

      <main className="workspace">
        <aside className="scenario-rail">
          <div className="rail-head"><div><span>FLOWS</span><strong>{visibleScenarios.length}</strong></div><button onClick={() => setCreateOpen(true)}>＋</button></div>
          {loading ? <div className="empty">読み込み中…</div> : visibleScenarios.length === 0 ? <div className="empty"><span className="empty-icon">🌱</span><strong>Flowはまだありません</strong><small>最初のFlowを作る</small></div> : visibleScenarios.map((item) => (
            <button key={item.id} className={`scenario-item ${scenarioId === item.id ? 'selected' : ''}`} onClick={() => setScenarioId(item.id)}>
              <span className={`status-dot ${item.isActive ? 'live' : ''}`} />
              <span className="scenario-copy"><strong>{item.name}</strong><small>{triggerMeta[item.triggerType]?.icon} {triggerMeta[item.triggerType]?.label} · {item.stepCount ?? '—'} steps</small></span>
              <span className="scenario-arrow">›</span>
            </button>
          ))}
        </aside>

        <section className="flow-stage">
          {!scenarioId ? <div className="stage-empty"><span>🌿</span><h2>Flowを選ぶか、新しく作る。</h2></div> : detailLoading || !scenario ? <div className="stage-empty"><span>◌</span><h2>Flowを読み込み中…</h2></div> : <>
            <header className="flow-head">
              <div><div className="flow-title-line"><span className={`live-badge ${scenario.isActive ? 'on' : ''}`}>{scenario.isActive ? '● LIVE' : '○ STOPPED'}</span><span className="mode-badge">{deliveryMode === 'relative' ? '前Step基準' : deliveryMode === 'elapsed' ? '登録時点基準' : '時刻指定'}</span></div><h2>{scenario.name}</h2><p>{scenario.description || '説明なし'}</p></div>
              <div className="flow-actions"><button className={scenario.isActive ? 'stop-button' : 'start-button'} onClick={toggleActive} disabled={saving}>{scenario.isActive ? 'Ⅱ 停止する' : '▶ 稼働する'}</button></div>
            </header>

            <div className="metric-row">
              <div><span>登録</span><strong>{stats?.enrolledTotal ?? '—'}</strong></div>
              <div><span>進行中</span><strong>{stats?.activeNow ?? '—'}</strong></div>
              <div><span>完了</span><strong>{stats?.completed ?? '—'}</strong></div>
              <div><span>一時停止</span><strong>{stats?.paused ?? '—'}</strong></div>
            </div>

            <div className="flow-canvas">
              <div className="trigger-card">
                <span className="node-icon trigger-icon">{triggerMeta[scenario.triggerType]?.icon}</span>
                <div><span className="node-label">TRIGGER</span><strong>{triggerMeta[scenario.triggerType]?.label}</strong><small>{scenario.triggerType === 'tag_added' ? `tag: ${tagName(scenario.triggerTagId)}` : triggerMeta[scenario.triggerType]?.detail}</small></div>
              </div>
              <div className="line-down"><span>↓</span></div>

              {scenario.steps.length === 0 ? <div className="no-step"><span>🫧</span><strong>まだStepがありません</strong><button onClick={addStep} disabled={saving}>最初のStepを追加</button></div> : scenario.steps.map((step, index) => {
                const reach = statFor(step.stepOrder);
                const isSelected = selectedStepId === step.id;
                return <div key={step.id} className="step-wrap">
                  <button className={`step-card ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedStepId(step.id)}>
                    <span className={`node-icon message-icon ${step.messageType}`}>{messageMeta[step.messageType]?.icon}</span>
                    <span className="step-main"><span className="step-meta"><b>STEP {step.stepOrder}</b><em>{scheduleLabel(deliveryMode, step)}</em></span><strong>{step.messageContent.slice(0, 72) || '(空)'}</strong><span className="step-tags">{step.conditionType && <i>IF · {step.conditionType}</i>}{step.onReachTagId && <i>＋ 🏷️ {tagName(step.onReachTagId)}</i>}{step.templateId && <i>Template</i>}</span></span>
                    <span className="reach"><b>{reach ? `${Math.round(reach.reachRate * 100)}%` : '—'}</b><small>到達</small></span>
                  </button>
                  {index < scenario.steps.length - 1 && <div className="line-down"><span>↓</span><small>{scheduleLabel(deliveryMode, scenario.steps[index + 1])}</small></div>}
                </div>;
              })}
              {scenario.steps.length > 0 && <div className="line-down"><span>↓</span></div>}
              <button className="add-step" onClick={addStep} disabled={saving}>＋ Stepを追加</button>
              <div className="end-node"><span>✓</span><strong>FLOW END</strong></div>
            </div>
          </>}
        </section>

        <aside className="inspector-panel">
          {!scenario ? <div className="inspector-empty"><span>👈</span><strong>Flowを選ぶ</strong><small>右側でStepを編集できます。</small></div> : !selectedStep ? <div className="inspector-empty"><span>✨</span><strong>Stepを選ぶ</strong><small>中央のカードをタップ。</small></div> : <>
            <div className="inspector-head"><div><span>INSPECTOR</span><h2>Step {selectedStep.stepOrder}</h2></div><span className="big-icon">{messageMeta[selectedStep.messageType]?.icon}</span></div>
            {selectedStep.templateId && <div className="template-warning">このStepはテンプレ参照中。ここで保存すると直接入力へ切り替わります。</div>}

            <fieldset><legend>⏱ WHEN</legend>
              {deliveryMode === 'relative' && <label><span>前のStepから何分後？</span><input type="number" min="0" value={form.delayMinutes} onChange={(e) => setForm({ ...form, delayMinutes: Number(e.target.value) })} /></label>}
              {deliveryMode === 'elapsed' && <div className="field-grid"><label><span>登録から何日後？</span><input type="number" min="0" value={form.offsetDays} onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })} /></label><label><span>＋何分？</span><input type="number" min="0" max="1439" value={form.offsetMinutes} onChange={(e) => setForm({ ...form, offsetMinutes: Number(e.target.value) })} /></label></div>}
              {deliveryMode === 'absolute_time' && <div className="field-grid"><label><span>登録から何日後？</span><input type="number" min="0" value={form.offsetDays} onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })} /></label><label><span>何時？</span><input type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} /></label></div>}
            </fieldset>

            <fieldset><legend>💬 DO</legend><label><span>メッセージ</span><select value={form.messageType} onChange={(e) => setForm({ ...form, messageType: e.target.value as MessageType })}><option value="text">💬 Text</option><option value="image">🖼️ Image JSON</option><option value="flex">▦ Flex JSON</option></select></label><label><span>{form.messageType === 'text' ? '本文' : 'JSON'}</span><textarea rows={8} value={form.messageContent} onChange={(e) => setForm({ ...form, messageContent: e.target.value })} /></label></fieldset>

            <fieldset><legend>◇ IF</legend><label><span>このStepを送る条件</span><select value={form.conditionType} onChange={(e) => setForm({ ...form, conditionType: e.target.value as ConditionType, conditionValue: '' })}><option value="">条件なし</option><option value="tag_exists">タグがある</option><option value="tag_not_exists">タグがない</option><option value="metadata_equals">情報が一致</option><option value="metadata_not_equals">情報が不一致</option></select></label>
              {(form.conditionType === 'tag_exists' || form.conditionType === 'tag_not_exists') && <label><span>タグ</span><select value={form.conditionValue} onChange={(e) => setForm({ ...form, conditionValue: e.target.value })}><option value="">選択…</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>}
              {(form.conditionType === 'metadata_equals' || form.conditionType === 'metadata_not_equals') && <label><span>条件 JSON</span><input value={form.conditionValue} placeholder='{"key":"plan","value":"premium"}' onChange={(e) => setForm({ ...form, conditionValue: e.target.value })} /></label>}
              {form.conditionType && <label><span>条件がFALSEなら Step</span><input type="number" min="1" value={form.nextStepOnFalse} placeholder="空欄 = 次へ" onChange={(e) => setForm({ ...form, nextStepOnFalse: e.target.value })} /></label>}
            </fieldset>

            <fieldset><legend>🏷️ AFTER</legend><label><span>到達時につけるタグ</span><select value={form.onReachTagId} onChange={(e) => setForm({ ...form, onReachTagId: e.target.value })}><option value="">なし</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label></fieldset>

            <div className="inspector-actions"><button className="save-button" onClick={saveStep} disabled={saving}>{saving ? '保存中…' : '保存する'}</button><div><button className="tiny" onClick={() => moveStep(-1)} disabled={saving || selectedStep.stepOrder === Math.min(...scenario.steps.map((s) => s.stepOrder))}>↑</button><button className="tiny" onClick={() => moveStep(1)} disabled={saving || selectedStep.stepOrder === Math.max(...scenario.steps.map((s) => s.stepOrder))}>↓</button><button className="tiny danger" onClick={deleteStep} disabled={saving}>削除</button></div></div>
          </>}
        </aside>
      </main>

      {createOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-flow-title"><header><div><span>NEW FLOW</span><h2 id="new-flow-title">自動で動く流れを作る</h2></div><button onClick={() => setCreateOpen(false)}>×</button></header><p className="safe-note">🛟 新しいFlowは必ず <strong>停止中</strong> で作成します。確認してから稼働できます。</p><label><span>Flow名</span><input value={newScenario.name} placeholder="例：新規登録 → 教育 → オファー" onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })} /></label><label><span>説明</span><input value={newScenario.description} placeholder="何のためのFlow？" onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })} /></label><div className="field-grid"><label><span>きっかけ</span><select value={newScenario.triggerType} onChange={(e) => setNewScenario({ ...newScenario, triggerType: e.target.value as TriggerType, triggerTagId: '' })}><option value="friend_add">👋 友だち追加</option><option value="tag_added">🏷️ タグ付与</option><option value="manual">▶ 手動</option></select></label><label><span>時間の考え方</span><select value={newScenario.deliveryMode} onChange={(e) => setNewScenario({ ...newScenario, deliveryMode: e.target.value as DeliveryMode })}><option value="elapsed">登録時点から</option><option value="absolute_time">登録からN日後の時刻</option><option value="relative">前Stepから</option></select></label></div>{newScenario.triggerType === 'tag_added' && <label><span>開始タグ</span><select value={newScenario.triggerTagId} onChange={(e) => setNewScenario({ ...newScenario, triggerTagId: e.target.value })}><option value="">選択…</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>}<footer><button className="ghost" onClick={() => setCreateOpen(false)}>キャンセル</button><button className="primary" onClick={createScenario} disabled={saving}>{saving ? '作成中…' : '停止中で作成'}</button></footer></section></div>}
    </div>
  );
}

const styles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  .line-flow-app { min-height:100vh; background:#f3f1ed; color:#17191c; font-family:'Zen Kaku Gothic New',system-ui,sans-serif; }
  button,select,input,textarea { font:inherit; }
  button { cursor:pointer; }
  .app-header { min-height:96px; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:16px 24px; background:#fbfaf8; border-bottom:1px solid #d8d4cd; position:sticky; top:0; z-index:30; }
  .brand-block { min-width:240px; }
  .back { color:#737b84; font-size:12px; text-decoration:none; }
  .brand-row { display:flex; align-items:center; gap:12px; margin-top:5px; }
  .line-logo { width:38px; height:38px; border-radius:9px; display:grid; place-items:center; background:#06c755; color:#fff; font-weight:900; box-shadow:0 4px 12px rgba(6,199,85,.16); }
  .brand-row p,.brand-row h1,.brand-desc { margin:0; }
  .brand-row p { color:#138a55; font-size:10px; letter-spacing:.14em; font-weight:800; }
  .brand-row h1 { font-family:'Cormorant Garamond',serif; font-size:27px; line-height:1; color:#4f3516; }
  .brand-desc { margin-top:7px; color:#68707a; font-size:12px; }
  .header-actions { display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .account-select { display:grid; gap:4px; }
  .account-select span { color:#79818a; font-size:9px; font-weight:800; letter-spacing:.1em; }
  select,input,textarea { width:100%; border:1px solid #d7d2ca; border-radius:8px; background:#fff; color:#202329; padding:10px 11px; outline:none; }
  select:focus,input:focus,textarea:focus { border-color:#a56c22; box-shadow:0 0 0 3px rgba(165,108,34,.1); }
  .account-select select { min-width:190px; padding:8px 32px 8px 10px; }
  .ghost,.primary,.start-button,.stop-button,.save-button { min-height:40px; border-radius:8px; padding:0 14px; font-weight:700; }
  .ghost { border:1px solid #d7d2ca; background:#fff; color:#4f5964; }
  .primary { border:1px solid #8e5e21; background:#a56c22; color:#fff; }
  .workspace { display:grid; grid-template-columns:250px minmax(440px,1fr) 340px; min-height:calc(100vh - 96px); }
  .scenario-rail { background:#fbfaf8; border-right:1px solid #ddd8d0; padding:14px 10px; overflow:auto; }
  .rail-head { display:flex; justify-content:space-between; align-items:center; padding:6px 6px 12px; }
  .rail-head>div { display:flex; align-items:center; gap:8px; }
  .rail-head span { color:#7b838c; font-size:10px; letter-spacing:.12em; font-weight:800; }
  .rail-head strong { min-width:22px; height:22px; display:grid; place-items:center; border-radius:50%; background:#ebe7df; font-size:11px; }
  .rail-head button { width:30px; height:30px; border:1px solid #d7d2ca; border-radius:8px; background:#fff; color:#8a5b22; font-size:18px; }
  .scenario-item { width:100%; display:grid; grid-template-columns:10px 1fr 18px; gap:10px; align-items:center; text-align:left; padding:12px 10px; margin-bottom:5px; border:1px solid transparent; border-radius:10px; background:transparent; color:#24272c; }
  .scenario-item:hover { background:#f3efe8; }
  .scenario-item.selected { background:#fff; border-color:#d7c6aa; box-shadow:0 5px 18px rgba(71,50,22,.06); }
  .status-dot { width:8px; height:8px; border-radius:50%; background:#b7b8b8; }
  .status-dot.live { background:#08a85a; box-shadow:0 0 0 4px rgba(8,168,90,.09); }
  .scenario-copy { min-width:0; display:grid; gap:3px; }
  .scenario-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
  .scenario-copy small { color:#7b838c; font-size:10px; }
  .scenario-arrow { color:#aaa49a; font-size:20px; }
  .empty,.stage-empty,.inspector-empty { min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#78808a; text-align:center; }
  .empty-icon,.stage-empty>span,.inspector-empty>span { font-size:28px; }
  .empty strong,.stage-empty h2,.inspector-empty strong { color:#353a40; font-size:14px; margin:0; }
  .empty small,.inspector-empty small { font-size:11px; }
  .flow-stage { min-width:0; padding:18px 22px 60px; overflow:auto; }
  .flow-head { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:12px; }
  .flow-head h2,.flow-head p { margin:0; }
  .flow-title-line { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:7px; }
  .live-badge,.mode-badge { border-radius:999px; padding:4px 8px; font-size:9px; font-weight:900; letter-spacing:.08em; }
  .live-badge { background:#eeeae4; color:#77716a; }
  .live-badge.on { background:#e4f7ec; color:#087c43; }
  .mode-badge { background:#f3eadc; color:#82541d; }
  .flow-head h2 { font-size:22px; }
  .flow-head p { margin-top:5px; color:#737b84; font-size:12px; }
  .start-button { border:1px solid #0e8b4d; background:#138a55; color:#fff; }
  .stop-button { border:1px solid #d7d2ca; background:#fff; color:#765b38; }
  .metric-row { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin:13px 0 18px; }
  .metric-row>div { display:flex; justify-content:space-between; align-items:baseline; padding:9px 11px; background:#fbfaf8; border:1px solid #e0dcd5; border-radius:8px; }
  .metric-row span { color:#7c838b; font-size:10px; }
  .metric-row strong { font-size:16px; color:#34383d; }
  .flow-canvas { max-width:720px; margin:0 auto; padding:8px 0 50px; }
  .trigger-card,.step-card,.end-node,.no-step { width:100%; border-radius:13px; background:#fff; border:1px solid #d9d5ce; box-shadow:0 8px 25px rgba(42,35,25,.05); }
  .trigger-card { display:flex; gap:14px; align-items:center; padding:15px 18px; border-color:#c9ddcf; background:#f8fdf9; }
  .node-icon { flex:0 0 auto; width:44px; height:44px; display:grid; place-items:center; border-radius:12px; font-size:20px; }
  .trigger-icon { background:#e4f7ec; }
  .message-icon { background:#f1eee9; }
  .message-icon.image { background:#eaf0fb; }
  .message-icon.flex { background:#f2eafd; }
  .node-label { color:#138a55; font-size:9px; font-weight:900; letter-spacing:.12em; }
  .trigger-card strong { display:block; margin-top:2px; font-size:14px; }
  .trigger-card small { display:block; margin-top:2px; color:#7a828b; font-size:10px; }
  .line-down { min-height:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#aaa397; }
  .line-down span { font-size:20px; line-height:1; }
  .line-down small { margin-top:3px; color:#8d8273; font-size:9px; }
  .step-card { display:grid; grid-template-columns:46px minmax(0,1fr) 54px; gap:13px; align-items:center; text-align:left; padding:13px 15px; transition:.15s ease; }
  .step-card:hover { transform:translateY(-1px); border-color:#c6b18f; }
  .step-card.selected { border-color:#a56c22; box-shadow:0 0 0 3px rgba(165,108,34,.09),0 10px 28px rgba(65,44,17,.08); }
  .step-main { min-width:0; }
  .step-meta { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
  .step-meta b { color:#8a5b22; font-size:9px; letter-spacing:.08em; }
  .step-meta em { color:#6e7780; font-size:10px; font-style:normal; }
  .step-main>strong { display:block; margin-top:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
  .step-tags { display:flex; gap:5px; flex-wrap:wrap; margin-top:6px; }
  .step-tags i { padding:3px 6px; border-radius:999px; background:#f0ede8; color:#6a7179; font-size:8px; font-style:normal; }
  .reach { display:grid; text-align:right; }
  .reach b { font-size:14px; }
  .reach small { color:#8b9198; font-size:8px; }
  .add-step { width:100%; min-height:44px; border:1px dashed #b9a98f; border-radius:11px; background:rgba(255,255,255,.45); color:#895a20; font-weight:800; }
  .end-node { margin-top:12px; display:flex; justify-content:center; align-items:center; gap:8px; padding:10px; background:#ece9e3; color:#7d7a75; box-shadow:none; }
  .end-node span { width:22px; height:22px; display:grid; place-items:center; border-radius:50%; background:#d7d2ca; }
  .end-node strong { font-size:9px; letter-spacing:.12em; }
  .no-step { min-height:150px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:9px; }
  .no-step>span { font-size:26px; }
  .no-step strong { font-size:13px; }
  .no-step button { border:0; border-radius:8px; background:#a56c22; color:#fff; padding:9px 13px; font-weight:800; }
  .inspector-panel { background:#fbfaf8; border-left:1px solid #ddd8d0; padding:18px 16px 42px; overflow:auto; }
  .inspector-head { display:flex; justify-content:space-between; gap:12px; align-items:center; padding-bottom:14px; border-bottom:1px solid #e1ddd6; }
  .inspector-head span { color:#8a5b22; font-size:9px; font-weight:900; letter-spacing:.13em; }
  .inspector-head h2 { margin:3px 0 0; font-size:19px; }
  .big-icon { font-size:26px!important; }
  .template-warning,.safe-note { margin:12px 0; padding:10px 11px; border-radius:8px; background:#fff5df; color:#6e532c; font-size:10px; line-height:1.6; }
  fieldset { margin:14px 0 0; padding:0; border:0; }
  legend { width:100%; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #e4e0d8; color:#494f56; font-size:10px; font-weight:900; letter-spacing:.07em; }
  label { display:grid; gap:5px; margin-top:9px; }
  label>span { color:#737b84; font-size:10px; font-weight:700; }
  textarea { resize:vertical; line-height:1.6; }
  .field-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .inspector-actions { display:grid; gap:9px; margin-top:17px; padding-top:14px; border-top:1px solid #dfdbd4; }
  .save-button { width:100%; border:1px solid #8e5e21; background:#a56c22; color:#fff; }
  .inspector-actions>div { display:grid; grid-template-columns:42px 42px 1fr; gap:6px; }
  .tiny { min-height:35px; border:1px solid #d7d2ca; border-radius:7px; background:#fff; color:#5d6670; font-weight:800; }
  .tiny.danger { color:#a23b32; }
  button:disabled { cursor:not-allowed; opacity:.5; }
  .toast { position:fixed; z-index:80; top:108px; left:50%; transform:translateX(-50%); padding:9px 14px; border-radius:999px; background:#26322b; color:#fff; font-size:11px; box-shadow:0 8px 25px rgba(0,0,0,.15); }
  .error-banner { margin:10px 18px 0; display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid #e6b9b3; border-radius:9px; background:#fff2f0; color:#8b332d; font-size:11px; }
  .error-banner>span { width:22px; height:22px; display:grid; place-items:center; border-radius:50%; background:#e8c0bb; font-weight:900; }
  .error-banner p { flex:1; margin:0; }
  .error-banner button { border:0; background:transparent; color:inherit; font-size:18px; }
  .modal-backdrop { position:fixed; inset:0; z-index:100; display:grid; place-items:center; padding:20px; background:rgba(36,31,25,.35); backdrop-filter:blur(5px); }
  .modal { width:min(560px,100%); max-height:90vh; overflow:auto; padding:20px; border-radius:16px; background:#fbfaf8; border:1px solid #d8d4cd; box-shadow:0 24px 80px rgba(34,28,20,.22); }
  .modal header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .modal header span { color:#8a5b22; font-size:9px; font-weight:900; letter-spacing:.13em; }
  .modal header h2 { margin:4px 0 0; font-size:20px; }
  .modal header button { border:0; background:transparent; color:#727982; font-size:22px; }
  .modal footer { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; padding-top:14px; border-top:1px solid #e0dcd5; }
  @media (max-width:1180px) { .workspace { grid-template-columns:220px minmax(420px,1fr); } .inspector-panel { grid-column:1 / -1; border-left:0; border-top:1px solid #ddd8d0; display:grid; grid-template-columns:minmax(0,760px); justify-content:center; } }
  @media (max-width:760px) { .app-header { position:relative; align-items:flex-start; flex-direction:column; padding:14px; } .header-actions { width:100%; justify-content:stretch; } .account-select { flex:1; } .account-select select { min-width:0; } .workspace { display:block; } .scenario-rail { border-right:0; border-bottom:1px solid #ddd8d0; white-space:nowrap; overflow-x:auto; } .rail-head { position:sticky; left:0; background:#fbfaf8; } .scenario-item { width:245px; display:inline-grid; margin-right:5px; vertical-align:top; white-space:normal; } .flow-stage { padding:16px 12px 45px; } .metric-row { grid-template-columns:1fr 1fr; } .step-card { grid-template-columns:42px minmax(0,1fr); } .reach { grid-column:2; display:flex; gap:5px; justify-content:flex-start; text-align:left; } .inspector-panel { padding:16px 12px 38px; } .field-grid { grid-template-columns:1fr; } .toast { top:16px; } }
`;
