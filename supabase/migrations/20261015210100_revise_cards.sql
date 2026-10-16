-- Mistake Lab slice 4: Revise cards (feature wave F1, rules unchanged; data/revise.js; spec tmp/mistake-lab-v4/SPEC.md 4.8
-- "Same mistakes later"). One row per student and question the student got wrong, scheduled in four boxes: back after 1,
-- 3, 7 and 21 days (box 1 to 4), counted in India days, at most 10 a day. Cards are seeded on the student's own read of
-- GET /api/me/revise from user_question_progress (last_correct false), at most the 200 newest, idempotent on
-- (user_id, question_id). Revise writes NO attempts row and nothing to user_question_progress, so it changes no accuracy
-- number, chapter number, SWOT line or Compass sample, and it spends no credits.
-- due_day and last_recalled_day are India calendar dates. key_hash is the hash of the key option's text when the card was
-- seeded (data/option_hash.js): a recall is not graded when the key has changed since. wrong_at is when the student got
-- the question wrong. state 'retired' is a card recalled right in box 4.
-- Service-role access only. NOT APPLIED to any remote database by this change. Undo: supabase/undo/20261015210100_revise_cards.undo.sql.
-- The account deletion processor deletes these rows (src/lib/server/accountDeletion.js DELETION_STEPS).
create table if not exists public.revise_cards (
  user_id text not null references public.users (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  box smallint not null default 1 check (box between 1 and 4),
  due_day date not null,
  state text not null default 'active' check (state in ('active', 'retired')),
  right_total integer not null default 0 check (right_total >= 0),
  last_recalled_day date,
  key_hash text,
  wrong_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists revise_cards_due_idx on public.revise_cards (user_id, state, due_day);

alter table public.revise_cards enable row level security;
revoke all on public.revise_cards from public, anon, authenticated;
grant all on public.revise_cards to service_role;
