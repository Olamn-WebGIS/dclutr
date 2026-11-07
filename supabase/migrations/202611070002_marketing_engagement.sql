alter table public.email_marketing_preferences
  add column if not exists saved_categories text[] not null default '{}',
  add column if not exists category_alerts_enabled boolean not null default false,
  add column if not exists category_alerts_since timestamptz,
  add column if not exists last_category_digest_at timestamptz,
  add column if not exists last_lifecycle_sent_at timestamptz,
  add column if not exists last_engaged_at timestamptz,
  add column if not exists unengaged_reminder_streak integer not null default 0
    check (unengaged_reminder_streak between 0 and 100);

alter table public.email_outbox
  add column if not exists requires_category_alert_consent boolean not null default false;

create table public.marketplace_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'market_visit', 'listing_view', 'listing_created', 'first_conversation',
    'order_completed', 'email_click'
  )),
  entity_id uuid,
  campaign text,
  dedupe_key text not null unique,
  occurred_at timestamptz not null default now()
);

create index marketplace_analytics_events_date_idx
  on public.marketplace_analytics_events(occurred_at desc, event_type);
create index marketplace_analytics_events_user_date_idx
  on public.marketplace_analytics_events(user_id, occurred_at desc)
  where user_id is not null;

alter table public.marketplace_analytics_events enable row level security;
revoke all on public.marketplace_analytics_events from anon, authenticated;
grant all on public.marketplace_analytics_events to service_role;
grant all on public.email_marketing_preferences to service_role;

create or replace function public.admin_marketplace_analytics(p_since timestamptz)
returns table (
  day date,
  visits bigint,
  listing_views bigint,
  listings bigint,
  first_conversations bigint,
  completed_orders bigint,
  email_clicks bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    (e.occurred_at at time zone 'UTC')::date as day,
    count(*) filter (where e.event_type = 'market_visit') as visits,
    count(*) filter (where e.event_type = 'listing_view') as listing_views,
    count(*) filter (where e.event_type = 'listing_created') as listings,
    count(*) filter (where e.event_type = 'first_conversation') as first_conversations,
    count(*) filter (where e.event_type = 'order_completed') as completed_orders,
    count(*) filter (where e.event_type = 'email_click') as email_clicks
  from public.marketplace_analytics_events e
  where e.occurred_at >= p_since
  group by 1
  order by 1 desc
$$;

create or replace function public.cleanup_marketplace_analytics()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  delete from public.marketplace_analytics_events where occurred_at < now() - interval '90 days';
  get diagnostics affected = row_count;
  update public.email_marketing_preferences
  set last_engaged_at = null, updated_at = now()
  where last_engaged_at < now() - interval '90 days';
  return affected;
end;
$$;

revoke execute on function public.admin_marketplace_analytics(timestamptz) from public, anon, authenticated;
revoke execute on function public.cleanup_marketplace_analytics() from public, anon, authenticated;
grant execute on function public.admin_marketplace_analytics(timestamptz) to service_role;
grant execute on function public.cleanup_marketplace_analytics() to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('dclutr-cleanup-marketplace-analytics', '45 2 * * *', 'select public.cleanup_marketplace_analytics()');
exception when others then
  raise notice 'Enable pg_cron and schedule public.cleanup_marketplace_analytics() daily if unavailable here: %', sqlerrm;
end $$;
