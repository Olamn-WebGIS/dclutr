create table public.email_marketing_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_subscribed boolean not null default false,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  last_lifecycle_week integer not null default 0 check (last_lifecycle_week >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_subscribed or consented_at is not null)
);

create index email_marketing_subscribed_idx
  on public.email_marketing_preferences(user_id)
  where is_subscribed = true;

alter table public.email_outbox add column unsubscribe_url text;
comment on column public.email_outbox.unsubscribe_url is 'Encrypted with ACCOUNT_ENCRYPTION_KEY when present.';

alter table public.email_marketing_preferences enable row level security;
revoke all on public.email_marketing_preferences from anon, authenticated;

create or replace function public.create_dclutr_account_with_marketing(
  p_user_id uuid,
  p_display_name text,
  p_email text,
  p_password_hash text,
  p_marketing_consent boolean
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if char_length(p_display_name) not between 2 and 80 or char_length(p_password_hash) > 250 then
    raise exception 'Invalid account details';
  end if;

  insert into public.profiles (id, display_name, email)
  values (p_user_id, p_display_name, lower(p_email));
  insert into public.app_accounts (user_id, password_hash)
  values (p_user_id, p_password_hash);

  if p_marketing_consent then
    insert into public.email_marketing_preferences (user_id, is_subscribed, consented_at, last_lifecycle_week)
    values (p_user_id, true, now(), 0);
  end if;

  return p_user_id;
end;
$$;

revoke execute on function public.create_dclutr_account_with_marketing(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_dclutr_account_with_marketing(uuid, text, text, text, boolean) to service_role;
