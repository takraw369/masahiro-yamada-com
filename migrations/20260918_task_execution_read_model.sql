alter table public.os_tasks
  add column if not exists execution_lane text,
  add column if not exists execution_class text;

create or replace function public.masa_task_execution_list_v1(
  p_owner_key text,
  p_limit integer default 120
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 120), 300));
  v_items jsonb;
  v_summary jsonb;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;

  if not exists (
    select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key
  ) then
    raise exception 'invalid_owner_key';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_status, x.sort_priority, x.updated_at desc), '[]'::jsonb)
    into v_items
  from (
    select
      t.task_id,
      t.status,
      t.priority,
      t.task,
      t.project,
      t.due_date,
      t.time_hint,
      t.next_action,
      t.execution_lane,
      t.execution_class,
      t.source_revision,
      t.source_edit_at,
      t.source_edit_by,
      t.source_updated_at,
      t.updated_at,
      case
        when t.status = 'DONE' then 'RECEIPT'
        when t.status = 'REVIEW' then 'VALIDATE'
        when t.status = 'WAIT' and t.execution_lane = 'MASA_GATE' then 'HUMAN_GATE'
        when t.status = 'WAIT' then 'BLOCKED'
        when t.status = 'NOW' then 'EXECUTE'
        when t.status = 'NEXT' then 'QUEUED'
        else 'STATE'
      end as phase,
      case t.status when 'NOW' then 1 when 'REVIEW' then 2 when 'NEXT' then 3 when 'WAIT' then 4 when 'DONE' then 5 else 6 end as sort_status,
      case t.priority when 'P0' then 1 when 'P1' then 2 when 'P2' then 3 else 4 end as sort_priority
    from public.os_tasks t
    where t.task_id is not null
    order by sort_status, sort_priority, t.updated_at desc
    limit v_limit
  ) x;

  select jsonb_build_object(
    'total', count(*),
    'now', count(*) filter (where status = 'NOW'),
    'next', count(*) filter (where status = 'NEXT'),
    'review', count(*) filter (where status = 'REVIEW'),
    'wait', count(*) filter (where status = 'WAIT'),
    'done', count(*) filter (where status = 'DONE'),
    'aiRun', count(*) filter (where execution_lane = 'AI_RUN' and status <> 'DONE'),
    'masaGate', count(*) filter (where execution_lane = 'MASA_GATE' and status <> 'DONE'),
    'unclassified', count(*) filter (where execution_lane is null and status in ('NOW','NEXT','REVIEW')),
    'lastSourceSyncAt', max(source_updated_at)
  ) into v_summary
  from public.os_tasks;

  return jsonb_build_object(
    'items', v_items,
    'summary', v_summary,
    'rule', '1 Task = 1 Execution Thread = 1 Deliverable = 1 Validation = 1 Receipt'
  );
end;
$$;

revoke all on function public.masa_task_execution_list_v1(text, integer) from public;
grant execute on function public.masa_task_execution_list_v1(text, integer) to anon, authenticated, service_role;
