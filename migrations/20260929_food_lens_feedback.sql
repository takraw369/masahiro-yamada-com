create table if not exists public.food_product_feedback (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null unique check (char_length(client_event_id) between 8 and 120),
  product_key text not null check (char_length(product_key) between 1 and 200),
  product_name text check (product_name is null or char_length(product_name) <= 240),
  sentiment smallint not null check (sentiment between 1 and 5),
  would_buy_again boolean,
  body_note text check (body_note is null or char_length(body_note) <= 500),
  comment text check (comment is null or char_length(comment) <= 1200),
  share_public boolean not null default false,
  source_ref text check (source_ref is null or char_length(source_ref) <= 500),
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now()
);

alter table public.food_product_feedback enable row level security;

grant insert on table public.food_product_feedback to anon, authenticated;
grant select on table public.food_product_feedback to anon, authenticated;

create policy "food feedback submit pending"
on public.food_product_feedback
for insert
to anon, authenticated
with check (status = 'pending');

create policy "food feedback published read"
on public.food_product_feedback
for select
to anon, authenticated
using (status = 'published' and share_public = true);

create or replace function public.submit_food_product_feedback_v1(
  p_client_event_id text,
  p_product_key text,
  p_product_name text default null,
  p_sentiment smallint default 3,
  p_would_buy_again boolean default null,
  p_body_note text default null,
  p_comment text default null,
  p_share_public boolean default false,
  p_source_ref text default '/food-lens'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_client_event_id is null or char_length(trim(p_client_event_id)) < 8 then
    raise exception 'invalid_client_event_id';
  end if;
  if p_product_key is null or char_length(trim(p_product_key)) < 1 then
    raise exception 'product_key_required';
  end if;
  if p_sentiment < 1 or p_sentiment > 5 then
    raise exception 'invalid_sentiment';
  end if;

  insert into public.food_product_feedback (
    client_event_id, product_key, product_name, sentiment, would_buy_again,
    body_note, comment, share_public, source_ref, status
  ) values (
    left(trim(p_client_event_id),120), left(trim(p_product_key),200), nullif(left(trim(coalesce(p_product_name,'')),240),''),
    p_sentiment, p_would_buy_again, nullif(left(trim(coalesce(p_body_note,'')),500),''),
    nullif(left(trim(coalesce(p_comment,'')),1200),''), coalesce(p_share_public,false),
    nullif(left(trim(coalesce(p_source_ref,'')),500),''), 'pending'
  )
  on conflict (client_event_id) do update set client_event_id = excluded.client_event_id
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_food_product_feedback_v1(text,text,text,smallint,boolean,text,text,boolean,text) from public;
grant execute on function public.submit_food_product_feedback_v1(text,text,text,smallint,boolean,text,text,boolean,text) to anon, authenticated;

create index if not exists food_product_feedback_product_key_created_idx
on public.food_product_feedback (product_key, created_at desc);