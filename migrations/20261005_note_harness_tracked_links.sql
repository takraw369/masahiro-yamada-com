-- NOTE HARNESS tracked-link attribution layer v1
-- Additive only: keeps existing CONTENT_OS / content_publications / funnel_events as the learning spine.

create table if not exists public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  publication_id uuid references public.content_publications(id) on delete set null,
  asset_id text,
  source_channel text not null default 'note',
  source_url text,
  placement text,
  cta_stage text,
  destination_type text,
  destination_url text not null,
  campaign_ref text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  check (destination_url ~ '^https://')
);

create index if not exists tracked_links_publication_idx
  on public.tracked_links(publication_id);
create index if not exists tracked_links_asset_idx
  on public.tracked_links(asset_id);
create index if not exists tracked_links_status_idx
  on public.tracked_links(status);

alter table public.tracked_links enable row level security;
revoke all on table public.tracked_links from public, anon, authenticated;

create table if not exists public.tracked_link_clicks (
  id uuid primary key default gen_random_uuid(),
  tracked_link_id uuid not null references public.tracked_links(id) on delete cascade,
  publication_id uuid references public.content_publications(id) on delete set null,
  asset_id text,
  request_id text,
  referrer_path text,
  user_agent_class text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists tracked_link_clicks_request_uidx
  on public.tracked_link_clicks(request_id)
  where request_id is not null;
create index if not exists tracked_link_clicks_link_time_idx
  on public.tracked_link_clicks(tracked_link_id, occurred_at desc);
create index if not exists tracked_link_clicks_publication_time_idx
  on public.tracked_link_clicks(publication_id, occurred_at desc);
create index if not exists tracked_link_clicks_asset_time_idx
  on public.tracked_link_clicks(asset_id, occurred_at desc);

alter table public.tracked_link_clicks enable row level security;
revoke all on table public.tracked_link_clicks from public, anon, authenticated;

-- Worker resolver: owner capability stays server-side. Anonymous direct RPC
-- calls cannot inject click receipts or arbitrary referrer/identifier data.
drop function if exists public.resolve_tracked_link_v1(text,text,text,text);
create or replace function public.resolve_tracked_link_v1(
  p_slug text,
  p_request_id text default null,
  p_referrer_path text default null,
  p_user_agent_class text default null,
  p_owner_key text default null
)
returns table (
  destination_url text,
  link_id uuid,
  publication_id uuid,
  asset_id text,
  campaign_ref text,
  source_channel text,
  placement text,
  cta_stage text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.tracked_links%rowtype;
  v_inserted integer := 0;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_ua_class text := lower(trim(coalesce(p_user_agent_class, 'unknown')));
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
    return;
  end if;

  if v_ua_class not in ('bot', 'mobile', 'desktop', 'unknown') then
    v_ua_class := 'unknown';
  end if;

  select *
    into v_link
  from public.tracked_links
  where slug = v_slug
    and status = 'active'
  limit 1;

  if not found then
    return;
  end if;

  insert into public.tracked_link_clicks(
    tracked_link_id,
    publication_id,
    asset_id,
    request_id,
    referrer_path,
    user_agent_class,
    metadata
  )
  values (
    v_link.id,
    v_link.publication_id,
    v_link.asset_id,
    nullif(left(trim(coalesce(p_request_id, '')), 160), ''),
    nullif(left(trim(coalesce(p_referrer_path, '')), 500), ''),
    v_ua_class,
    jsonb_build_object(
      'source_channel', v_link.source_channel,
      'placement', v_link.placement,
      'cta_stage', v_link.cta_stage,
      'destination_type', v_link.destination_type,
      'source_url', v_link.source_url
    )
  )
  on conflict (request_id) where request_id is not null do nothing;

  get diagnostics v_inserted = row_count;

  -- Keep bot/preview hits in the raw click receipt for diagnostics, but do not
  -- let them contaminate the human funnel-learning spine.
  if v_inserted > 0 and v_ua_class in ('mobile', 'desktop') then
    insert into public.funnel_events(
      contact_id,
      event_type,
      channel,
      campaign,
      offer_id,
      payload,
      occurred_at
    )
    values (
      null,
      'tracked_link_click',
      v_link.source_channel,
      v_link.campaign_ref,
      null,
      jsonb_build_object(
        'tracked_link_id', v_link.id,
        'publication_id', v_link.publication_id,
        'asset_id', v_link.asset_id,
        'slug', v_link.slug,
        'placement', v_link.placement,
        'cta_stage', v_link.cta_stage,
        'destination_type', v_link.destination_type,
        'referrer_path', nullif(left(trim(coalesce(p_referrer_path, '')), 500), ''),
        'user_agent_class', v_ua_class
      ),
      now()
    );
  end if;

  return query
  select
    v_link.destination_url,
    v_link.id,
    v_link.publication_id,
    v_link.asset_id,
    v_link.campaign_ref,
    v_link.source_channel,
    v_link.placement,
    v_link.cta_stage;
end;
$$;

revoke all on function public.resolve_tracked_link_v1(text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_tracked_link_v1(text,text,text,text,text) to anon, authenticated;

-- Owner-gated control plane used by the private dashboard / Note Harness.
create or replace function public.masa_tracked_link_upsert_v1(
  p_owner_key text,
  p_slug text,
  p_destination_url text,
  p_publication_id uuid default null,
  p_asset_id text default null,
  p_source_channel text default 'note',
  p_source_url text default null,
  p_placement text default null,
  p_cta_stage text default null,
  p_destination_type text default null,
  p_campaign_ref text default null,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_id uuid;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_destination text := trim(coalesce(p_destination_url, ''));
  v_status text := lower(trim(coalesce(p_status, 'active')));
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
    raise exception 'invalid_slug';
  end if;
  if v_destination !~ '^https://' or length(v_destination) > 2000 then
    raise exception 'invalid_destination_url';
  end if;
  if v_status not in ('active','paused','archived') then
    raise exception 'invalid_status';
  end if;
  if p_publication_id is not null and not exists (
    select 1 from public.content_publications cp where cp.id = p_publication_id
  ) then
    raise exception 'publication_not_found';
  end if;

  insert into public.tracked_links(
    slug,
    publication_id,
    asset_id,
    source_channel,
    source_url,
    placement,
    cta_stage,
    destination_type,
    destination_url,
    campaign_ref,
    status
  ) values (
    v_slug,
    p_publication_id,
    nullif(left(trim(coalesce(p_asset_id, '')), 180), ''),
    coalesce(nullif(left(trim(coalesce(p_source_channel, '')), 60), ''), 'note'),
    nullif(left(trim(coalesce(p_source_url, '')), 2000), ''),
    nullif(left(trim(coalesce(p_placement, '')), 120), ''),
    nullif(left(trim(coalesce(p_cta_stage, '')), 80), ''),
    nullif(left(trim(coalesce(p_destination_type, '')), 80), ''),
    v_destination,
    coalesce(nullif(left(trim(coalesce(p_campaign_ref, '')), 120), ''), 'nh-' || v_slug),
    v_status
  )
  on conflict (slug) do update set
    publication_id = excluded.publication_id,
    asset_id = excluded.asset_id,
    source_channel = excluded.source_channel,
    source_url = excluded.source_url,
    placement = excluded.placement,
    cta_stage = excluded.cta_stage,
    destination_type = excluded.destination_type,
    destination_url = excluded.destination_url,
    campaign_ref = excluded.campaign_ref,
    status = excluded.status,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.masa_tracked_link_list_v1(
  p_owner_key text,
  p_limit integer default 100
)
returns table (
  id uuid,
  slug text,
  publication_id uuid,
  asset_id text,
  source_channel text,
  source_url text,
  placement text,
  cta_stage text,
  destination_type text,
  destination_url text,
  campaign_ref text,
  status text,
  human_clicks bigint,
  bot_clicks bigint,
  last_clicked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
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
    l.id,
    l.slug,
    l.publication_id,
    l.asset_id,
    l.source_channel,
    l.source_url,
    l.placement,
    l.cta_stage,
    l.destination_type,
    l.destination_url,
    l.campaign_ref,
    l.status,
    count(c.id) filter (where c.user_agent_class in ('mobile', 'desktop')) as human_clicks,
    count(c.id) filter (where c.user_agent_class = 'bot') as bot_clicks,
    max(c.occurred_at) as last_clicked_at,
    l.created_at,
    l.updated_at
  from public.tracked_links l
  left join public.tracked_link_clicks c on c.tracked_link_id = l.id
  group by l.id
  order by l.updated_at desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.masa_tracked_link_upsert_v1(text,text,text,uuid,text,text,text,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.masa_tracked_link_upsert_v1(text,text,text,uuid,text,text,text,text,text,text,text,text) to anon, authenticated, service_role;

revoke all on function public.masa_tracked_link_list_v1(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.masa_tracked_link_list_v1(text,integer) to anon, authenticated, service_role;
