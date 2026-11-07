alter table public.email_marketing_preferences
  add column if not exists lifecycle_emails_enabled boolean not null default false;

update public.email_marketing_preferences
set lifecycle_emails_enabled = true
where is_subscribed = true;

alter table public.email_outbox
  add column if not exists requires_lifecycle_consent boolean not null default false;

create or replace function public.create_dclutr_account_with_marketing(
  p_user_id uuid,
  p_display_name text,
  p_email text,
  p_password_hash text,
  p_marketing_consent boolean,
  p_price_alert_consent boolean
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

  if p_marketing_consent or p_price_alert_consent then
    insert into public.email_marketing_preferences (
      user_id,
      is_subscribed,
      consented_at,
      last_lifecycle_week,
      lifecycle_emails_enabled,
      price_alerts_enabled,
      price_alerts_since
    )
    values (
      p_user_id,
      true,
      now(),
      0,
      p_marketing_consent,
      p_price_alert_consent,
      case when p_price_alert_consent then now() else null end
    );
  end if;

  return p_user_id;
end;
$$;

revoke execute on function public.create_dclutr_account_with_marketing(uuid, text, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.create_dclutr_account_with_marketing(uuid, text, text, text, boolean, boolean) to service_role;
