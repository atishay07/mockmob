-- Key cards and chapter state (KEYCARDS-BUILD-SPEC.md 2b, owner decisions D200-D206, 31 Oct 2026).
-- Four new tables; nothing existing changes. The card content is NOT here: decks are files bundled with the site
-- (data/keycards/decks/<subject>.json), so the database holds only each student's schedule, reviews, reports and options.
-- Security: RLS on and no policy for anon or authenticated (service role only, like the study tables); every write goes
-- through the Key cards routes (src/lib/server/keycards.js). All four are in the account deletion steps
-- (src/lib/server/accountDeletion.js). Additive and idempotent (if not exists).
-- One addition to the spec's shape: a unique index on key_card_reviews (user_id, card_id, client_reviewed_at), the lock that
-- makes an outbox replay of the same review idempotent under a race (POST /api/keycards/review).
-- SAVED ONLY. Not applied anywhere by this change; production needs its own dry run (PGlite or a schema copy) and the
-- owner's grant. Undo: supabase/undo/20261031140000_key_cards.undo.sql

create table if not exists public.key_card_states (
  user_id text not null,
  card_id text not null,
  subject text not null,
  chapter_key text not null,
  schedule jsonb not null,
  reps int not null default 0,
  lapses int not null default 0,
  due_at timestamptz not null,
  last_review_at timestamptz,
  last_rating smallint,
  added_from text not null check (added_from in ('chapter', 'taste', 'mistake', 'manual')),
  added_at timestamptz not null default now(),
  suspended boolean not null default false,
  primary key (user_id, card_id)
);
create index if not exists key_card_states_due on public.key_card_states (user_id, due_at) where not suspended;

create table if not exists public.key_card_reviews (
  id bigint generated always as identity primary key,
  user_id text not null,
  card_id text not null,
  card_v int not null,
  rating smallint not null check (rating in (1, 3, 4)),
  mode text not null check (mode in ('revise', 'study', 'last_look')),
  reviewed_at timestamptz not null default now(),
  client_reviewed_at timestamptz,
  scheduled_days real,
  elapsed_days real
);
create index if not exists key_card_reviews_recent on public.key_card_reviews (user_id, reviewed_at desc);
create unique index if not exists key_card_reviews_replay on public.key_card_reviews (user_id, card_id, client_reviewed_at)
  where client_reviewed_at is not null;

create table if not exists public.key_card_reports (
  user_id text not null,
  card_id text not null,
  reason text not null check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index if not exists key_card_reports_card on public.key_card_reports (card_id);

create table if not exists public.student_subject_options (
  user_id text not null,
  subject text not null,
  option text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject)
);

alter table public.key_card_states enable row level security;
alter table public.key_card_reviews enable row level security;
alter table public.key_card_reports enable row level security;
alter table public.student_subject_options enable row level security;
revoke all on public.key_card_states, public.key_card_reviews, public.key_card_reports, public.student_subject_options from public, anon, authenticated;
grant all on public.key_card_states, public.key_card_reviews, public.key_card_reports, public.student_subject_options to service_role;
