-- Read the review-gated X draft that masa_intelligence_make_output_drafts_v1
-- already writes into publish_queue. content_seed stays internal source material;
-- it must never be treated as publishable X copy.

create or replace function public.masa_intelligence_get_x_draft_v1(
  p_owner_key text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_payload jsonb;
  v_account_ref text;
  v_status text;
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;

  if not exists (
    select 1
    from public.masa_intelligence_feed
    where id = p_id
      and status <> 'archived'
  ) then
    raise exception 'intelligence_not_found';
  end if;

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
    'sourceClaim', coalesce(v_payload->>'source_claim', ''),
    'factCheckRequired', coalesce((v_payload->>'fact_check_required')::boolean, true),
    'factCheckStatus', coalesce(v_payload->>'fact_check_status', 'required'),
    'humanApproved', coalesce((v_payload->>'human_approved')::boolean, false),
    'readyForPublish', coalesce((v_payload->>'ready_for_publish')::boolean, false),
    'reviewGate', coalesce(v_payload->>'review_gate', 'MASA_REVIEW_REQUIRED')
  );
end;
$$;

revoke execute on function public.masa_intelligence_get_x_draft_v1(text,uuid) from public;
grant execute on function public.masa_intelligence_get_x_draft_v1(text,uuid) to anon, authenticated, service_role;
