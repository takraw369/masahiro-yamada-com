/** One product's working state in the existing FLOW Board. Product files stay in Drive. */
export const REVENUE_NODE_ID = 'revenue-first-product';
export const REVENUE_STAGES = [
  'ASSET_SOURCE', 'PACKAGE', 'QA', 'READY_TO_PUBLISH',
  'LIVE', 'SALE_DETECTED', 'DELIVERED', 'LEARN',
] as const;

export type RevenueStage = typeof REVENUE_STAGES[number];
export type RevenueActor = 'human' | 'ai' | 'system';

export const REVENUE_FIELDS = [
  { key: 'sourceAsset', label: 'Source asset / Drive 正本', kind: 'url', group: 'package' },
  { key: 'title', label: '商品タイトル', kind: 'text', group: 'package' },
  { key: 'customerProblem', label: '顧客の悩み', kind: 'textarea', group: 'package' },
  { key: 'promise', label: '約束する整理・行動', kind: 'textarea', group: 'package' },
  { key: 'mainContent', label: '本文 PDF / Drive', kind: 'url', group: 'package' },
  { key: 'worksheet', label: 'ワークシート / Drive', kind: 'url', group: 'package' },
  { key: 'promptPack', label: 'AI プロンプト集 / Drive', kind: 'url', group: 'package' },
  { key: 'preview', label: 'サンプル・プレビュー / Drive', kind: 'url', group: 'package' },
  { key: 'description', label: '商品説明', kind: 'textarea', group: 'package' },
  { key: 'coverBrief', label: '表紙・サムネイル指示', kind: 'textarea', group: 'package' },
  { key: 'priceHypothesis', label: '価格仮説', kind: 'text', group: 'package' },
  { key: 'qa', label: 'QA レビュー記録・根拠', kind: 'textarea', group: 'review' },
  { key: 'policy', label: '規約・誇大表現チェック記録', kind: 'textarea', group: 'review' },
  { key: 'publishGate', label: 'MASA 公開確認の記録', kind: 'textarea', group: 'review' },
  { key: 'liveUrl', label: '実際に公開した商品 URL', kind: 'url', group: 'signal' },
  { key: 'liveEvidence', label: '公開実施の Evidence / Drive 参照', kind: 'url', group: 'signal' },
  { key: 'saleSignal', label: '販売 Signal の Evidence / Drive 参照', kind: 'url', group: 'signal' },
  { key: 'deliveryEvidence', label: '納品 Evidence / Drive 参照', kind: 'url', group: 'signal' },
  { key: 'learning', label: '学習 Evidence / Drive 参照', kind: 'url', group: 'signal' },
  { key: 'nextAction', label: 'AI が継続する次の作業', kind: 'textarea', group: 'signal' },
] as const;

export type RevenueFieldKey = typeof REVENUE_FIELDS[number]['key'];
export type RevenueMission = { version: 1; state: RevenueStage } & Record<RevenueFieldKey, string>;

type Node = Record<string, unknown> & { id: string };
type Board = { nodes: unknown[]; edges: unknown[] };
type UpdateOptions = { sceneKey: string; actor?: unknown };
const PACKAGE_FIELDS = REVENUE_FIELDS.filter(field => field.group === 'package');
const READY_FIELDS = REVENUE_FIELDS.filter(field => field.group !== 'signal');
const REVIEW_KEYS = ['qa', 'policy', 'publishGate'] as const;
const RECEIPT_KEYS = new Set<RevenueFieldKey>(['liveEvidence', 'saleSignal', 'deliveryEvidence', 'learning']);
const ALL_KEYS = new Set<string>(['version', 'state', ...REVENUE_FIELDS.map(field => field.key)]);
const LIVE_INDEX = REVENUE_STAGES.indexOf('LIVE');

export class RevenueMissionError extends Error {
  constructor(message: string) { super(message); this.name = 'RevenueMissionError'; }
}

function fail(message: string): never { throw new RevenueMissionError(message); }
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSafeUrl(value: string, receipt = false) {
  // Evidence references are links to existing records, never buyer payloads or new storage.
  if (receipt && /^\/dashboard\/evidence#[a-zA-Z0-9_-]{1,120}$/.test(value)) return true;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (!receipt) return true;
  return ['drive.google.com', 'docs.google.com'].includes(url.hostname)
    || (url.hostname === 'masahiroyamada.com' && url.pathname === '/dashboard/evidence' && /^#[a-zA-Z0-9_-]{1,120}$/.test(url.hash));
}

function validateField(key: RevenueFieldKey, value: unknown): asserts value is string {
  const field = REVENUE_FIELDS.find(item => item.key === key)!;
  const maxLength = field.kind === 'url' ? 1500 : field.kind === 'text' ? 400 : 4000;
  if (typeof value !== 'string' || value.length > maxLength || value !== value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    fail(`revenue_invalid_field:${key}`);
  }
  if (value && field.kind === 'url' && !isSafeUrl(value, RECEIPT_KEYS.has(key))) fail(`revenue_invalid_url:${key}`);
}

function validateMission(value: unknown): asserts value is RevenueMission {
  if (!record(value) || value.version !== 1 || !REVENUE_STAGES.includes(value.state as RevenueStage)
      || Object.keys(value).some(key => !ALL_KEYS.has(key))) fail('revenue_invalid_mission');
  for (const { key } of REVENUE_FIELDS) validateField(key, value[key]);
}

export function createRevenueMission(): RevenueMission {
  return {
    version: 1, state: 'ASSET_SOURCE', sourceAsset: '',
    title: '考えすぎて動けない人のための AI言語化 → 7日行動設計ワークブック',
    customerProblem: '考えがまとまらず、最初の一歩を選べない。',
    promise: '曖昧な悩みを AI との対話で仮説・選択肢・次の7日間の行動へ整理する。診断や成果保証はしない。',
    mainContent: '', worksheet: '', promptPack: '', preview: '', description: '', coverBrief: '',
    priceHypothesis: '', qa: '', policy: '', publishGate: '', liveUrl: '', liveEvidence: '',
    saleSignal: '', deliveryEvidence: '', learning: '', nextAction: '',
  };
}

export function getRevenueReadiness(mission: RevenueMission) {
  validateMission(mission);
  const missing = READY_FIELDS.filter(({ key }) => !mission[key]).map(({ key, label }) => ({ key, label }));
  const stateActions: Record<RevenueStage, string> = {
    ASSET_SOURCE: '既存の Drive 資産を1つ選び、Source asset に正本リンクを残す。',
    PACKAGE: '本文 PDF・ワークシート・プロンプト集を Drive で仕上げ、参照を残す。',
    QA: '実物をレビューし、QA・規約チェックの記録を残して MASA の公開確認へ進む。',
    READY_TO_PUBLISH: 'MASA が販売サイトで初回公開し、公開 URL と実施 Evidence を記録する。',
    LIVE: '販売が確認できたら既存 Evidence Lab に記録し、販売 Signal の参照を残す。',
    SALE_DETECTED: 'Marketplace の納品結果を既存 Evidence Lab に記録し、参照を残す。',
    DELIVERED: '購入者情報を含めず学びを既存 Evidence Lab に残し、次の改善を選ぶ。',
    LEARN: '学びから次の改善を1つ選ぶ。公開後の商品・価格変更は MASA の別途判断へ。',
  };
  return {
    complete: READY_FIELDS.length - missing.length, total: READY_FIELDS.length, missing,
    ready: missing.length === 0,
    nextAction: missing.length && REVENUE_STAGES.indexOf(mission.state) < LIVE_INDEX
      ? `${missing[0].label} を確認し、記録する。`
      : mission.nextAction || stateActions[mission.state],
  };
}

/** Invalid metadata is an error, not an invitation to overwrite it with a fresh mission. */
export function getRevenueMission(snapshot: unknown): RevenueMission | null {
  if (!record(snapshot) || !Array.isArray(snapshot.nodes)) fail('revenue_invalid_board');
  const nodes = snapshot.nodes.filter(node => record(node) && (node.id === REVENUE_NODE_ID || Object.hasOwn(node, 'revenueMission')));
  if (nodes.length > 1) fail('revenue_duplicate_mission');
  if (!nodes.length) return null;
  const node = nodes[0] as Record<string, unknown>;
  if (node.id !== REVENUE_NODE_ID) fail('revenue_invalid_node');
  validateMission(node.revenueMission);
  return structuredClone(node.revenueMission);
}

export function withRevenueMission<T extends Board>(snapshot: T, mission: RevenueMission): T {
  validateMission(mission);
  getRevenueMission(snapshot);
  const next = structuredClone(snapshot);
  const existing = next.nodes.find(node => record(node) && node.id === REVENUE_NODE_ID) as Node | undefined;
  const readiness = getRevenueReadiness(mission);
  const node = {
    ...(existing || { id: REVENUE_NODE_ID, x: 1430, y: 1130, w: 270, h: 130, provenance: 'revenue-mission-v1' }),
    kind: 'BUSINESS', label: `REVENUE MISSION · ${mission.state}`,
    note: `${mission.title}\nREADY ${readiness.complete}/${readiness.total}\n${readiness.nextAction}`,
    revenueMission: structuredClone(mission),
  };
  if (existing) next.nodes = next.nodes.map(item => item === existing ? node : item);
  else next.nodes.push(node);
  for (const source of ['N021', 'N027']) {
    if (!next.nodes.some(item => record(item) && item.id === source)) continue;
    const id = `${source}-revenue-first-product`;
    if (!next.edges.some(edge => record(edge) && (edge.id === id || (edge.source === source && edge.target === REVENUE_NODE_ID)))) {
      next.edges.push({ id, source, target: REVENUE_NODE_ID, relation: 'supports', state: 'WORKING' });
    }
  }
  return next;
}

/** Package edits invalidate review of the previous package. Post-publication rework is a separate Human Gate. */
export function updateRevenueFields(mission: RevenueMission, patch: Partial<Record<RevenueFieldKey, string>>): RevenueMission {
  validateMission(mission);
  if (!record(patch) || Object.keys(patch).some(key => !REVENUE_FIELDS.some(field => field.key === key))) fail('revenue_invalid_patch');
  const next = { ...mission };
  for (const [key, raw] of Object.entries(patch)) {
    if (typeof raw !== 'string') fail(`revenue_invalid_field:${key}`);
    const value = raw.trim();
    validateField(key as RevenueFieldKey, value);
    next[key as RevenueFieldKey] = value;
  }
  const packageChanged = PACKAGE_FIELDS.some(({ key }) => mission[key] !== next[key]);
  const reviewChanged = REVIEW_KEYS.some(key => mission[key] !== next[key]);
  const isLive = REVENUE_STAGES.indexOf(mission.state) >= LIVE_INDEX;
  if (isLive && (packageChanged || reviewChanged || mission.liveUrl !== next.liveUrl || mission.liveEvidence !== next.liveEvidence)) {
    fail('revenue_live_package_locked');
  }
  if (packageChanged) {
    next.qa = ''; next.policy = ''; next.publishGate = '';
    if (!next.sourceAsset) next.state = 'ASSET_SOURCE';
    else if (mission.state === 'QA' || mission.state === 'READY_TO_PUBLISH') next.state = 'PACKAGE';
  } else if (mission.qa !== next.qa || mission.policy !== next.policy) {
    next.publishGate = '';
    if (mission.state === 'READY_TO_PUBLISH') next.state = 'QA';
  } else if (mission.publishGate !== next.publishGate && !next.publishGate && mission.state === 'READY_TO_PUBLISH') {
    next.state = 'QA';
  }
  return next;
}

function assertStageRequirements(mission: RevenueMission) {
  const index = REVENUE_STAGES.indexOf(mission.state);
  if (index >= 1 && !mission.sourceAsset) fail('revenue_source_required');
  if (index >= 2 && PACKAGE_FIELDS.some(({ key }) => !mission[key])) fail('revenue_package_incomplete');
  if (index >= 3 && !getRevenueReadiness(mission).ready) fail('revenue_ready_incomplete');
  if (index >= LIVE_INDEX && (!mission.liveUrl || !mission.liveEvidence)) fail('revenue_publication_evidence_required');
  if (index >= 5 && !mission.saleSignal) fail('revenue_sale_evidence_required');
  if (index >= 6 && !mission.deliveryEvidence) fail('revenue_delivery_evidence_required');
  if (index >= 7 && !mission.learning) fail('revenue_learning_evidence_required');
  if (index >= 7 && !mission.nextAction) fail('revenue_learning_action_required');
}

export function transitionRevenueMission(
  mission: RevenueMission,
  target: RevenueStage,
  options: { actor?: unknown; evidence?: string },
): RevenueMission {
  validateMission(mission);
  const from = REVENUE_STAGES.indexOf(mission.state);
  const to = REVENUE_STAGES.indexOf(target);
  if (to < 0) fail('revenue_invalid_stage');
  if (target === mission.state) { assertStageRequirements(mission); return { ...mission }; }
  if (from < LIVE_INDEX && to < from && (target === 'PACKAGE' || target === 'QA')) {
    const rework = { ...mission, state: target, publishGate: '' };
    if (target === 'PACKAGE') { rework.qa = ''; rework.policy = ''; }
    assertStageRequirements(rework);
    return rework;
  }
  if (to !== from + 1) fail('revenue_invalid_transition');
  if (target === 'LIVE' && options.actor !== 'human') fail('revenue_human_gate_required');
  const next = { ...mission, state: target };
  if (target === 'LIVE' && options.evidence !== undefined) {
    validateField('liveEvidence', options.evidence);
    next.liveEvidence = options.evidence;
  }
  assertStageRequirements(next);
  return next;
}

/** Same authenticated API for people and AI; actor is an audit label, not independent identity proof. */
export function validateRevenueBoardUpdate(previousSnapshot: unknown, nextSnapshot: unknown, options: UpdateOptions): void {
  const previous = getRevenueMission(previousSnapshot);
  const next = getRevenueMission(nextSnapshot);
  if (options.sceneKey !== 'main' && (previous || next)) fail('revenue_main_scene_required');
  if (!next) {
    if (previous) fail('revenue_mission_removal_forbidden');
    return;
  }
  if ((!previous || previous.publishGate !== next.publishGate) && next.publishGate && options.actor !== 'human') {
    fail('revenue_human_gate_required');
  }
  if (!previous) {
    if (next.state !== 'ASSET_SOURCE') fail('revenue_initial_stage_required');
    return;
  }
  const patch: Partial<Record<RevenueFieldKey, string>> = {};
  for (const { key } of REVENUE_FIELDS) if (previous[key] !== next[key]) patch[key] = next[key];
  let expected = updateRevenueFields(previous, patch);
  if (next.state !== expected.state) expected = transitionRevenueMission(expected, next.state, { actor: options.actor });
  for (const { key } of REVENUE_FIELDS) {
    if (expected[key] !== next[key]) fail('revenue_stale_review');
  }
  assertStageRequirements(next);
}
