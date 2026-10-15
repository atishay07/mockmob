-- Privacy-safe landing funnel (src/app/api/funnel/route.js, src/lib/funnel.js).
-- AGGREGATE daily counters only: one row per (day, step) holding a number. There is no user id, no
-- session id, no IP, no user agent, no cookie and no timestamp finer than the day, so nothing in this
-- table can be tied to a person, a child or an unknown age. The day is the India calendar day and is
-- taken by the database, never by the caller. The step list is enforced here as well as in the route.
-- Service role only. Not applied to any remote database by this change. Undo: supabase/undo/20261015233000_funnel_daily.undo.sql
create table if not exists public.funnel_daily (
  day date not null,
  step text not null check (step in (
    'landing_view', 'sample_subject_chosen', 'sample_started', 'sample_done',
    'signup_click', 'signup_complete', 'login_click'
  )),
  count int not null default 0 check (count >= 0),
  primary key (day, step)
);

-- Atomic increment: one statement, so two visitors at the same moment both count. The count stops at
-- 2,000,000,000 rather than overflowing. An unknown step violates the check above and raises.
create or replace function public.funnel_increment(p_step text)
returns void language sql security invoker set search_path = public as $$
  insert into public.funnel_daily (day, step, count)
  values ((now() at time zone 'Asia/Kolkata')::date, p_step, 1)
  on conflict (day, step) do update
    set count = least(public.funnel_daily.count + 1, 2000000000);
$$;

alter table public.funnel_daily enable row level security;
revoke all on public.funnel_daily from public, anon, authenticated;
grant all on public.funnel_daily to service_role;
revoke all on function public.funnel_increment(text) from public, anon, authenticated;
grant execute on function public.funnel_increment(text) to service_role;
