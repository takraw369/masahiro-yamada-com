-- Additive telemetry for existing 23-question Mental Check; reuses public.funnel_events.
-- No new tables, questionnaire changes, exposure of answers, or public read permissions.
create or replace function public.mental_check_funnel_event_add_v1(
  p_session_key text,
  p_event_name text
) returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_contact_id uuid;
  v_event_id bigint;
begin
  if coalesce(p_session_key, '') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
    raise exception 'invalid_session_key';
  end if;
  if p_event_name not in ('mental_check_completed', 'mental_check_line_click', 'mental_check_toolkit_click')
     or p_event_name is null then
    raise exception 'invalid_event';
  end if;

  -- Knowledge of this unpredictable key is required; the linked questionnaire must have completed.
  select s.id, case when s.consent_scope = 'marketing_followup' then s.person_id else null end
  into v_session_id, v_contact_id
  from public.answer_sessions s
  join public.question_sets qs on qs.id = s.question_set_id
  where s.session_key = p_session_key
    and s.source_channel = 'web_questionnaire'
    and s.status = 'completed'
    and s.completed_at >= now() - interval '14 days'
    and qs.set_key = 'mental_condition_lead_v1'
  order by s.completed_at desc
  limit 1;

  if v_session_id is null then return null; end if;

  -- Serialise duplicate browser beacons and retries for the same stage/session.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_session_id::text),
    pg_catalog.hashtext(p_event_name)
  );
  select e.id into v_event_id
  from public.funnel_events e
  where e.event_type = p_event_name
    and e.payload->>'answer_session_id' = v_session_id::text
  order by e.id limit 1;
  if v_event_id is not null then return v_event_id; end if;

  insert into public.funnel_events(
    contact_id, event_type, channel, campaign, offer_id, payload, occurred_at
  ) values (
    v_contact_id, p_event_name, 'web_questionnaire', 'mental_condition_lead_v1',
    null, pg_catalog.jsonb_build_object(
      'answer_session_id', v_session_id::text,
      'path', '/mental-check',
      'origin', 'masahiro-yamada-com'
    ), now()
  ) returning id into v_event_id;
  return v_event_id;
end;
$function$;

revoke all on function public.mental_check_funnel_event_add_v1(text, text) from public, anon, authenticated;
grant execute on function public.mental_check_funnel_event_add_v1(text, text) to anon, authenticated;
