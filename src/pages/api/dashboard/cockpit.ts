import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type ProjectItem = {
  entity_id?: string;
  entity_type?: string;
  title?: string;
  project?: string;
  priority?: string;
  status?: string;
  due_date?: string | null;
  next_action?: string | null;
  stale?: boolean;
};

type ProjectSignals = {
  actionable_tasks?: number;
  now_tasks?: number;
  review_tasks?: number;
  blocked_high_priority?: number;
  overdue_actionable?: number;
  stale_actionable?: number;
  s_projects?: number;
  sync_errors?: number;
};

type ProjectPack = {
  primary_focus?: ProjectItem | null;
  focus?: ProjectItem[];
  bottleneck_candidate?: ProjectItem | null;
  blocked_high_priority?: ProjectItem[];
  review_queue?: ProjectItem[];
  stale_queue?: ProjectItem[];
  signals?: ProjectSignals;
  rule_version?: string;
};

type EvidenceRow = {
  id?: string;
  title?: string;
  evidence_type?: string;
  evidence_quality?: string;
  status?: string;
  tags?: string[] | null;
  occurred_at?: string;
  updated_at?: string;
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const clean = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function compactProject(item: ProjectItem | null | undefined) {
  if (!item) return null;
  return {
    id: clean(item.entity_id, 80),
    type: clean(item.entity_type, 60),
    title: clean(item.title, 220),
    project: clean(item.project, 220),
    priority: clean(item.priority, 24),
    status: clean(item.status, 40),
    dueDate: clean(item.due_date, 40) || null,
    nextAction: clean(item.next_action, 520) || null,
    stale: Boolean(item.stale),
  };
}

function compactEvidence(item: EvidenceRow) {
  return {
    id: clean(item.id, 100),
    title: clean(item.title, 220),
    type: clean(item.evidence_type, 60),
    quality: clean(item.evidence_quality, 60),
    status: clean(item.status, 60),
    tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string').slice(0, 5) : [],
    occurredAt: clean(item.occurred_at, 60) || null,
    updatedAt: clean(item.updated_at, 60) || null,
  };
}

function tokyoToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const GET = async ({ locals }: APIContext) => {
  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);

    const [projectResult, evidenceResult] = await Promise.allSettled([
      supabaseRpc<ProjectPack>(env, 'masa_choice_project_context_v1', {
        p_owner_key: ownerKey,
        p_date: tokyoToday(),
        p_limit: 5,
      }),
      supabaseRpc<EvidenceRow[]>(env, 'masa_evidence_list_v1', {
        p_owner_key: ownerKey,
        p_limit: 8,
      }),
    ]);

    const projectPack = projectResult.status === 'fulfilled' ? projectResult.value ?? null : null;
    const evidenceRows = evidenceResult.status === 'fulfilled' ? evidenceResult.value ?? [] : [];

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      project: {
        available: projectResult.status === 'fulfilled',
        primaryFocus: compactProject(projectPack?.primary_focus),
        focus: (projectPack?.focus ?? []).slice(0, 5).map(compactProject).filter(Boolean),
        bottleneck: compactProject(projectPack?.bottleneck_candidate),
        blocked: (projectPack?.blocked_high_priority ?? []).slice(0, 5).map(compactProject).filter(Boolean),
        signals: projectPack?.signals ?? null,
        ruleVersion: clean(projectPack?.rule_version, 80) || null,
      },
      evidence: {
        available: evidenceResult.status === 'fulfilled',
        items: evidenceRows.slice(0, 5).map(compactEvidence),
      },
    });
  } catch {
    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      project: { available: false, primaryFocus: null, focus: [], bottleneck: null, blocked: [], signals: null, ruleVersion: null },
      evidence: { available: false, items: [] },
    });
  }
};
