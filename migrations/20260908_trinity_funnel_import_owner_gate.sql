-- Secure the one-time D1 -> Supabase Trinity funnel import.
-- Runtime calls this RPC with the server-derived Dashboard owner key.
-- Public funnel event ingestion remains on trinity_funnel_event_add().

create or replace function public.trinity_funnel_event_import_v2(
  p_owner_key text,
  p_legacy_id bigint,
  p_session_id text,
  p_event_name text,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null,
  p_path text default '/trinity',
  p_created_at timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id bigint;
  v_allowed text[] := array[
    'trinity_view',
    'trinity_start',
    'trinity_complete',
    'trinity_line_click',
    'trinity_trial_click',
    'trinity_share_x',
    'trinity_copy_link'
  ];
begin
  if not exists (
    select 1
    from private.masa_dashboard_owner_keys k
    where k.owner_key = p_owner_key
  ) then
    raise exception 'dashboard_owner_required';
  end if;

  if p_legacy_id is null or p_legacy_id < 0 then
    raise exception 'invalid_legacy_id';
  end if;

  -- New imports bind provenance to the registered owner key. The old import RPC
  -- is retired below, so an anonymous caller cannot pre-seed this de-dup key.
  select id into v_id
  from public.funnel_events
  where payload->>'origin' = 'masahiro-yamada-com'
    and payload->>'legacy_d1_id' = p_legacy_id::text
    and payload->>'owner_key' = p_owner_key
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 or length(p_session_id) > 80 then
    raise exception 'invalid_session_id';
  end if;

  if p_event_name is null or not (p_event_name = any(v_allowed)) then
    raise exception 'invalid_event';
  end if;

  insert into public.funnel_events(
    contact_id,
    event_type,
    channel,
    campaign,
    offer_id,
    payload,
    occurred_at
  ) values (
    null,
    p_event_name,
    coalesce(nullif(trim(p_medium), ''), nullif(trim(p_source), '')),
    nullif(trim(p_campaign), ''),
    null,
    jsonb_build_object(
      'session_id', p_session_id,
      'source', p_source,
      'medium', p_medium,
      'path', coalesce(nullif(trim(p_path), ''), '/trinity'),
      'origin', 'masahiro-yamada-com',
      'legacy_d1_id', p_legacy_id,
      'owner_key', p_owner_key
    ),
    coalesce(p_created_at, now())
  ) returning id into v_id;

  return v_id;
end;
$$;

-- SECURITY DEFINER functions are executable by PUBLIC by default. Close the
-- default surface first, then intentionally expose v2 to the runtime roles that
-- still must present a registered Dashboard owner key.
revoke all on function public.trinity_funnel_event_import_v2(
  text, bigint, text, text, text, text, text, text, timestamptz
) from public;
grant execute on function public.trinity_funnel_event_import_v2(
  text, bigint, text, text, text, text, text, text, timestamptz
) to anon, authenticated, service_role;

-- Retire the ungated legacy import surface. Explicitly revoke PUBLIC as well as
-- Supabase API roles so a different baseline/default ACL cannot re-expose v1.
revoke execute on function public.trinity_funnel_event_import(
  bigint, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
