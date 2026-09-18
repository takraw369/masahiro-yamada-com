-- Production reconciliation: ensure the existing X-draft read contract delegates to v2.
-- The first production application of 20260919_intelligence_x_copy_v2.sql landed before
-- this delegation block was added to the repository version.

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
