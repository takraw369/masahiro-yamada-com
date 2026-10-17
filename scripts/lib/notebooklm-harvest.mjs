// Offline transfer packets only. Drive is canonical; this module never writes a database.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';

export const SCHEMA = 'masa-notebooklm-harvest/v1';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const normal = (value) => String(value).replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n').trim();
const stable = (value) => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,})|\b(?:access_token|refresh_token|client_secret|service_role_key|api_key)\s*["']?\s*[:=]\s*["']?[^\s"']{12,}/iu;

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}_required`);
  return value.trim();
}

export function canonicalUrl(value) {
  const url = new URL(required(value, 'source_url'));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('unsafe_source_url');
  for (const key of url.searchParams.keys()) {
    if (/token|secret|password|signature|credential|key$/iu.test(key)) throw new Error('sensitive_url_query');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./u, '');
  const parts = url.pathname.split('/').filter(Boolean);
  const video = host === 'youtu.be' ? parts[0]
    : ['youtube.com', 'm.youtube.com'].includes(host)
      ? (url.pathname === '/watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null) : null;
  if (video) {
    if (!/^[A-Za-z0-9_-]{11}$/u.test(video)) throw new Error('invalid_youtube_id');
    return `https://www.youtube.com/watch?v=${video}`;
  }
  const drive = ['docs.google.com', 'drive.google.com'].includes(host)
    ? url.pathname.match(/\/(?:d|folders)\/([A-Za-z0-9_-]+)/u)?.[1] || (url.pathname === '/open' ? url.searchParams.get('id') : null) : null;
  if (drive) return `https://drive.google.com/file/d/${drive}/view`;
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/iu.test(key) || ['fbclid', 'gclid', 'si'].includes(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}

export function parseExport(text, metadata = {}) {
  text = normal(text);
  if (secret.test(text) || secret.test(stable(metadata))) throw new Error('possible_credentials_in_input');
  const heading = text.match(/^#\s+(.+)$/mu)?.[1];
  let body = text;
  let header = {};
  // Only consume the known export wrapper, never an arbitrary Markdown horizontal rule.
  if (text.includes('<!-- Indexed/read-only export from NotebookLM -->')) {
    const split = text.indexOf('\n---\n');
    if (split < 0) throw new Error('invalid_export_wrapper');
    for (const match of text.slice(0, split).matchAll(/^- ([a-z_]+):\s*(.*)$/gmu)) header[match[1]] = match[2].trim();
    body = normal(text.slice(split + 5));
  }
  const meta = { ...header, ...Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined)) };
  for (const key of ['notebook_id', 'source_id', 'note_id']) {
    if (header[key] && metadata[key] && header[key] !== metadata[key]) throw new Error('export_manifest_provenance_conflict');
  }
  if (header.source_url && metadata.source_url && canonicalUrl(header.source_url) !== canonicalUrl(metadata.source_url)) throw new Error('export_manifest_url_conflict');
  if (!body.trim()) throw new Error('empty_source_body');
  const title = required(meta.title || heading, 'title');
  const kind = meta.note_id ? 'note' : meta.kind || 'source';
  if (!['source', 'note', 'report'].includes(kind)) throw new Error('invalid_document_kind');
  const originalUrl = meta.source_url || meta.url || null;
  const url = originalUrl ? canonicalUrl(originalUrl) : null;
  const notebookId = meta.notebook_id || null;
  const sourceId = meta.source_id || meta.note_id || meta.id || null;
  if (!url && !(notebookId && sourceId)) throw new Error('provenance_required');
  const identity = kind === 'note' || kind === 'report'
    ? `${kind}:${notebookId || url}:${sourceId || url}` : url || `notebooklm:${notebookId}:source:${sourceId}`;
  return {
    id: `nlm-${sha(identity).slice(0, 24)}`, title, body,
    contentHash: sha(body),
    source: { system: notebookId ? 'notebooklm_export' : 'document_export', kind,
      url, originalUrl, exportedUrl: header.source_url || originalUrl, sourceId, notebookId, notebookTitle: meta.notebook_title || null,
      notebookUrl: notebookId ? `https://notebooklm.google.com/notebook/${encodeURIComponent(notebookId)}` : null,
      sourceType: meta.source_type || meta.type || null,
      // already_local files can be older than the index's latest scan.
      exportedAt: header.exported_at_utc || meta.exported_at_utc || null,
      manifestObservedAt: metadata.exported_at_utc || null,
      representation: notebookId ? 'indexed_text_not_original_binary' : 'exported_text',
      factualStatus: kind === 'source' ? 'source_claims_unverified' : 'ai_or_authored_note_unverified' },
  };
}

function readText(path) {
  const data = readFileSync(path);
  if (data.length > 5_000_000) throw new Error('input_exceeds_5mb');
  return data.toString('utf8');
}

function containedFile(root, file) {
  const target = realpathSync(resolve(root, file));
  const rel = relative(realpathSync(root), target);
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error('manifest_path_escape');
  return target;
}

// Accept the owner's existing read-only export index, a Markdown/text + .source.json,
// or a readable Google Drive connector envelope {content,id,url,title}.
export function loadInput(path, { sourceIds = [] } = {}) {
  path = realpathSync(path);
  const raw = readText(path);
  if (!path.endsWith('.json')) {
    let meta = {};
    try { meta = JSON.parse(readText(`${path}.source.json`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { documents: [parseExport(raw, meta)], skipped: [] };
  }
  const data = JSON.parse(raw);
  if (typeof data.content === 'string') return { documents: [parseExport(data.content, data)], skipped: [] };
  if (!data.notebook_id || !Array.isArray(data.sources) || !Array.isArray(data.notes || [])) throw new Error('unsupported_input_json');
  const documents = [], skipped = [];
  for (const [kind, rows] of [['source', data.sources], ['note', data.notes || []]]) {
    for (const row of rows) {
      if (sourceIds.length && !sourceIds.includes(row.id)) continue;
      if (!['exported', 'already_local'].includes(row.status)) {
        skipped.push({ notebookId: data.notebook_id, sourceId: row.id, status: row.status || 'unknown', reason: row.reason || 'not_exported' });
        continue;
      }
      const sourceFile = containedFile(dirname(path), required(row.filename, 'filename'));
      const doc = parseExport(readText(sourceFile), { ...row,
        source_id: kind === 'source' ? row.id : undefined, note_id: kind === 'note' ? row.id : undefined,
        kind, notebook_id: data.notebook_id, notebook_title: data.notebook_title,
        exported_at_utc: data.exported_at_utc });
      documents.push(doc);
    }
  }
  return { documents, skipped };
}

function strings(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v.trim())) throw new Error(`invalid_${name}`);
  return value.map(v => v.trim());
}

function readCoverage(doc, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['exported_text_only', 'partial_export', 'selected_passages'].includes(value.scope)
    || (value.originalCompleteness !== undefined && value.originalCompleteness !== 'unverified')) throw new Error('invalid_read_coverage');
  const limitations = strings(value.limitations, 'coverage_limitations');
  if (value.scope !== 'exported_text_only' && !limitations.length) throw new Error('coverage_limitations_required');
  let evidence = null;
  if (value.evidenceQuote !== undefined) {
    const quote = required(value.evidenceQuote, 'coverage_evidence_quote'), start = doc.body.indexOf(quote);
    if (start < 0) throw new Error('coverage_quote_not_in_source');
    evidence = { quote, start, end: start + quote.length, offsetUnit: 'utf16_code_units', sourceHash: doc.contentHash };
  }
  return { scope: value.scope, originalCompleteness: 'unverified', limitations, evidence };
}

function annotate(doc, annotation) {
  if (!annotation) return { summary: null, principles: [], statements: [], relations: [], reuse: [], openQuestions: ['要約・思想・関連・転用案の編集確認が必要'], canonicalTarget: null, reviewStatus: 'needs_extraction' };
  if (secret.test(stable(annotation))) throw new Error('possible_credentials_in_annotation');
  const summary = required(annotation.summary, 'summary');
  const principles = strings(annotation.principles, 'principles');
  const statements = (annotation.statements || []).map(s => {
    if (!['claim', 'hypothesis', 'interpretation', 'experience', 'fact'].includes(s.kind)) throw new Error('invalid_statement_kind');
    const text = required(s.text, 'statement_text');
    const quote = required(s.quote, 'evidence_quote');
    const start = doc.body.indexOf(quote);
    if (start < 0) throw new Error('evidence_quote_not_in_source');
    // A transcript supports attribution, not truth. P0 never promotes world claims to FACT.
    if (s.kind === 'fact' && s.scope !== 'document_observation') throw new Error('external_fact_requires_independent_verification');
    return { kind: s.kind, scope: s.scope || (s.kind === 'interpretation' ? 'annotation' : s.kind === 'hypothesis' ? 'hypothesis' : 'source_claim'), text,
      verification: s.kind === 'fact' ? 'source_text_observed' : 'unverified',
      evidence: { quote, start, end: start + quote.length, offsetUnit: 'utf16_code_units', sourceHash: doc.contentHash } };
  });
  if (!statements.length) throw new Error('at_least_one_grounded_statement_required');
  const relations = (annotation.relations || []).map(r => ({
    targetId: r.targetId || null, targetUrl: r.targetUrl ? canonicalUrl(r.targetUrl) : null,
    title: required(r.title, 'relation_title'), relation: required(r.relation, 'relation'),
    rationale: required(r.rationale, 'relation_rationale'), status: 'candidate', origin: 'harvest_annotation',
  }));
  const reuse = (annotation.reuse || []).map(r => ({ area: required(r.area, 'reuse_area'), idea: required(r.idea, 'reuse_idea'), status: 'proposal' }));
  const openQuestions = strings(annotation.openQuestions, 'open_questions');
  let canonicalTarget = null;
  if (annotation.canonicalTarget) {
    const t = annotation.canonicalTarget;
    if (!['LINK', 'MERGE', 'UPDATE', 'REFERENCE'].includes(t.action)) throw new Error('invalid_canonical_target_action');
    canonicalTarget = { action: t.action, targetId: required(t.targetId, 'target_id'),
      targetUrl: canonicalUrl(t.targetUrl), title: required(t.title, 'target_title'),
      section: required(t.section, 'target_section'), rationale: required(t.rationale, 'target_rationale'),
      evidenceQuote: required(t.evidenceQuote, 'target_evidence_quote') };
  }
  return { summary, principles, statements, relations, reuse, openQuestions, canonicalTarget,
    ...(annotation.coverage !== undefined ? { coverage: readCoverage(doc, annotation.coverage) } : {}),
    reviewStatus: 'candidate_unreviewed' };
}

export function captureText(candidate) {
  const lines = [candidate.title, `[NotebookLM harvest candidate ${candidate.id}]`,
    'STATUS: private draft / SOURCE claims unverified / interpretations and reuse are proposals',
    `SOURCE: ${candidate.source.originalUrl || candidate.source.notebookUrl}`,
    `Source ID: ${candidate.source.sourceId || 'not supplied'}`,
    `Notebook: ${candidate.source.notebookTitle || candidate.source.notebookId || 'document export'}`,
    `Notebook URL: ${candidate.source.notebookUrl || 'not applicable'}`,
    `Source hash: ${candidate.contentHash}`, '', 'SUMMARY', candidate.summary || 'UNVERIFIED: extraction pending',
    '', 'READ COVERAGE', `Scope: ${candidate.coverage?.scope || 'exported_text_only'}; original completeness: unverified`,
    ...(candidate.coverage?.limitations || []).map(v => `- ${v}`),
    ...(candidate.coverage?.evidence ? [`Coverage evidence: ${candidate.coverage.evidence.quote}`] : []),
    '', 'PRINCIPLES (annotation)', ...candidate.principles.map(v => `- ${v}`),
    '', 'STATEMENTS', ...candidate.statements.map(s => `[${s.kind}/${s.verification}] ${s.text}\nEvidence: ${s.evidence.quote}`),
    '', 'RELATION CANDIDATES', ...candidate.relations.map(r => `${r.title} (${r.targetId || r.targetUrl || 'unresolved'}): ${r.relation}; ${r.rationale}`),
    '', 'REUSE PROPOSALS', ...candidate.reuse.map(r => `${r.area}: ${r.idea}`),
    '', 'OPEN QUESTIONS', ...candidate.openQuestions.map(q => `- ${q}`),
    ...(candidate.canonicalTarget ? ['', 'CANONICAL TARGET PROPOSAL', `${candidate.canonicalTarget.action}: ${candidate.canonicalTarget.title} / ${candidate.canonicalTarget.section}`, candidate.canonicalTarget.targetUrl, candidate.canonicalTarget.rationale, `Existing target evidence: ${candidate.canonicalTarget.evidenceQuote}`] : [])];
  return lines.join('\n');
}

export function buildHarvest(documents, { annotations = {}, previous = null, existing = [], skipped = [] } = {}) {
  if (previous && previous.schema !== SCHEMA) throw new Error('incompatible_previous_receipt');
  if (!Array.isArray(existing)) throw new Error('existing_snapshot_must_be_array');
  const prior = new Map([...(previous?.deferredCandidates || []), ...(previous?.candidates || [])].map(c => [c.id, c]));
  const aliases = new Map();
  for (const old of prior.values()) {
    for (const o of old.occurrences || []) {
      if (o.notebookId && o.sourceId) aliases.set(stable([o.notebookId, o.sourceId, o.kind]), old.id);
    }
  }
  const groups = new Map();
  for (const doc of documents) {
    const alias = aliases.get(stable([doc.source.notebookId, doc.source.sourceId, doc.source.kind]));
    const id = alias || doc.id;
    const group = groups.get(id) || [];
    group.push(doc); groups.set(id, group);
  }
  const candidates = [];
  for (const [id, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    group.sort((a, b) => stable([a.source.notebookId, a.source.sourceId, a.source.originalUrl, a.contentHash]).localeCompare(stable([b.source.notebookId, b.source.sourceId, b.source.originalUrl, b.contentHash])));
    const old = prior.get(id);
    // Different bodies under one URL require review; never silently pick a winner.
    const conflict = new Set(group.map(d => d.contentHash)).size > 1 || old?.delta?.action === 'conflict';
    const doc = group.find(d => annotations[d.source.sourceId]) || group[0];
    const retained = old?.contentHash === doc.contentHash && old.summary ? {
      summary: old.summary, principles: old.principles, relations: old.relations,
      reuse: old.reuse, openQuestions: old.openQuestions, canonicalTarget: old.canonicalTarget,
      ...(old.coverage ? { coverage: { ...old.coverage, ...(old.coverage.evidence ? { evidenceQuote: old.coverage.evidence.quote } : {}) } } : {}),
      statements: old.statements.map(s => ({ ...s, quote: s.evidence.quote })),
    } : null;
    const annotation = annotations[id] || annotations[doc.source.sourceId] || annotations[doc.source.url] || retained;
    const fields = annotate(doc, annotation);
    let canonicalMatch = null;
    if (fields.canonicalTarget) {
      const t = fields.canonicalTarget;
      canonicalMatch = existing.find(e => e.id === t.targetId && e.source_url && canonicalUrl(e.source_url) === t.targetUrl);
      if (!canonicalMatch || typeof canonicalMatch.content !== 'string') throw new Error('canonical_target_snapshot_required');
      const content = normal(canonicalMatch.content), start = content.indexOf(t.evidenceQuote);
      if (start < 0) throw new Error('canonical_target_evidence_mismatch');
      fields.canonicalTarget = { ...t, verification: 'target_text_observed_not_write_approved',
        targetContentHash: sha(content), evidenceStart: start, evidenceEnd: start + t.evidenceQuote.length, offsetUnit: 'utf16_code_units' };
    }
    const occurrenceMap = new Map();
    for (const occurrence of [...(old?.occurrences || []), ...group.map(d => ({ title: d.title, ...d.source, contentHash: d.contentHash }))]) {
      const key = stable([occurrence.notebookId, occurrence.sourceId, occurrence.kind, occurrence.originalUrl]);
      occurrenceMap.set(key, occurrence);
    }
    const occurrences = [...occurrenceMap.values()].sort((a, b) => stable([a.notebookId, a.sourceId, a.originalUrl]).localeCompare(stable([b.notebookId, b.sourceId, b.originalUrl])));
    const candidate = { id, title: doc.title, source: doc.source, occurrences, contentHash: doc.contentHash,
      sourceBody: doc.body, ...fields };
    const revisionSource = { ...doc.source, exportedAt: null, manifestObservedAt: null };
    const revisionOccurrences = occurrences.map(o => ({ ...o, exportedAt: null, manifestObservedAt: null }));
    candidate.revisionHash = sha(stable({ title: doc.title, source: revisionSource, occurrences: revisionOccurrences, contentHash: doc.contentHash, ...fields }));
    const matched = existing.filter(e => e === canonicalMatch || e.id === id || (e.source_url && doc.source.url && canonicalUrl(e.source_url) === doc.source.url));
    candidate.delta = { action: conflict ? 'conflict' : !old ? 'create' : old.revisionHash === candidate.revisionHash ? 'unchanged' : 'update',
      previousRevisionHash: old?.revisionHash || null,
      changedFields: old ? [
        ...['title', 'contentHash', 'summary', 'principles', 'statements', 'relations', 'reuse', 'openQuestions', 'canonicalTarget', 'coverage'].filter(k => stable(old[k]) !== stable(candidate[k])),
        ...(stable({ ...old.source, exportedAt: null, manifestObservedAt: null }) !== stable(revisionSource) ? ['source'] : []),
        ...(stable((old.occurrences || []).map(o => ({ ...o, exportedAt: null, manifestObservedAt: null }))) !== stable(revisionOccurrences) ? ['occurrences'] : []),
      ] : [] };
    candidate.integration = {
      target: '/dashboard/knowledge', canonicalOwner: 'Google Drive / MASA_OS',
      operation: conflict ? 'HOLD_CONFLICT' : fields.canonicalTarget ? `REVIEW_${fields.canonicalTarget.action}_EXISTING` : matched.length ? 'LINK_OR_MERGE_EXISTING' : candidate.delta.action === 'unchanged' ? 'NO_CHANGE' : old ? 'REVIEW_UPDATE' : 'REVIEW_CREATE',
      existingMatches: matched.map(e => ({ id: e.id, title: e.title || null })),
      humanGate: ['confirm_canonical_target_and_rights', 'review_source_claims_and_annotations', 'verify_owner_rpc_and_rls', 'read_back_after_apply'],
      applied: false,
      duplicateCheck: existing.length ? 'bounded_existing_snapshot_and_batch' : 'batch_and_previous_receipt_only_live_check_required',
      // Existing capture is insert-only. UPDATE/LINK must never create another capture.
      capturePreview: null,
    };
    const text = captureText(candidate);
    if (!conflict && !matched.length && !old && fields.reviewStatus === 'candidate_unreviewed' && text.length <= 12000 && Buffer.byteLength(JSON.stringify({kind:'capture',text})) <= 32000) {
      candidate.integration.capturePreview = { endpoint: '/api/dashboard/knowledge', method: 'POST', body: { kind: 'capture', text } };
    }
    if (conflict) candidate.conflictingSources = [...(old?.conflictingSources || []), ...group.map(d => ({ source: d.source, body: d.body, contentHash: d.contentHash }))]
      .filter((d, i, all) => all.findIndex(v => stable(v) === stable(d)) === i);
    candidates.push(candidate);
  }
  const counts = { inputDocuments: documents.length, notebooks: new Set(documents.map(d => d.source.notebookId).filter(Boolean)).size,
    uniqueSources: candidates.length, duplicateRegistrations: documents.length - candidates.length,
    structuredCandidates: candidates.filter(c => c.reviewStatus === 'candidate_unreviewed').length,
    skipped: skipped.length, create: 0, update: 0, unchanged: 0, conflict: 0, applied: 0 };
  for (const c of candidates) counts[c.delta.action]++;
  return { schema: SCHEMA, mode: 'offline_candidate_packet', counts, candidates, skipped,
    // Missing inputs can be a partial batch. They are never tombstones or delete requests.
    deferredCandidates: [...prior.values()].filter(c => !groups.has(c.id)),
    missingPreviousIds: [...prior.keys()].filter(id => !groups.has(id)), liveWrites: 0 };
}

export function renderMarkdown(packet) {
  return ['# NotebookLM Knowledge Harvest — PRIVATE review packet', '',
    `Schema: ${SCHEMA}`, 'Drive remains canonical. No live writes; this packet is an intermediate review artifact.',
    `Counts: ${JSON.stringify(packet.counts)}`, '',
    ...packet.candidates.map(c => `${captureText(c)}\n\nDELTA: ${JSON.stringify(c.delta)}\nINTEGRATION: ${c.integration.operation}\n\n---\n`)].join('\n');
}
