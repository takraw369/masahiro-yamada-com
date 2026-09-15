-- Canonical repository record of the migration already applied to production
-- as Supabase migration 20260908014031 / distribution_dashboard_read_model_v1.
-- This file restores code/database source-of-truth parity; this change does not
-- apply or re-apply the production migration.

create or replace function public.masa_distribution_content_get_v1(
  p_owner_key text,
  p_asset_ids text[] default array['C034','C033','C035']::text[]
)
returns table (
  asset_id text,
  genre text,
  current_title text,
  sell_readiness text,
  productization_status text,
  product_format_candidate text,
  target_audience text,
  next_action text,
  source_url text,
  related_project text,
  last_reviewed text,
  source_updated_at timestamptz
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

  if not exists (
    select 1
    from public.masa_dashboard_state s
    where s.owner_key = p_owner_key
  ) then
    raise exception 'unknown_dashboard_owner';
  end if;

  return query
  select
    c.asset_id,
    c.genre,
    c.current_title,
    c.sell_readiness,
    c.productization_status,
    c.product_format_candidate,
    c.target_audience,
    c.next_action,
    c.source_url,
    c.related_project,
    c.last_reviewed,
    c.source_updated_at
  from public.os_content_items c
  where c.asset_id = any(coalesce(p_asset_ids, array['C034','C033','C035']::text[]))
  order by array_position(
    coalesce(p_asset_ids, array['C034','C033','C035']::text[]),
    c.asset_id
  );
end;
$$;

revoke all on function public.masa_distribution_content_get_v1(text, text[]) from public;
grant execute on function public.masa_distribution_content_get_v1(text, text[]) to anon, authenticated, service_role;

comment on function public.masa_distribution_content_get_v1(text, text[]) is
  'Private Dashboard read-only projection of Drive-synced CONTENT_OS items. Drive remains canonical.';
