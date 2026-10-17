-- Cognitive Decision Lens: private interaction state, not a second knowledge canonical.
-- MASA_CORE_MAP / DECISION_LOG in Drive remain the long-term source of truth.
create table if not exists private.masa_cognitive_cases (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  title text not null check (char_length(title) between 1 and 180),
  context_text text not null check (char_length(context_text) between 1 and 6000),
  options_text text not null default '' check (char_length(options_text) <= 3000),
  lens text not null default 'core' check (lens in ('core','alt','2035','challenge')),
  prediction_text text not null default '' check (char_length(prediction_text) <= 6000),
  rationale_text text not null default '' check (char_length(rationale_text) <= 4000),
  actual_text text not null default '' check (char_length(actual_text) <= 6000),
  difference_text text not null default '' check (char_length(difference_text) <= 4000),
  outcome_text text not null default '' check (char_length(outcome_text) <= 4000),
  stage text not null default 'draft' check (stage in ('draft','locked','reviewed')),
  locked_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists masa_cognitive_cases_owner_updated_idx
  on private.masa_cognitive_cases (owner_key, updated_at desc);
alter table private.masa_cognitive_cases enable row level security;
revoke all on private.masa_cognitive_cases from public, anon, authenticated;
comment on table private.masa_cognitive_cases is
  'Owner-only Dashboard Decision Lens interaction records. Drive remains canonical for enduring judgment principles.';

-- Existing 64-hex HMAC owner key is derived server-side from the Dashboard secret.
-- No browser-side service_role secret or direct table grant is introduced.
create or replace function public.masa_cognitive_cases_list_v1(
  p_owner_key text, p_limit integer default 25
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$'
     or not exists (select 1 from private.masa_dashboard_owner_keys
                    where owner_key = p_owner_key) then
    raise exception 'invalid_owner_key';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) - 'owner_key' order by x.updated_at desc), '[]'::jsonb)
  into v_result
  from (
    select * from private.masa_cognitive_cases
    where owner_key = p_owner_key
    order by updated_at desc
    limit least(greatest(coalesce(p_limit,25),1),50)
  ) x;
  return v_result;
end;
$$;

create or replace function public.masa_cognitive_case_save_v1(
  p_owner_key text, p_action text, p_case jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_existing private.masa_cognitive_cases%rowtype;
  v_title text;
  v_context text;
  v_options text;
  v_lens text;
  v_prediction text;
  v_rationale text;
  v_actual text;
  v_difference text;
  v_outcome text;
  v_result jsonb;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$'
    or not exists (select 1 from private.masa_dashboard_owner_keys
                   where owner_key = p_owner_key) then
    raise exception 'invalid_owner_key';
  end if;
  if p_action not in ('draft','lock','actual','outcome')
    or p_action is null or jsonb_typeof(p_case) <> 'object'
    or octet_length(p_case::text) > 24000 then
    raise exception 'invalid_input';
  end if;

  if p_case ? 'id' and nullif(p_case->>'id','') is not null then
    v_id := (p_case->>'id')::uuid;
    select * into v_existing from private.masa_cognitive_cases
    where id = v_id and owner_key = p_owner_key for update;
    if not found then raise exception 'case_not_found'; end if;
  elsif p_action <> 'draft' then
    raise exception 'draft_must_be_saved_first';
  end if;

  if p_action = 'draft' then
    if v_id is not null and v_existing.stage <> 'draft' then
      raise exception 'locked_prediction_immutable';
    end if;
    v_title := btrim(coalesce(p_case->>'title',''));
    v_context := btrim(coalesce(p_case->>'context_text',''));
    v_options := btrim(coalesce(p_case->>'options_text',''));
    v_lens := coalesce(p_case->>'lens','core');
    if char_length(v_title) not between 1 and 180
      or char_length(v_context) not between 1 and 6000
      or char_length(v_options) > 3000
      or v_lens not in ('core','alt','2035','challenge') then
      raise exception 'invalid_draft';
    end if;
    if v_id is null then
      insert into private.masa_cognitive_cases
        (owner_key,title,context_text,options_text,lens)
      values (p_owner_key,v_title,v_context,v_options,v_lens)
      returning id into v_id;
    else
      update private.masa_cognitive_cases
      set title=v_title, context_text=v_context, options_text=v_options,
          lens=v_lens, updated_at=now()
      where id=v_id and owner_key=p_owner_key;
    end if;

  elsif p_action = 'lock' then
    if v_existing.stage <> 'draft' then raise exception 'already_locked'; end if;
    v_prediction := btrim(coalesce(p_case->>'prediction_text',''));
    v_rationale := btrim(coalesce(p_case->>'rationale_text',''));
    if char_length(v_prediction) not between 1 and 6000
      or char_length(v_rationale) > 4000 then
      raise exception 'invalid_prediction';
    end if;
    update private.masa_cognitive_cases
    set prediction_text=v_prediction, rationale_text=v_rationale,
        locked_at=now(), stage='locked', updated_at=now()
    where id=v_id and owner_key=p_owner_key;

  elsif p_action = 'actual' then
    if v_existing.stage <> 'locked' then raise exception 'prediction_must_be_locked'; end if;
    v_actual := btrim(coalesce(p_case->>'actual_text',''));
    v_difference := btrim(coalesce(p_case->>'difference_text',''));
    if char_length(v_actual) not between 1 and 6000
      or char_length(v_difference) > 4000 then
      raise exception 'invalid_actual';
    end if;
    update private.masa_cognitive_cases
    set actual_text=v_actual, difference_text=v_difference,
        reviewed_at=now(), stage='reviewed', updated_at=now()
    where id=v_id and owner_key=p_owner_key;

  elsif p_action = 'outcome' then
    if v_existing.stage <> 'reviewed' then raise exception 'actual_must_be_recorded'; end if;
    v_outcome := btrim(coalesce(p_case->>'outcome_text',''));
    if char_length(v_outcome) > 4000 then raise exception 'invalid_outcome'; end if;
    update private.masa_cognitive_cases
    set outcome_text=v_outcome, updated_at=now()
    where id=v_id and owner_key=p_owner_key;
  end if;

  select to_jsonb(c) - 'owner_key' into v_result
  from private.masa_cognitive_cases c
  where c.id=v_id and c.owner_key=p_owner_key;
  return v_result;
end;
$$;

revoke all on function public.masa_cognitive_cases_list_v1(text,integer) from public, anon, authenticated;
revoke all on function public.masa_cognitive_case_save_v1(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.masa_cognitive_cases_list_v1(text,integer) to anon, authenticated;
grant execute on function public.masa_cognitive_case_save_v1(text,text,jsonb) to anon, authenticated;
