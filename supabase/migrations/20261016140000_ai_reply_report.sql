-- "Report this AI reply" (Google Play generative-AI policy): one row per report a student sends from the app.
-- Written only by the server (service role) in POST /api/ai/mentor/report, which first checks that the student
-- really received the reply. Row level security is on and no policy exists, and every browser role (public, anon,
-- authenticated) is stripped of all privileges, so no client can read or write it. Nothing existing is changed.
-- reason is one of four codes the server validates: wrong_about_record, wrong_about_subject, unsafe_or_unkind, other.
-- dedupe_key ('ai-report-<requestId>') makes a repeated or retried report of the same reply one row per student.
-- Rows are deleted with the student (on delete cascade), so account deletion needs no extra step.
-- Safe to run more than once. Run it BEFORE deploying the route. Undo: supabase/undo/20261016140000_ai_reply_report.undo.sql
--
-- Check after running (expect table_exists, rls_enabled, created_at_index, service_role_can_write true;
-- client_can_read and client_can_write false):
--   select to_regclass('public.ai_reply_reports') is not null as table_exists,
--     (select relrowsecurity from pg_class where oid = 'public.ai_reply_reports'::regclass) as rls_enabled,
--     exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'ai_reply_reports' and indexname = 'ai_reply_reports_created_at_idx') as created_at_index,
--     (has_table_privilege('anon', 'public.ai_reply_reports', 'select') or has_table_privilege('authenticated', 'public.ai_reply_reports', 'select')) as client_can_read,
--     (has_table_privilege('anon', 'public.ai_reply_reports', 'insert') or has_table_privilege('authenticated', 'public.ai_reply_reports', 'insert')) as client_can_write,
--     has_table_privilege('service_role', 'public.ai_reply_reports', 'insert') as service_role_can_write;
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
