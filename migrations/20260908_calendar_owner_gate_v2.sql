-- Harden the already-deployed Calendar snapshot before the Calendar UI is accepted.
--
-- This is additive to the 20260906 v1 migration that was applied out-of-band.
-- Google Calendar remains canonical; these tables are a private display snapshot.
-- Public API callers use a publishable key, so RPC EXECUTE remains available to
-- anon/authenticated only behind a registered, unguessable Dashboard owner key.

alter table public.masa_calendar_events enable row level security;
alter table public.masa_calendar_sync_state enable row level security;

revoke all on table public.masa_calendar_events from public, anon, authenticated;
revoke all on table public.masa_calendar_sync_state from public, anon, authenticated;

alter table public.masa_calendar_sync_state
  add column if not exists source_synced_at timestamptz;

update public.masa_calendar_sync_state
set source_synced_at = coalesce(source_synced_at, synced_at)
where source_synced_at is null;

create or replace function public.masa_calendar_snapshot_replace_v2(
  p_owner_key text,
  p_events jsonb,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_source_synced_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  item jsonb;
  inserted_count integer := 0;
  v_event_id text;
  v_title text;
  v_calendar_id text;
  v_location text;
  v_start timestamptz;
  v_end timestamptz;
  v_all_day boolean;
  v_last_source_synced_at timestamptz;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;

  if not exists (
    select 1
    from private.masa_dashboard_owner_keys k
    where k.owner_key = p_owner_key
  ) then
    raise exception 'dashboard_owner_required';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'events_must_be_array';
  end if;
  if jsonb_array_length(p_events) > 500 then
    raise exception 'too_many_events';
  end if;
  if pg_column_size(p_events) > 2097152 then
    raise exception 'calendar_payload_too_large';
  end if;

  if p_window_start is null
     or p_window_end is null
     or p_window_end <= p_window_start
     or p_window_end > p_window_start + interval '90 days' then
    raise exception 'invalid_window';
  end if;

  if p_source_synced_at is null
     or p_source_synced_at > now() + interval '10 minutes'
     or p_source_synced_at < now() - interval '7 days' then
    raise exception 'invalid_source_synced_at';
  end if;

  -- Validate the complete payload before touching the previous snapshot. The
  -- function is transactional, but pre-validation also makes failures deterministic.
  if exists (
    select 1
    from jsonb_array_elements(p_events) e(value)
    where jsonb_typeof(e.value) <> 'object'
  ) then
    raise exception 'invalid_event_shape';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_events) e(value)
  ) <> (
    select count(distinct nullif(btrim(e.value->>'event_id'), ''))
    from jsonb_array_elements(p_events) e(value)
  ) then
    raise exception 'duplicate_or_missing_event_id';
  end if;

  for item in select value from jsonb_array_elements(p_events)
  loop
    v_event_id := btrim(coalesce(item->>'event_id', ''));
    v_title := btrim(coalesce(item->>'title', ''));
    v_calendar_id := btrim(coalesce(item->>'calendar_id', ''));
    v_location := btrim(coalesce(item->>'location', ''));

    if v_event_id = '' or char_length(v_event_id) > 512 then
      raise exception 'invalid_event_id';
    end if;
    if v_title = '' then
      v_title := '(no title)';
    end if;
    if char_length(v_title) > 500 then
      raise exception 'invalid_event_title';
    end if;
    if char_length(v_calendar_id) > 255 then
      raise exception 'invalid_calendar_id';
    end if;
    if char_length(v_location) > 500 then
      raise exception 'invalid_event_location';
    end if;

    if item ? 'all_day' and jsonb_typeof(item->'all_day') <> 'boolean' then
      raise exception 'invalid_all_day';
    end if;
    v_all_day := coalesce((item->>'all_day')::boolean, false);

    begin
      v_start := (item->>'start_at')::timestamptz;
      v_end := (item->>'end_at')::timestamptz;
    exception when others then
      raise exception 'invalid_event_time';
    end;

    if v_start is null or v_end is null or v_end <= v_start then
      raise exception 'invalid_event_range';
    end if;
    -- CalendarApp may return events that overlap the requested window, so do not
    -- require each event to be fully contained inside it.
    if v_end < p_window_start or v_start > p_window_end then
      raise exception 'event_outside_window';
    end if;
  end loop;

  -- One owner can have only one whole-snapshot replacement in flight. The source
  -- timestamp then prevents an older request that arrived late from winning.
  perform pg_advisory_xact_lock(hashtextextended(p_owner_key, 0));

  select s.source_synced_at
  into v_last_source_synced_at
  from public.masa_calendar_sync_state s
  where s.owner_key = p_owner_key;

  if v_last_source_synced_at is not null
     and p_source_synced_at <= v_last_source_synced_at then
    raise exception 'stale_calendar_snapshot';
  end if;

  delete from public.masa_calendar_events
  where owner_key = p_owner_key;

  for item in select value from jsonb_array_elements(p_events)
  loop
    v_event_id := btrim(item->>'event_id');
    v_title := coalesce(nullif(btrim(item->>'title'), ''), '(no title)');
    v_calendar_id := coalesce(nullif(btrim(item->>'calendar_id'), ''), 'primary');
    v_location := nullif(btrim(coalesce(item->>'location', '')), '');
    v_start := (item->>'start_at')::timestamptz;
    v_end := (item->>'end_at')::timestamptz;
    v_all_day := coalesce((item->>'all_day')::boolean, false);

    insert into public.masa_calendar_events(
      owner_key,
      event_id,
      calendar_id,
      title,
      start_at,
      end_at,
      all_day,
      location,
      source,
      synced_at
    ) values (
      p_owner_key,
      v_event_id,
      v_calendar_id,
      v_title,
      v_start,
      v_end,
      v_all_day,
      v_location,
      'google_calendar',
      now()
    );
    inserted_count := inserted_count + 1;
  end loop;

  insert into public.masa_calendar_sync_state(
    owner_key,
    synced_at,
    source_synced_at,
    window_start,
    window_end,
    event_count
  ) values (
    p_owner_key,
    now(),
    p_source_synced_at,
    p_window_start,
    p_window_end,
    inserted_count
  )
  on conflict (owner_key) do update
    set synced_at = excluded.synced_at,
        source_synced_at = excluded.source_synced_at,
        window_start = excluded.window_start,
        window_end = excluded.window_end,
        event_count = excluded.event_count;

  return inserted_count;
end;
$$;

create or replace function public.masa_calendar_snapshot_get_v2(
  p_owner_key text,
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  event_id text,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean,
  location text
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (
    select 1
    from private.masa_dashboard_owner_keys k
    where k.owner_key = p_owner_key
  ) then
    raise exception 'dashboard_owner_required';
  end if;
  if p_from is null
     or p_to is null
     or p_to <= p_from
     or p_to > p_from + interval '120 days' then
    raise exception 'invalid_window';
  end if;

  return query
  select e.event_id, e.title, e.start_at, e.end_at, e.all_day, e.location
  from public.masa_calendar_events e
  where e.owner_key = p_owner_key
    and e.end_at >= p_from
    and e.start_at <= p_to
  order by e.start_at asc, e.end_at asc;
end;
$$;

create or replace function public.masa_calendar_sync_status_v2(p_owner_key text)
returns table(
  synced_at timestamptz,
  source_synced_at timestamptz,
  window_start timestamptz,
  window_end timestamptz,
  event_count integer
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (
    select 1
    from private.masa_dashboard_owner_keys k
    where k.owner_key = p_owner_key
  ) then
    raise exception 'dashboard_owner_required';
  end if;

  return query
  select s.synced_at, s.source_synced_at, s.window_start, s.window_end, s.event_count
  from public.masa_calendar_sync_state s
  where s.owner_key = p_owner_key;
end;
$$;

-- Retire the ungated public API paths. Keep service_role access only for recovery.
revoke execute on function public.masa_calendar_snapshot_replace_v1(text, jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.masa_calendar_snapshot_get_v1(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.masa_calendar_sync_status_v1(text)
  from public, anon, authenticated;
grant execute on function public.masa_calendar_snapshot_replace_v1(text, jsonb, timestamptz, timestamptz)
  to service_role;
grant execute on function public.masa_calendar_snapshot_get_v1(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.masa_calendar_sync_status_v1(text)
  to service_role;

revoke all on function public.masa_calendar_snapshot_replace_v2(text, jsonb, timestamptz, timestamptz, timestamptz)
  from public;
revoke all on function public.masa_calendar_snapshot_get_v2(text, timestamptz, timestamptz)
  from public;
revoke all on function public.masa_calendar_sync_status_v2(text)
  from public;
grant execute on function public.masa_calendar_snapshot_replace_v2(text, jsonb, timestamptz, timestamptz, timestamptz)
  to anon, authenticated, service_role;
grant execute on function public.masa_calendar_snapshot_get_v2(text, timestamptz, timestamptz)
  to anon, authenticated, service_role;
grant execute on function public.masa_calendar_sync_status_v2(text)
  to anon, authenticated, service_role;
