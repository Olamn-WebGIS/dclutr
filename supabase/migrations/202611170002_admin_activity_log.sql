create table public.admin_activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  actor_name text not null,
  actor_email text not null,
  action text not null,
  subject_user_id uuid,
  subject_name text,
  subject_email text,
  details text,
  created_at timestamptz not null default now()
);

create index admin_activity_log_created_at_idx
  on public.admin_activity_log(created_at desc);

alter table public.admin_activity_log enable row level security;
revoke all on public.admin_activity_log from public, anon, authenticated;
grant all on public.admin_activity_log to service_role;

insert into public.admin_activity_log (
  actor_id, actor_name, actor_email, action, subject_user_id, subject_name, subject_email, created_at
)
select
  audit.admin_id,
  actor.display_name,
  actor.email,
  audit.action,
  audit.subject_user_id,
  subject.display_name,
  subject.email,
  audit.created_at
from public.admin_account_audit audit
join public.profiles actor on actor.id = audit.admin_id
left join public.profiles subject on subject.id = audit.subject_user_id;
