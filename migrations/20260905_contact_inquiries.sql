-- Contact inquiries v1
-- Applied to Supabase project: sunlovesflow-core

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('service','payment','technical','business','privacy','other')),
  name text,
  email text not null,
  message text not null,
  source text not null default 'website',
  path text,
  status text not null default 'new' check (status in ('new','in_progress','resolved','spam')),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.contact_inquiries enable row level security;
revoke all on table public.contact_inquiries from anon, authenticated;

create or replace function public.submit_contact_inquiry_v1(
  p_category text,
  p_name text,
  p_email text,
  p_message text,
  p_source text default 'website',
  p_path text default '/contact',
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_category text := lower(trim(coalesce(p_category, '')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_message text := trim(coalesce(p_message, ''));
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return null;
  end if;

  if v_category not in ('service','payment','technical','business','privacy','other') then
    raise exception 'invalid_category';
  end if;
  if v_name is not null and char_length(v_name) > 100 then
    raise exception 'name_too_long';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 5000 then
    raise exception 'invalid_message_length';
  end if;

  insert into public.contact_inquiries(category, name, email, message, source, path)
  values (
    v_category,
    v_name,
    v_email,
    v_message,
    left(coalesce(nullif(trim(p_source), ''), 'website'), 80),
    left(coalesce(nullif(trim(p_path), ''), '/contact'), 300)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_contact_inquiry_v1(text,text,text,text,text,text,text) from public;
grant execute on function public.submit_contact_inquiry_v1(text,text,text,text,text,text,text) to anon, authenticated;
