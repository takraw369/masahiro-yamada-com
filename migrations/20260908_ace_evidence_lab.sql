-- ACE Evidence Lab: structured runtime evidence for athlete/education research.
-- Supabase owns raw/structured state; Google Drive remains canonical knowledge.

create table if not exists public.ace_evidence (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  source_kind text not null default 'manual',
  source_url text,
  sport text,
  age_band text,
  learning_phase text not null default 'unclassified',
  evidence_type text not null default 'observation',
  evidence_quality text not null default 'raw',
  status text not null default 'inbox',
  ace_connection text,
  review_note text,
  canonical_drive_url text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  occurred_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_evidence_source_kind_check check (source_kind in ('manual','field','voice','web','research','ai_scout')),
  constraint ace_evidence_learning_phase_check check (learning_phase in ('pattern','perception','choice','adaptation','creation','mixed','unclassified')),
  constraint ace_evidence_type_check check (evidence_type in ('observation','case','research','article','idea','counterexample')),
  constraint ace_evidence_quality_check check (evidence_quality in ('raw','weak','medium','strong','canonical')),
  constraint ace_evidence_status_check check (status in ('inbox','reviewing','validated','canonical','dismissed'))
);

create index if not exists ace_evidence_created_at_idx on public.ace_evidence (created_at desc);
create index if not exists ace_evidence_status_idx on public.ace_evidence (status, created_at desc);
create index if not exists ace_evidence_phase_idx on public.ace_evidence (learning_phase, created_at desc);
create index if not exists ace_evidence_source_kind_idx on public.ace_evidence (source_kind, created_at desc);

alter table public.ace_evidence enable row level security;
revoke all on table public.ace_evidence from public, anon, authenticated;

create or replace function public.masa_evidence_owner_ok_v1(p_owner_key text)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key
  );
$$;

revoke all on function public.masa_evidence_owner_ok_v1(text) from public;

create or replace function public.masa_evidence_list_v1(
  p_owner_key text,
  p_limit integer default 300
)
returns setof public.ace_evidence
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;

  return query
  select e.*
  from public.ace_evidence e
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 300), 500));
end;
$$;

revoke all on function public.masa_evidence_list_v1(text, integer) from public;
grant execute on function public.masa_evidence_list_v1(text, integer) to anon, authenticated;

create or replace function public.masa_evidence_create_v1(
  p_owner_key text,
  p_title text,
  p_body text,
  p_source_kind text default 'manual',
  p_source_url text default null,
  p_sport text default null,
  p_age_band text default null,
  p_learning_phase text default 'unclassified',
  p_evidence_type text default 'observation',
  p_evidence_quality text default 'raw',
  p_ace_connection text default null,
  p_tags text[] default '{}',
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_occurred_at timestamptz default now()
)
returns public.ace_evidence
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.ace_evidence;
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;
  if nullif(trim(p_title), '') is null then raise exception 'evidence_title_required'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'evidence_body_required'; end if;
  if p_source_kind not in ('manual','field','voice','web','research','ai_scout') then raise exception 'invalid_source_kind'; end if;
  if p_learning_phase not in ('pattern','perception','choice','adaptation','creation','mixed','unclassified') then raise exception 'invalid_learning_phase'; end if;
  if p_evidence_type not in ('observation','case','research','article','idea','counterexample') then raise exception 'invalid_evidence_type'; end if;
  if p_evidence_quality not in ('raw','weak','medium','strong','canonical') then raise exception 'invalid_evidence_quality'; end if;

  insert into public.ace_evidence (
    title, body, source_kind, source_url, sport, age_band, learning_phase,
    evidence_type, evidence_quality, ace_connection, tags, metadata, dedupe_key, occurred_at
  ) values (
    left(trim(p_title), 400), left(trim(p_body), 12000), p_source_kind,
    nullif(left(trim(coalesce(p_source_url,'')), 1500), ''),
    nullif(left(trim(coalesce(p_sport,'')), 120), ''),
    nullif(left(trim(coalesce(p_age_band,'')), 120), ''),
    p_learning_phase, p_evidence_type, p_evidence_quality,
    nullif(left(trim(coalesce(p_ace_connection,'')), 3000), ''),
    coalesce(p_tags, '{}'), coalesce(p_metadata, '{}'::jsonb),
    nullif(left(trim(coalesce(p_dedupe_key,'')), 500), ''), coalesce(p_occurred_at, now())
  )
  on conflict (dedupe_key) do update set
    updated_at = now(),
    metadata = public.ace_evidence.metadata || excluded.metadata
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.masa_evidence_create_v1(text,text,text,text,text,text,text,text,text,text,text,text[],jsonb,text,timestamptz) from public;
grant execute on function public.masa_evidence_create_v1(text,text,text,text,text,text,text,text,text,text,text,text[],jsonb,text,timestamptz) to anon, authenticated;

create or replace function public.masa_evidence_update_v1(
  p_owner_key text,
  p_id uuid,
  p_patch jsonb
)
returns public.ace_evidence
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.ace_evidence;
  v_status text;
  v_phase text;
  v_quality text;
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  if p_id is null then raise exception 'evidence_id_required'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'evidence_patch_required'; end if;

  if p_patch ? 'status' then
    v_status := p_patch->>'status';
    if v_status not in ('inbox','reviewing','validated','canonical','dismissed') then raise exception 'invalid_evidence_status'; end if;
  end if;
  if p_patch ? 'learning_phase' then
    v_phase := p_patch->>'learning_phase';
    if v_phase not in ('pattern','perception','choice','adaptation','creation','mixed','unclassified') then raise exception 'invalid_learning_phase'; end if;
  end if;
  if p_patch ? 'evidence_quality' then
    v_quality := p_patch->>'evidence_quality';
    if v_quality not in ('raw','weak','medium','strong','canonical') then raise exception 'invalid_evidence_quality'; end if;
  end if;

  update public.ace_evidence e set
    status = case when p_patch ? 'status' then v_status else e.status end,
    learning_phase = case when p_patch ? 'learning_phase' then v_phase else e.learning_phase end,
    evidence_quality = case when p_patch ? 'evidence_quality' then v_quality else e.evidence_quality end,
    sport = case when p_patch ? 'sport' then nullif(left(trim(p_patch->>'sport'),120),'') else e.sport end,
    age_band = case when p_patch ? 'age_band' then nullif(left(trim(p_patch->>'age_band'),120),'') else e.age_band end,
    ace_connection = case when p_patch ? 'ace_connection' then nullif(left(trim(p_patch->>'ace_connection'),3000),'') else e.ace_connection end,
    review_note = case when p_patch ? 'review_note' then nullif(left(trim(p_patch->>'review_note'),4000),'') else e.review_note end,
    canonical_drive_url = case when p_patch ? 'canonical_drive_url' then nullif(left(trim(p_patch->>'canonical_drive_url'),1500),'') else e.canonical_drive_url end,
    reviewed_at = case when p_patch ? 'status' and v_status = 'inbox' then null when p_patch ? 'status' then now() else e.reviewed_at end,
    updated_at = now()
  where e.id = p_id
  returning * into v_row;

  if v_row.id is null then raise exception 'evidence_not_found'; end if;
  return v_row;
end;
$$;

revoke all on function public.masa_evidence_update_v1(text,uuid,jsonb) from public;
grant execute on function public.masa_evidence_update_v1(text,uuid,jsonb) to anon, authenticated;
