-- MockMob app: notification preferences, push devices, weekly goal and account deletion requests.
-- Additive and idempotent. Service-role only: RLS is enabled with no anon/authenticated policies.
-- users.id is text in this schema, so user_id columns are text.

create table if not exists public.notification_prefs (
  user_id text primary key references public.users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  quiet_start time not null default '23:00',
  quiet_end time not null default '07:00',
  channels jsonb not null default '{"check_due":true,"weekly_plan":true,"study_window":false,"result_ready":true}'::jsonb,
  study_window jsonb,
  weekly_cap smallint not null default 5 check (weekly_cap between 0 and 14),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_devices (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android')),
  token text not null unique,
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists push_devices_user_idx on public.push_devices (user_id) where revoked_at is null;

create table if not exists public.study_goals (
  user_id text primary key references public.users(id) on delete cascade,
  days_per_week smallint not null default 4 check (days_per_week between 1 and 7),
  timezone text not null default 'Asia/Kolkata',
  paused_until date,
  updated_at timestamptz not null default now()
);

-- Operator-processed: a script must read pending rows, delete the account and study records,
-- then mark the row completed. Nothing hard-deletes in the request route.
create table if not exists public.account_deletion_requests (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  source text not null default 'android' check (source in ('android','web')),
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  completed_at timestamptz
);
create unique index if not exists account_deletion_one_pending_idx on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.notification_prefs enable row level security;
alter table public.push_devices enable row level security;
alter table public.study_goals enable row level security;
alter table public.account_deletion_requests enable row level security;

revoke all on public.notification_prefs, public.push_devices, public.study_goals, public.account_deletion_requests from public, anon, authenticated;
grant all on public.notification_prefs, public.push_devices, public.study_goals, public.account_deletion_requests to service_role;
grant usage, select on sequence public.push_devices_id_seq, public.account_deletion_requests_id_seq to service_role;
