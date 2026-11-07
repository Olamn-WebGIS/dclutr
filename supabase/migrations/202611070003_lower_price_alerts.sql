alter table public.email_marketing_preferences
  add column if not exists price_alerts_enabled boolean not null default false,
  add column if not exists price_alerts_since timestamptz,
  add column if not exists last_price_alert_at timestamptz;

alter table public.email_outbox
  add column if not exists requires_price_alert_consent boolean not null default false;

create table public.email_price_alert_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_listing_id uuid not null,
  search_term text not null check (char_length(search_term) between 2 and 100),
  category text not null,
  reference_price_ngn integer not null check (reference_price_ngn > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_listing_id, search_term)
);

create index email_price_alert_interests_recent_idx
  on public.email_price_alert_interests(created_at desc, category);
create index email_price_alert_interests_user_idx
  on public.email_price_alert_interests(user_id, created_at desc);

alter table public.email_price_alert_interests enable row level security;
revoke all on public.email_price_alert_interests from anon, authenticated;
grant all on public.email_price_alert_interests to service_role;

create or replace function public.cleanup_email_price_alert_interests()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  delete from public.email_price_alert_interests where created_at < now() - interval '30 days';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.cleanup_email_price_alert_interests() from public, anon, authenticated;
grant execute on function public.cleanup_email_price_alert_interests() to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('dclutr-cleanup-price-alert-interests', '50 2 * * *', 'select public.cleanup_email_price_alert_interests()');
exception when others then
  raise notice 'Enable pg_cron and schedule public.cleanup_email_price_alert_interests() daily if unavailable here: %', sqlerrm;
end $$;
