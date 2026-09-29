-- Reusable public app-feedback intake backed by feedback_events.
-- Direct table reads remain blocked by RLS; public clients can only insert a tightly constrained event shape.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback_events'
      and policyname = 'public can submit constrained app feedback'
  ) then
    create policy "public can submit constrained app feedback"
    on public.feedback_events
    for insert
    to anon, authenticated
    with check (
      provider = 'app'
      and event_type = 'app_feedback'
      and status = 'new'
      and publish_queue_id is null
      and provider_post_id is null
      and provider_event_id is not null
      and btrim(provider_event_id) <> ''
      and length(provider_event_id) <= 120
      and text is not null
      and length(btrim(text)) between 1 and 4000
      and (actor_ref is null or length(actor_ref) <= 320)
      and (source_ref is null or length(source_ref) <= 500)
      and jsonb_typeof(raw_payload) = 'object'
      and length(coalesce(raw_payload ->> 'app_key', '')) between 1 and 80
      and raw_payload ->> 'client_event_id' = provider_event_id
      and dedupe_key = 'app-feedback:' || (raw_payload ->> 'app_key') || ':' || provider_event_id
    );
  end if;
end
$$;

grant insert (
  source_ref,
  provider,
  provider_event_id,
  event_type,
  text,
  actor_ref,
  occurred_at,
  raw_payload,
  dedupe_key,
  status
) on public.feedback_events to anon, authenticated;

create or replace function public.submit_app_feedback_v1(
  p_client_event_id text,
  p_app_key text,
  p_context_key text,
  p_message text,
  p_actor_ref text default null,
  p_source_ref text default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_client_event_id text := btrim(coalesce(p_client_event_id, ''));
  v_app_key text := lower(btrim(coalesce(p_app_key, '')));
  v_context_key text := nullif(btrim(coalesce(p_context_key, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_actor_ref text := nullif(btrim(coalesce(p_actor_ref, '')), '');
  v_source_ref text := nullif(btrim(coalesce(p_source_ref, '')), '');
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_dedupe_key text;
begin
  if length(v_client_event_id) not between 1 and 120 then
    raise exception 'invalid client event id';
  end if;
  if length(v_app_key) not between 1 and 80 or v_app_key !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then
    raise exception 'invalid app key';
  end if;
  if v_context_key is not null and length(v_context_key) > 200 then
    raise exception 'context key too long';
  end if;
  if length(v_message) not between 1 and 4000 then
    raise exception 'invalid message';
  end if;
  if v_actor_ref is not null and length(v_actor_ref) > 320 then
    raise exception 'actor ref too long';
  end if;
  if v_source_ref is not null and length(v_source_ref) > 500 then
    raise exception 'source ref too long';
  end if;
  if jsonb_typeof(v_meta) <> 'object' or octet_length(v_meta::text) > 12000 then
    raise exception 'invalid metadata';
  end if;

  v_dedupe_key := 'app-feedback:' || v_app_key || ':' || v_client_event_id;

  begin
    insert into public.feedback_events (
      source_ref,
      provider,
      provider_event_id,
      event_type,
      text,
      actor_ref,
      occurred_at,
      raw_payload,
      dedupe_key,
      status
    ) values (
      v_source_ref,
      'app',
      v_client_event_id,
      'app_feedback',
      v_message,
      v_actor_ref,
      now(),
      jsonb_build_object(
        'app_key', v_app_key,
        'client_event_id', v_client_event_id,
        'context_key', v_context_key,
        'meta', v_meta
      ),
      v_dedupe_key,
      'new'
    );
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'accepted', true, 'duplicate', true);
  end;

  return jsonb_build_object('ok', true, 'accepted', true, 'duplicate', false);
end;
$$;

revoke all on function public.submit_app_feedback_v1(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_app_feedback_v1(text, text, text, text, text, text, jsonb) to anon, authenticated;
