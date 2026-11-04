with ranked_pending as (
  select id, row_number() over (
    partition by listing_id, buyer_id
    order by created_at desc, id desc
  ) as offer_position
  from public.offers
  where status = 'pending' and listing_id is not null
)
update public.offers o
set status = 'withdrawn', responded_at = coalesce(o.responded_at, now())
from ranked_pending rp
where o.id = rp.id and rp.offer_position > 1;

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
    select 1 from public.offers
    where listing_id = p_listing_id and buyer_id = p_actor_id
      and status in ('accepted', 'rejected')
  ) then
    raise exception 'This offer has already been accepted or declined and can no longer be changed';
  end if;

  select * into existing_offer
  from public.offers
  where listing_id = p_listing_id and buyer_id = p_actor_id
  order by created_at desc
  limit 1
  for update;

  if found then
    if existing_offer.status <> 'pending' then
      raise exception 'You already made an offer on this item and it can no longer be changed';
    end if;
    update public.offers
    set amount_ngn = p_amount_ngn, note = nullif(btrim(p_note), '')
    where id = existing_offer.id;
    return query select existing_offer.id, true;
    return;
  end if;

  insert into public.offers (listing_id, listing_title_snapshot, listing_seller_id, buyer_id, amount_ngn, note)
  values (l.id, l.title, l.seller_id, p_actor_id, p_amount_ngn, nullif(btrim(p_note), ''))
  returning id into offer_id;
  return query select offer_id, false;
end;
$$;

revoke execute on function public.submit_listing_offer(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.submit_listing_offer(uuid, uuid, integer, text) to service_role;