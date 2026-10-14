-- Disposable synthetic owner and all test writes roll back. Never use MASA's key.
begin;
insert into private.masa_dashboard_owner_keys(owner_key) values(repeat('f',64));
set local role anon;
do $$
declare v_owner text := repeat('f',64); v_snapshot jsonb := '{"version":1,"references":{"version":1,"previewId":"shadcn","favorites":["shadcn"],"notes":{"shadcn":"同期テスト"}},"draft":{"version":2,"style":"orange","layout":"studio","buttons":"soft","cards":"soft","navigation":"chips","cta":"solid"},"favorites":[]}'; v_result jsonb;
begin
  begin perform public.masa_design_state_get_v1(repeat('e',64)); raise exception 'unguarded_get';
    exception when invalid_authorization_specification then null; end;
  begin perform public.masa_design_state_save_v1(repeat('e',64),v_snapshot,0); raise exception 'unguarded_save';
    exception when invalid_authorization_specification then null; end;
  begin perform 1 from private.masa_dashboard_design_state; raise exception 'table_exposed';
    exception when insufficient_privilege then null; end;
  v_result := public.masa_design_state_get_v1(v_owner);
  if v_result->>'revision' <> '0' or v_result->'snapshot' <> 'null'::jsonb then raise exception 'bad_initial_state'; end if;
  begin perform public.masa_design_state_save_v1(v_owner,v_snapshot,5); raise exception 'initial_cas_not_checked';
    exception when serialization_failure then null; end;
  v_result := public.masa_design_state_get_v1(v_owner);
  if v_result->>'revision' <> '0' then raise exception 'rejected_save_changed_state'; end if;
  v_result := public.masa_design_state_save_v1(v_owner,v_snapshot,0);
  if v_result->>'revision' <> '1' or v_result->'snapshot' <> v_snapshot then raise exception 'save_failed'; end if;
  begin perform public.masa_design_state_save_v1(v_owner,v_snapshot,0); raise exception 'stale_save_not_checked';
    exception when serialization_failure then null; end;
  v_result := public.masa_design_state_get_v1(v_owner);
  if v_result->>'revision' <> '1' or v_result->'snapshot' <> v_snapshot then raise exception 'readback_failed'; end if;
  v_result := public.masa_design_state_save_v1(v_owner,v_snapshot,1);
  if v_result->>'revision' <> '2' then raise exception 'second_save_failed'; end if;
  begin perform public.masa_design_state_save_v1(v_owner,'{}'::jsonb,2); raise exception 'invalid_snapshot_accepted';
    exception when invalid_parameter_value then null; end;
end;
$$;
reset role;
select 'PASS: owner authorization, denied table access, round trip, initial/stale CAS, invalid snapshot' as result;
rollback;
