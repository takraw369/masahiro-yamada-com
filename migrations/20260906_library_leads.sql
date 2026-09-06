-- MASA Library preview / launch leads v1

create table if not exists public.library_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  product_slug text not null,
  source text not null default 'website',
  path text,
  status text not null default 'waiting' check (status in ('waiting','notified','converted','unsubscribed')),
  metadata jsonb not null default '{}'::jsonb,
  unique(email, product_slug)
);

alter table public.library_leads enable row level security;
revoke all on table public.library_leads from anon, authenticated;

create or replace function public.submit_library_lead_v1(
  p_email text,
  p_product_slug text,
  p_source text default 'website',
  p_path text default '/library',
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_product_slug text := lower(trim(coalesce(p_product_slug, '')));
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return null;
  end if;

  if char_length(v_email) < 5 or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  if char_length(v_product_slug) < 2 or char_length(v_product_slug) > 80 or v_product_slug !~ '^[a-z0-9-]+$' then
    raise exception 'invalid_product_slug';
  end if;

  insert into public.library_leads(email, product_slug, source, path)
  values (
    v_email,
    v_product_slug,
    left(coalesce(nullif(trim(p_source), ''), 'website'), 80),
    left(coalesce(nullif(trim(p_path), ''), '/library'), 300)
  )
  on conflict (email, product_slug)
  do update set
    updated_at = now(),
    source = excluded.source,
    path = excluded.path,
    status = case
      when public.library_leads.status = 'unsubscribed' then public.library_leads.status
      else 'waiting'
    end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_library_lead_v1(text,text,text,text,text) from public;
grant execute on function public.submit_library_lead_v1(text,text,text,text,text) to anon, authenticated;
