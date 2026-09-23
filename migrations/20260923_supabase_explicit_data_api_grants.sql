-- Supabase Data API default-grant hardening.
-- Adopt the 2026-10-30 behavior early so future public tables must opt in explicitly.
-- Existing tables/sequences keep their current grants.

alter default privileges for role postgres in schema public
revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke usage, select on sequences from anon, authenticated, service_role;

-- IMPORTANT FOR FUTURE MIGRATIONS
-- Any public table that must be reachable through supabase-js/PostgREST/GraphQL
-- must include explicit role grants in the same migration, e.g.:
--
-- grant select on table public.example to anon;
-- grant select, insert, update, delete on table public.example to authenticated;
-- grant select, insert, update, delete on table public.example to service_role;
--
-- Keep GRANT, RLS enablement, and policies together as one security decision.
