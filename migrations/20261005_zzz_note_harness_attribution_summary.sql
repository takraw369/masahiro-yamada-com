-- NOTE HARNESS aggregate attribution summary v1
-- Reporting only. Does not rewrite downstream event attribution.
-- Direct outcomes and first-touch assisted outcomes remain explicitly separated.

create or replace function public.masa_note_attribution_summary_v1(
  p_owner_key text,
  p_limit integer default 100
)
returns table (
  link_id uuid,
  slug text,
  publication_id uuid,
  asset_id text,
  title text,
  placement text,
  cta_stage text,
  destination_type text,
  campaign_ref text,
  human_clicks bigint,
  consented_contacts bigint,
  line_engaged_contacts bigint,
  first_touch_paid_customers bigint,
  first_touch_paid_purchases bigint,
  first_touch_revenue_yen bigint,
  last_clicked_at timestamptz,
  published_url text,
  published_at timestamptz
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
    ci.current_title,
    l.placement,
    l.cta_stage,
    l.destination_type,
    l.campaign_ref,
    coalesce(clicks.human_clicks, 0),
    coalesce(contacts.consented_contacts, 0),
    coalesce(line.line_engaged_contacts, 0),
    coalesce(paid.first_touch_paid_customers, 0),
    coalesce(paid.first_touch_paid_purchases, 0),
    coalesce(paid.first_touch_revenue_yen, 0),
    clicks.last_clicked_at,
    p.published_url,
    p.published_at
  from public.tracked_links l
  left join public.content_publications p on p.id = l.publication_id
  left join public.os_content_items ci on ci.asset_id = coalesce(l.asset_id, p.asset_id)
  left join lateral (
    select
      count(*) filter (where c.user_agent_class in ('mobile', 'desktop'))::bigint as human_clicks,
      max(c.occurred_at) filter (where c.user_agent_class in ('mobile', 'desktop')) as last_clicked_at
    from public.tracked_link_clicks c
    where c.tracked_link_id = l.id
  ) clicks on true
  left join lateral (
    select count(*)::bigint as consented_contacts
    from public.contacts c
    where l.campaign_ref is not null
      and c.source_campaign = l.campaign_ref
      and c.consent_at is not null
  ) contacts on true
  left join lateral (
    select count(distinct e.contact_id)::bigint as line_engaged_contacts
    from public.funnel_events e
    join public.contacts c on c.id = e.contact_id
    where l.campaign_ref is not null
      and c.source_campaign = l.campaign_ref
      and c.consent_at is not null
      and e.channel = 'line'
      and e.occurred_at >= coalesce(c.consent_at, c.created_at)
  ) line on true
  left join lateral (
    select
      count(distinct pu.contact_id)::bigint as first_touch_paid_customers,
      count(*)::bigint as first_touch_paid_purchases,
      coalesce(sum(pu.amount_jpy), 0)::bigint as first_touch_revenue_yen
    from public.purchases pu
    join public.contacts c on c.id = pu.contact_id
    where l.campaign_ref is not null
      and c.source_campaign = l.campaign_ref
      and c.consent_at is not null
      and pu.status = 'paid'
      and coalesce(pu.purchased_at, pu.created_at) >= coalesce(c.consent_at, c.created_at)
  ) paid on true
  order by coalesce(clicks.last_clicked_at, l.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.masa_note_attribution_summary_v1(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.masa_note_attribution_summary_v1(text,integer) to anon, authenticated, service_role;
