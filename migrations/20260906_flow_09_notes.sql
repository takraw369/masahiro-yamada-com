create table if not exists public.masa_flow_09_notes (
  owner_key text not null,
  number smallint not null check (number between 0 and 9),
  meaning text not null default '',
  life_area text not null default '',
  episode text not null default '',
  friction text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner_key, number),
  constraint masa_flow_09_owner_key_format check (owner_key ~ '^[0-9a-f]{64}$')
);

alter table public.masa_flow_09_notes enable row level security;
revoke all on table public.masa_flow_09_notes from anon, authenticated;
grant all on table public.masa_flow_09_notes to service_role;

create or replace function public.masa_flow_09_get_v1(p_owner_key text)
returns table(
  number smallint,
  meaning text,
  life_area text,
  episode text,
  friction text,
  updated_at timestamptz
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

  return query
  select n.number, n.meaning, n.life_area, n.episode, n.friction, n.updated_at
  from public.masa_flow_09_notes n
  where n.owner_key = p_owner_key
  order by n.number;
end;
$$;

create or replace function public.masa_flow_09_set_v1(
  p_owner_key text,
  p_number integer,
  p_meaning text,
  p_life_area text,
  p_episode text,
  p_friction text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_owner_key';
  end if;
  if p_number is null or p_number < 0 or p_number > 9 then
    raise exception 'invalid_number';
  end if;

  insert into public.masa_flow_09_notes(owner_key, number, meaning, life_area, episode, friction, updated_at)
  values (
    p_owner_key,
    p_number::smallint,
    left(coalesce(p_meaning, ''), 5000),
    left(coalesce(p_life_area, ''), 5000),
    left(coalesce(p_episode, ''), 10000),
    left(coalesce(p_friction, ''), 5000),
    now()
  )
  on conflict (owner_key, number)
  do update set
    meaning = excluded.meaning,
    life_area = excluded.life_area,
    episode = excluded.episode,
    friction = excluded.friction,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.masa_flow_09_get_v1(text) from public;
revoke all on function public.masa_flow_09_set_v1(text, integer, text, text, text, text) from public;
grant execute on function public.masa_flow_09_get_v1(text) to anon, authenticated, service_role;
grant execute on function public.masa_flow_09_set_v1(text, integer, text, text, text, text) to anon, authenticated, service_role;
