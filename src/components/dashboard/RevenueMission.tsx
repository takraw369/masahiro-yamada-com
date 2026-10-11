import { useEffect, useState } from 'react';
import { createFlowBoardSnapshot, type BoardSnapshot } from '../../lib/flowBoard';
import {
  REVENUE_FIELDS, REVENUE_STAGES, createRevenueMission, getRevenueMission,
  getRevenueReadiness, transitionRevenueMission, updateRevenueFields, withRevenueMission,
  type RevenueMission as Mission, type RevenueStage,
} from '../../lib/revenueMission';
import '../../styles/revenue-mission.css';

const stageNames: Record<string, string> = {
  ASSET_SOURCE: '素材を選ぶ', PACKAGE: '商品にする', QA: '品質を確認',
  READY_TO_PUBLISH: '公開判断済み', LIVE: '公開の証跡', SALE_DETECTED: '売上の証跡',
  DELIVERED: '納品の証跡', LEARN: '学びを戻す',
};
const hints: Record<string, string> = {
  sourceAsset: '再利用する既存資産の Drive / MASA_OS 正本 URL。未確認の素材は空欄のまま。',
  title: '初期値は First Product の仮説。素材と内容を確認して確定する。',
  mainContent: '購入後に単独で使える PDF 本文の正本 URL。',
  worksheet: '仮説・選択肢・7日間の行動を整理するシートの正本 URL。',
  promptPack: '購入者が自分で AI と対話できるプロンプト集の正本 URL。',
  preview: '購入前に内容を確認できるサンプルの正本 URL。',
  priceHypothesis: '販売価格の仮説と理由。公開後の重大変更は MASA の判断が必要。',
  qa: '実物を通しで使った結果・確認日・根拠を記録。未完了なら空欄。',
  policy: '下記の全ガードレールと販売先の規約を確認した結果・日付・根拠。不明点があれば空欄。',
  publishGate: 'MASA がこの内容・価格・規約を確認した判断記録。AI は承認を記入しない。',
  liveUrl: 'MASA が初回公開した後の販売ページ URL。ここから公開は実行しない。',
  liveEvidence: '実際の公開を確認した Evidence Lab 記録または Drive の証跡 URL。',
  saleSignal: '購入者情報を含まない売上確認の証跡 URL。',
  deliveryEvidence: 'マーケットプレイスで配信・受取可能を確認した証跡 URL。',
  learning: '売上・反応から得た学びの Evidence Lab / Drive URL。',
  nextAction: '証跡に基づいて次に変える一点。推測を事実として書かない。',
};

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code.includes('conflict')) return '他の編集が先に保存されました。入力を控えてから共有版を再読込してください。';
  const field = REVENUE_FIELDS.find(item => code.endsWith(`:${item.key}`));
  if (field) return `${field.label} の形式または長さを確認してください。変更は未保存です。`;
  const messages: Record<string, string> = {
    revenue_source_required: '先に素材の正本 URL を登録してください。',
    revenue_package_incomplete: '商品を揃える欄に、まだ未完了の項目があります。',
    revenue_ready_incomplete: 'READY には全ての商品・QA・規約確認・MASA の公開判断記録が必要です。',
    revenue_publication_evidence_required: '実際の公開 URL と、公開実施の証跡を先に保存してください。',
    revenue_sale_evidence_required: '売上確認の証跡を先に保存してください。',
    revenue_delivery_evidence_required: '納品確認の証跡を先に保存してください。',
    revenue_learning_evidence_required: '学びの証跡を先に保存してください。',
    revenue_learning_action_required: '学びから次に進める作業を記録してください。',
    revenue_live_package_locked: '公開後の商品・価格・公開の証跡変更は、別途 MASA の判断が必要です。',
  };
  return messages[code] || '共有保存を完了できませんでした。入力を残したまま、接続と共有状態を確認してください。';
}

export default function RevenueMission() {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [revision, setRevision] = useState(0);
  const [mission, setMission] = useState<Mission>(createRevenueMission);
  const [draft, setDraft] = useState<Mission>(createRevenueMission);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState('共有 FLOW Board を読み込み中…');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [expanded, setExpanded] = useState(false);
  const readiness = getRevenueReadiness(mission);
  const changed = JSON.stringify(draft) !== JSON.stringify(mission);
  const stageIndex = REVENUE_STAGES.indexOf(mission.state);
  const afterLive = stageIndex >= REVENUE_STAGES.indexOf('LIVE');
  const nextStage = REVENUE_STAGES[stageIndex + 1];
  const disabled = busy || !board || conflict;

  async function load() {
    setBusy(true); setError(''); setStatus('共有 FLOW Board を読み込み中…');
    setBoard(null);
    try {
      const response = await fetch('/api/dashboard/board?scene=main', { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json();
      const data = result.data;
      if (!response.ok || !result.ok || !Number.isSafeInteger(data?.revision) || data.revision < 0
        || !Array.isArray(data.snapshot?.nodes) || !Array.isArray(data.snapshot?.edges)) throw new Error('board_read_unavailable');
      const snapshot: BoardSnapshot = data.revision === 0 ? createFlowBoardSnapshot() : data.snapshot;
      const saved = getRevenueMission(snapshot);
      const current = saved || createRevenueMission();
      setBoard(snapshot); setRevision(data.revision); setMission(current); setDraft(current);
      setExists(Boolean(saved)); setConflict(false);
      setStatus(saved ? `共有済み · r${data.revision}` : '仮説 · まだ共有保存されていません');
    } catch {
      setStatus('共有状態は未確認');
      setError('FLOW Board を取得できません。保存は停止しています。再読込してください。');
    } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save(target?: RevenueStage) {
    if (disabled || !board) return;
    setBusy(true); setError(''); setStatus('共有保存中…');
    try {
      const patch = Object.fromEntries(REVENUE_FIELDS.map(field => [field.key, draft[field.key]]));
      let next = updateRevenueFields(mission, patch);
      if (target) next = transitionRevenueMission(next, target, { actor: 'human', evidence: next.liveEvidence });
      const snapshot = withRevenueMission(board, next);
      const response = await fetch('/api/dashboard/board', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneKey: 'main', snapshot, expectedRevision: revision, actor: 'human' }),
      });
      const result = await response.json();
      if (response.status === 409) { setConflict(true); throw new Error('revision_conflict'); }
      if (!response.ok || !result.ok) throw new Error(result.error || 'board_write_unavailable');
      if (!Number.isSafeInteger(result.data?.revision) || result.data.revision <= revision) throw new Error('save_receipt_invalid');
      setBoard(snapshot); setRevision(result.data.revision); setMission(next); setDraft(next); setExists(true);
      setStatus(`共有済み · r${result.data.revision}`);
    } catch (failure) {
      setStatus('変更は未保存'); setError(messageFor(failure));
    } finally { setBusy(false); }
  }

  async function copyResume() {
    const packet = {
      mission: 'First Product: AI言語化 → 7日行動設計ワークブック',
      canonical: 'Drive / MASA_OS（商品本体）。FLOW Board は進捗・参照・判断の共有面。',
      readFirst: 'GET /api/dashboard/board?scene=main を再取得し、revenue-first-product を確認する。',
      snapshotRevisionAtCopy: board ? revision : 'UNVERIFIED',
      saved: exists && Boolean(board) ? mission : null,
      unsavedDraft: changed ? draft : null,
      remaining: readiness.missing,
      nextSmallestAction: board ? readiness.nextAction : '共有 FLOW Board を取得する。',
      writeContract: '既存の認証境界で actor:ai と最新 expectedRevision を指定し、無関係な nodes/edges を保持。409 は再取得・再検討。',
      humanGate: '初回公開、価格重大変更、停止/再開、曖昧な規約、決済、契約、破壊的外部操作は MASA。AI は承認を代行しない。',
      evidence: '売上・納品・学びは既存 Evidence Lab / Drive の参照を使う。購入者データを転載しない。',
      implementation: 'docs/revenue-agent-current-master.md / src/lib/revenueMission.ts',
    };
    try { await navigator.clipboard.writeText(JSON.stringify(packet, null, 2)); setCopyStatus('再開メモをコピーしました'); }
    catch { setCopyStatus('コピーできませんでした。画面の次の一手と共有状態から再開してください。'); }
  }

  return <section id="revenue-mission" className="revenue-mission" aria-labelledby="revenue-title">
    <div className="revenue-heading">
      <div><p className="revenue-kicker">FIRST PRODUCT · REVENUE MISSION</p><h2 id="revenue-title">1商品を、販売できるところへ。</h2></div>
      <span className="revenue-sync" role="status">{status}{changed ? ' · 入力に未保存の変更あり' : ''}</span>
    </div>
    <p className="revenue-offer">考えすぎて動けない人のための AI言語化 → 7日行動設計ワークブック</p>
    <p className="revenue-subtitle">PDF ＋ ワークシート ＋ AIプロンプト集。曖昧な悩みを、仮説・選択肢・次の7日間の行動へ。</p>
    <div className="revenue-summary">
      <div><span>現在地</span><strong>{board ? mission.state : 'UNVERIFIED'}</strong><small>{board ? stageNames[mission.state] : '共有データの取得が必要'}</small></div>
      <div><span>販売準備の記録</span><strong>{board ? `${readiness.complete} / ${readiness.total}` : '—'}</strong><small>{board ? (readiness.ready ? 'READY 条件の記録あり' : `残り ${readiness.missing.length} 項目`) : '未確認'}</small></div>
      <div className="revenue-next"><span>次の一手</span><strong>{board ? readiness.nextAction : '共有 FLOW Board を再読込する。'}</strong></div>
    </div>
    <ol className="revenue-stages" aria-label="Revenue Flow">
      {REVENUE_STAGES.map((stage, index) => <li key={stage} aria-current={board && stage === mission.state ? 'step' : undefined} data-complete={board && index < stageIndex}>
        <span>{String(index + 1).padStart(2, '0')}</span><b>{stageNames[stage]}</b><small>{stage}</small>
      </li>)}
    </ol>
    {board && readiness.missing.length > 0 && <p className="revenue-missing"><b>残っているもの：</b>{readiness.missing.map(item => item.label).join(' / ')}</p>}
    {error && <p className="revenue-error" role="alert">{error}</p>}
    <div className="revenue-actions">
      <button type="button" className="revenue-primary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="revenue-editor">{expanded ? '準備項目を閉じる' : '準備項目と証跡を開く'}</button>
      <a href="/dashboard/board?mission=revenue">FLOW Board で見る ↗</a>
      <button type="button" onClick={copyResume}>AI の再開メモをコピー</button>
      <button type="button" disabled={busy} onClick={() => void load()}>{changed || conflict ? '共有版を再読込（入力を戻す）' : '再読込'}</button>
    </div>
    {copyStatus && <p className="revenue-note" role="status">{copyStatus}</p>}
    <div id="revenue-editor" hidden={!expanded}>
      <p className="revenue-note">商品本体の正本は Drive / MASA_OS。ここには参照先と確認記録を保存します。URL の内容を自動で検証したという意味ではありません。</p>
      {(['package', 'review', 'signal'] as const).map(group => <fieldset key={group} disabled={disabled}>
        <legend>{group === 'package' ? '01 · 商品を揃える' : group === 'review' ? '02 · QA と Publish Human Gate' : '03 · 公開・売上・納品・学び'}</legend>
        {group === 'review' && <p className="revenue-note">素材・商品・価格を変更すると QA・規約確認・公開判断をやり直します。先に商品を保存し、改めてレビュー記録を入力してください。</p>}
        {group === 'signal' && <p className="revenue-note">購入・配信はマーケットプレイスが担当。売れるたびの MASA 承認は不要です。<a href="/dashboard/evidence" target="_blank" rel="noreferrer">Evidence Lab を開く ↗</a> で既存の記録を確認し、証跡の URL を残してください。</p>}
        <div className="revenue-fields">
          {REVENUE_FIELDS.filter(field => field.group === group).map(field => <label key={field.key}>
            <span>{field.label}{field.key === 'publishGate' && <em>MASA の判断記録</em>}</span>
            {field.kind === 'textarea'
              ? <textarea rows={3} value={draft[field.key]} maxLength={4000} disabled={afterLive && group !== 'signal'} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} />
              : <input type="text" inputMode={field.kind === 'url' ? 'url' : 'text'} value={draft[field.key]} maxLength={field.kind === 'url' ? 1500 : 400} disabled={afterLive && (group !== 'signal' || field.key === 'liveUrl' || field.key === 'liveEvidence')} placeholder={field.kind === 'url' ? 'https://… または /dashboard/evidence#記録ID' : undefined} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} />}
            {hints[field.key] && <small>{hints[field.key]}</small>}
          </label>)}
        </div>
      </fieldset>)}
      {afterLive && <p className="revenue-note">公開後の商品・価格・公開判断の変更はこの面では実行しません。改善案は「次の一手」に残し、重大変更・停止・再開は MASA が販売先と正本を確認して判断します。</p>}
      <div className="revenue-actions">
        <button type="button" className="revenue-primary" disabled={disabled} onClick={() => void save()}>準備と証跡を共有保存</button>
        {nextStage && <button type="button" disabled={disabled || !exists || changed} onClick={() => void save(nextStage)}>{nextStage === 'LIVE' ? '公開済みの証跡を記録 → LIVE' : `${stageNames[nextStage]}へ → ${nextStage}`}</button>}
        {['QA', 'READY_TO_PUBLISH'].includes(mission.state) && <button type="button" disabled={disabled || changed} onClick={() => void save('PACKAGE')}>商品を見直す → PACKAGE</button>}
      </div>
      {(!exists || changed) && <p className="revenue-note">入力を共有保存してから、次の状態へ進めます。</p>}
      <details className="revenue-guardrails"><summary>販売と Human Gate の境界</summary>
        <p>初回公開・価格の重大変更・停止/再開・規約が不明確な変更・決済・契約・破壊的な外部操作は MASA が判断します。この画面は公開や決済を実行しません。</p>
        <ul><li>外部決済・不必要な外部連絡への誘導をしない。</li><li>適職・性格・健康等の断定診断、成果保証をしない。</li><li>架空の実績・統計、重複商品での露出水増しをしない。</li><li>購入者データを目的外利用しない。証跡は購入者情報を除いて記録する。</li></ul>
        <p>販促を準備する時は <a href="/dashboard/content-flow">既存 Content Flow</a> へ。商品の READY 判定と公開の証跡は、この共有 Mission で確認します。</p>
      </details>
    </div>
  </section>;
}
