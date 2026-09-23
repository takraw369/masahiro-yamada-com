-- RLS-without-policy tables are intentionally API-closed.
-- Production-equivalent migration applied to sunlovesflow-core on 2026-09-23.
-- These tables already return no rows to anon/authenticated. Removing table
-- privileges adds defense in depth and ensures a future policy cannot expose
-- a table until the same migration also grants the required privileges.

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policy p where p.polrelid = c.oid
      )
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated',
      r.schema_name,
      r.table_name
    );
  end loop;
end
$$;
