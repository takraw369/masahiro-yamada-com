-- Derived reading/thumbnail metadata stays separate from source and review state.
alter table public.masa_intelligence_feed
  add column if not exists thumbnail_url text not null default '',
  add column if not exists thumbnail_source text not null default '',
  add column if not exists thumbnail_checked_at timestamptz,
  add column if not exists reading jsonb not null default '{}'::jsonb;

-- Existing owner-key RPC is the sole browser access path. No direct Data API grant.
revoke all on table public.masa_intelligence_feed from anon, authenticated;

create or replace function public.masa_intelligence_reader_get_v1(p_owner_key text, p_id uuid)
returns public.masa_intelligence_feed language plpgsql security definer set search_path = ''
as $$
declare v_row public.masa_intelligence_feed;
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  select * into v_row from public.masa_intelligence_feed where id = p_id;
  return v_row;
end;
$$;

create or replace function public.masa_intelligence_reader_save_v1(
  p_owner_key text, p_id uuid, p_input_hash text, p_expected_source jsonb, p_reading jsonb
)
returns public.masa_intelligence_feed language plpgsql security definer set search_path = ''
as $$
declare v_row public.masa_intelligence_feed;
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  if p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_expected_source) is distinct from 'array'
    or jsonb_typeof(p_reading) is distinct from 'object'
    or p_reading->>'version' is distinct from 'intelligence-reading-ja-v1'
    or p_reading->>'evidenceScope' is distinct from 'title_excerpt'
    or p_reading->>'inputHash' is distinct from p_input_hash
    or p_reading->>'model' is distinct from '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
    or exists (select 1 from jsonb_each(p_reading) field where jsonb_typeof(field.value) is distinct from 'string')
    or length(coalesce(p_reading->>'titleJa','')) not between 3 and 250
    or length(coalesce(p_reading->>'summaryJa','')) not between 20 and 1400
    or length(coalesce(p_reading->>'whyJa','')) not between 15 and 700
    or length(coalesce(p_reading->>'generatedAt','')) not between 15 and 80
    or exists (select 1 from jsonb_object_keys(p_reading) k
      where k <> all(array['version','titleJa','summaryJa','whyJa','inputHash','evidenceScope','model','generatedAt']))
  then raise exception 'invalid_intelligence_reading'; end if;
  -- Reject malformed timestamps without accepting a plausible string by length.
  perform (p_reading->>'generatedAt')::timestamptz;
  select * into v_row from public.masa_intelligence_feed where id = p_id for update;
  if v_row.id is null then raise exception 'intelligence_not_found'; end if;
  if v_row.status = 'archived' then raise exception 'intelligence_archived'; end if;
  if p_expected_source is distinct from jsonb_build_array(
    coalesce(v_row.source_id,''),coalesce(v_row.title,''),coalesce(v_row.excerpt,''),
    coalesce(v_row.topic,''),coalesce(v_row.fact_type,''),coalesce(v_row.url,'')
  ) then raise exception 'reader_source_changed'; end if;
  update public.masa_intelligence_feed set reading=p_reading, updated_at=now() where id=p_id returning * into v_row;
  -- Source/review/status/content_seed fields are intentionally untouched.
  return v_row;
end;
$$;

revoke all on function public.masa_intelligence_reader_get_v1(text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.masa_intelligence_reader_save_v1(text,uuid,text,jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.masa_intelligence_reader_get_v1(text,uuid) to anon, authenticated, service_role;
grant execute on function public.masa_intelligence_reader_save_v1(text,uuid,text,jsonb,jsonb) to anon, authenticated, service_role;
comment on column public.masa_intelligence_feed.reading is 'Cached derived Japanese title/excerpt reading; never a verification or review-state promotion.';
