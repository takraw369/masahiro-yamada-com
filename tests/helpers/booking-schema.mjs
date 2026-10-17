// Relevant production columns/constraints observed read-only on 2026-10-17.
// Disposable fixtures omit production entitlement triggers; staging must test them.
export const bookingSchema = `
create table contacts(id uuid primary key, line_user_id text unique, consent_at timestamptz);
create table person_identities(person_id uuid references contacts,channel text,external_user_id text,unique(channel,external_user_id));
create table offers(id uuid primary key,slug text not null unique,status text not null,price_jpy integer not null);
create table purchases(id uuid primary key default gen_random_uuid(),contact_id uuid not null references contacts,offer_id uuid not null references offers,provider text,external_payment_id text unique,amount_jpy integer not null check(amount_jpy>=0),status text not null check(status in ('pending','paid','refunded','failed','cancelled')),purchased_at timestamptz,metadata jsonb not null default '{}');
create table funnel_events(contact_id uuid references contacts,event_type text not null,channel text,offer_id uuid references offers,payload jsonb not null default '{}');
`;
