-- Booking OS: server-only reservations, intentionally NOT applied automatically.
-- All clients denied; server Worker must use a secret service key kept in Worker Secrets.
-- Requires existing contacts, person_identities, offers, purchases and funnel_events.
-- Existing table schemas are preserved; verified paid bookings write canonical purchases.
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
    tsrange((start_at at time zone 'UTC') - interval '20 minutes',
            (end_at at time zone 'UTC') + interval '20 minutes', '[)') with &&
  ) where (state in ('held','checkout_started','paid','confirmed','needs_review'))
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
  if row.state not in ('held','checkout_started') or row.expires_at <= now() then
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

-- This migration remains unlaunched. These columns are nullable solely for old,
-- unverified holds; those holds cannot pass the new purchase reconciliation RPC.
alter table public.ace_booking_holds
  add column if not exists contact_id uuid references public.contacts(id),
  add column if not exists offer_id uuid references public.offers(id),
  add column if not exists identity_verified_at timestamptz,
  add column if not exists purchase_id uuid references public.purchases(id);
create unique index if not exists ace_booking_payment_intent_unique
  on public.ace_booking_holds(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create or replace function public.ace_booking_identity_immutable_v1()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if old.identity_verified_at is not null and
    (new.contact_id,new.offer_id,new.identity_verified_at) is distinct from
    (old.contact_id,old.offer_id,old.identity_verified_at)
    then raise exception 'booking_identity_immutable'; end if;
  return new;
end $$;
drop trigger if exists ace_booking_identity_immutable on public.ace_booking_holds;
create trigger ace_booking_identity_immutable before update on public.ace_booking_holds
  for each row execute function public.ace_booking_identity_immutable_v1();
revoke all on function public.ace_booking_identity_immutable_v1() from public,anon,authenticated;
grant execute on function public.ace_booking_identity_immutable_v1() to service_role;

-- Only the server may supply p_line_subject, after LINE verifies the ID token.
-- Check both existing identity sources; conflicting mappings are never guessed.
create or replace function public.ace_booking_hold_verified_v1(
  p_request_key uuid, p_start_at timestamptz, p_end_at timestamptz,
  p_mode text, p_location_id text, p_client_area text, p_line_subject text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare ids uuid[]; customer public.contacts%rowtype; offer public.offers%rowtype;
  result jsonb; hold public.ace_booking_holds%rowtype;
begin
  if p_line_subject is null or p_line_subject !~ '^U[0-9a-fA-F]{32}$'
    then raise exception 'booking_identity_required'; end if;
  select array_agg(distinct id) into ids from (
    select id from public.contacts where line_user_id=p_line_subject
    union select person_id from public.person_identities
      where channel='line' and external_user_id=p_line_subject
  ) matches;
  if coalesce(cardinality(ids),0) <> 1 then raise exception 'booking_identity_ambiguous'; end if;
  select * into customer from public.contacts where id=ids[1] for share;
  if not found or (customer.line_user_id is not null and customer.line_user_id <> p_line_subject)
    or customer.consent_at is null then raise exception 'booking_identity_not_consented'; end if;
  select * into strict offer from public.offers where slug='winning_os_90' for share;
  if offer.status <> 'active' or offer.price_jpy <> 19800
    then raise exception 'booking_offer_unavailable'; end if;
  result := public.ace_booking_hold_create_v1(p_request_key,p_start_at,p_end_at,p_mode,p_location_id,p_client_area);
  if result ? 'error' then return result; end if;
  select * into hold from public.ace_booking_holds where id=(result->>'id')::uuid for update;
  if hold.contact_id is not null then
    if hold.contact_id <> customer.id or hold.offer_id is distinct from offer.id
      then raise exception 'booking_identity_collision'; end if;
  elsif hold.state <> 'held' or hold.stripe_session_id is not null then
    raise exception 'booking_identity_too_late';
  else
    update public.ace_booking_holds set contact_id=customer.id,offer_id=offer.id,
      identity_verified_at=now(),updated_at=now() where id=hold.id;
  end if;
  return result || jsonb_build_object('identityBound',true);
end $$;

-- A signature-verified live paid event is the only caller. No email/Stripe
-- metadata contact ID is accepted. Insert and hold transition commit together.
create or replace function public.ace_booking_purchase_v1(
  p_booking_id uuid, p_stripe_session_id text, p_request_key uuid,
  p_payment_intent_id text, p_livemode boolean
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare hold public.ace_booking_holds%rowtype; purchase public.purchases%rowtype;
  offer public.offers%rowtype; paid jsonb; inserted boolean;
begin
  if p_livemode is not true or p_payment_intent_id is null
    or p_payment_intent_id !~ '^pi_[a-zA-Z0-9_]+$'
    then raise exception 'booking_live_payment_required'; end if;
  select * into hold from public.ace_booking_holds where id=p_booking_id for update;
  if not found or hold.request_key is distinct from p_request_key
    or hold.stripe_session_id is distinct from p_stripe_session_id
    or hold.contact_id is null or hold.offer_id is null or hold.identity_verified_at is null
    or hold.mode <> 'online' or hold.location_id <> 'online-private'
    then raise exception 'booking_purchase_binding_invalid'; end if;
  select * into strict offer from public.offers where id=hold.offer_id;
  -- Preserve historical paid evidence if an offer is later disabled; the fixed
  -- identity/price must still agree with the admitted winning_os_90 booking.
  if offer.slug <> 'winning_os_90' or offer.price_jpy <> 19800
    then raise exception 'booking_purchase_offer_mismatch'; end if;
  paid := public.ace_booking_paid_v1(hold.id,p_stripe_session_id,p_payment_intent_id);
  if paid ? 'error' then raise exception 'booking_purchase_payment_mismatch'; end if;
  insert into public.purchases(contact_id,offer_id,provider,external_payment_id,amount_jpy,status,purchased_at,metadata)
    values(hold.contact_id,hold.offer_id,'stripe',p_payment_intent_id,19800,'paid',now(),
      jsonb_build_object('booking_flow','smart_booking_v1','booking_id',hold.id,
        'stripe_session_id',p_stripe_session_id,'livemode',true))
    on conflict(external_payment_id) do nothing returning * into purchase;
  inserted := found;
  if not inserted then
    select * into strict purchase from public.purchases where external_payment_id=p_payment_intent_id for update;
  end if;
  if purchase.contact_id <> hold.contact_id or purchase.offer_id <> hold.offer_id
    or purchase.provider is distinct from 'stripe' or purchase.amount_jpy <> 19800
    or purchase.status <> 'paid' or purchase.metadata->>'booking_flow' is distinct from 'smart_booking_v1'
    or purchase.metadata->>'booking_id' is distinct from hold.id::text
    or purchase.metadata->>'stripe_session_id' is distinct from p_stripe_session_id
    or (hold.purchase_id is not null and hold.purchase_id <> purchase.id)
    then raise exception 'booking_purchase_collision_or_review'; end if;
  if inserted then
    insert into public.funnel_events(contact_id,event_type,channel,offer_id,payload)
      values(hold.contact_id,'booking_payment_received','web',hold.offer_id,
        jsonb_build_object('booking_id',hold.id,'purchase_id',purchase.id,'payment_intent_id',p_payment_intent_id));
  end if;
  update public.ace_booking_holds set purchase_id=purchase.id where id=hold.id;
  return paid || jsonb_build_object('purchaseId',purchase.id);
end $$;

revoke all on function public.ace_booking_hold_verified_v1(uuid,timestamptz,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ace_booking_purchase_v1(uuid,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ace_booking_hold_verified_v1(uuid,timestamptz,timestamptz,text,text,text,text) to service_role;
grant execute on function public.ace_booking_purchase_v1(uuid,text,uuid,text,boolean) to service_role;
