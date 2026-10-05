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

create or replace function public.resolve_tracked_link_v1(
  p_slug text,
  p_request_id text default null,
  p_referrer_path text default null,
  p_user_agent_class text default null
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
begin
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
    return;
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
    nullif(left(trim(coalesce(p_user_agent_class, '')), 40), ''),
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

  if v_inserted > 0 then
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
        'user_agent_class', nullif(left(trim(coalesce(p_user_agent_class, '')), 40), '')
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

revoke all on function public.resolve_tracked_link_v1(text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_tracked_link_v1(text,text,text,text) to anon, authenticated;
