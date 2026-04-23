-- =====================================================================
-- MockMob — Row Level Security
-- The server uses the service_role key (bypasses RLS entirely).
-- These policies only gate anon/authenticated (browser) access.
-- =====================================================================

alter table public.users     enable row level security;
alter table public.questions enable row level security;
alter table public.attempts  enable row level security;

-- ---- USERS ----
-- No anon access to users table (contains email). Server-only reads.
-- (no policies = deny all for anon/authenticated roles)

-- ---- QUESTIONS ----
-- Anyone can read LIVE questions (public question bank).
drop policy if exists "anon read live questions" on public.questions;
create policy "anon read live questions"
  on public.questions
  for select
  to anon, authenticated
  using (status = 'live');

-- ---- ATTEMPTS ----
-- No anon access. Server aggregates everything.
-- (leaderboard joins users+attempts and returns a denormalized view)
