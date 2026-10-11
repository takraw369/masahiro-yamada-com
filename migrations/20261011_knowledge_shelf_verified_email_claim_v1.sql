-- Buyer identity claim: trusted verified Supabase Auth email only.
-- This function does not grant purchases or entitlements.
create or replace function public.knowledge_shelf_claim_verified_email_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_matches bigint;
  v_contact_id uuid;
  v_linked_uid uuid;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id = v_uid
    and u.email_confirmed_at is not null;

  if v_email is null or v_email = '' then
    return jsonb_build_object('status', 'email_unverified');
  end if;

  select count(*) into v_matches
  from public.contacts c
  where c.email is not null and lower(btrim(c.email)) = v_email;

  if v_matches <> 1 then
    return jsonb_build_object('status', 'unlinked');
  end if;

  select c.id, c.auth_user_id into v_contact_id, v_linked_uid
  from public.contacts c
  where c.email is not null and lower(btrim(c.email)) = v_email
  for update;

  if v_linked_uid is not null and v_linked_uid <> v_uid then
    return jsonb_build_object('status', 'conflict');
  end if;

  if v_linked_uid is null then
    update public.contacts c set auth_user_id = v_uid, updated_at = now()
    where c.id = v_contact_id and c.auth_user_id is null;
  end if;

  return jsonb_build_object('status', 'linked');
end;
$function$;

revoke all on function public.knowledge_shelf_claim_verified_email_v1() from public, anon;
grant execute on function public.knowledge_shelf_claim_verified_email_v1() to authenticated, service_role;

comment on function public.knowledge_shelf_claim_verified_email_v1() is
  'Link an existing unique contact to a Supabase JWT identity only after the Auth account email has been verified. No entitlement grants or new contacts.';
