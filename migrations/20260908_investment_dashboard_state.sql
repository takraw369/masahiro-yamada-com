create table if not exists public.masa_investment_state (
  owner_key text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint masa_investment_state_owner_key_format check (owner_key ~ '^[0-9a-f]{64}$'),
  constraint masa_investment_state_is_object check (jsonb_typeof(state) = 'object'),
  constraint masa_investment_state_size check (octet_length(state::text) <= 200000)
);

alter table public.masa_investment_state enable row level security;
revoke all on table public.masa_investment_state from anon, authenticated;
grant all on table public.masa_investment_state to service_role;

create or replace function public.masa_investment_state_get_v1(p_owner_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare v_state jsonb;
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_key'; end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then raise exception 'invalid_owner_key'; end if;
  select s.state into v_state from public.masa_investment_state s where s.owner_key = p_owner_key;
  return coalesce(v_state, '{}'::jsonb);
end;
$$;

create or replace function public.masa_investment_state_set_v1(p_owner_key text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_key'; end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then raise exception 'invalid_owner_key'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'invalid_state'; end if;
  if octet_length(p_state::text) > 200000 then raise exception 'state_too_large'; end if;
  insert into public.masa_investment_state(owner_key, state, updated_at)
  values (p_owner_key, p_state, now())
  on conflict (owner_key) do update set state = excluded.state, updated_at = now();
  return true;
end;
$$;

revoke all on function public.masa_investment_state_get_v1(text) from public;
revoke all on function public.masa_investment_state_set_v1(text, jsonb) from public;
grant execute on function public.masa_investment_state_get_v1(text) to anon, authenticated, service_role;
grant execute on function public.masa_investment_state_set_v1(text, jsonb) to anon, authenticated, service_role;
