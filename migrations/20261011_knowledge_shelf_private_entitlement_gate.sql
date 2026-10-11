-- Private Knowledge Shelf content: no paid content is published or billed by this migration.
-- Manual publication and separate buyer-auth/payment E2E are still required.
create table if not exists public.knowledge_shelf_protected_assets (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 1 and 200),
  access_level text not null check (access_level in ('one-time', 'member', 'pro')),
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'live', 'archived')),
  body_markdown text not null default '',
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_shelf_protected_assets enable row level security;
revoke all on public.knowledge_shelf_protected_assets from public, anon, authenticated;
-- No SELECT/INSERT/UPDATE/DELETE policy for browsers; content is returned only by gated RPC.

create or replace function public.knowledge_shelf_content_read_v1(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_slug text := trim(coalesce(p_slug, ''));
  v_asset public.knowledge_shelf_protected_assets%rowtype;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  if v_slug !~ '^[a-z0-9-]{2,80}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_asset
  from public.knowledge_shelf_protected_assets a
  where a.slug = v_slug and a.publication_status = 'live';

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select exists (
    select 1
    from public.contacts c
    join public.person_entitlements pe on pe.contact_id = c.id
    join public.entitlement_definitions ed on ed.id = pe.entitlement_id
    where c.auth_user_id = v_user_id
      and pe.status = 'active'
      and pe.revoked_at is null
      and (pe.expires_at is null or pe.expires_at > now())
      and ed.status = 'active'
      and (
        (ed.resource_type = 'knowledge_shelf_item' and ed.resource_key = v_asset.slug)
        or
        (v_asset.access_level = 'member'
          and ed.resource_type = 'knowledge_shelf_tier'
          and ed.resource_key in ('member', 'pro'))
        or
        (v_asset.access_level = 'pro'
          and ed.resource_type = 'knowledge_shelf_tier'
          and ed.resource_key = 'pro')
      )
      -- Never trust a stale entitlement after payment was refunded/revoked.
      and (
        pe.source_type <> 'purchase'
        or exists (
          select 1 from public.purchases p
          where p.id::text = pe.source_ref
            and p.contact_id = c.id
            and p.status = 'paid'
        )
      )
  ) into v_allowed;

  if not v_allowed then
    return jsonb_build_object('status', 'forbidden');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'asset', jsonb_build_object(
      'slug', v_asset.slug,
      'title', v_asset.title,
      'access_level', v_asset.access_level,
      'version', v_asset.version,
      'body_markdown', v_asset.body_markdown,
      'updated_at', v_asset.updated_at
    )
  );
end;
$function$;

revoke all on function public.knowledge_shelf_content_read_v1(text) from public, anon;
grant execute on function public.knowledge_shelf_content_read_v1(text) to authenticated, service_role;

comment on table public.knowledge_shelf_protected_assets is
  'Private Knowledge Shelf content. RLS denies browser direct access; new entries remain draft until explicitly reviewed.';
comment on function public.knowledge_shelf_content_read_v1(text) is
  'Returns LIVE Knowledge Shelf paid content only to a JWT-authenticated contact with an active, nonexpired entitlement; no anonymous access.';
