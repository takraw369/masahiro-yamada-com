-- NOTE HARNESS publication / learning bridge v1
-- Depends on 20261005_note_harness_tracked_links.sql.

create or replace function public.sync_tracked_click_to_content_publication_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.publication_id is not null and coalesce(new.user_agent_class, 'unknown') <> 'bot' then
    update public.content_publications
    set
      clicks = coalesce(clicks, 0) + 1,
      observed_at = greatest(coalesce(observed_at, new.occurred_at), new.occurred_at),
      updated_at = now()
    where id = new.publication_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_tracked_click_to_content_publication_v1() from public, anon, authenticated, service_role;

drop trigger if exists tracked_link_click_sync_publication_v1 on public.tracked_link_clicks;
create trigger tracked_link_click_sync_publication_v1
after insert on public.tracked_link_clicks
for each row execute function public.sync_tracked_click_to_content_publication_v1();

create or replace function public.masa_note_publication_register_v1(
  p_owner_key text,
  p_asset_id text,
  p_published_url text,
  p_provider_post_id text default null,
  p_draft_ref text default null,
  p_cta text default null,
  p_campaign_ref text default null,
  p_published_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_id uuid;
  v_url text := trim(coalesce(p_published_url, ''));
  v_asset_id text := trim(coalesce(p_asset_id, ''));
  v_draft_ref text := nullif(left(trim(coalesce(p_draft_ref, '')), 2000), '');
  v_provider_post_id text;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if v_asset_id = '' or length(v_asset_id) > 180 or not exists (
    select 1 from public.os_content_items c where c.asset_id = v_asset_id
  ) then
    raise exception 'invalid_asset_id';
  end if;
  if v_url !~ '^https://note[.]com/' or length(v_url) > 2000 then
    raise exception 'invalid_note_url';
  end if;

  v_provider_post_id := coalesce(
    nullif(left(trim(coalesce(p_provider_post_id, '')), 500), ''),
    v_url
  );

  select p.id into v_id
  from public.content_publications p
  where p.published_url = v_url
  limit 1;

  if v_id is null and v_draft_ref is not null then
    select p.id into v_id
    from public.content_publications p
    where p.channel = 'note'
      and p.asset_id = v_asset_id
      and p.draft_ref = v_draft_ref
    order by p.updated_at desc
    limit 1;
  end if;

  if v_id is null then
    insert into public.content_publications(
      asset_id,
      channel,
      status,
      cta,
      draft_ref,
      published_url,
      published_at,
      observed_at,
      raw_metrics
    ) values (
      v_asset_id,
      'note',
      'published',
      nullif(left(trim(coalesce(p_cta, '')), 2000), ''),
      v_draft_ref,
      v_url,
      coalesce(p_published_at, now()),
      now(),
      jsonb_strip_nulls(jsonb_build_object(
        'provider', 'note',
        'provider_post_id', v_provider_post_id,
        'campaign_ref', nullif(left(trim(coalesce(p_campaign_ref, '')), 160), '')
      ))
    ) returning id into v_id;
  else
    update public.content_publications
    set
      asset_id = v_asset_id,
      channel = 'note',
      status = 'published',
      cta = coalesce(nullif(left(trim(coalesce(p_cta, '')), 2000), ''), cta),
      draft_ref = coalesce(v_draft_ref, draft_ref),
      published_url = v_url,
      published_at = coalesce(p_published_at, published_at, now()),
      observed_at = now(),
      raw_metrics = coalesce(raw_metrics, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'provider', 'note',
        'provider_post_id', v_provider_post_id,
        'campaign_ref', nullif(left(trim(coalesce(p_campaign_ref, '')), 160), '')
      )),
      updated_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.masa_note_metrics_record_v1(
  p_owner_key text,
  p_publication_id uuid,
  p_provider_post_id text default null,
  p_impressions bigint default null,
  p_views bigint default null,
  p_likes bigint default null,
  p_comments bigint default null,
  p_shares bigint default null,
  p_saves bigint default null,
  p_raw_metrics jsonb default '{}'::jsonb,
  p_captured_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_publication public.content_publications%rowtype;
  v_provider_post_id text;
  v_snapshot_id uuid;
  v_engagements bigint;
  v_clicks bigint;
  v_raw jsonb := coalesce(p_raw_metrics, '{}'::jsonb);
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if p_publication_id is null then
    raise exception 'publication_required';
  end if;
  if pg_column_size(v_raw) > 65536 then
    raise exception 'raw_metrics_too_large';
  end if;

  select * into v_publication
  from public.content_publications
  where id = p_publication_id and channel = 'note'
  limit 1;
  if not found then
    raise exception 'note_publication_not_found';
  end if;

  if p_impressions is not null and p_impressions < 0 then raise exception 'invalid_impressions'; end if;
  if p_views is not null and p_views < 0 then raise exception 'invalid_views'; end if;
  if p_likes is not null and p_likes < 0 then raise exception 'invalid_likes'; end if;
  if p_comments is not null and p_comments < 0 then raise exception 'invalid_comments'; end if;
  if p_shares is not null and p_shares < 0 then raise exception 'invalid_shares'; end if;
  if p_saves is not null and p_saves < 0 then raise exception 'invalid_saves'; end if;

  v_provider_post_id := coalesce(
    nullif(left(trim(coalesce(p_provider_post_id, '')), 500), ''),
    nullif(v_publication.raw_metrics->>'provider_post_id', ''),
    v_publication.published_url
  );
  if v_provider_post_id is null then
    raise exception 'provider_post_id_required';
  end if;

  if p_likes is null and p_comments is null and p_shares is null and p_saves is null then
    v_engagements := v_publication.engagements;
  else
    v_engagements := coalesce(p_likes, 0) + coalesce(p_comments, 0) + coalesce(p_shares, 0) + coalesce(p_saves, 0);
  end if;
  v_clicks := coalesce(v_publication.clicks, 0);

  insert into public.content_metric_snapshots(
    publish_queue_id,
    source_ref,
    provider,
    provider_post_id,
    captured_at,
    impressions,
    views,
    likes,
    comments,
    shares,
    saves,
    clicks,
    raw_metrics
  ) values (
    null,
    'content_publication:' || p_publication_id::text,
    'note',
    v_provider_post_id,
    coalesce(p_captured_at, now()),
    p_impressions,
    p_views,
    p_likes,
    p_comments,
    p_shares,
    p_saves,
    v_clicks,
    v_raw || jsonb_build_object('publication_id', p_publication_id)
  ) returning id into v_snapshot_id;

  update public.content_publications
  set
    status = case when status in ('published', 'measured') then 'measured' else status end,
    impressions = coalesce(p_impressions::integer, impressions),
    engagements = coalesce(v_engagements::integer, engagements),
    observed_at = coalesce(p_captured_at, now()),
    raw_metrics = coalesce(raw_metrics, '{}'::jsonb) || v_raw || jsonb_strip_nulls(jsonb_build_object(
      'provider', 'note',
      'provider_post_id', v_provider_post_id,
      'views', p_views,
      'likes', p_likes,
      'comments', p_comments,
      'shares', p_shares,
      'saves', p_saves
    )),
    updated_at = now()
  where id = p_publication_id;

  return v_snapshot_id;
end;
$$;

create or replace function public.masa_note_publication_list_v1(
  p_owner_key text,
  p_limit integer default 100
)
returns table (
  id uuid,
  asset_id text,
  title text,
  status text,
  draft_ref text,
  published_url text,
  published_at timestamptz,
  impressions integer,
  engagements integer,
  clicks integer,
  line_registrations integer,
  purchases integer,
  revenue_yen integer,
  views bigint,
  likes bigint,
  comments bigint,
  last_metric_at timestamptz,
  observed_at timestamptz
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
    p.id,
    p.asset_id,
    c.current_title,
    p.status,
    p.draft_ref,
    p.published_url,
    p.published_at,
    p.impressions,
    p.engagements,
    p.clicks,
    p.line_registrations,
    p.purchases,
    p.revenue_yen,
    m.views,
    m.likes,
    m.comments,
    m.captured_at,
    p.observed_at
  from public.content_publications p
  join public.os_content_items c on c.asset_id = p.asset_id
  left join lateral (
    select s.views, s.likes, s.comments, s.captured_at
    from public.content_metric_snapshots s
    where s.provider = 'note'
      and s.source_ref = 'content_publication:' || p.id::text
    order by s.captured_at desc
    limit 1
  ) m on true
  where p.channel = 'note'
  order by coalesce(p.published_at, p.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.masa_note_publication_register_v1(text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.masa_note_publication_register_v1(text,text,text,text,text,text,text,timestamptz) to anon, authenticated, service_role;

revoke all on function public.masa_note_metrics_record_v1(text,uuid,text,bigint,bigint,bigint,bigint,bigint,bigint,jsonb,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.masa_note_metrics_record_v1(text,uuid,text,bigint,bigint,bigint,bigint,bigint,bigint,jsonb,timestamptz) to anon, authenticated, service_role;

revoke all on function public.masa_note_publication_list_v1(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.masa_note_publication_list_v1(text,integer) to anon, authenticated, service_role;
