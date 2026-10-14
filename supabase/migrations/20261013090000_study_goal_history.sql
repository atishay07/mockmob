-- MockMob app: goal history so past weeks keep the goal they were held to.
-- Additive and idempotent. Service-role only: RLS enabled with no anon/authenticated policies.
-- A row says: from effective_week (a Monday) onward the goal is days_per_week, until a later row.
-- Goals saved before this table existed are backfilled with a 2000-01-03 baseline ("always").

create table if not exists public.study_goal_history (
  user_id text not null references public.users(id) on delete cascade,
  effective_week date not null check (extract(isodow from effective_week) = 1),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  created_at timestamptz not null default now(),
  primary key (user_id, effective_week)
);

alter table public.study_goal_history enable row level security;
revoke all on public.study_goal_history from public, anon, authenticated;
grant all on public.study_goal_history to service_role;

insert into public.study_goal_history (user_id, effective_week, days_per_week)
select user_id, date '2000-01-03', days_per_week from public.study_goals
on conflict (user_id, effective_week) do nothing;
