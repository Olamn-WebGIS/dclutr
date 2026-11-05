alter table public.conversations
  add column if not exists buyer_last_read_at timestamptz,
  add column if not exists seller_last_read_at timestamptz;

create or replace function public.header_activity_counts(p_user_id uuid)
returns table (unread_messages integer, pending_offers integer, checkout_orders integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    (
      select count(*)::integer
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.expires_at > now()
        and m.sender_id <> p_user_id
        and (
          (c.buyer_id = p_user_id and m.created_at > coalesce(c.buyer_last_read_at, c.created_at))
          or (c.seller_id = p_user_id and m.created_at > coalesce(c.seller_last_read_at, c.created_at))
        )
    ),
    (
      select count(*)::integer
      from public.offers o
      where o.status = 'pending'
        and (o.buyer_id = p_user_id or o.listing_seller_id = p_user_id)
    ),
    (
      select count(*)::integer
      from public.orders o
      join public.listings l on l.id = o.listing_id
      where o.buyer_id = p_user_id
        and o.status = 'awaiting_payment'
        and l.status = 'active'
    );
$$;

revoke execute on function public.header_activity_counts(uuid) from public, anon, authenticated;
grant execute on function public.header_activity_counts(uuid) to service_role;
