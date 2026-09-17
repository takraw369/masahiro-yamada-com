import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type TaskExecutionRow = {
  task_id: string;
  status: string | null;
  priority: string | null;
  task: string | null;
  project: string | null;
  due_date: string | null;
  time_hint: string | null;
  next_action: string | null;
  execution_lane: string | null;
  execution_class: string | null;
  source_revision: number | null;
  source_edit_at: string | null;
  source_edit_by: string | null;
  source_updated_at: string | null;
  updated_at: string | null;
  phase: string | null;
};

type TaskExecutionPayload = {
  items?: TaskExecutionRow[];
  summary?: Record<string, unknown>;
  rule?: string;
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const GET = async ({ request, locals }: APIContext) => {
  try {
    const url = new URL(request.url);
    const limit = clamp(Number(url.searchParams.get('limit') || 120) || 120, 1, 300);
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const payload = await supabaseRpc<TaskExecutionPayload>(env, 'masa_task_execution_list_v1', {
      p_owner_key: ownerKey,
      p_limit: limit,
    });

    const items = (payload?.items ?? []).map((row) => ({
      taskId: row.task_id,
      status: row.status,
      priority: row.priority,
      task: row.task,
      project: row.project,
      dueDate: row.due_date,
      timeHint: row.time_hint,
      nextAction: row.next_action,
      executionLane: row.execution_lane,
      executionClass: row.execution_class,
      sourceRevision: row.source_revision,
      sourceEditAt: row.source_edit_at,
      sourceEditBy: row.source_edit_by,
      sourceUpdatedAt: row.source_updated_at,
      updatedAt: row.updated_at,
      phase: row.phase,
    }));

    return json({
      ok: true,
      items,
      summary: payload?.summary ?? {},
      rule: payload?.rule ?? '1 Task = 1 Execution Thread = 1 Deliverable = 1 Validation = 1 Receipt',
      aiApiCalls: 0,
    });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};
