create table if not exists public.flow_canvas_scenes (
  owner_key text not null references public.masa_flow_mind_trusted_owners(owner_key) on delete cascade,
  scene_key text not null default 'main',
  snapshot jsonb not null default '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  revision bigint not null default 0,
  updated_by text not null default 'human',
  updated_at timestamptz not null default now(),
  primary key (owner_key, scene_key),
  constraint flow_canvas_scene_key_check check (scene_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint flow_canvas_updated_by_check check (updated_by in ('human','ai','system')),
  constraint flow_canvas_snapshot_object_check check (jsonb_typeof(snapshot) = 'object')
);

alter table public.flow_canvas_scenes enable row level security;
revoke all on public.flow_canvas_scenes from anon, authenticated;

create or replace function public.masa_flow_canvas_get_v1(
  p_owner_key text,
  p_scene_key text default 'main'
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
declare
  v_scene_key text := lower(btrim(coalesce(p_scene_key, 'main')));
  v_row public.flow_canvas_scenes%rowtype;
begin
  perform private.flow_mind_assert_owner(p_owner_key);
  if v_scene_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'invalid_scene_key' using errcode = '22023';
  end if;

  select * into v_row
  from public.flow_canvas_scenes
  where owner_key = p_owner_key and scene_key = v_scene_key;

  if not found then
    return jsonb_build_object(
      'sceneKey', v_scene_key,
      'snapshot', jsonb_build_object('nodes','[]'::jsonb,'edges','[]'::jsonb,'viewport',jsonb_build_object('x',0,'y',0,'zoom',1)),
      'revision', 0,
      'updatedBy', null,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'sceneKey', v_row.scene_key,
    'snapshot', v_row.snapshot,
    'revision', v_row.revision,
    'updatedBy', v_row.updated_by,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.masa_flow_canvas_save_v1(
  p_owner_key text,
  p_scene_key text,
  p_snapshot jsonb,
  p_expected_revision bigint default null,
  p_actor text default 'human'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  v_scene_key text := lower(btrim(coalesce(p_scene_key, 'main')));
  v_actor text := lower(btrim(coalesce(p_actor, 'human')));
  v_current bigint;
  v_next bigint;
begin
  perform private.flow_mind_assert_owner(p_owner_key);
  if v_scene_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'invalid_scene_key' using errcode = '22023';
  end if;
  if v_actor not in ('human','ai','system') then
    raise exception 'invalid_actor' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(coalesce(p_snapshot->'nodes','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_snapshot->'edges','[]'::jsonb)) <> 'array' then
    raise exception 'invalid_snapshot' using errcode = '22023';
  end if;

  select revision into v_current
  from public.flow_canvas_scenes
  where owner_key = p_owner_key and scene_key = v_scene_key
  for update;

  if not found then
    if p_expected_revision is not null and p_expected_revision <> 0 then
      raise exception 'revision_conflict' using errcode = '40001';
    end if;
    v_next := 1;
    insert into public.flow_canvas_scenes(owner_key, scene_key, snapshot, revision, updated_by, updated_at)
    values (p_owner_key, v_scene_key, p_snapshot, v_next, v_actor, now());
  else
    if p_expected_revision is not null and p_expected_revision <> v_current then
      raise exception 'revision_conflict' using errcode = '40001';
    end if;
    v_next := v_current + 1;
    update public.flow_canvas_scenes
      set snapshot = p_snapshot, revision = v_next, updated_by = v_actor, updated_at = now()
    where owner_key = p_owner_key and scene_key = v_scene_key;
  end if;

  return jsonb_build_object('sceneKey',v_scene_key,'revision',v_next,'updatedBy',v_actor,'updatedAt',now());
end;
$$;

revoke all on function public.masa_flow_canvas_get_v1(text,text) from public;
revoke all on function public.masa_flow_canvas_save_v1(text,text,jsonb,bigint,text) from public;
grant execute on function public.masa_flow_canvas_get_v1(text,text) to anon, authenticated;
grant execute on function public.masa_flow_canvas_save_v1(text,text,jsonb,bigint,text) to anon, authenticated;
