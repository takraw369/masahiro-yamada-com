-- Intelligence -> X draft v2.
-- The previous v1 path was deterministic SQL concatenation, not model generation.
-- This keeps the flow safe and publishable-looking without pretending source metadata is copy.
-- Human review remains mandatory.

create or replace function public.masa_intelligence_refresh_x_copy_v2(
  p_owner_key text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_row public.masa_intelligence_feed;
  v_topic text;
  v_hook text;
  v_focus text;
  v_close text;
  v_text text;
  v_payload jsonb;
  v_account_ref text;
  v_status text;
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;

  select * into v_row
  from public.masa_intelligence_feed
  where id = p_id;

  if v_row.id is null then
    raise exception 'intelligence_not_found';
  end if;
  if v_row.status = 'archived' then
    raise exception 'intelligence_archived';
  end if;

  -- Ensure the existing review-gated queue row exists. This remains idempotent.
  perform public.masa_intelligence_make_output_drafts_v1(p_owner_key, p_id);

  v_topic := regexp_replace(coalesce(nullif(btrim(v_row.topic), ''), 'このテーマ'), '\s*/\s*', '・', 'g');

  v_hook := case
    when coalesce(v_row.fact_type, '') = '研究' then '研究は「答え」ではなく、現場を見る角度を増やす材料。'
    when coalesce(v_row.fact_type, '') = '仮説' then '仮説は、信じるためではなく、次に試すために置く。'
    else '新しい情報は、知るだけでは資産にならない。'
  end;

  if coalesce(v_row.why_it_matters, '') ~ '[ぁ-んァ-ヶ一-龠]'
     and position('MASAの関心' in coalesce(v_row.why_it_matters, '')) = 0
     and position('Evidence' in coalesce(v_row.why_it_matters, '')) = 0
     and char_length(btrim(coalesce(v_row.why_it_matters, ''))) between 20 and 120 then
    v_focus := btrim(v_row.why_it_matters);
  else
    v_focus := '今回は「' || v_topic || '」の新着を、既存の原理と現場の実感に照らして読む。';
  end if;

  v_close := '一致する点、ズレる点、次に試すこと。そこまで落として初めて知識が使える。';
  v_text := left(concat_ws(E'\n\n', v_hook, v_focus, v_close), 280);

  update public.publish_queue pq
  set payload = pq.payload || jsonb_build_object(
        'draft_version', 'intelligence-x-copy-v2',
        'copy_mode', 'deterministic_safe_template',
        'text', v_text,
        'fact_check_status', 'required',
        'fact_check_required', true,
        'human_approved', false,
        'ready_for_publish', false,
        'review_gate', 'MASA_REVIEW_REQUIRED'
      ),
      updated_at = now()
  where pq.provider = 'x'
    and pq.payload->>'intelligence_id' = p_id::text
    and pq.status = 'draft';

  select pq.payload, pq.account_ref, pq.status
    into v_payload, v_account_ref, v_status
  from public.publish_queue pq
  where pq.provider = 'x'
    and pq.payload->>'intelligence_id' = p_id::text
  order by pq.updated_at desc
  limit 1;

  if v_payload is null or nullif(btrim(v_payload->>'text'), '') is null then
    raise exception 'x_draft_not_found';
  end if;

  return jsonb_build_object(
    'text', v_payload->>'text',
    'accountRef', v_account_ref,
    'queueStatus', v_status,
    'draftVersion', coalesce(v_payload->>'draft_version', ''),
    'copyMode', coalesce(v_payload->>'copy_mode', ''),
    'sourceClaim', coalesce(v_payload->>'source_claim', ''),
    'factCheckRequired', coalesce((v_payload->>'fact_check_required')::boolean, true),
    'factCheckStatus', coalesce(v_payload->>'fact_check_status', 'required'),
    'humanApproved', coalesce((v_payload->>'human_approved')::boolean, false),
    'readyForPublish', coalesce((v_payload->>'ready_for_publish')::boolean, false),
    'reviewGate', coalesce(v_payload->>'review_gate', 'MASA_REVIEW_REQUIRED')
  );
end;
$$;

revoke execute on function public.masa_intelligence_refresh_x_copy_v2(text,uuid) from public;
grant execute on function public.masa_intelligence_refresh_x_copy_v2(text,uuid) to anon, authenticated, service_role;

-- Keep the existing API contract, but make the shelf's X-draft read refresh the safe v2 copy first.
create or replace function public.masa_intelligence_get_x_draft_v1(
  p_owner_key text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
begin
  return public.masa_intelligence_refresh_x_copy_v2(p_owner_key, p_id);
end;
$$;

revoke execute on function public.masa_intelligence_get_x_draft_v1(text,uuid) from public;
grant execute on function public.masa_intelligence_get_x_draft_v1(text,uuid) to anon, authenticated, service_role;
