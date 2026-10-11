-- Synthetic records only; the entire test transaction is rolled back.
begin;
do $$
declare
 v_owner text; v_suffix text:=replace(gen_random_uuid()::text,'-','');
 v_slug text; v_session text; v_payment text; v_hash text:=repeat('a',64);
 v_body text:=repeat('PRIVATE_FIXTURE_BODY_ONLY ',20); v_result jsonb; v_count integer;
begin
 select owner_key into v_owner from private.masa_dashboard_owner_keys limit 1;
 if v_owner is null then raise exception 'test_requires_configured_owner'; end if;
 v_slug:='fixture-'||v_suffix; v_session:='cs_live_'||v_suffix; v_payment:='pi_'||v_suffix;
 begin
  perform public.masa_content_studio_snapshot_v1(null);
  raise exception 'owner_guard_failed';
 exception when others then if sqlerrm<>'dashboard_owner_required' then raise; end if; end;
 perform public.masa_shelf_product_save_v1(v_owner,v_slug,'Fixture only','Public summary',v_body,null,1980,null,'https://buy.stripe.com/fixture',true);
 if public.knowledge_shelf_catalog_v1()::text like '%PRIVATE_FIXTURE_BODY_ONLY%' then raise exception 'catalog_leaked_body'; end if;
 begin
  perform public.masa_shelf_product_save_v1(v_owner,v_slug,'Changed','',v_body,null,1980,null,null,false);
  raise exception 'version_guard_failed';
 exception when others then if sqlerrm<>'version_conflict' then raise; end if; end;
 perform public.masa_shelf_payment_record_v1(v_owner,v_session,v_payment,v_slug,'fixture-'||v_suffix||'@example.invalid',1980,'pending',false,'evt_fixture_pending',v_hash);
 if public.knowledge_shelf_key_content_v1(v_slug,v_hash)->>'status'<>'forbidden' then raise exception 'pending_opened_content'; end if;
 begin
  perform public.masa_shelf_payment_record_v1(v_owner,v_session,v_payment,v_slug,'fixture-'||v_suffix||'@example.invalid',1979,'paid',false,'evt_fixture_amount',v_hash);
  raise exception 'amount_guard_failed';
 exception when others then if sqlerrm<>'payment_amount_mismatch' then raise; end if; end;
 perform public.masa_shelf_payment_record_v1(v_owner,v_session,v_payment,v_slug,'fixture-'||v_suffix||'@example.invalid',1980,'paid',false,'evt_fixture_paid',v_hash);
 if public.knowledge_shelf_key_content_v1(v_slug,v_hash)->>'status'<>'ok' then raise exception 'paid_did_not_open'; end if;
 if public.knowledge_shelf_key_content_v1(v_slug,repeat('b',64))->>'status'<>'forbidden' then raise exception 'wrong_key_opened'; end if;
 if public.knowledge_shelf_key_content_v1('other-product',v_hash)->>'status'<>'forbidden' then raise exception 'wrong_product_opened'; end if;
 if public.masa_shelf_key_claim_v1(v_owner,v_session)->>'status'<>'ok' then raise exception 'paid_claim_failed'; end if;
 perform public.masa_shelf_payment_record_v1(v_owner,v_session,v_payment,v_slug,'fixture-'||v_suffix||'@example.invalid',1980,'paid',false,'evt_fixture_replay',v_hash);
 select count(*) into v_count from public.purchases where external_payment_id=v_payment;
 if v_count<>1 then raise exception 'duplicate_purchase'; end if;
 select count(*) into v_count from private.knowledge_shelf_purchase_keys where checkout_session_id=v_session;
 if v_count<>1 then raise exception 'duplicate_key'; end if;
 perform public.masa_shelf_payment_record_v1(v_owner,v_session,v_payment,v_slug,'fixture-'||v_suffix||'@example.invalid',1980,'pending',false,'evt_fixture_late_pending',v_hash);
 if public.knowledge_shelf_key_content_v1(v_slug,v_hash)->>'status'<>'ok' then raise exception 'late_pending_revoked_paid'; end if;
 perform public.masa_shelf_payment_record_v1(v_owner,'cs_test_'||v_suffix,'pi_test'||v_suffix,v_slug,'fixture-test-'||v_suffix||'@example.invalid',1980,'paid',true,'evt_fixture_test',repeat('c',64));
 if public.knowledge_shelf_key_content_v1(v_slug,repeat('c',64))->>'status'<>'forbidden' then raise exception 'test_opened_live_content'; end if;
 if public.masa_shelf_key_claim_v1(v_owner,'cs_test_'||v_suffix)->>'status'<>'payment_pending' then raise exception 'test_claimed_live_key'; end if;
 perform public.masa_shelf_payment_revoke_v1(v_owner,v_payment,'refunded','evt_fixture_refund',false);
 if public.knowledge_shelf_key_content_v1(v_slug,v_hash)->>'status'<>'forbidden' then raise exception 'refund_did_not_revoke'; end if;
 v_result:=public.masa_shelf_payment_record_v1(v_owner,v_session,v_payment,v_slug,'fixture-'||v_suffix||'@example.invalid',1980,'paid',false,'evt_fixture_paid_after_refund',v_hash);
 if v_result->>'status'<>'revoked' then raise exception 'replay_restored_refunded_purchase'; end if;
 if public.knowledge_shelf_key_content_v1(v_slug,v_hash)->>'status'<>'forbidden' then raise exception 'refunded_content_returned'; end if;
 if has_table_privilege('anon','public.knowledge_shelf_protected_assets','SELECT') then raise exception 'anon_direct_body_access'; end if;
 if has_table_privilege('authenticated','public.knowledge_shelf_protected_assets','SELECT') then raise exception 'authenticated_direct_body_access'; end if;
end;
$$;
rollback;
select 'PASS: owner, version, amount, paid-only, wrong-key, wrong-product, replay, test isolation, refund and direct-table denial; fixtures rolled back' as receipt;
