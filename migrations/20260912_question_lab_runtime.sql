-- Runtime RPCs for Question Lab dashboard and public questionnaire.

create or replace function public.masa_question_lab_owner_ok_v1(p_owner_key text)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key=p_owner_key);
$$;
revoke all on function public.masa_question_lab_owner_ok_v1(text) from public, anon, authenticated;

create or replace function public.masa_question_lab_overview_v1(p_owner_key text,p_search text default null,p_domain text default null,p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare v_result jsonb;
begin
  if not public.masa_question_lab_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'question_count',(select count(*) from public.question_bank where status<>'retired'),
      'question_set_count',(select count(*) from public.question_sets where status<>'retired'),
      'answer_count',(select count(*) from public.answer_events),
      'answered_question_count',(select count(distinct question_id) from public.answer_events),
      'people_answered',(select count(distinct person_id) from public.answer_events where person_id is not null),
      'session_count',(select count(*) from public.answer_sessions where status<>'void')
    ),
    'domains',coalesce((select jsonb_agg(jsonb_build_object('domain',d.domain,'question_count',d.question_count) order by d.question_count desc,d.domain) from (select coalesce(domain,'uncategorized') domain,count(*) question_count from public.question_bank where status<>'retired' group by coalesce(domain,'uncategorized')) d),'[]'::jsonb),
    'questions',coalesce((select jsonb_agg(to_jsonb(x) order by x.answer_count desc,x.question_text) from (
      select s.question_key,s.question_text,q.short_label,s.domain,s.category,s.answer_type,s.answer_count,s.person_count,s.session_count,s.numeric_avg,s.numeric_min,s.numeric_max,s.first_answered_at,s.last_answered_at,q.tags,q.source_type
      from public.v_question_answer_stats s join public.question_bank q on q.id=s.question_id
      where q.status<>'retired'
        and (nullif(trim(coalesce(p_domain,'')),'') is null or s.domain=p_domain)
        and (nullif(trim(coalesce(p_search,'')),'') is null or s.question_text ilike '%'||trim(p_search)||'%' or coalesce(q.short_label,'') ilike '%'||trim(p_search)||'%' or coalesce(s.domain,'') ilike '%'||trim(p_search)||'%' or coalesce(s.category,'') ilike '%'||trim(p_search)||'%')
      limit greatest(1,least(coalesce(p_limit,200),500))
    ) x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.masa_question_lab_overview_v1(text,text,text,integer) from public;
grant execute on function public.masa_question_lab_overview_v1(text,text,text,integer) to anon, authenticated;

create or replace function public.masa_question_lab_question_v1(p_owner_key text,p_question_key text,p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare v_question_id uuid; v_result jsonb;
begin
  if not public.masa_question_lab_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  select id into v_question_id from public.question_bank where question_key=p_question_key;
  if v_question_id is null then raise exception 'question_not_found'; end if;
  select jsonb_build_object(
    'question',(select to_jsonb(x) from (select q.id,q.question_key,q.question_text,q.short_label,q.domain,q.category,q.answer_type,q.config,q.tags,q.source_type,q.source_ref,q.status,q.version,s.answer_count,s.person_count,s.session_count,s.numeric_avg,s.numeric_min,s.numeric_max,s.first_answered_at,s.last_answered_at from public.question_bank q left join public.v_question_answer_stats s on s.question_id=q.id where q.id=v_question_id) x),
    'options',coalesce((select jsonb_agg(to_jsonb(o) order by o.sort_order) from public.v_question_option_stats o where o.question_id=v_question_id),'[]'::jsonb),
    'answers',coalesce((select jsonb_agg(to_jsonb(a) order by a.answered_at desc) from (select r.answer_id,r.person_id,r.serial_code,r.display_name,r.response_value,r.text_value,r.numeric_value,r.boolean_value,r.selected_options,r.answered_at,r.source_channel from public.v_question_answer_reverse_lookup r where r.question_key=p_question_key order by r.answered_at desc limit greatest(1,least(coalesce(p_limit,100),500))) a),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.masa_question_lab_question_v1(text,text,integer) from public;
grant execute on function public.masa_question_lab_question_v1(text,text,integer) to anon, authenticated;

create or replace function public.masa_question_lab_people_v1(p_owner_key text,p_search text default null,p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.masa_question_lab_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.answer_count desc,x.display_name nulls last) from (
    select c.id person_id,ps.serial_code,c.display_name,c.lifecycle_stage,c.source_channel,c.tags,count(a.id) answer_count,count(distinct a.question_id) answered_question_count,max(a.answered_at) last_answered_at
    from public.contacts c left join public.person_serials ps on ps.person_id=c.id join public.answer_events a on a.person_id=c.id
    where nullif(trim(coalesce(p_search,'')),'') is null or coalesce(c.display_name,'') ilike '%'||trim(p_search)||'%' or coalesce(ps.serial_code,'') ilike '%'||trim(p_search)||'%'
    group by c.id,ps.serial_code,c.display_name,c.lifecycle_stage,c.source_channel,c.tags
    limit greatest(1,least(coalesce(p_limit,100),500))
  ) x),'[]'::jsonb);
end;
$$;
revoke all on function public.masa_question_lab_people_v1(text,text,integer) from public;
grant execute on function public.masa_question_lab_people_v1(text,text,integer) to anon, authenticated;

create or replace function public.masa_question_lab_person_v1(p_owner_key text,p_person_id uuid,p_limit integer default 300)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare v_result jsonb;
begin
  if not public.masa_question_lab_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  if not exists(select 1 from public.contacts where id=p_person_id) then raise exception 'person_not_found'; end if;
  select jsonb_build_object(
    'person',(select jsonb_build_object('person_id',c.id,'serial_code',ps.serial_code,'display_name',c.display_name,'lifecycle_stage',c.lifecycle_stage,'source_channel',c.source_channel,'tags',c.tags,'created_at',c.created_at) from public.contacts c left join public.person_serials ps on ps.person_id=c.id where c.id=p_person_id),
    'answers',coalesce((select jsonb_agg(to_jsonb(x) order by x.answered_at desc) from (select h.answer_id,h.session_id,h.question_key,h.question_text,h.domain,h.category,h.answer_type,h.response_value,h.text_value,h.numeric_value,h.boolean_value,h.answered_at,h.source_channel from public.v_person_answer_history h where h.person_id=p_person_id order by h.answered_at desc limit greatest(1,least(coalesce(p_limit,300),1000))) x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.masa_question_lab_person_v1(text,uuid,integer) from public;
grant execute on function public.masa_question_lab_person_v1(text,uuid,integer) to anon, authenticated;

create or replace function public.masa_question_lab_reverse_v1(p_owner_key text,p_search text,p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.masa_question_lab_owner_ok_v1(p_owner_key) then raise exception 'dashboard_owner_required'; end if;
  if nullif(trim(coalesce(p_search,'')),'') is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.answered_at desc) from (
    select distinct r.answer_id,r.question_key,r.question_text,r.domain,r.category,r.person_id,r.serial_code,r.display_name,r.response_value,r.text_value,r.numeric_value,r.boolean_value,r.selected_options,r.answered_at,r.source_channel
    from public.v_question_answer_reverse_lookup r
    where r.question_text ilike '%'||trim(p_search)||'%' or coalesce(r.text_value,'') ilike '%'||trim(p_search)||'%' or coalesce(r.display_name,'') ilike '%'||trim(p_search)||'%' or coalesce(r.serial_code,'') ilike '%'||trim(p_search)||'%' or exists(select 1 from unnest(r.selected_options) opt where opt ilike '%'||trim(p_search)||'%')
    order by r.answered_at desc limit greatest(1,least(coalesce(p_limit,100),500))
  ) x),'[]'::jsonb);
end;
$$;
revoke all on function public.masa_question_lab_reverse_v1(text,text,integer) from public;
grant execute on function public.masa_question_lab_reverse_v1(text,text,integer) to anon, authenticated;

create or replace function public.public_question_set_v1(p_set_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_set_id uuid; v_result jsonb;
begin
  select id into v_set_id from public.question_sets where set_key=p_set_key and status='active' and visibility='public';
  if v_set_id is null then raise exception 'question_set_not_found'; end if;
  select jsonb_build_object(
    'set',jsonb_build_object('set_key',qs.set_key,'name',qs.name,'purpose',qs.purpose,'audience',qs.audience,'version',qs.version),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('question_key',q.question_key,'question_text',q.question_text,'short_label',q.short_label,'domain',q.domain,'category',q.category,'answer_type',q.answer_type,'config',q.config,'required',i.required,'sort_order',i.sort_order,'options',coalesce((select jsonb_agg(jsonb_build_object('option_key',o.option_key,'label',o.label,'sort_order',o.sort_order) order by o.sort_order) from public.question_options o where o.question_id=q.id),'[]'::jsonb)) order by i.sort_order) from public.question_set_items i join public.question_bank q on q.id=i.question_id where i.set_id=v_set_id and q.status='active'),'[]'::jsonb)
  ) into v_result from public.question_sets qs where qs.id=v_set_id;
  return v_result;
end;
$$;
revoke all on function public.public_question_set_v1(text) from public;
grant execute on function public.public_question_set_v1(text) to anon, authenticated;

create or replace function public.submit_questionnaire_v1(
  p_set_key text,p_session_key text,p_answers jsonb,p_display_name text default null,p_email text default null,p_contact_route text default null,p_followup_consent boolean default false,p_source_ref text default null,p_website text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id uuid; v_session_id uuid; v_person_id uuid; v_serial_code text; v_item jsonb;
  v_question_id uuid; v_answer_type text; v_answer_id uuid; v_value_text text; v_answer_count integer:=0;
  v_email text:=nullif(lower(trim(coalesce(p_email,''))),'');
  v_name text:=nullif(left(trim(coalesce(p_display_name,'')),160),'');
  v_contact text:=nullif(left(trim(coalesce(p_contact_route,'')),500),'');
begin
  if nullif(trim(coalesce(p_website,'')),'') is not null then return jsonb_build_object('ok',true,'ignored',true); end if;
  if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<1 or jsonb_array_length(p_answers)>100 then raise exception 'invalid_answers'; end if;
  select id into v_set_id from public.question_sets where set_key=p_set_key and status='active' and visibility='public';
  if v_set_id is null then raise exception 'question_set_not_found'; end if;
  if exists(select 1 from public.question_set_items i join public.question_bank q on q.id=i.question_id where i.set_id=v_set_id and i.required and not exists(select 1 from jsonb_array_elements(p_answers) a where a->>'questionKey'=q.question_key and a?'value' and a->'value'<>'null'::jsonb and a->>'value'<>'')) then raise exception 'required_answers_missing'; end if;

  if nullif(trim(coalesce(p_session_key,'')),'') is not null then
    select id,person_id into v_session_id,v_person_id from public.answer_sessions where source_channel='web_questionnaire' and session_key=left(trim(p_session_key),120) limit 1;
    if v_session_id is not null then
      select serial_code into v_serial_code from public.person_serials where person_id=v_person_id;
      return jsonb_build_object('ok',true,'duplicate',true,'session_id',v_session_id,'person_id',v_person_id,'serial_code',v_serial_code);
    end if;
  end if;

  if coalesce(p_followup_consent,false) and v_email is not null and position('@' in v_email)>1 then
    select id into v_person_id from public.contacts where lower(email)=v_email order by created_at asc limit 1;
    if v_person_id is null then
      insert into public.contacts(display_name,email,source_channel,source_campaign,lifecycle_stage,tags,consent_at,metadata)
      values(v_name,v_email,'web_questionnaire',p_set_key,'registered',array['questionnaire',p_set_key],now(),jsonb_build_object('contact_route',v_contact,'questionnaire_set',p_set_key)) returning id into v_person_id;
    else
      update public.contacts set display_name=coalesce(display_name,v_name),consent_at=coalesce(consent_at,now()),tags=(select array(select distinct x from unnest(coalesce(tags,'{}'::text[])||array['questionnaire',p_set_key]) x)),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('contact_route',v_contact,'last_questionnaire_set',p_set_key),updated_at=now() where id=v_person_id;
    end if;
  end if;

  insert into public.answer_sessions(person_id,question_set_id,session_key,source_channel,source_ref,status,consent_scope,completed_at,metadata)
  values(v_person_id,v_set_id,nullif(left(trim(coalesce(p_session_key,'')),120),''),'web_questionnaire',nullif(left(trim(coalesce(p_source_ref,'')),500),''),'completed',case when v_person_id is not null then 'marketing_followup' else 'anonymous_aggregate' end,now(),jsonb_build_object('respondent_name',case when coalesce(p_followup_consent,false) then v_name else null end,'contact_route',case when coalesce(p_followup_consent,false) then v_contact else null end,'followup_consent',coalesce(p_followup_consent,false))) returning id into v_session_id;

  for v_item in select value from jsonb_array_elements(p_answers) loop
    select q.id,q.answer_type into v_question_id,v_answer_type from public.question_bank q join public.question_set_items i on i.question_id=q.id where i.set_id=v_set_id and q.question_key=v_item->>'questionKey' and q.status='active' limit 1;
    if v_question_id is null then continue; end if;
    v_value_text:=v_item->>'value';
    insert into public.answer_events(session_id,person_id,question_id,response_value,text_value,numeric_value,boolean_value,source_channel,idempotency_key,answered_at,metadata)
    values(v_session_id,v_person_id,v_question_id,coalesce(v_item,'{}'::jsonb),case when v_answer_type='free_text' then nullif(left(v_value_text,4000),'') else null end,case when v_answer_type in ('scale','number') and coalesce(v_value_text,'') ~ '^-?[0-9]+([.][0-9]+)?$' then v_value_text::numeric else null end,case when v_answer_type='yes_no' and lower(coalesce(v_value_text,'')) in ('true','yes','1','はい') then true when v_answer_type='yes_no' and lower(coalesce(v_value_text,'')) in ('false','no','0','いいえ') then false else null end,'web_questionnaire',v_session_id::text||':'||v_question_id::text,now(),'{}'::jsonb) returning id into v_answer_id;
    if v_answer_type='single_choice' then
      insert into public.answer_selected_options(answer_id,option_id) select v_answer_id,o.id from public.question_options o where o.question_id=v_question_id and o.option_key=v_value_text on conflict do nothing;
    elsif v_answer_type in ('multi_choice','ranking') and jsonb_typeof(v_item->'value')='array' then
      insert into public.answer_selected_options(answer_id,option_id,rank_order) select v_answer_id,o.id,k.ord::integer from jsonb_array_elements_text(v_item->'value') with ordinality as k(option_key,ord) join public.question_options o on o.question_id=v_question_id and o.option_key=k.option_key on conflict do nothing;
    end if;
    v_answer_count:=v_answer_count+1; v_question_id:=null;
  end loop;
  if v_person_id is not null then select serial_code into v_serial_code from public.person_serials where person_id=v_person_id; end if;
  return jsonb_build_object('ok',true,'session_id',v_session_id,'person_id',v_person_id,'serial_code',v_serial_code,'answer_count',v_answer_count);
end;
$$;
revoke all on function public.submit_questionnaire_v1(text,text,jsonb,text,text,text,boolean,text,text) from public;
grant execute on function public.submit_questionnaire_v1(text,text,jsonb,text,text,text,boolean,text,text) to anon, authenticated;
