alter table public.conversations
  add column if not exists buyer_offer_attempts smallint not null default 0
  check (buyer_offer_attempts between 0 and 3);

update public.conversations c
set buyer_offer_attempts = least(3, (
  select count(*) from public.offers o
  where o.listing_id = c.listing_id and o.buyer_id = c.buyer_id
))::smallint
where c.buyer_offer_attempts = 0;

create or replace function public.submit_listing_offer(
  p_listing_id uuid,
  p_actor_id uuid,
  p_amount_ngn integer,
  p_note text default null
)
returns table (offer_id uuid, was_updated boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l public.listings%rowtype;
  existing_offer public.offers%rowtype;
  existing_conversation public.conversations%rowtype;
  v_offer_id uuid;
  offer_attempts integer;
  conversation_exists boolean;
begin
  if p_amount_ngn <= 0 or char_length(p_note) > 500 then
    raise exception 'Enter a valid offer amount and a note under 500 characters';
  end if;

  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.status <> 'active' or l.expires_at <= now() then
    raise exception 'This listing is no longer available';
  end if;
  if l.seller_id = p_actor_id then raise exception 'You cannot make an offer on your own listing'; end if;
  if not l.negotiable then raise exception 'The seller has not enabled offers for this item'; end if;
  if p_amount_ngn > l.price_ngn then raise exception 'An offer cannot exceed the asking price'; end if;
  if exists (
    select 1 from public.offers o
    where o.listing_id = p_listing_id and o.buyer_id = p_actor_id and o.status = 'accepted'
      and not exists (select 1 from public.orders ord where ord.offer_id = o.id and ord.status = 'cancelled')
  ) then
    raise exception 'This offer has already been accepted and can no longer be changed';
  end if;

  select * into existing_offer
  from public.offers
  where listing_id = p_listing_id and buyer_id = p_actor_id
  order by created_at desc, id desc
  limit 1
  for update;

  if found and existing_offer.status = 'pending' then
    update public.offers set amount_ngn = p_amount_ngn, note = nullif(btrim(p_note), '') where id = existing_offer.id;
    return query select existing_offer.id, true;
    return;
  end if;

  if found and existing_offer.status = 'withdrawn' and not exists (
    select 1 from public.orders ord
    where ord.offer_id = existing_offer.id and ord.buyer_id = p_actor_id
      and ord.listing_id = p_listing_id and ord.status = 'cancelled'
  ) then
    raise exception 'This offer can no longer be changed';
  end if;
  if found and existing_offer.status not in ('rejected', 'withdrawn') then
    raise exception 'You already made an offer on this item and it can no longer be changed';
  end if;

  select * into existing_conversation
  from public.conversations
  where listing_id = p_listing_id and buyer_id = p_actor_id
  for update;
  conversation_exists := found;
  if conversation_exists then
    offer_attempts := existing_conversation.buyer_offer_attempts;
  else
    select count(*) into offer_attempts
    from public.offers
    where listing_id = p_listing_id and buyer_id = p_actor_id;
  end if;
  if offer_attempts >= 3 then raise exception 'You have used all 3 offer attempts for this item'; end if;

  insert into public.offers (listing_id, listing_title_snapshot, listing_seller_id, buyer_id, amount_ngn, note)
  values (l.id, l.title, l.seller_id, p_actor_id, p_amount_ngn, nullif(btrim(p_note), ''))
  returning id into v_offer_id;

  update public.conversations c
  set offer_id = v_offer_id,
      buyer_offer_attempts = least(3, offer_attempts + 1)
  where c.listing_id = p_listing_id and c.buyer_id = p_actor_id
    and exists (select 1 from public.orders ord where ord.conversation_id = c.id and ord.status = 'cancelled');

  update public.orders ord
  set offer_id = v_offer_id
  where ord.listing_id = p_listing_id and ord.buyer_id = p_actor_id and ord.status = 'cancelled'
    and exists (select 1 from public.conversations c where c.id = ord.conversation_id and c.listing_id = p_listing_id and c.buyer_id = p_actor_id);

  return query select v_offer_id, false;
end;
$$;

create or replace function public.start_fixed_price_purchase(p_listing_id uuid, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l public.listings%rowtype;
  existing_order public.orders%rowtype;
  v_offer_id uuid;
  v_conversation_id uuid;
  conversation_exists boolean;
  order_exists boolean;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then raise exception 'Listing is no longer available'; end if;

  select id into v_conversation_id
  from public.conversations
  where listing_id = p_listing_id and buyer_id = p_actor_id
  for update;
  conversation_exists := found;

  if conversation_exists then
    select * into existing_order from public.orders where conversation_id = v_conversation_id for update;
    order_exists := found;
    if order_exists and existing_order.status <> 'cancelled' then return v_conversation_id; end if;
    if l.status <> 'active' or l.expires_at <= now() then raise exception 'Listing is no longer available'; end if;
    if l.seller_id = p_actor_id then raise exception 'You cannot buy your own listing'; end if;
    if l.negotiable then raise exception 'This listing accepts offers. Send a new offer from this chat.'; end if;

    insert into public.offers (listing_id, listing_title_snapshot, listing_seller_id, buyer_id, amount_ngn, status, responded_at)
    values (l.id, l.title, l.seller_id, p_actor_id, l.price_ngn, 'accepted', now())
    returning id into v_offer_id;
    update public.conversations set offer_id = v_offer_id, listing_title_snapshot = l.title where id = v_conversation_id;

    if order_exists then
      update public.orders set
        offer_id = v_offer_id,
        listing_id = l.id,
        item_title = l.title,
        buyer_id = p_actor_id,
        seller_id = l.seller_id,
        amount_ngn = l.price_ngn,
        buyer_fee_ngn = ceil(l.price_ngn * 0.02)::integer,
        seller_fee_ngn = ceil(l.price_ngn * 0.05)::integer,
        buyer_total_ngn = l.price_ngn + ceil(l.price_ngn * 0.02)::integer,
        seller_payout_ngn = l.price_ngn - ceil(l.price_ngn * 0.05)::integer,
        status = 'terms_pending',
        buyer_terms_accepted_at = null,
        seller_terms_accepted_at = null,
        paystack_reference = null,
        paid_at = null,
        dispatched_at = null,
        delivered_at = null,
        payout_due_at = null,
        payout_paid_at = null,
        payout_reference = null,
        delivery_code_hash = null,
        delivery_code_attempts = 0,
        created_at = now()
      where id = existing_order.id;
    else
      insert into public.orders (conversation_id, offer_id, listing_id, item_title, buyer_id, seller_id, amount_ngn, buyer_fee_ngn, seller_fee_ngn, buyer_total_ngn, seller_payout_ngn)
      values (v_conversation_id, v_offer_id, l.id, l.title, p_actor_id, l.seller_id, l.price_ngn, ceil(l.price_ngn * 0.02)::integer, ceil(l.price_ngn * 0.05)::integer, l.price_ngn + ceil(l.price_ngn * 0.02)::integer, l.price_ngn - ceil(l.price_ngn * 0.05)::integer);
    end if;

    update public.listings set status = 'sold', sold_at = now() where id = l.id;
    return v_conversation_id;
  end if;

  if l.status <> 'active' or l.expires_at <= now() then raise exception 'Listing is no longer available'; end if;
  if l.negotiable then raise exception 'Send an offer for this negotiable listing'; end if;
  if l.seller_id = p_actor_id then raise exception 'You cannot buy your own listing'; end if;

  insert into public.offers (listing_id, listing_title_snapshot, listing_seller_id, buyer_id, amount_ngn, status, responded_at)
  values (l.id, l.title, l.seller_id, p_actor_id, l.price_ngn, 'accepted', now()) returning id into v_offer_id;
  update public.listings set status = 'sold', sold_at = now() where id = l.id;
  insert into public.conversations (offer_id, listing_id, listing_title_snapshot, buyer_id, seller_id)
  values (v_offer_id, l.id, l.title, p_actor_id, l.seller_id) returning id into v_conversation_id;
  insert into public.orders (conversation_id, offer_id, listing_id, item_title, buyer_id, seller_id, amount_ngn, buyer_fee_ngn, seller_fee_ngn, buyer_total_ngn, seller_payout_ngn)
  values (v_conversation_id, v_offer_id, l.id, l.title, p_actor_id, l.seller_id, l.price_ngn, ceil(l.price_ngn * 0.02)::integer, ceil(l.price_ngn * 0.05)::integer, l.price_ngn + ceil(l.price_ngn * 0.02)::integer, l.price_ngn - ceil(l.price_ngn * 0.05)::integer);
  return v_conversation_id;
end;
$$;

create or replace function public.accept_offer(p_offer_id uuid, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.offers%rowtype;
  l public.listings%rowtype;
  existing_order public.orders%rowtype;
  v_conversation_id uuid;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.status <> 'pending' then raise exception 'Offer is not available'; end if;
  select * into l from public.listings where id = o.listing_id for update;
  if l.seller_id <> p_actor_id then raise exception 'Only the listing seller can accept this offer'; end if;
  if l.status <> 'active' or l.expires_at <= now() then raise exception 'Listing is no longer available'; end if;

  update public.offers set status = 'accepted', responded_at = now() where id = o.id;
  update public.listings set status = 'sold', sold_at = now() where id = l.id;
  insert into public.conversations (offer_id, listing_id, listing_title_snapshot, buyer_id, seller_id, buyer_offer_attempts)
  values (o.id, l.id, l.title, o.buyer_id, l.seller_id, least(3, (select count(*) from public.offers where listing_id = l.id and buyer_id = o.buyer_id))::smallint)
  on conflict (listing_id, buyer_id) do update set offer_id = excluded.offer_id, listing_title_snapshot = excluded.listing_title_snapshot
  returning id into v_conversation_id;

  select * into existing_order from public.orders where conversation_id = v_conversation_id for update;
  if found and existing_order.status = 'cancelled' then
    update public.orders set
      offer_id = o.id,
      listing_id = l.id,
      item_title = l.title,
      buyer_id = o.buyer_id,
      seller_id = l.seller_id,
      amount_ngn = o.amount_ngn,
      buyer_fee_ngn = ceil(o.amount_ngn * 0.02)::integer,
      seller_fee_ngn = ceil(o.amount_ngn * 0.05)::integer,
      buyer_total_ngn = o.amount_ngn + ceil(o.amount_ngn * 0.02)::integer,
      seller_payout_ngn = o.amount_ngn - ceil(o.amount_ngn * 0.05)::integer,
      status = 'terms_pending',
      buyer_terms_accepted_at = null,
      seller_terms_accepted_at = null,
      paystack_reference = null,
      paid_at = null,
      dispatched_at = null,
      delivered_at = null,
      payout_due_at = null,
      payout_paid_at = null,
      payout_reference = null,
      delivery_code_hash = null,
      delivery_code_attempts = 0,
      created_at = now()
    where id = existing_order.id;
  elsif not found then
    insert into public.orders (conversation_id, offer_id, listing_id, item_title, buyer_id, seller_id, amount_ngn, buyer_fee_ngn, seller_fee_ngn, buyer_total_ngn, seller_payout_ngn)
    values (v_conversation_id, o.id, l.id, l.title, o.buyer_id, l.seller_id, o.amount_ngn, ceil(o.amount_ngn * 0.02)::integer, ceil(o.amount_ngn * 0.05)::integer, o.amount_ngn + ceil(o.amount_ngn * 0.02)::integer, o.amount_ngn - ceil(o.amount_ngn * 0.05)::integer)
    on conflict (conversation_id) do nothing;
  end if;
  return v_conversation_id;
end;
$$;

revoke execute on function public.submit_listing_offer(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.submit_listing_offer(uuid, uuid, integer, text) to service_role;
revoke execute on function public.start_fixed_price_purchase(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_fixed_price_purchase(uuid, uuid) to service_role;
revoke execute on function public.accept_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_offer(uuid, uuid) to service_role;