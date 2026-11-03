update public.listings l
set status = 'removed'
where l.status = 'sold'
  and exists (
    select 1 from public.orders o
    where o.listing_id = l.id and o.delivered_at is not null
  );

update public.listings l
set status = 'active', sold_at = null
where l.status = 'sold'
  and exists (
    select 1 from public.orders o
    where o.listing_id = l.id and o.status in ('terms_pending', 'awaiting_payment')
  )
  and not exists (
    select 1 from public.orders o
    where o.listing_id = l.id and o.status in ('paid', 'dispatched', 'delivered', 'disputed', 'completed')
  );

update public.listings l
set status = case when l.expires_at > now() then 'active'::public.listing_status else 'expired'::public.listing_status end,
    sold_at = null
where l.status = 'sold'
  and exists (select 1 from public.orders o where o.listing_id = l.id and o.status = 'cancelled')
  and not exists (
    select 1 from public.orders o
    where o.listing_id = l.id and o.status in ('terms_pending', 'awaiting_payment', 'paid', 'dispatched', 'delivered', 'disputed', 'completed')
  );

create or replace function public.expire_old_listings()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  with expired as (
    update public.listings l set status = 'expired'
    where l.status = 'active' and l.expires_at <= now()
      and not exists (
        select 1 from public.orders o
        where o.listing_id = l.id and o.status in ('terms_pending', 'awaiting_payment')
      )
    returning l.id, l.seller_id, l.title
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
  insert into public.conversations (offer_id, listing_id, listing_title_snapshot, buyer_id, seller_id)
  values (offer_id, l.id, l.title, p_actor_id, l.seller_id) returning id into c_id;
  insert into public.orders (conversation_id, offer_id, listing_id, item_title, buyer_id, seller_id, amount_ngn, buyer_fee_ngn, seller_fee_ngn, buyer_total_ngn, seller_payout_ngn)
  values (c_id, offer_id, l.id, l.title, p_actor_id, l.seller_id, l.price_ngn, ceil(l.price_ngn * 0.02)::integer, ceil(l.price_ngn * 0.05)::integer, l.price_ngn + ceil(l.price_ngn * 0.02)::integer, l.price_ngn - ceil(l.price_ngn * 0.05)::integer);
  return c_id;
end;
$$;

create or replace function public.accept_order_terms(p_order_id uuid, p_actor_id uuid)
returns public.order_status language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype; l public.listings%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or p_actor_id not in (o.buyer_id, o.seller_id) then raise exception 'Order not found'; end if;
  if o.status <> 'terms_pending' then raise exception 'Terms are no longer awaiting acceptance'; end if;
  select * into l from public.listings where id = o.listing_id for update;
  if not found or l.status <> 'active' then raise exception 'This item is sold out or no longer available'; end if;
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
  if o.status not in ('terms_pending', 'awaiting_payment') then raise exception 'Payment is confirmed or this order can no longer be cancelled. Contact D_clutr support for help.'; end if;
  update public.orders set status = 'cancelled' where id = o.id;
  update public.offers set status = 'withdrawn', responded_at = now() where id = o.offer_id;
  update public.listings l
  set status = case when l.expires_at > now() then 'active'::public.listing_status else 'expired'::public.listing_status end,
      sold_at = null
  where l.id = o.listing_id and l.status = 'sold'
    and not exists (
      select 1 from public.orders other_order
      where other_order.listing_id = l.id and other_order.id <> o.id
        and other_order.status in ('paid', 'dispatched', 'delivered', 'disputed', 'completed')
    );
end;
$$;

create or replace function public.confirm_marketplace_payment(p_order_id uuid, p_paystack_reference text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype; l public.listings%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.paystack_reference is distinct from p_paystack_reference then return jsonb_build_object('result', 'not_found'); end if;
  if o.status in ('paid', 'dispatched', 'delivered', 'disputed', 'completed') then return jsonb_build_object('result', 'already_paid'); end if;
  if o.status = 'cancelled' then return jsonb_build_object('result', 'cancelled'); end if;
  if o.status <> 'awaiting_payment' then return jsonb_build_object('result', 'unavailable'); end if;
  if o.listing_id is null then
    update public.orders set status = 'cancelled' where id = o.id;
    update public.offers set status = 'withdrawn', responded_at = now() where id = o.offer_id;
    return jsonb_build_object('result', 'sold_out');
  end if;
  select * into l from public.listings where id = o.listing_id for update;
  if not found or l.status <> 'active' then
    update public.orders set status = 'cancelled' where id = o.id;
    update public.offers set status = 'withdrawn', responded_at = now() where id = o.offer_id;
    return jsonb_build_object('result', 'sold_out');
  end if;
  update public.orders set status = 'paid', paid_at = now() where id = o.id;
  update public.listings set status = 'sold', sold_at = now() where id = l.id;
  return jsonb_build_object('result', 'confirmed');
end;
$$;

create or replace function public.ensure_active_listing_for_offer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare listing_state public.listing_status;
begin
  select status into listing_state from public.listings where id = new.listing_id for update;
  if not found or listing_state <> 'active' then raise exception 'This item has sold out or is no longer available'; end if;
  return new;
end;
$$;

drop trigger if exists offers_require_active_listing on public.offers;
create trigger offers_require_active_listing before insert on public.offers
for each row execute function public.ensure_active_listing_for_offer();

revoke execute on function public.confirm_marketplace_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_marketplace_payment(uuid, text) to service_role;
revoke execute on function public.ensure_active_listing_for_offer() from public, anon, authenticated;
grant execute on function public.ensure_active_listing_for_offer() to service_role;

drop policy if exists "Active listings are public; sellers/admins see own" on public.listings;
create policy "Active and sold listings are public; sellers/admins see own" on public.listings for select to anon, authenticated
using ((status = 'active' and expires_at > now()) or status = 'sold' or seller_id = auth.uid() or public.is_admin());