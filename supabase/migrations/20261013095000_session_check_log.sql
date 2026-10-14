-- B13: per-answer practice check log. A checked answer is final.
-- session_id is a recovery_sessions id or a sealed-ticket practice id (ticket sessions have no row),
-- so it is deliberately not a foreign key. Service-role access only. Not applied to any remote database.
create table if not exists public.session_check_log (
  session_id text not null check (length(session_id) between 1 and 100),
  qid text not null check (length(qid) between 1 and 100),
  user_id text not null references public.users(id) on delete cascade,
  answer smallint not null check (answer between 0 and 9),
  checked_at timestamptz not null default now(),
  primary key (session_id, qid)
);
create index if not exists session_check_log_user_idx on public.session_check_log (user_id, checked_at desc);
alter table public.session_check_log enable row level security;
revoke all on public.session_check_log from public, anon, authenticated;
grant all on public.session_check_log to service_role;
