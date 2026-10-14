-- Dashboard design choices only; task and Flow Canvas records are untouched.
create table private.masa_dashboard_design_state (
  owner_key text primary key references private.masa_dashboard_owner_keys(owner_key) on delete cascade,
  snapshot jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz,
  check ((revision = 0 and snapshot is null) or
    (revision > 0 and snapshot is not null and jsonb_typeof(snapshot) = 'object'
      and snapshot->>'version' = '1' and octet_length(snapshot::text) <= 32000))
);
alter table private.masa_dashboard_design_state enable row level security;
revoke all on private.masa_dashboard_design_state from public, anon, authenticated;

-- SECURITY DEFINER is the existing dashboard's guarded RPC contract: the
-- publishable role has no table access. Owner keys are derived on the Worker,
-- checked against a private allowlist and never returned to browsers.
create function public.masa_design_state_get_v1(p_owner_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$'
    or not exists(select 1 from private.masa_dashboard_owner_keys where owner_key = p_owner_key)
  then raise exception 'dashboard_owner_required' using errcode = '28000'; end if;
  select jsonb_build_object('snapshot',snapshot,'revision',revision,'updatedAt',updated_at)
    into v_result from private.masa_dashboard_design_state where owner_key = p_owner_key;
  return coalesce(v_result,jsonb_build_object('snapshot',null,'revision',0,'updatedAt',null));
end;
$$;
revoke all on function public.masa_design_state_get_v1(text) from public, anon, authenticated;
grant execute on function public.masa_design_state_get_v1(text) to anon, authenticated;

create function public.masa_design_state_save_v1(p_owner_key text,p_snapshot jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$'
    or not exists(select 1 from private.masa_dashboard_owner_keys where owner_key = p_owner_key)
  then raise exception 'dashboard_owner_required' using errcode = '28000'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 2147483647
    or p_snapshot is null or jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_snapshot->>'version' is distinct from '1' or octet_length(p_snapshot::text) > 32000
    or jsonb_typeof(p_snapshot->'references') is distinct from 'object'
    or p_snapshot->'references'->>'version' is distinct from '1'
    or jsonb_typeof(p_snapshot->'favorites') is distinct from 'array'
    or jsonb_array_length(p_snapshot->'favorites') > 12
    or jsonb_typeof(p_snapshot->'draft') is distinct from 'object'
    or p_snapshot->'draft'->>'version' is distinct from '2'
  then raise exception 'invalid_design_snapshot' using errcode = '22023'; end if;

  -- The initial insert serializes first writers too. A rejected CAS rolls back
  -- its placeholder, so no row survives an unsuccessful initial save.
  insert into private.masa_dashboard_design_state(owner_key) values(p_owner_key) on conflict do nothing;
  update private.masa_dashboard_design_state set snapshot = p_snapshot,
    revision = revision + 1, updated_at = clock_timestamp()
    where owner_key = p_owner_key and revision = p_expected_revision
    returning jsonb_build_object('snapshot',snapshot,'revision',revision,'updatedAt',updated_at) into v_result;
  if not found then raise exception 'revision_conflict' using errcode = '40001'; end if;
  return v_result;
end;
$$;
revoke all on function public.masa_design_state_save_v1(text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.masa_design_state_save_v1(text,jsonb,integer) to anon, authenticated;
