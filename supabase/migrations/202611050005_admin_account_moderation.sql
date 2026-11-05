alter table public.profiles
  add column if not exists account_banned boolean not null default false,
  add column if not exists account_banned_at timestamptz,
  add column if not exists posting_restricted boolean not null default false,
  add column if not exists posting_restricted_at timestamptz,
  add column if not exists account_deleted boolean not null default false,
  add column if not exists account_deleted_at timestamptz,
  add column if not exists account_moderation_note text;

create index if not exists profiles_moderation_idx
  on public.profiles(account_banned, posting_restricted, account_deleted);

create table if not exists public.admin_account_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  subject_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.admin_account_audit enable row level security;
revoke all on public.admin_account_audit from public, anon, authenticated;

create or replace function public.admin_anonymize_student_account(p_target_user_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target public.profiles%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Admin access required';
  end if;

  select * into target from public.profiles where id = p_target_user_id for update;
  if not found or target.role <> 'student' then raise exception 'Student account not found'; end if;
  if target.account_deleted then raise exception 'This account has already been deleted'; end if;

  delete from public.email_outbox where lower(recipient) = lower(target.email);
  delete from public.notifications where user_id = target.id;
  delete from public.verification_submissions where user_id = target.id;
  delete from public.seller_payout_profiles where user_id = target.id;
  delete from public.favorites where user_id = target.id;
  delete from public.messages where sender_id = target.id;

  update public.offers
  set note = null
  where buyer_id = target.id or listing_seller_id = target.id;

  delete from public.listings where seller_id = target.id;
  delete from public.app_accounts where user_id = target.id;

  update public.profiles set
    display_name = 'Deleted student',
    email = 'deleted-' || target.id::text || '@deleted.invalid',
    verification_status = 'not_submitted',
    account_banned = true,
    account_banned_at = now(),
    posting_restricted = true,
    posting_restricted_at = now(),
    account_deleted = true,
    account_deleted_at = now(),
    account_moderation_note = null
  where id = target.id;
end;
$$;

revoke execute on function public.admin_anonymize_student_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_anonymize_student_account(uuid, uuid) to service_role;