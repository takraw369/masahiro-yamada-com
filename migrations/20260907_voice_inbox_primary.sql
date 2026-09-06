-- Move Voice Inbox ownership to the PRIMARY MASA Dashboard.
-- Dashboard requests are already protected by the Cloudflare/Astro dashboard cookie.
-- These RPCs add a second DB-side check against the one canonical dashboard owner key.

create schema if not exists private;

create table if not exists private.masa_dashboard_owner_keys (
  owner_key text primary key,
  created_at timestamptz not null default now(),
  constraint masa_dashboard_owner_key_format check (owner_key ~ '^[0-9a-f]{64}$')
);

-- Seed from the existing canonical Dashboard state without exposing the key in source code.
insert into private.masa_dashboard_owner_keys (owner_key)
select distinct owner_key
from public.masa_dashboard_state
where owner_key ~ '^[0-9a-f]{64}$'
on conflict (owner_key) do nothing;

revoke all on table private.masa_dashboard_owner_keys from public, anon, authenticated;

create or replace function public.masa_voice_inbox_list_v1(
  p_owner_key text,
  p_limit integer default 250
)
returns setof public.os_feedback
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not exists (
    select 1
    from private.masa_dashboard_owner_keys k
    where k.owner_key = p_owner_key
  ) then
    raise exception 'dashboard_owner_required';
  end if;

  return query
  select f.*
  from public.os_feedback f
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 250), 500));
end;
$$;

revoke all on function public.masa_voice_inbox_list_v1(text, integer) from public;
grant execute on function public.masa_voice_inbox_list_v1(text, integer) to anon, authenticated;

create or replace function public.masa_voice_inbox_update_v1(
  p_owner_key text,
  p_id uuid,
  p_patch jsonb
)
returns public.os_feedback
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.os_feedback;
  v_status text;
  v_priority text;
  v_bucket text;
begin
  if not exists (
    select 1
    from private.masa_dashboard_owner_keys k
    where k.owner_key = p_owner_key
  ) then
    raise exception 'dashboard_owner_required';
  end if;

  if p_id is null then
    raise exception 'voice_id_required';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'voice_patch_required';
  end if;

  if p_patch ? 'status' then
    v_status := p_patch->>'status';
    if v_status not in ('pending', 'reviewing', 'applied', 'dismissed') then
      raise exception 'invalid_voice_status';
    end if;
  end if;

  if p_patch ? 'priority' then
    v_priority := p_patch->>'priority';
    if v_priority not in ('P0', 'P1', 'P2', 'P3') then
      raise exception 'invalid_voice_priority';
    end if;
  end if;

  if p_patch ? 'workflow_bucket' then
    v_bucket := p_patch->>'workflow_bucket';
    if v_bucket not in ('inbox', 'improvement', 'case', 'content', 'product', 'research') then
      raise exception 'invalid_voice_bucket';
    end if;
  end if;

  update public.os_feedback f
  set
    status = case when p_patch ? 'status' then v_status else f.status end,
    priority = case when p_patch ? 'priority' then v_priority else f.priority end,
    workflow_bucket = case when p_patch ? 'workflow_bucket' then v_bucket else f.workflow_bucket end,
    theme = case when p_patch ? 'theme' then nullif(left(trim(p_patch->>'theme'), 240), '') else f.theme end,
    cluster_key = case when p_patch ? 'cluster_key' then nullif(left(trim(p_patch->>'cluster_key'), 240), '') else f.cluster_key end,
    review_note = case when p_patch ? 'review_note' then nullif(left(trim(p_patch->>'review_note'), 3000), '') else f.review_note end,
    reviewed_at = case
      when p_patch ? 'status' and v_status = 'pending' then null
      when p_patch ? 'status' then now()
      else f.reviewed_at
    end,
    updated_at = now()
  where f.id = p_id
  returning f.* into v_row;

  if v_row.id is null then
    raise exception 'voice_not_found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.masa_voice_inbox_update_v1(text, uuid, jsonb) from public;
grant execute on function public.masa_voice_inbox_update_v1(text, uuid, jsonb) to anon, authenticated;
