-- Publication is a projection of Drive knowledge, not a second source library.
alter table public.knowledge_shelf_protected_assets
  add column if not exists summary text not null default '',
  add column if not exists source_asset_id text,
  add column if not exists offer_id uuid references public.offers(id);
revoke all on public.knowledge_shelf_protected_assets from anon, authenticated;

create table if not exists private.knowledge_shelf_purchase_keys (
  purchase_id uuid primary key references public.purchases(id) on delete cascade,
  slug text not null references public.knowledge_shelf_protected_assets(slug),
  checkout_session_id text not null unique,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table private.knowledge_shelf_purchase_keys enable row level security;
revoke all on private.knowledge_shelf_purchase_keys from public, anon, authenticated;

create or replace function private.knowledge_shelf_assert_owner_v1(p_owner_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$'
    or not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key)
  then raise exception 'dashboard_owner_required'; end if;
end;
$$;
revoke all on function private.knowledge_shelf_assert_owner_v1(text) from public, anon, authenticated;

create or replace function public.masa_content_studio_snapshot_v1(p_owner_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.knowledge_shelf_assert_owner_v1(p_owner_key);
  select jsonb_build_object(
    'captured_at', now(),
    'assets', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.asset_id, 'title', a.current_title, 'genre', a.genre,
      'target', a.target_audience, 'next', a.next_action,
      'source_url', case when a.source_url ~ '^https://' then a.source_url else null end,
      'status', a.productization_status, 'project', a.related_project,
      'format', a.product_format_candidate, 'rights', a.rights_source,
      'updated_at', a.source_updated_at
    ) order by a.asset_id) from public.os_content_items a), '[]'::jsonb),
    'knowledge', coalesce((select jsonb_agg(jsonb_build_object(
      'id', k.id, 'title', k.title, 'domain', k.domain, 'summary', k.summary,
      'status', k.status, 'visibility', k.visibility,
      'sources', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'url', s.url))
        from public.knowledge_sources ks join public.sources s on s.id = ks.source_id
        where ks.knowledge_id = k.id), '[]'::jsonb)
    ) order by k.title) from public.knowledge_items k), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
      'slug', a.slug, 'title', a.title, 'summary', a.summary,
      'body', a.body_markdown, 'status', a.publication_status,
      'source_asset_id', a.source_asset_id, 'version', a.version,
      'price_jpy', o.price_jpy, 'checkout_url', o.checkout_url
    ) order by a.updated_at desc) from public.knowledge_shelf_protected_assets a
      left join public.offers o on o.id = a.offer_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.masa_content_studio_snapshot_v1(text) from public, anon, authenticated;
grant execute on function public.masa_content_studio_snapshot_v1(text) to anon, authenticated;

create or replace function public.masa_shelf_product_save_v1(
  p_owner_key text, p_slug text, p_title text, p_summary text,
  p_body text, p_source_asset_id text, p_price_jpy integer,
  p_expected_version integer default null,
  p_checkout_url text default null, p_live boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old public.knowledge_shelf_protected_assets%rowtype; v_offer uuid; v_version integer;
begin
  perform private.knowledge_shelf_assert_owner_v1(p_owner_key);
  if p_slug is null or p_slug !~ '^[a-z0-9-]{2,80}$'
    or char_length(btrim(coalesce(p_title,''))) not between 1 and 200
    or char_length(coalesce(p_summary,'')) > 2000
    or char_length(coalesce(p_body,'')) > 100000
    or p_price_jpy is null or p_price_jpy not between 0 and 1000000
  then raise exception 'invalid_product'; end if;
  if p_source_asset_id is not null and not exists (
    select 1 from public.os_content_items a where a.asset_id = p_source_asset_id
  ) then raise exception 'source_asset_not_found'; end if;
  if p_live and (char_length(btrim(coalesce(p_body,''))) < 200
    or p_price_jpy < 50 or coalesce(p_checkout_url,'') !~ '^https://buy[.]stripe[.]com/[a-zA-Z0-9_-]+$')
  then raise exception 'product_not_ready'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('knowledge-shelf:' || p_slug));
  select * into v_old from public.knowledge_shelf_protected_assets where slug = p_slug for update;
  if found and p_expected_version is distinct from v_old.version then raise exception 'version_conflict'; end if;
  -- A draft save must not silently unpublish an existing purchased product.
  if v_old.publication_status = 'live' and not p_live then raise exception 'live_product_requires_explicit_update'; end if;
  v_version := coalesce(v_old.version,0) + 1;
  insert into public.offers (slug, name, tier, price_jpy, status, checkout_url, description, metadata)
  values ('shelf-' || p_slug, btrim(p_title), 'entry', p_price_jpy,
    case when p_live then 'active' else 'draft' end,
    nullif(p_checkout_url,''), coalesce(p_summary,''), jsonb_build_object('knowledge_shelf_slug',p_slug))
  on conflict (slug) do update set name = excluded.name, price_jpy = excluded.price_jpy,
    status = excluded.status, checkout_url = excluded.checkout_url,
    description = excluded.description,
    metadata = public.offers.metadata || excluded.metadata, updated_at = now()
  returning id into v_offer;
  insert into public.knowledge_shelf_protected_assets (
    slug,title,summary,body_markdown,source_asset_id,offer_id,access_level,publication_status,version
  ) values (p_slug,btrim(p_title),coalesce(p_summary,''),coalesce(p_body,''),p_source_asset_id,v_offer,
    'one-time',case when p_live then 'live' else 'draft' end,v_version)
  on conflict (slug) do update set title=excluded.title,summary=excluded.summary,
    body_markdown=excluded.body_markdown,source_asset_id=excluded.source_asset_id,
    offer_id=excluded.offer_id,publication_status=excluded.publication_status,
    version=excluded.version,updated_at=now();
  return jsonb_build_object('slug',p_slug,'version',v_version,'status',case when p_live then 'live' else 'draft' end);
end;
$$;
revoke all on function public.masa_shelf_product_save_v1(text,text,text,text,text,text,integer,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.masa_shelf_product_save_v1(text,text,text,text,text,text,integer,integer,text,boolean) to anon, authenticated;

create or replace function public.knowledge_shelf_catalog_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug',a.slug,'title',a.title,'summary',a.summary,'price_jpy',o.price_jpy,
    'checkout_url',o.checkout_url,'access_level',a.access_level,'version',a.version
  ) order by a.updated_at desc),'[]'::jsonb)
  from public.knowledge_shelf_protected_assets a join public.offers o on o.id=a.offer_id
  where a.publication_status='live' and o.status='active'
    and o.checkout_url ~ '^https://buy[.]stripe[.]com/[a-zA-Z0-9_-]+$';
$$;
revoke all on function public.knowledge_shelf_catalog_v1() from public, anon, authenticated;
grant execute on function public.knowledge_shelf_catalog_v1() to anon, authenticated;

-- Only the signature-verifying site webhook may call this owner-guarded function.
create or replace function public.masa_shelf_payment_record_v1(
  p_owner_key text, p_session_id text, p_payment_id text, p_slug text,
  p_email text, p_amount_jpy integer, p_state text, p_test boolean,
  p_event_id text, p_key_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_asset public.knowledge_shelf_protected_assets%rowtype; v_offer public.offers%rowtype;
  v_contact uuid; v_matches integer; v_purchase public.purchases%rowtype; v_external text;
begin
  perform private.knowledge_shelf_assert_owner_v1(p_owner_key);
  if p_state is null or p_state not in ('pending','paid','failed')
    or p_test is null or p_session_id is null or p_session_id !~ '^cs_(live|test)_[a-zA-Z0-9_]{8,180}$'
    or p_test <> (p_session_id like 'cs_test_%')
    or p_payment_id is null or p_payment_id !~ '^pi_[a-zA-Z0-9_]{8,180}$'
    or p_event_id is null or p_event_id !~ '^evt_[a-zA-Z0-9_]{3,180}$'
    or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
    or coalesce(p_email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then raise exception 'invalid_payment'; end if;
  select * into v_asset from public.knowledge_shelf_protected_assets where slug=p_slug and publication_status='live';
  if not found then raise exception 'product_not_live'; end if;
  select * into v_offer from public.offers where id=v_asset.offer_id and status='active';
  if not found or v_offer.price_jpy is distinct from p_amount_jpy then raise exception 'payment_amount_mismatch'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('shelf-payment:'||p_session_id));
  v_external := case when p_test then 'test:' else '' end || p_payment_id;
  select * into v_purchase from public.purchases where external_payment_id=v_external for update;
  if found then
    if v_purchase.offer_id <> v_offer.id then raise exception 'payment_offer_conflict'; end if;
    if v_purchase.status in ('refunded','cancelled') then return jsonb_build_object('status','revoked'); end if;
    if v_purchase.status='paid' and p_state <> 'paid' then return jsonb_build_object('status','paid'); end if;
    v_contact := v_purchase.contact_id;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('shelf-email:'||lower(btrim(p_email))));
    select count(*),min(c.id::text)::uuid into v_matches,v_contact from public.contacts c where lower(btrim(c.email))=lower(btrim(p_email));
    if v_matches > 1 then raise exception 'ambiguous_customer'; end if;
    if v_contact is null then
      insert into public.contacts (email,source_channel) values(lower(btrim(p_email)),'knowledge_shelf') returning id into v_contact;
    end if;
  end if;
  insert into public.purchases (contact_id,offer_id,provider,external_payment_id,amount_jpy,status,purchased_at,metadata)
  values(v_contact,v_offer.id,case when p_test then 'stripe_test' else 'stripe' end,v_external,p_amount_jpy,p_state,
    case when p_state='paid' then now() else null end,
    jsonb_build_object('knowledge_shelf_slug',p_slug,'checkout_session_id',p_session_id,
      'stripe_event_id',p_event_id,'payment_intent_id',p_payment_id,'test_mode',p_test))
  on conflict(external_payment_id) do update set status=excluded.status,
    purchased_at=coalesce(public.purchases.purchased_at,excluded.purchased_at),
    metadata=public.purchases.metadata||excluded.metadata,updated_at=now()
  returning * into v_purchase;
  if p_state='paid' then
    if exists(select 1 from private.knowledge_shelf_purchase_keys k where k.checkout_session_id=p_session_id and k.key_hash<>p_key_hash)
    then raise exception 'key_secret_mismatch'; end if;
    insert into private.knowledge_shelf_purchase_keys(purchase_id,slug,checkout_session_id,key_hash)
    values(v_purchase.id,p_slug,p_session_id,p_key_hash) on conflict(purchase_id) do nothing;
  end if;
  return jsonb_build_object('status',p_state,'test_mode',p_test);
end;
$$;
revoke all on function public.masa_shelf_payment_record_v1(text,text,text,text,text,integer,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.masa_shelf_payment_record_v1(text,text,text,text,text,integer,text,boolean,text,text) to anon, authenticated;

create or replace function public.masa_shelf_key_claim_v1(p_owner_key text,p_session_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_key record;
begin
  perform private.knowledge_shelf_assert_owner_v1(p_owner_key);
  if coalesce(p_session_id,'') !~ '^cs_live_[a-zA-Z0-9_]{8,180}$' then return jsonb_build_object('status','payment_pending'); end if;
  select k.slug,k.key_hash into v_key
  from private.knowledge_shelf_purchase_keys k join public.purchases p on p.id=k.purchase_id
  join public.knowledge_shelf_protected_assets a on a.slug=k.slug
  where k.checkout_session_id=p_session_id and p.status='paid' and p.provider='stripe'
    and coalesce((p.metadata->>'test_mode')::boolean,false)=false and a.publication_status='live';
  if not found then return jsonb_build_object('status','payment_pending'); end if;
  return jsonb_build_object('status','ok','slug',v_key.slug,'key_hash',v_key.key_hash);
end;
$$;
revoke all on function public.masa_shelf_key_claim_v1(text,text) from public, anon, authenticated;
grant execute on function public.masa_shelf_key_claim_v1(text,text) to anon, authenticated;

-- The unguessable key hash is the bearer proof; it is never returned by the public catalog.
create or replace function public.knowledge_shelf_key_content_v1(p_slug text,p_key_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_asset public.knowledge_shelf_protected_assets%rowtype;
begin
  if coalesce(p_key_hash,'') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','forbidden'); end if;
  select a.* into v_asset from public.knowledge_shelf_protected_assets a
  join private.knowledge_shelf_purchase_keys k on k.slug=a.slug
  join public.purchases p on p.id=k.purchase_id
  where a.slug=p_slug and a.publication_status='live' and k.key_hash=p_key_hash
    and p.status='paid' and p.provider='stripe' and coalesce((p.metadata->>'test_mode')::boolean,false)=false;
  if not found then return jsonb_build_object('status','forbidden'); end if;
  return jsonb_build_object('status','ok','asset',jsonb_build_object('slug',v_asset.slug,'title',v_asset.title,
    'body_markdown',v_asset.body_markdown,'version',v_asset.version));
end;
$$;
revoke all on function public.knowledge_shelf_key_content_v1(text,text) from public, anon, authenticated;
grant execute on function public.knowledge_shelf_key_content_v1(text,text) to anon, authenticated;

create or replace function public.masa_shelf_payment_revoke_v1(p_owner_key text,p_payment_id text,p_state text,p_event_id text,p_test boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform private.knowledge_shelf_assert_owner_v1(p_owner_key);
  if p_state is null or p_state not in ('refunded','cancelled') or p_test is null
    or coalesce(p_payment_id,'') !~ '^pi_[a-zA-Z0-9_]{8,180}$'
  then raise exception 'invalid_revocation'; end if;
  update public.purchases p set status=p_state,updated_at=now(),metadata=p.metadata||jsonb_build_object('revocation_event_id',p_event_id)
  where p.external_payment_id=(case when p_test then 'test:' else '' end)||p_payment_id
    and p.metadata ? 'knowledge_shelf_slug';
  get diagnostics v_count=row_count;
  return jsonb_build_object('status',p_state,'updated',v_count);
end;
$$;
revoke all on function public.masa_shelf_payment_revoke_v1(text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.masa_shelf_payment_revoke_v1(text,text,text,text,boolean) to anon, authenticated;
