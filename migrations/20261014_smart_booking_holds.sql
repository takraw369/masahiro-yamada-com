-- Booking OS: server-only reservations, intentionally NOT applied automatically.
-- All clients denied; server Worker must use a secret service key kept in Worker Secrets.
-- No existing offers/purchases/calendar tables are modified.
create extension if not exists btree_gist with schema extensions;

create table if not exists public.ace_booking_holds (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  resource_key text not null default 'masa',
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode text not null check (mode in ('online','in_person','premium')),
  location_id text not null,
  client_area text not null,
  state text not null default 'held' check (state in
    ('held','checkout_started','paid','confirmed','needs_review','expired','canceled','refund_required')),
  expires_at timestamptz not null default (now() + interval '35 minutes'),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  calendar_event_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_booking_time_valid check (end_at = start_at + interval '90 minutes'),
  constraint ace_booking_resource_valid check (resource_key = 'masa'),
  constraint ace_booking_no_overlap exclude using gist (
    resource_key with =,
    tstzrange(start_at - interval '20 minutes', end_at + interval '20 minutes', '[)') with &&
  ) where (state in ('held','checkout_started','paid','confirmed','needs_review','refund_required'))
);

alter table public.ace_booking_holds enable row level security;
revoke all on public.ace_booking_holds from public, anon, authenticated;
grant select, insert, update on public.ace_booking_holds to service_role;

-- Expiry is processed inside the same transaction as the next claimant.
-- A booked time cannot be reused during checkout or unresolved paid/confirmed states.
create or replace function public.ace_booking_hold_create_v1(
  p_request_key uuid, p_start_at timestamptz, p_end_at timestamptz,
  p_mode text, p_location_id text, p_client_area text
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare found_row public.ace_booking_holds%rowtype;
begin
  if p_request_key is null or p_start_at is null or p_end_at is null
    or p_mode not in ('online','in_person','premium')
    or p_location_id is null or length(p_location_id) > 100 or length(p_location_id) < 2
    or p_client_area is null or length(p_client_area) > 100 or length(p_client_area) < 2
    or p_start_at < now() + interval '24 hours'
    or p_start_at > now() + interval '14 days'
    or p_end_at <> p_start_at + interval '90 minutes'
  then raise exception 'booking_invalid_request'; end if;

  select * into found_row from public.ace_booking_holds where request_key = p_request_key;
  if found then
    if found_row.start_at <> p_start_at or found_row.end_at <> p_end_at
       or found_row.mode <> p_mode or found_row.location_id <> p_location_id
       or found_row.client_area <> p_client_area
      then raise exception 'booking_idempotency_collision'; end if;
    return jsonb_build_object('id',found_row.id, 'state',found_row.state, 'expires_at',found_row.expires_at);
  end if;

  -- Expire only genuinely unpaid holds. Mark paid/review bookings non-reusable.
  update public.ace_booking_holds
     set state='expired',updated_at=now()
   where state in ('held','checkout_started') and expires_at < now()
     and stripe_payment_intent_id is null;

  insert into public.ace_booking_holds
    (request_key,start_at,end_at,mode,location_id,client_area)
    values (p_request_key,p_start_at,p_end_at,p_mode,p_location_id,p_client_area)
    returning * into found_row;
  return jsonb_build_object('id',found_row.id, 'state',found_row.state, 'expires_at',found_row.expires_at);
exception
  when exclusion_violation then
    return jsonb_build_object('error','slot_conflict');
  when unique_violation then
    return jsonb_build_object('error','idempotency_conflict');
end $$;

create or replace function public.ace_booking_attach_checkout_v1(p_booking_id uuid, p_stripe_session_id text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row public.ace_booking_holds%rowtype;
begin
  if length(coalesce(p_stripe_session_id,'')) < 5 then raise exception 'invalid_session'; end if;
  select * into row from public.ace_booking_holds where id=p_booking_id for update;
  if not found then return jsonb_build_object('error','not_found'); end if;
  if row.stripe_session_id = p_stripe_session_id then return jsonb_build_object('id',row.id,'state',row.state); end if;
  if row.state <> 'held' or row.expires_at <= now() or row.stripe_session_id is not null
    then return jsonb_build_object('error','hold_not_active'); end if;
  update public.ace_booking_holds set state='checkout_started',stripe_session_id=p_stripe_session_id,updated_at=now()
    where id=p_booking_id;
  return jsonb_build_object('id',row.id,'state','checkout_started');
end $$;

create or replace function public.ace_booking_paid_v1(
  p_booking_id uuid, p_stripe_session_id text, p_payment_intent_id text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row public.ace_booking_holds%rowtype;
begin
  select * into row from public.ace_booking_holds where id=p_booking_id for update;
  if not found or row.stripe_session_id is distinct from p_stripe_session_id
    or length(coalesce(p_payment_intent_id,'')) < 5
  then return jsonb_build_object('error','invalid_payment_reference'); end if;
  if row.stripe_payment_intent_id is not null and row.stripe_payment_intent_id <> p_payment_intent_id
    then return jsonb_build_object('error','payment_id_mismatch'); end if;
  if row.state in ('confirmed','paid','needs_review','refund_required')
    then return jsonb_build_object('id',row.id,'state',row.state); end if;
  if row.state not in ('held','checkout_started') then
    -- Money arrived after the reservation was released. Keep evidence and
    -- block overlapping re-sales until human refund/repair review completes.
    update public.ace_booking_holds
       set state='refund_required',stripe_payment_intent_id=p_payment_intent_id,
           failure_reason='payment_for_expired_hold',updated_at=now() where id=p_booking_id;
    return jsonb_build_object('id',row.id,'state','refund_required');
  end if;
  update public.ace_booking_holds set state='paid',stripe_payment_intent_id=p_payment_intent_id,updated_at=now()
    where id=p_booking_id;
  return jsonb_build_object('id',row.id,'state','paid');
end $$;

create or replace function public.ace_booking_confirm_v1(p_booking_id uuid, p_calendar_event_id text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row public.ace_booking_holds%rowtype;
begin
  select * into row from public.ace_booking_holds where id=p_booking_id for update;
  if not found or row.stripe_payment_intent_id is null or length(coalesce(p_calendar_event_id,'')) < 5
    then return jsonb_build_object('error','not_paid'); end if;
  if row.state='confirmed' and row.calendar_event_id=p_calendar_event_id
    then return jsonb_build_object('id',row.id,'state','confirmed'); end if;
  if row.state not in ('paid','needs_review') then return jsonb_build_object('error','invalid_state'); end if;
  update public.ace_booking_holds
     set state='confirmed',calendar_event_id=p_calendar_event_id,updated_at=now() where id=p_booking_id;
  return jsonb_build_object('id',row.id,'state','confirmed');
end $$;

create or replace function public.ace_booking_review_v1(p_booking_id uuid, p_reason text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare row public.ace_booking_holds%rowtype;
begin
  select * into row from public.ace_booking_holds where id=p_booking_id for update;
  if not found then return jsonb_build_object('error','not_found'); end if;
  if row.state='confirmed' then return jsonb_build_object('id',row.id,'state','confirmed'); end if;
  if row.stripe_payment_intent_id is null then return jsonb_build_object('error','no_payment'); end if;
  update public.ace_booking_holds set state='needs_review',
    failure_reason=left(coalesce(p_reason,'unknown'),100),updated_at=now() where id=p_booking_id;
  return jsonb_build_object('id',row.id,'state','needs_review');
end $$;

revoke all on function public.ace_booking_hold_create_v1(uuid,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
revoke all on function public.ace_booking_attach_checkout_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.ace_booking_paid_v1(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ace_booking_confirm_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.ace_booking_review_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.ace_booking_hold_create_v1(uuid,timestamptz,timestamptz,text,text,text) to service_role;
grant execute on function public.ace_booking_attach_checkout_v1(uuid,text) to service_role;
grant execute on function public.ace_booking_paid_v1(uuid,text,text) to service_role;
grant execute on function public.ace_booking_confirm_v1(uuid,text) to service_role;
grant execute on function public.ace_booking_review_v1(uuid,text) to service_role;
