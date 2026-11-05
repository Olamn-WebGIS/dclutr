create or replace function public.conversation_unread_counts(p_user_id uuid)
returns table (conversation_id uuid, unread_count integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, count(m.id)::integer
  from public.conversations c
  left join public.messages m
    on m.conversation_id = c.id
    and m.expires_at > now()
    and m.sender_id <> p_user_id
    and (
      (c.buyer_id = p_user_id and m.created_at > coalesce(c.buyer_last_read_at, c.created_at))
      or (c.seller_id = p_user_id and m.created_at > coalesce(c.seller_last_read_at, c.created_at))
    )
  where c.buyer_id = p_user_id or c.seller_id = p_user_id
  group by c.id;
$$;

revoke execute on function public.conversation_unread_counts(uuid) from public, anon, authenticated;
grant execute on function public.conversation_unread_counts(uuid) to service_role;