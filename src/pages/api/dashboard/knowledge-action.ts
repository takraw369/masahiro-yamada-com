import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';
import { jsonResponse } from '../../../lib/security/request.mjs';
import { normalizeLibrary, validateSelection, buildPracticeProposal, REVIEW_ACTIONS } from '../../../lib/knowledgeAction.mjs';

export const GET = async ({ request, locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 240) || null;
    const raw = await supabaseRpc(env, 'masa_knowledge_action_library_v1', { p_owner_key: await getDashboardOwnerKey(env), p_query: query, p_limit: 100 });
    return jsonResponse({ ok: true, data: normalizeLibrary(raw) });
  } catch { return jsonResponse({ ok: false, error: 'knowledge_action_unavailable' }, 503); }
};

export const POST = async ({ request, locals }: APIContext) => {
  if (Number(request.headers.get('content-length') || 0) > 64000) return jsonResponse({ ok: false, error: 'payload_too_large' }, 413);
  let body: any;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 64000) return jsonResponse({ ok: false, error: 'payload_too_large' }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    validateSelection(body.nodeIds);
    if (typeof body.eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(body.eventId)) throw new Error();
    if (body.proposalId !== undefined && (typeof body.proposalId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(body.proposalId))) throw new Error();
    if (body.occurredAt !== undefined && (typeof body.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(body.occurredAt) || !Number.isFinite(Date.parse(body.occurredAt)))) throw new Error();
    if (body.reflection !== undefined && (!body.reflection || typeof body.reflection !== 'object' || Array.isArray(body.reflection) || ['outcome','learning','nextAction'].some((k) => typeof body.reflection[k] !== 'string' || body.reflection[k].length > 1500))) throw new Error();
    if (body.action !== 'propose' && !REVIEW_ACTIONS.includes(body.action)) throw new Error();
    if (typeof body.note !== 'undefined' && (typeof body.note !== 'string' || body.note.length > 5000)) throw new Error();
    if (['revise', 'outcome'].includes(body.action) && !body.note?.trim()) throw new Error();
  } catch { return jsonResponse({ ok: false, error: 'invalid_action' }, 400); }
  try {
    const env = getSiteStorageEnv(locals); const ownerKey = await getDashboardOwnerKey(env);
    let payload: Record<string, unknown> = { note: body.note?.trim() || '', proposalId: body.proposalId || null, visibility: 'private', reviewStatus: body.action === 'review' ? 'human_reviewed' : 'ai_candidate' };
    if (body.occurredAt) payload.occurredAt = body.occurredAt;
    if (body.reflection) payload.reflection = body.reflection;
    if (body.action === 'propose') {
      const raw = await supabaseRpc(env, 'masa_knowledge_action_library_v1', { p_owner_key: ownerKey, p_query: null, p_limit: 100 });
      payload = buildPracticeProposal(normalizeLibrary(raw).items, body.nodeIds, body.destination, body.eventId);
    }
    const receipt = await supabaseRpc(env, 'masa_knowledge_action_record_v1', { p_owner_key: ownerKey, p_event_id: body.eventId, p_action: body.action, p_node_ids: body.nodeIds, p_payload: payload });
    return jsonResponse({ ok: true, data: { receipt, proposal: body.action === 'propose' ? payload : null } }, 201);
  } catch (error) {
    if (/invalid_|source_unavailable|event_(?:id_)?conflict/.test(String(error))) return jsonResponse({ ok: false, error: 'invalid_or_conflicting_action' }, 409);
    return jsonResponse({ ok: false, error: 'knowledge_action_save_unavailable' }, 503);
  }
};
