create or replace function public.is_dashboard_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'admin'
    );
$$;

revoke all on function public.is_dashboard_admin() from public, anon;
grant execute on function public.is_dashboard_admin() to authenticated;

create or replace function public.reset_dashboard_login_password(p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth, extensions
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'dashboard_admin_required';
  end if;

  if p_new_password is null or char_length(p_new_password) < 12 then
    raise exception 'dashboard_password_too_short';
  end if;

  if char_length(p_new_password) > 128 then
    raise exception 'dashboard_password_too_long';
  end if;

  insert into private.dashboard_login_credentials (id, password_hash, updated_at)
  values (true, crypt(p_new_password, gen_salt('bf', 12)), now())
  on conflict (id) do update
    set password_hash = excluded.password_hash,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.reset_dashboard_login_password(text) from public, anon;
grant execute on function public.reset_dashboard_login_password(text) to authenticated;
