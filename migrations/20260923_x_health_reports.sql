create table if not exists public.masa_x_health_reports (
  owner_key text not null,
  account_id text not null,
  username text not null default '',
  report_month text not null,
  post_count integer not null default 0,
  post_label_count integer not null default 0,
  account_label_days integer not null default 0,
  legal_restriction_count integer not null default 0,
  labels jsonb not null default '[]'::jsonb,
  raw_report jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_key, account_id, report_month),
  constraint masa_x_health_owner_key_format check (owner_key ~ '^[0-9a-f]{64}$'),
  constraint masa_x_health_account_id_length check (char_length(account_id) between 1 and 180),
  constraint masa_x_health_username_length check (char_length(username) <= 100),
  constraint masa_x_health_report_month_format check (report_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint masa_x_health_post_count_nonnegative check (post_count >= 0),
  constraint masa_x_health_post_label_count_nonnegative check (post_label_count >= 0),
  constraint masa_x_health_account_label_days_nonnegative check (account_label_days >= 0),
  constraint masa_x_health_legal_restriction_count_nonnegative check (legal_restriction_count >= 0),
  constraint masa_x_health_labels_array check (jsonb_typeof(labels) = 'array'),
  constraint masa_x_health_raw_object check (jsonb_typeof(raw_report) = 'object'),
  constraint masa_x_health_labels_size check (octet_length(labels::text) <= 200000),
  constraint masa_x_health_raw_size check (octet_length(raw_report::text) <= 500000)
);

alter table public.masa_x_health_reports enable row level security;
revoke all on table public.masa_x_health_reports from anon, authenticated;
grant all on table public.masa_x_health_reports to service_role;

create index if not exists masa_x_health_reports_owner_month_idx
  on public.masa_x_health_reports(owner_key, report_month desc);

create or replace function public.masa_x_health_reports_get_v1(p_owner_key text)
returns table (
  account_id text,
  username text,
  report_month text,
  post_count integer,
  post_label_count integer,
  account_label_days integer,
  legal_restriction_count integer,
  labels jsonb,
  raw_report jsonb,
  imported_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_key'; end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then raise exception 'invalid_owner_key'; end if;

  return query
  select
    r.account_id,
    r.username,
    r.report_month,
    r.post_count,
    r.post_label_count,
    r.account_label_days,
    r.legal_restriction_count,
    r.labels,
    r.raw_report,
    r.imported_at,
    r.updated_at
  from public.masa_x_health_reports r
  where r.owner_key = p_owner_key
  order by r.report_month desc, r.username asc, r.account_id asc;
end;
$$;

create or replace function public.masa_x_health_report_upsert_v1(
  p_owner_key text,
  p_account_id text,
  p_username text,
  p_report_month text,
  p_post_count integer,
  p_post_label_count integer,
  p_account_label_days integer,
  p_legal_restriction_count integer,
  p_labels jsonb,
  p_raw_report jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_owner_key is null or p_owner_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_owner_key'; end if;
  if not exists (select 1 from private.masa_dashboard_owner_keys k where k.owner_key = p_owner_key) then raise exception 'invalid_owner_key'; end if;
  if p_account_id is null or char_length(btrim(p_account_id)) < 1 or char_length(p_account_id) > 180 then raise exception 'invalid_account_id'; end if;
  if p_username is null or char_length(p_username) > 100 then raise exception 'invalid_username'; end if;
  if p_report_month is null or p_report_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'invalid_report_month'; end if;
  if coalesce(p_post_count, -1) < 0 or coalesce(p_post_label_count, -1) < 0 or coalesce(p_account_label_days, -1) < 0 or coalesce(p_legal_restriction_count, -1) < 0 then raise exception 'invalid_counts'; end if;
  if p_labels is null or jsonb_typeof(p_labels) <> 'array' then raise exception 'invalid_labels'; end if;
  if p_raw_report is null or jsonb_typeof(p_raw_report) <> 'object' then raise exception 'invalid_raw_report'; end if;
  if octet_length(p_labels::text) > 200000 then raise exception 'labels_too_large'; end if;
  if octet_length(p_raw_report::text) > 500000 then raise exception 'raw_report_too_large'; end if;

  insert into public.masa_x_health_reports (
    owner_key,
    account_id,
    username,
    report_month,
    post_count,
    post_label_count,
    account_label_days,
    legal_restriction_count,
    labels,
    raw_report,
    imported_at,
    updated_at
  ) values (
    p_owner_key,
    btrim(p_account_id),
    btrim(p_username),
    p_report_month,
    p_post_count,
    p_post_label_count,
    p_account_label_days,
    p_legal_restriction_count,
    p_labels,
    p_raw_report,
    now(),
    now()
  )
  on conflict (owner_key, account_id, report_month) do update set
    username = excluded.username,
    post_count = excluded.post_count,
    post_label_count = excluded.post_label_count,
    account_label_days = excluded.account_label_days,
    legal_restriction_count = excluded.legal_restriction_count,
    labels = excluded.labels,
    raw_report = excluded.raw_report,
    imported_at = now(),
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.masa_x_health_reports_get_v1(text) from public;
revoke all on function public.masa_x_health_report_upsert_v1(text, text, text, text, integer, integer, integer, integer, jsonb, jsonb) from public;
grant execute on function public.masa_x_health_reports_get_v1(text) to anon, authenticated, service_role;
grant execute on function public.masa_x_health_report_upsert_v1(text, text, text, text, integer, integer, integer, integer, jsonb, jsonb) to anon, authenticated, service_role;
