-- MASA Intelligence Feed -> existing publish_queue review-gated draft bridge.
-- Source is not truth: generated payloads keep Source Claim / MASA Interpretation
-- separate and require fact check + human approval before any publish worker can run.

create or replace function public.masa_intelligence_make_output_drafts_v1(
  p_owner_key text,
  p_id uuid
)
returns public.masa_intelligence_feed
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_row public.masa_intelligence_feed;
  v_provider text;
  v_account_ref text;
  v_content_type text;
  v_claim text;
  v_interpretation text;
  v_one_thing text;
  v_angle text;
  v_hook text;
  v_cta text;
  v_draft text;
  v_seed text;
  v_trust integer;
  v_signal integer;
  v_idempotency_key text;
  v_output_targets text[];
begin
  if not public.masa_evidence_owner_ok_v1(p_owner_key) then
    raise exception 'dashboard_owner_required';
  end if;

  select * into v_row
  from public.masa_intelligence_feed
  where id = p_id
  for update;

  if v_row.id is null then
    raise exception 'intelligence_not_found';
  end if;
  if v_row.status = 'archived' then
    raise exception 'intelligence_archived';
  end if;

  v_trust := greatest(0, least(5, coalesce((v_row.scores->>'trust')::numeric::integer, 0)));
  v_signal := greatest(0, least(5, coalesce((v_row.scores->>'signal')::numeric::integer, 0)));
  v_claim := coalesce(nullif(btrim(v_row.title), ''), 'Untitled source');
  v_interpretation := coalesce(nullif(btrim(v_row.why_it_matters), ''), 'MASA interpretation pending review.');
  v_one_thing := left(v_interpretation, 700);
  v_angle := left(concat_ws(' × ', nullif(v_row.topic, ''), nullif(v_row.fact_type, '')), 300);
  v_hook := left(v_claim, 220);

  v_seed := concat_ws(E'\n',
    'TITLE: ' || v_claim,
    'TOPIC: ' || coalesce(v_row.topic, 'General'),
    'FACT TYPE: ' || coalesce(v_row.fact_type, '不明'),
    'SOURCE: ' || coalesce(nullif(v_row.url, ''), 'NO URL'),
    'TRUST / SIGNAL: ' || v_trust::text || ' / ' || v_signal::text,
    'SOURCE CLAIM: ' || v_claim,
    'WHY IT MATTERS: ' || v_interpretation,
    'MASA INTERPRETATION: review before publish',
    'ONE THING: ' || v_one_thing,
    'ANGLE: ' || v_angle,
    'HOOK: ' || v_hook,
    'TRUST GATE: Source != Truth. Original-source / corroboration / contradiction check required before publishing as fact.'
  );

  v_output_targets := (
    select array_agg(distinct x order by x)
    from unnest(coalesce(v_row.output_targets, array[]::text[]) || array['sns','x','threads','instagram','note']) as x
  );

  update public.masa_intelligence_feed
  set content_seed = left(v_seed, 6000),
      status = case when v_row.status in ('verified','evidence','asset','project') then v_row.status else 'content_seed' end,
      output_targets = coalesce(v_output_targets, array['sns','x','threads','instagram','note']::text[]),
      reviewed_at = now(),
      updated_at = now()
  where id = p_id
  returning * into v_row;

  foreach v_provider in array array['x','threads','instagram','note'] loop
    v_account_ref := case v_provider
      when 'x' then '@MASAHIRO_501'
      when 'note' then 'masahiroyamada'
      else null
    end;
    v_content_type := case v_provider
      when 'instagram' then 'caption'
      when 'note' then 'article'
      else 'text'
    end;
    v_cta := case v_provider
      when 'x' then '問い / 返信 / 保存のいずれか1つをMASA Reviewで選ぶ'
      when 'threads' then '会話を促す問いをMASA Reviewで1つ選ぶ'
      when 'instagram' then '保存 / プロフィール導線をMASA Reviewで選ぶ'
      when 'note' then '次の関連記事 / Quest / LINE等から1つをMASA Reviewで選ぶ'
      else 'MASA Review required'
    end;

    v_draft := case v_provider
      when 'x' then left(concat_ws(E'\n\n', v_hook, v_one_thing), 280)
      when 'threads' then left(concat_ws(E'\n\n', v_hook, left(coalesce(nullif(v_row.excerpt,''), v_claim), 500), v_one_thing), 1400)
      when 'instagram' then left(concat_ws(E'\n\n', v_hook, v_one_thing, '—', 'Sourceを確認し、事実と解釈を分けてから公開する。'), 2200)
      when 'note' then left(concat_ws(E'\n\n',
        '# ' || v_hook,
        '## Source Claim',
        v_claim,
        '## Why it matters',
        v_one_thing,
        '## MASA Interpretation',
        '（MASA Reviewで追記）',
        '## Fact Check',
        '- Original source resolution\n- Cross-source corroboration\n- Contradiction / counterexample check',
        '## Next Action',
        v_cta
      ), 10000)
      else v_hook
    end;

    v_idempotency_key := 'intelligence:' || v_row.source_id || ':' || v_provider || ':draft-v1';

    insert into public.publish_queue (
      idempotency_key,
      provider,
      account_ref,
      content_type,
      source_ref,
      payload,
      status
    ) values (
      v_idempotency_key,
      v_provider,
      v_account_ref,
      v_content_type,
      'intelligence:' || v_row.source_id,
      jsonb_build_object(
        'draft_version', 'intelligence-output-v1',
        'intelligence_id', v_row.id,
        'source_id', v_row.source_id,
        'source_url', v_row.url,
        'topic', v_row.topic,
        'lenses', coalesce(v_row.lenses, array[]::text[]),
        'fact_type', v_row.fact_type,
        'trust', v_trust,
        'signal', v_signal,
        'source_claim', v_claim,
        'verified_fact', '',
        'masa_interpretation', v_interpretation,
        'one_thing', v_one_thing,
        'angle', v_angle,
        'hook', v_hook,
        'cta', v_cta,
        'text', v_draft,
        'fact_check_status', 'required',
        'fact_check_required', true,
        'human_approved', false,
        'ready_for_publish', false,
        'review_gate', 'MASA_REVIEW_REQUIRED',
        'account_selection_required', (v_account_ref is null)
      ),
      'draft'
    )
    on conflict (idempotency_key) do update
      set account_ref = case when public.publish_queue.status = 'draft' then excluded.account_ref else public.publish_queue.account_ref end,
          content_type = case when public.publish_queue.status = 'draft' then excluded.content_type else public.publish_queue.content_type end,
          source_ref = case when public.publish_queue.status = 'draft' then excluded.source_ref else public.publish_queue.source_ref end,
          payload = case when public.publish_queue.status = 'draft' then excluded.payload else public.publish_queue.payload end,
          updated_at = case when public.publish_queue.status = 'draft' then now() else public.publish_queue.updated_at end;
  end loop;

  return v_row;
end;
$$;

-- Keep the current server-side publishable-key + owner-key call path working,
-- but remove PostgreSQL's default PUBLIC execute grant from Intelligence RPCs.
revoke execute on function public.masa_intelligence_create_v1(text,text,text,text,text,text[],text) from public;
revoke execute on function public.masa_intelligence_update_v1(text,uuid,jsonb) from public;
revoke execute on function public.masa_intelligence_make_content_seed_v1(text,uuid) from public;
revoke execute on function public.masa_intelligence_promote_evidence_v1(text,uuid,text) from public;
revoke execute on function public.masa_intelligence_list_v1(text,text,text,integer) from public;
revoke execute on function public.masa_intelligence_make_output_drafts_v1(text,uuid) from public;

grant execute on function public.masa_intelligence_make_output_drafts_v1(text,uuid) to anon, authenticated, service_role;
