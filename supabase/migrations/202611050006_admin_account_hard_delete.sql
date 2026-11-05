revoke execute on function public.admin_anonymize_student_account(uuid, uuid) from public, anon, authenticated, service_role;
drop function public.admin_anonymize_student_account(uuid, uuid);

create or replace function public.admin_delete_student_account(p_target_user_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target public.profiles%rowtype;
begin
  if p_target_user_id = p_actor_id then
    raise exception 'You cannot delete your own account';
  end if;

  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Admin access required';
  end if;

  select * into target from public.profiles where id = p_target_user_id for update;
  if not found or target.role <> 'student' then
    raise exception 'Student account not found';
  end if;

  delete from public.admin_account_audit
  where subject_user_id = target.id or admin_id = target.id;
  delete from public.email_outbox where lower(recipient) = lower(target.email);
  delete from public.disputes
  where opened_by = target.id
    or resolved_by = target.id
    or order_id in (select id from public.orders where buyer_id = target.id or seller_id = target.id);
  delete from public.orders where buyer_id = target.id or seller_id = target.id;
  delete from public.messages
  where sender_id = target.id
    or conversation_id in (
      select id from public.conversations where buyer_id = target.id or seller_id = target.id
    );
  delete from public.conversations where buyer_id = target.id or seller_id = target.id;
  delete from public.offers where buyer_id = target.id or listing_seller_id = target.id;
  delete from public.listings where seller_id = target.id;
  delete from public.verification_submissions where user_id = target.id or reviewed_by = target.id;
  delete from public.profiles where id = target.id;
end;
$$;

revoke execute on function public.admin_delete_student_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_student_account(uuid, uuid) to service_role;
