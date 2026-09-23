-- Supabase security advisor hardening v1.
-- Production-equivalent migration applied to sunlovesflow-core on 2026-09-23.

-- Future functions in public are fail-closed for RPC exposure.
alter default privileges for role postgres in schema public
revoke execute on functions from public, anon, authenticated, service_role;

-- Make the unified OS view obey the caller's RLS context while preserving
-- intended admin visibility for source tables that previously relied on the
-- view owner's privileges.
drop policy if exists "admins read os content items" on public.os_content_items;
create policy "admins read os content items"
on public.os_content_items
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  )
);

drop policy if exists "admins read os wants" on public.os_wants;
create policy "admins read os wants"
on public.os_wants
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  )
);

alter view public.os_unified_items set (security_invoker = true);

-- Admin-only RPCs do not need anonymous execution.
revoke execute on function public.complete_private_os_action(text) from anon;
revoke execute on function public.get_admin_revenue_summary() from anon;

-- Internal maintenance / trigger functions are not API endpoints.
revoke execute on function public.recompute_intellectual_capital_summary() from public, anon, authenticated, service_role;
revoke execute on function public.refresh_intellectual_capital_summary_trigger() from public, anon, authenticated, service_role;
revoke execute on function public.sync_purchase_entitlements_v1() from public, anon, authenticated, service_role;

-- Remove generic PUBLIC execution while preserving intentional explicit role grants.
revoke execute on function public.knowledge_journey_event_add_v1(text,text,text,text,text,text,text,text,text,jsonb) from public;
revoke execute on function public.masa_knowledge_journey_snapshot_v1(text,integer) from public;
revoke execute on function public.private_os_board_set(text,text,text,text,text,date,integer) from public;
revoke execute on function public.submit_library_lead_v2(text,text,text,text,text,text,text,text,text,text) from public;
