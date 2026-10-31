-- D_clutr FUTA marketplace initial schema.
-- Run in Supabase SQL editor. Service role keys must never be exposed to the browser.
create extension if not exists pgcrypto;

create type public.profile_role as enum ('student', 'admin');
create type public.verification_status as enum ('not_submitted', 'pending', 'approved', 'rejected');
create type public.listing_status as enum ('active', 'sold', 'expired', 'removed');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'expired');
create type public.order_status as enum ('terms_pending', 'awaiting_payment', 'paid', 'dispatched', 'delivered', 'disputed', 'completed', 'cancelled');
create type public.dispute_status as enum ('open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  role public.profile_role not null default 'student',
  verification_status public.verification_status not null default 'not_submitted',
  created_at timestamptz not null default now()
);

-- D_clutr-managed credentials; passwords are one-way scrypt hashes, never plaintext.
create table public.app_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null,
  session_version integer not null default 0,
  password_reset_hash text,
  password_reset_expires_at timestamptz,
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index profiles_email_unique on public.profiles(lower(email));

create or replace function public.create_dclutr_account(p_user_id uuid, p_display_name text, p_email text, p_password_hash text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if char_length(p_display_name) not between 2 and 80 or char_length(p_password_hash) > 250 then raise exception 'Invalid account details'; end if;
  insert into public.profiles (id, display_name, email) values (p_user_id, p_display_name, lower(p_email));
  insert into public.app_accounts (user_id, password_hash) values (p_user_id, p_password_hash);
  return p_user_id;
end;
$$;

create table public.auth_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null default 0
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  recipient text not null,
  subject text not null,
  body_text text not null,
  body_encrypted boolean not null default true,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_queued_idx on public.email_outbox(created_at) where status = 'queued';

create table public.seller_payout_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  encrypted_details text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 4 and 100),
  description text not null check (char_length(description) between 10 and 3000),
  category text not null,
  condition text not null check (condition in ('Like New', 'Good Condition', 'Fairly Used', 'Used')),
  price_ngn integer not null check (price_ngn > 0),
  negotiable boolean not null default false,
  meetup_area text not null,
  photo_paths text[] not null default '{}',
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  sold_at timestamptz
);
create index listings_active_expires_idx on public.listings(status, expires_at) where status = 'active';
create index listings_seller_created_idx on public.listings(seller_id, created_at desc);

create table public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id_path text not null,
  selfie_path text not null,
  status public.verification_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index verification_pending_idx on public.verification_submissions(status, submitted_at desc);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  listing_title_snapshot text not null,
  listing_seller_id uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  amount_ngn integer not null check (amount_ngn > 0),
  note text check (note is null or char_length(note) <= 500),
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index offers_buyer_idx on public.offers(buyer_id, created_at desc);
create index offers_listing_idx on public.offers(listing_id, status);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers(id) on delete restrict,
  listing_id uuid references public.listings(id) on delete set null,
  listing_title_snapshot text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete restrict,
  offer_id uuid not null unique references public.offers(id) on delete restrict,
  listing_id uuid references public.listings(id) on delete set null,
  item_title text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  amount_ngn integer not null check (amount_ngn > 0),
  buyer_fee_ngn integer not null check (buyer_fee_ngn >= 0),
  seller_fee_ngn integer not null check (seller_fee_ngn >= 0),
  buyer_total_ngn integer not null check (buyer_total_ngn = amount_ngn + buyer_fee_ngn),
  seller_payout_ngn integer not null check (seller_payout_ngn = amount_ngn - seller_fee_ngn and seller_payout_ngn >= 0),
  status public.order_status not null default 'terms_pending',
  buyer_terms_accepted_at timestamptz,
  seller_terms_accepted_at timestamptz,
  paystack_reference text unique,
  paid_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  payout_due_at timestamptz,
  payout_paid_at timestamptz,
  payout_reference text,
  delivery_code_hash text,
  delivery_code_attempts smallint not null default 0 check (delivery_code_attempts between 0 and 5),
  created_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_seller_idx on public.orders(seller_id, created_at desc);
create index orders_payout_idx on public.orders(status, payout_due_at) where status = 'delivered';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index messages_expiry_idx on public.messages(expires_at);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.dispute_status not null default 'open',
  admin_response text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.business_holidays (
  day date primary key,
  label text not null
);

create or replace function public.consume_auth_attempt(p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.auth_rate_limits%rowtype;
begin
  if char_length(p_key_hash) <> 64 then return false; end if;
  insert into public.auth_rate_limits (key_hash, window_started_at, attempts)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update set
    window_started_at = case when public.auth_rate_limits.window_started_at + make_interval(secs => least(greatest(p_window_seconds, 60), 3600)) <= now() then now() else public.auth_rate_limits.window_started_at end,
    attempts = case when public.auth_rate_limits.window_started_at + make_interval(secs => least(greatest(p_window_seconds, 60), 3600)) <= now() then 1 else public.auth_rate_limits.attempts + 1 end
  returning * into current_row;
  return current_row.attempts <= least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.current_profile_role()
returns public.profile_role language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;
create or replace function public.is_verified_student()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select verification_status = 'approved' from public.profiles where id = auth.uid()), false)
$$;

-- Expire unsold listings at seven days and remove them; sellers must create a fresh listing if they want to relist.
create or replace function public.expire_old_listings()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  with expired as (
    update public.listings set status = 'expired'
    where status = 'active' and expires_at <= now()
    returning id, seller_id, title
  ), notices as (
    insert into public.notifications (user_id, kind, title, body)
    select seller_id, 'listing_expired', 'Your D_clutr listing expired', '“' || title || '” expired after seven days and was removed from the marketplace. Create a fresh listing if the item is still available.'
    from expired returning user_id, body
  )
  insert into public.email_outbox (dedupe_key, recipient, subject, body_text, body_encrypted)
  select 'listing-expired:' || e.id::text, p.email, 'Your D_clutr listing expired',
    'Your listing “' || e.title || '” expired after seven days and was removed from the marketplace. Create a fresh listing if the item is still available.', false
  from expired e join public.profiles p on p.id = e.seller_id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.delete_expired_messages()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  delete from public.messages where expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.cleanup_security_outbox()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.auth_rate_limits where window_started_at < now() - interval '1 day';
  delete from public.email_outbox where (status = 'sent' and sent_at < now() - interval '90 days') or (status = 'failed' and created_at < now() - interval '90 days');
end;
$$;

-- Schedule hourly expiry with Supabase pg_cron, if enabled for the project.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('dclutr-expire-listings', '0 * * * *', 'select public.expire_old_listings()');
  perform cron.schedule('dclutr-delete-chat-30d', '15 2 * * *', 'select public.delete_expired_messages()');
  perform cron.schedule('dclutr-cleanup-security', '30 2 * * *', 'select public.cleanup_security_outbox()');
exception when others then
  raise notice 'Enable pg_cron and schedule public.expire_old_listings() hourly if unavailable here: %', sqlerrm;
end $$;

-- Offer acceptance atomically starts the conversation and terms/order workflow.
create or replace function public.accept_offer(p_offer_id uuid, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.offers%rowtype; l public.listings%rowtype; c_id uuid;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.status <> 'pending' then raise exception 'Offer is not available'; end if;
  select * into l from public.listings where id = o.listing_id for update;
  if l.seller_id <> p_actor_id then raise exception 'Only the listing seller can accept this offer'; end if;
  if l.status <> 'active' or l.expires_at <= now() then raise exception 'Listing is no longer available'; end if;
  update public.offers set status = 'accepted', responded_at = now() where id = o.id;
  update public.listings set status = 'sold', sold_at = now() where id = l.id;
  insert into public.conversations (offer_id, listing_id, listing_title_snapshot, buyer_id, seller_id)
  values (o.id, l.id, l.title, o.buyer_id, l.seller_id)
  on conflict (listing_id, buyer_id) do update set offer_id = excluded.offer_id
  returning id into c_id;
  insert into public.orders (conversation_id, offer_id, listing_id, item_title, buyer_id, seller_id, amount_ngn, buyer_fee_ngn, seller_fee_ngn, buyer_total_ngn, seller_payout_ngn)
  values (c_id, o.id, l.id, l.title, o.buyer_id, l.seller_id, o.amount_ngn, ceil(o.amount_ngn * 0.02)::integer, ceil(o.amount_ngn * 0.05)::integer, o.amount_ngn + ceil(o.amount_ngn * 0.02)::integer, o.amount_ngn - ceil(o.amount_ngn * 0.05)::integer)
  on conflict (conversation_id) do nothing;
  return c_id;
end;
$$;

create or replace function public.reject_offer(p_offer_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.offers%rowtype;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.status <> 'pending' then raise exception 'Offer is not available'; end if;
  if not exists (select 1 from public.listings l where l.id = o.listing_id and l.seller_id = p_actor_id) then raise exception 'Only the listing seller can reject this offer'; end if;
  update public.offers set status = 'rejected', responded_at = now() where id = o.id;
end;
$$;

create or replace function public.start_fixed_price_purchase(p_listing_id uuid, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.listings%rowtype; offer_id uuid; c_id uuid;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.status <> 'active' or l.expires_at <= now() then raise exception 'Listing is no longer available'; end if;
  if l.negotiable then raise exception 'Send an offer for this negotiable listing'; end if;
  if l.seller_id = p_actor_id then raise exception 'You cannot buy your own listing'; end if;
  insert into public.offers (listing_id, listing_title_snapshot, listing_seller_id, buyer_id, amount_ngn, status, responded_at)
  values (l.id, l.title, l.seller_id, p_actor_id, l.price_ngn, 'accepted', now()) returning id into offer_id;
  update public.listings set status = 'sold', sold_at = now() where id = l.id;
  insert into public.conversations (offer_id, listing_id, listing_title_snapshot, buyer_id, seller_id)
  values (offer_id, l.id, l.title, p_actor_id, l.seller_id) returning id into c_id;
  insert into public.orders (conversation_id, offer_id, listing_id, item_title, buyer_id, seller_id, amount_ngn, buyer_fee_ngn, seller_fee_ngn, buyer_total_ngn, seller_payout_ngn)
  values (c_id, offer_id, l.id, l.title, p_actor_id, l.seller_id, l.price_ngn, ceil(l.price_ngn * 0.02)::integer, ceil(l.price_ngn * 0.05)::integer, l.price_ngn + ceil(l.price_ngn * 0.02)::integer, l.price_ngn - ceil(l.price_ngn * 0.05)::integer);
  return c_id;
end;
$$;

-- Both participants must accept terms before payment can start.
create or replace function public.accept_order_terms(p_order_id uuid, p_actor_id uuid)
returns public.order_status language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or p_actor_id not in (o.buyer_id, o.seller_id) then raise exception 'Order not found'; end if;
  if o.status <> 'terms_pending' then raise exception 'Terms are no longer awaiting acceptance'; end if;
  if p_actor_id = o.buyer_id then update public.orders set buyer_terms_accepted_at = now() where id = o.id;
  else update public.orders set seller_terms_accepted_at = now() where id = o.id;
  end if;
  select * into o from public.orders where id = p_order_id;
  if o.buyer_terms_accepted_at is not null and o.seller_terms_accepted_at is not null then
    update public.orders set status = 'awaiting_payment' where id = o.id returning * into o;
  end if;
  return o.status;
end;
$$;

create or replace function public.cancel_unpaid_order(p_order_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or p_actor_id not in (o.buyer_id, o.seller_id) then raise exception 'Order not found'; end if;
  if o.status not in ('terms_pending', 'awaiting_payment') or o.paystack_reference is not null then raise exception 'This order cannot be cancelled here; contact admin if payment was started'; end if;
  update public.orders set status = 'cancelled' where id = o.id;
  update public.offers set status = 'withdrawn', responded_at = now() where id = o.offer_id;
  update public.listings set status = 'active', sold_at = null where id = o.listing_id and status = 'sold' and expires_at > now();
end;
$$;

create or replace function public.verify_delivery_code(p_order_id uuid, p_code_hash text, p_actor_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.seller_id <> p_actor_id then raise exception 'Order not found'; end if;
  if o.status <> 'dispatched' or o.delivery_code_hash is null then raise exception 'Order is not awaiting delivery confirmation'; end if;
  if o.delivery_code_attempts >= 5 then raise exception 'Too many code attempts. Ask the buyer to generate a new code.'; end if;
  if o.delivery_code_hash = p_code_hash then return true; end if;
  update public.orders set delivery_code_attempts = delivery_code_attempts + 1 where id = o.id;
  return false;
end;
$$;

-- Add one business day for the manual payout due date, skipping weekends and configured holidays.
create or replace function public.next_business_day(p_from timestamptz)
returns timestamptz language plpgsql stable as $$
declare candidate date := (p_from at time zone 'Africa/Lagos')::date; remaining integer := 1;
begin
  while remaining > 0 loop
    candidate := candidate + 1;
    if extract(isodow from candidate) < 6 and not exists (select 1 from public.business_holidays where day = candidate) then
      remaining := remaining - 1;
    end if;
  end loop;
  return (candidate::timestamp + time '17:00') at time zone 'Africa/Lagos';
end;
$$;

-- Only admins can call this after the release time and an out-of-band bank transfer.
create or replace function public.admin_mark_payout_paid(p_order_id uuid, p_reference text, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then raise exception 'Admin access required'; end if;
  update public.orders set status = 'completed', payout_paid_at = now(), payout_reference = p_reference
  where id = p_order_id and status = 'delivered' and payout_due_at <= now() and char_length(p_reference) between 3 and 120;
  if not found then raise exception 'Payout is not due or order is invalid'; end if;
end;
$$;

-- Row-level security: user-facing database access is limited to the owning student/participants.
alter table public.profiles enable row level security;
alter table public.app_accounts enable row level security;
alter table public.auth_rate_limits enable row level security;
alter table public.email_outbox enable row level security;
alter table public.seller_payout_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.verification_submissions enable row level security;
alter table public.offers enable row level security;
alter table public.conversations enable row level security;
alter table public.orders enable row level security;
alter table public.favorites enable row level security;
alter table public.messages enable row level security;
alter table public.disputes enable row level security;
alter table public.notifications enable row level security;
alter table public.business_holidays enable row level security;

revoke all on public.profiles, public.app_accounts, public.auth_rate_limits, public.email_outbox,
  public.seller_payout_profiles, public.listings, public.verification_submissions, public.offers,
  public.conversations, public.orders, public.favorites, public.messages, public.disputes,
  public.notifications, public.business_holidays from anon, authenticated;
grant select on public.profiles, public.listings, public.verification_submissions, public.offers,
  public.conversations, public.orders, public.favorites, public.messages, public.disputes,
  public.notifications, public.business_holidays to authenticated;
grant select on public.listings to anon;
grant update (display_name) on public.profiles to authenticated;
grant insert on public.messages to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Service-key-only routines: Supabase Auth/anon callers must not be able to spoof p_actor_id.
revoke execute on function public.consume_auth_attempt(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_dclutr_account(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.expire_old_listings() from public, anon, authenticated;
revoke execute on function public.delete_expired_messages() from public, anon, authenticated;
revoke execute on function public.cleanup_security_outbox() from public, anon, authenticated;
revoke execute on function public.accept_offer(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.reject_offer(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.start_fixed_price_purchase(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.accept_order_terms(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cancel_unpaid_order(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.verify_delivery_code(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.next_business_day(timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_mark_payout_paid(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.consume_auth_attempt(text, integer, integer) to service_role;
grant execute on function public.create_dclutr_account(uuid, text, text, text) to service_role;
grant execute on function public.expire_old_listings() to service_role;
grant execute on function public.delete_expired_messages() to service_role;
grant execute on function public.cleanup_security_outbox() to service_role;
grant execute on function public.accept_offer(uuid, uuid) to service_role;
grant execute on function public.reject_offer(uuid, uuid) to service_role;
grant execute on function public.start_fixed_price_purchase(uuid, uuid) to service_role;
grant execute on function public.accept_order_terms(uuid, uuid) to service_role;
grant execute on function public.cancel_unpaid_order(uuid, uuid) to service_role;
grant execute on function public.verify_delivery_code(uuid, text, uuid) to service_role;
grant execute on function public.next_business_day(timestamptz) to service_role;
grant execute on function public.admin_mark_payout_paid(uuid, text, uuid) to service_role;

create policy "Students see only their own profile; admins see all" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Users update own display name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Active listings are public; sellers/admins see own" on public.listings for select to anon, authenticated using ((status = 'active' and expires_at > now()) or seller_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.listings from authenticated;
create policy "Admins manage listings" on public.listings for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.verification_submissions from authenticated;
create policy "Users view own verification; admins review all" on public.verification_submissions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Users view involved offers; admins view all" on public.offers for select to authenticated using (buyer_id = auth.uid() or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
revoke insert, update, delete on public.offers from authenticated;
create policy "Participants read conversations" on public.conversations for select to authenticated using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
create policy "Participants read messages" on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)) or public.is_admin());
create policy "Conversation participants send messages" on public.messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "Order participants read orders" on public.orders for select to authenticated using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
create policy "Users manage their own saved listings" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Dispute participants read disputes" on public.disputes for select to authenticated using (opened_by = auth.uid() or exists (select 1 from public.orders o where o.id = order_id and auth.uid() in (o.buyer_id, o.seller_id)) or public.is_admin());
create policy "Order participants open dispute" on public.disputes for insert to authenticated with check (opened_by = auth.uid() and exists (select 1 from public.orders o where o.id = order_id and auth.uid() in (o.buyer_id, o.seller_id) and o.status in ('paid', 'dispatched', 'delivered')));
revoke insert, update, delete on public.disputes from authenticated;
create policy "Users view own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users mark own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Holidays are visible" on public.business_holidays for select to authenticated using (true);

-- Private student ID/selfie documents; only their uploader and admins can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-documents', 'verification-documents', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "Verification uploads are private to owner and admins" on storage.objects for select to authenticated using (bucket_id = 'verification-documents' and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));

-- Product photos are public; uploads are restricted to verified sellers' own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "Public read listing photos" on storage.objects for select to anon, authenticated using (bucket_id = 'listing-images');
