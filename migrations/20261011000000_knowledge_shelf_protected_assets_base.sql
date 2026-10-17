-- Base table required by the already-merged purchase-key migration
-- 20261011224318_knowledge_shelf_purchase_keys.sql.
-- Source recovered from the non-merged PR #292 / applied Supabase migration
-- knowledge_shelf_private_entitlement_gate_v1 (2026-10-11).
-- Keep this private store independent of any buyer authentication method.
-- This is idempotent and does not publish content, offer subscriptions or keys.
create table if not exists public.knowledge_shelf_protected_assets (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 1 and 200),
  access_level text not null check (access_level in ('one-time', 'member', 'pro')),
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'live', 'archived')),
  body_markdown text not null default '',
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_shelf_protected_assets enable row level security;
revoke all on public.knowledge_shelf_protected_assets from public, anon, authenticated;
-- Intentionally no client SELECT policy: paid bodies are read only through
-- the payment-key RPC with verified purchases.
comment on table public.knowledge_shelf_protected_assets is
  'Private Knowledge Shelf manuscripts; source of truth is Drive. New rows default to draft, and browser direct reads remain denied.';
