create or replace function public.cancel_unpaid_order(p_order_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or p_actor_id not in (o.buyer_id, o.seller_id) then raise exception 'Order not found'; end if;
  if o.status not in ('terms_pending', 'awaiting_payment') then raise exception 'Payment is confirmed or this order can no longer be cancelled. Contact D_clutr support for help.'; end if;
  update public.orders set status = 'cancelled' where id = o.id;
  update public.offers set status = 'withdrawn', responded_at = now() where id = o.offer_id;
  update public.listings set status = 'active', sold_at = null where id = o.listing_id and status = 'sold' and expires_at > now();
end;
$$;

revoke execute on function public.cancel_unpaid_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_unpaid_order(uuid, uuid) to service_role;