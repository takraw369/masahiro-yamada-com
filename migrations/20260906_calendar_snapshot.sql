create table if not exists public.masa_calendar_events (
  owner_key text not null,
  event_id text not null,
  calendar_id text not null default 'primary',
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  source text not null default 'google_calendar',
  synced_at timestamptz not null default now(),
  primary key (owner_key, event_id),
  constraint masa_calendar_owner_key_check check (owner_key ~ '^[0-9a-f]{64}$'),
  constraint masa_calendar_event_id_len check (char_length(event_id) between 1 and 512),
  constraint masa_calendar_title_len check (char_length(title) between 1 and 500)
);

create index if not exists masa_calendar_events_owner_start_idx
  on public.masa_calendar_events(owner_key, start_at);

create table if not exists public.masa_calendar_sync_state (
  owner_key text primary key,
  synced_at timestamptz not null default now(),
  window_start timestamptz,
  window_end timestamptz,
  event_count integer not null default 0,
  constraint masa_calendar_sync_owner_key_check check (owner_key ~ '^[0-9a-f]{64}$')
);

revoke all on table public.masa_calendar_events from public, anon, authenticated;
revoke all on table public.masa_calendar_sync_state from public, anon, authenticated;

create or replace function public.masa_calendar_snapshot_replace_v1(
  p_owner_key text,
  p_events jsonb,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  inserted_count integer := 0;
  v_event_id text;
  v_title text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'events_must_be_array';
  end if;
  if jsonb_array_length(p_events) > 500 then
    raise exception 'too_many_events';
  end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'invalid_window';
  end if;

  delete from public.masa_calendar_events where owner_key = p_owner_key;

  for item in select value from jsonb_array_elements(p_events)
  loop
    v_event_id := trim(coalesce(item->>'event_id', ''));
    v_title := trim(coalesce(item->>'title', ''));
    if v_event_id = '' or char_length(v_event_id) > 512 then
      raise exception 'invalid_event_id';
    end if;
    if v_title = '' then v_title := '(no title)'; end if;
    if char_length(v_title) > 500 then v_title := left(v_title, 500); end if;

    begin
      v_start := (item->>'start_at')::timestamptz;
      v_end := (item->>'end_at')::timestamptz;
    exception when others then
      raise exception 'invalid_event_time';
    end;
    if v_end < v_start then
      raise exception 'invalid_event_range';
    end if;

    insert into public.masa_calendar_events(
      owner_key, event_id, calendar_id, title, start_at, end_at, all_day, location, source, synced_at
    ) values (
      p_owner_key,
      v_event_id,
      left(coalesce(nullif(trim(item->>'calendar_id'), ''), 'primary'), 255),
      v_title,
      v_start,
      v_end,
      coalesce((item->>'all_day')::boolean, false),
      nullif(left(trim(coalesce(item->>'location', '')), 500), ''),
      'google_calendar',
      now()
    );
    inserted_count := inserted_count + 1;
  end loop;

  insert into public.masa_calendar_sync_state(owner_key, synced_at, window_start, window_end, event_count)
  values (p_owner_key, now(), p_window_start, p_window_end, inserted_count)
  on conflict (owner_key) do update
    set synced_at = excluded.synced_at,
        window_start = excluded.window_start,
        window_end = excluded.window_end,
        event_count = excluded.event_count;

  return inserted_count;
end;
$$;

create or replace function public.masa_calendar_snapshot_get_v1(
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
set search_path = public
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + interval '120 days' then
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

create or replace function public.masa_calendar_sync_status_v1(p_owner_key text)
returns table(
  synced_at timestamptz,
  window_start timestamptz,
  window_end timestamptz,
  event_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;

  return query
  select s.synced_at, s.window_start, s.window_end, s.event_count
  from public.masa_calendar_sync_state s
  where s.owner_key = p_owner_key;
end;
$$;

revoke all on function public.masa_calendar_snapshot_replace_v1(text, jsonb, timestamptz, timestamptz) from public;
revoke all on function public.masa_calendar_snapshot_get_v1(text, timestamptz, timestamptz) from public;
revoke all on function public.masa_calendar_sync_status_v1(text) from public;

grant execute on function public.masa_calendar_snapshot_replace_v1(text, jsonb, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.masa_calendar_snapshot_get_v1(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.masa_calendar_sync_status_v1(text) to anon, authenticated;
