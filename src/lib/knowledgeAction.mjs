export const ACTION_SCHEMA = 'masa-knowledge-action/v1';
export const DESTINATIONS = ['ACE', 'SLF', 'Athlete Quest'];
export const REVIEW_ACTIONS = ['hold', 'reject', 'revise', 'review', 'execute', 'outcome'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function safeSourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export function normalizeLibrary(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : []).flatMap((node) => {
    const a = node?.metadata?.knowledge_action;
    if (!uuid.test(node?.id || '') || !a || a.visibility !== 'private') return [];
    return [{ id: node.id, sourceKey: text(node.source_key, 240), title: text(node.title, 240), canonicalUrl: safeSourceUrl(node.canonical_url),
      assetId: text(a.assetId, 240), summary: text(a.summary), coreConcept: text(a.coreConcept), domain: text(a.domain), target: text(a.target),
      projects: Array.isArray(a.projects) ? a.projects.map((p) => text(p, 80)).filter(Boolean) : text(a.projects).split(/\s*\/\s*/).filter(Boolean),
      sourceType: text(a.sourceType), canonicalOwner: text(a.canonicalOwner), evidence: text(a.evidence), interpretation: text(a.interpretation), hypothesis: text(a.hypothesis),
      rights: text(a.rights) || '権利・外部根拠の確認が必要', readiness: text(a.readiness), nextAction: text(a.nextAction), reviewStatus: a.reviewStatus === 'human_reviewed' ? 'human_reviewed' : 'ai_candidate',
      visibility: 'private', atomicUnits: Array.isArray(a.atomicUnits) ? a.atomicUnits : [], practice: a.practice || null, originalRefs: text(a.originalRefs), sourceUpdatedAt: text(a.sourceUpdatedAt, 80) }];
  });
  const ids = new Set(items.map((i) => i.id));
  const edges = (Array.isArray(raw?.edges) ? raw.edges : []).filter((e) => ids.has(e.from_node_id) && ids.has(e.to_node_id) && ['candidate', 'canonical'].includes(e.edge_status));
  return { items, edges, events: Array.isArray(raw?.events) ? raw.events : [] };
}
export function filterLibrary(items, { query = '', project = '', target = '', use = '' } = {}) {
  const q = text(query, 240).toLocaleLowerCase();
  return items.filter((i) => (!q || [i.title, i.summary, i.coreConcept, i.domain, i.target, i.assetId].join(' ').toLocaleLowerCase().includes(q))
    && (!project || i.projects.some((p) => p.includes(project))) && (!target || i.target.includes(target))
    && (!use || [i.readiness, i.nextAction, JSON.stringify(i.practice)].join(' ').includes(use)));
}
export function validateSelection(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12 || value.some((id) => typeof id !== 'string' || !uuid.test(id)) || new Set(value).size !== value.length) throw new Error('invalid_selection');
  return value;
}
export function parsePracticeFeedback(value, items) {
  if (!value || value.schema !== 'masa-knowledge-action-feedback/v1' || typeof value.eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value.eventId)
    || typeof value.proposalId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value.proposalId) || !value.reflection || typeof value.reflection !== 'object') throw new Error('invalid_feedback');
  const ids = validateSelection(value.sourceNodeIds);
  if (ids.some((id) => !items.some((i) => i.id === id))) throw new Error('source_unavailable');
  for (const key of ['outcome','learning','nextAction']) if (typeof value.reflection[key] !== 'string' || value.reflection[key].length > 1500) throw new Error('invalid_feedback');
  if (!value.reflection.outcome.trim()) throw new Error('outcome_required');
  if (typeof value.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.occurredAt) || !Number.isFinite(Date.parse(value.occurredAt))) throw new Error('invalid_occurred_at');
  return { action:'outcome', eventId:value.eventId, proposalId:value.proposalId, nodeIds:ids, occurredAt:value.occurredAt, reflection:value.reflection, note:`実践結果：${value.reflection.outcome.trim()}\n学び：${value.reflection.learning.trim()}\n次の行動：${value.reflection.nextAction.trim()}` };
}
export function buildPracticeProposal(items, nodeIds, destination, proposalId) {
  validateSelection(nodeIds);
  if (!DESTINATIONS.includes(destination)) throw new Error('invalid_destination');
  if (typeof proposalId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(proposalId)) throw new Error('invalid_event_id');
  const selected = nodeIds.map((id) => items.find((i) => i.id === id));
  if (selected.some((i) => !i || !i.canonicalUrl)) throw new Error('source_unavailable');
  const practice = selected.find((i) => i.practice?.instruction)?.practice;
  const steps = practice?.steps || selected.map((i) => `「${i.title}」の原本を読み、使う原則を1つ選ぶ。次の行動：${i.nextAction || '自分の状況で小さく試す方法を記す。'}`);
  return { schema: ACTION_SCHEMA, proposalId, title: text(practice?.title || `${selected[0].title}｜実践・振り返り候補`, 240), destination,
    mode: 'training_reflection', reviewStatus: 'ai_candidate', visibility: 'private',
    sources: selected.map((i) => ({ nodeId: i.id, sourceKey: i.sourceKey, title: i.title, canonicalUrl: i.canonicalUrl })),
    practice: { instruction: text(practice?.instruction || '原本の原則を、今の課題で試せる最小の行動へ置き換える。これは効果を保証する教材ではなく、実践と観察のための候補です。'),
      steps: steps.slice(0, 20).map((s) => text(s, 1000)), reflectionQuestions: (practice?.reflectionQuestions || ['何を試した？', '実際に何が起きた？予想との差は？', '次回、何を残し何を変える？']).slice(0, 12).map((s) => text(s, 1000)) },
    constraints: [...new Set(['AIによる活用候補。人間の確認前に科学的事実やMASA本人の体験として断定しない。', '非公開の実践用。外部公開・商品化には出典・権利・内容の確認が必要。', ...selected.map((i) => text(i.rights, 1000))])].slice(0, 20) };
}
