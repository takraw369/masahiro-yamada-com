-- Harden legacy dashboard bearer-key RPCs.
-- Keep anon/authenticated execution for the existing dashboard client, but
-- require the supplied 64-hex owner key to exist in the private registry.

create or replace function public.masa_dashboard_feedback_add_v2(
  p_owner_key text,
  p_page text,
  p_message text,
  p_context text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_id uuid;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message_required';
  end if;

  insert into public.os_feedback(
    target_type, target_key, feedback_type, body, status, source,
    public_consent, metadata, occurred_at
  ) values (
    'dashboard',
    coalesce(nullif(trim(p_page), ''), '/dashboard'),
    'request',
    left(trim(p_message), 5000),
    'pending',
    'masahiro-yamada-com',
    'private',
    jsonb_build_object('context', p_context, 'owner_key', p_owner_key),
    now()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.masa_dashboard_feedback_import_v2(
  p_owner_key text,
  p_legacy_id bigint,
  p_page text,
  p_message text,
  p_context text default null,
  p_status text default 'new',
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_id uuid;
  v_client_event_id text;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  v_client_event_id := 'd1-dashboard-feedback:' || p_owner_key || ':' || p_legacy_id::text;

  select id into v_id from public.os_feedback
  where client_event_id = v_client_event_id limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.os_feedback(
    target_type, target_key, feedback_type, body, status, source,
    client_event_id, public_consent, metadata, occurred_at, created_at, updated_at
  ) values (
    'dashboard',
    coalesce(nullif(trim(p_page), ''), '/dashboard'),
    'request',
    left(trim(p_message), 5000),
    case when p_status in ('reviewing','applied','dismissed') then p_status else 'pending' end,
    'masahiro-yamada-com',
    v_client_event_id,
    'private',
    jsonb_build_object(
      'context', p_context,
      'owner_key', p_owner_key,
      'legacy_d1_status', p_status,
      'legacy_d1_id', p_legacy_id
    ),
    coalesce(p_created_at, now()),
    coalesce(p_created_at, now()),
    now()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.masa_dashboard_feedback_list_v2(
  p_owner_key text,
  p_limit integer default 20
)
returns table(id uuid, page text, message text, context text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = 'public', 'private'
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;

  return query
  select
    f.id,
    f.target_key as page,
    f.body as message,
    nullif(f.metadata->>'context', '') as context,
    f.status,
    f.created_at
  from public.os_feedback f
  where f.target_type = 'dashboard'
    and f.source = 'masahiro-yamada-com'
    and f.metadata->>'owner_key' = p_owner_key
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

create or replace function public.masa_dashboard_state_get_v2(p_owner_key text)
returns table(slot_id text)
language plpgsql
stable
security definer
set search_path = 'public', 'private'
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;

  return query
  select s.slot_id
  from public.masa_dashboard_state s
  where s.owner_key = p_owner_key
    and s.slot_id <> '__legacy_d1_migrated__'
  order by s.checked_at asc;
end;
$$;

create or replace function public.masa_dashboard_state_set_v2(
  p_owner_key text,
  p_slot_id text,
  p_checked boolean,
  p_xp integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if p_slot_id is null or length(trim(p_slot_id)) = 0 or length(p_slot_id) > 180 then
    raise exception 'invalid_slot_id';
  end if;
  if p_slot_id = '__legacy_d1_migrated__' then
    raise exception 'reserved_slot_id';
  end if;

  if p_checked then
    insert into public.masa_dashboard_state(owner_key, slot_id, xp, checked_at)
    values (p_owner_key, p_slot_id, greatest(coalesce(p_xp, 0), 0), now())
    on conflict (owner_key, slot_id)
    do update set xp = excluded.xp, checked_at = now();
  else
    delete from public.masa_dashboard_state
    where owner_key = p_owner_key and slot_id = p_slot_id;
  end if;
  return true;
end;
$$;

create or replace function public.masa_legacy_d1_mark_migrated_v2(p_owner_key text)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  insert into public.masa_dashboard_state(owner_key, slot_id, xp, checked_at)
  values (p_owner_key, '__legacy_d1_migrated__', 0, now())
  on conflict (owner_key, slot_id) do update set checked_at = now();
  return true;
end;
$$;

create or replace function public.masa_legacy_d1_migrated_v2(p_owner_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = 'public', 'private'
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  return exists(
    select 1 from public.masa_dashboard_state
    where owner_key = p_owner_key and slot_id = '__legacy_d1_migrated__'
  );
end;
$$;
