-- Class leagues (16 Nov 2026): a whole class sits the Sunday Mock and, once its answers open, each member sees how many of the
-- class sat it, the class average and their own marks beside it. Never a name, a rank or a list of members.
-- NOT APPLIED to any remote database by this change. The owner applies it. Until it is applied AND CLASS_LEAGUES_ENABLED=true
-- is set, nothing reads these tables (every /api/class route answers 404 CLASS_OFF and no screen shows the feature).
-- Undo: supabase/undo/20261116150000_class_leagues.undo.sql
--
-- Two small tables, service role only: RLS on with no anon or authenticated policy, every read and write through /api/class
-- (src/lib/classLeague/). No function, no trigger, nothing that touches attempts: the class figure is computed on the server
-- from the Sunday Mock's own counted sittings (src/lib/classLeague/model.mjs), so there is no second scoring path in SQL.
--
-- class_leagues          one row per class: its name (shown to anyone with the code), its 6-character code, the subjects it
--                        follows (internal subject ids, from its creator's own subjects), who started it (so only they can
--                        close it) and when it closed. A closed class shows nothing and its code stops working.
-- class_league_members   one row per membership: joined_at and, once the student leaves (or the class closes), left_at.
--                        A row is never rewritten: rejoining adds a new row. A week's figure counts the members open at that
--                        Sunday's 11:05 PM (joined by then, not left by then), so a later join or leave cannot move a closed
--                        week's average. The partial unique index keeps a student in one class at a time.
--
-- Account deletion keeps the users row as a tombstone, so the foreign keys below do not fire for it: the deletion steps in
-- src/lib/server/accountDeletion.js must name class_league_members (delete, own user_id) and class_leagues (anonymise
-- created_by to null) before a member can be deleted, or the processor refuses with unclassified_user_data (fail closed).

create table if not exists public.class_leagues (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'),
  name text not null check (char_length(name) between 3 and 60),
  subjects text[] not null check (cardinality(subjects) between 1 and 6),
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint class_leagues_code_key unique (code)
);
create index if not exists class_leagues_creator_idx on public.class_leagues (created_by) where closed_at is null;

create table if not exists public.class_league_members (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.class_leagues(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  constraint class_league_members_left_after check (left_at is null or left_at >= joined_at)
);
-- One class at a time: at most one open membership per student (a second join is refused with 23505).
create unique index if not exists class_league_members_one_open on public.class_league_members (user_id) where left_at is null;
create index if not exists class_league_members_league_idx on public.class_league_members (league_id, joined_at);

alter table public.class_leagues enable row level security;
alter table public.class_league_members enable row level security;
revoke all on public.class_leagues, public.class_league_members from public, anon, authenticated;
grant all on public.class_leagues, public.class_league_members to service_role;
