create table public.push_subscriptions (
  endpoint_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  encrypted_subscription text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant all on public.push_subscriptions to service_role;
