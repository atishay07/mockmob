-- Play policy: a student can report an AI reply from the app. One row per report.
-- Written by the server with the service role only. No browser role can read or write it,
-- so a student's own report is inserted by the server on their behalf and nobody reads it from a client.
-- dedupe_key makes a retried or repeated report of the same reply one row (unique per student).
-- Additive and idempotent. Not applied to any remote database.
create table if not exists public.ai_reply_reports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  reason text not null check (length(reason) between 1 and 120),
  reply_excerpt text not null check (length(reply_excerpt) between 1 and 1200),
  session_id text check (session_id is null or length(session_id) between 1 and 100),
  request_id text check (request_id is null or length(request_id) between 1 and 100),
  dedupe_key text check (dedupe_key is null or length(dedupe_key) between 8 and 200),
  created_at timestamptz not null default now(),
  constraint ai_reply_reports_user_dedupe_key unique (user_id, dedupe_key)
);
create index if not exists ai_reply_reports_created_at_idx on public.ai_reply_reports (created_at desc);
create index if not exists ai_reply_reports_user_idx on public.ai_reply_reports (user_id, created_at desc);
alter table public.ai_reply_reports enable row level security;
revoke all on public.ai_reply_reports from public, anon, authenticated;
grant all on public.ai_reply_reports to service_role;
