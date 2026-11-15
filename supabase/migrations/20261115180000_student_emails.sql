-- The welcome and day-2 emails (src/lib/email/*, 15 Nov 2026). Two small tables, service role only.
-- NOT applied to any remote database by this change. Until it is applied the code sends nothing (studentMailStore ready()).
-- Undo: supabase/undo/20261115180000_student_emails.undo.sql
--
-- email_sends: the "never twice" record, one row per student per email. The row is written (claimed) BEFORE the email is
--   handed to the provider, and the primary key refuses a second claim, so two cron runs, two servers or a retry can never
--   send the same email twice. A crash between the claim and the send leaves a claimed row without sent_at: that email is
--   then never sent (a missed email is preferred to a double one). failure holds a short reason code, never an address.
-- email_optouts: one row per student who used the unsubscribe link. Neither email is sent to them again. Sign-in codes are
--   not affected (they never read this table).
-- Neither table holds an email address. The users row is kept as a tombstone when an account is deleted, so the deletion
-- processor names both tables (src/lib/server/accountDeletion.js DELETION_STEPS).
create table if not exists public.email_sends (
  user_id text not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'day2')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure text check (failure is null or char_length(failure) <= 120),
  provider_id text check (provider_id is null or char_length(provider_id) <= 120),
  primary key (user_id, kind)
);

create table if not exists public.email_optouts (
  user_id text primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.email_sends enable row level security;
alter table public.email_optouts enable row level security;
revoke all on public.email_sends from public, anon, authenticated;
revoke all on public.email_optouts from public, anon, authenticated;
grant all on public.email_sends to service_role;
grant all on public.email_optouts to service_role;
