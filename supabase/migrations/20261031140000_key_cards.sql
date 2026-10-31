-- Key cards and chapter state (KEYCARDS-BUILD-SPEC.md 2b, owner decisions D200-D206, 31 Oct 2026).
-- Four new tables; nothing existing changes. The card content is NOT here: decks are files bundled with the site
-- (data/keycards/decks/<subject>.json), so the database holds only each student's schedule, reviews, reports and options.
-- Security: RLS on and no policy for anon or authenticated (service role only, like the study tables); every write goes
-- through the Key cards routes (src/lib/server/keycards.js). All four are in the account deletion steps
-- (src/lib/server/accountDeletion.js). Additive and idempotent (if not exists).
-- Additions to the spec's shape (code review 31 Oct, CODE-REVIEW-2026-10-31.md M1, M2, L1):
--   key_card_reviews.client_key: the raw clientReviewedAt the client sent (its outbox key), with a unique index per
--     (user, card, key). The clamped time stays in client_reviewed_at for scheduling only; a clamped value moves on every
--     request (a future clock clamps to now, an old one to 48 h ago), so it could not be the replay key.
--   key_card_review(): one rating in one transaction (the replay check, the review row, the state move guarded by the
--     expected reps, and the Free allowance claims), called only by POST /api/keycards/review with the service role.
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
  client_key text check (client_key is null or char_length(client_key) <= 100),
  scheduled_days real,
  elapsed_days real
);
create index if not exists key_card_reviews_recent on public.key_card_reviews (user_id, reviewed_at desc);
create unique index if not exists key_card_reviews_replay on public.key_card_reviews (user_id, card_id, client_key)
  where client_key is not null;

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

-- One rating in one transaction. Returns { status }:
--   ok               the review row is in and the state moved (or was created at the first rating)
--   logged           p_move false (a last look, or a review older than the card's last one): the review row only
--   replay           this (user, card, client_key) is already in: nothing changed
--   conflict         the state is not at p_expected_reps (null = no row expected): nothing changed
--   suspended        the card is suspended for this student: nothing changed
--   keycard_reviews  Free: the day's reviews are used (p_review_limit); nothing changed
--   keycard_new      Free: the day's new cards are used (p_new_limit); nothing changed
-- Allowances are learning_allowances rows (kind, period `<IST day>:<slot>`), so the primary key is the lock and a race
-- cannot take a slot past the limit. p_state carries the computed schedule (schedule, reps, lapses, due_at, last_review_at)
-- and, for a first rating, the new row's subject, chapter_key, added_from and added_at.
create or replace function public.key_card_review(
  p_user_id text, p_card_id text, p_card_v int, p_rating int, p_mode text,
  p_client_key text, p_client_reviewed_at timestamptz, p_reviewed_at timestamptz,
  p_move boolean, p_expected_reps int, p_state jsonb, p_scheduled_days real, p_elapsed_days real,
  p_day text, p_review_limit int, p_new_limit int, p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review bigint;
  v_found boolean;
  v_reps int;
  v_suspended boolean;
  v_taken int;
  v_slot int;
  v_claimed boolean;
begin
  begin
    insert into public.key_card_reviews (user_id, card_id, card_v, rating, mode, reviewed_at, client_reviewed_at, client_key, scheduled_days, elapsed_days)
      values (p_user_id, p_card_id, p_card_v, p_rating, p_mode, coalesce(p_reviewed_at, now()), p_client_reviewed_at, p_client_key,
        case when p_move then p_scheduled_days end, case when p_move then p_elapsed_days end)
      on conflict (user_id, card_id, client_key) where client_key is not null do nothing
      returning id into v_review;
    if v_review is null then return jsonb_build_object('status', 'replay'); end if;
    if not coalesce(p_move, false) then return jsonb_build_object('status', 'logged'); end if;

    select s.reps, s.suspended into v_reps, v_suspended from public.key_card_states s
      where s.user_id = p_user_id and s.card_id = p_card_id for update;
    v_found := found;
    if v_found and v_suspended then raise exception 'suspended'; end if;
    if v_found <> (p_expected_reps is not null) or (v_found and v_reps <> p_expected_reps) then raise exception 'conflict'; end if;

    if p_review_limit is not null then
      select count(*) into v_taken from public.learning_allowances a
        where a.user_id = p_user_id and a.kind = 'keycard_review' and a.period like p_day || ':%';
      v_claimed := false;
      v_slot := v_taken + 1;
      while v_slot <= p_review_limit loop
        insert into public.learning_allowances (user_id, kind, period, reference)
          values (p_user_id, 'keycard_review', p_day || ':' || v_slot, left(coalesce(p_reference, p_card_id), 200))
          on conflict do nothing;
        if found then v_claimed := true; exit; end if;
        v_slot := v_slot + 1;
      end loop;
      if not v_claimed then raise exception 'keycard_reviews'; end if;
    end if;

    if p_new_limit is not null and (not v_found or v_reps = 0) then
      select count(*) into v_taken from public.learning_allowances a
        where a.user_id = p_user_id and a.kind = 'keycard_new' and a.period like p_day || ':%';
      v_claimed := false;
      v_slot := v_taken + 1;
      while v_slot <= p_new_limit loop
        insert into public.learning_allowances (user_id, kind, period, reference)
          values (p_user_id, 'keycard_new', p_day || ':' || v_slot, left(p_card_id, 200))
          on conflict do nothing;
        if found then v_claimed := true; exit; end if;
        v_slot := v_slot + 1;
      end loop;
      if not v_claimed then raise exception 'keycard_new'; end if;
    end if;

    if v_found then
      update public.key_card_states set
        schedule = p_state->'schedule', reps = (p_state->>'reps')::int, lapses = (p_state->>'lapses')::int,
        due_at = (p_state->>'due_at')::timestamptz, last_review_at = (p_state->>'last_review_at')::timestamptz, last_rating = p_rating
        where user_id = p_user_id and card_id = p_card_id and reps = p_expected_reps;
    else
      insert into public.key_card_states (user_id, card_id, subject, chapter_key, schedule, reps, lapses, due_at, last_review_at, last_rating, added_from, added_at, suspended)
        values (p_user_id, p_card_id, p_state->>'subject', p_state->>'chapter_key', p_state->'schedule', (p_state->>'reps')::int,
          (p_state->>'lapses')::int, (p_state->>'due_at')::timestamptz, (p_state->>'last_review_at')::timestamptz, p_rating,
          p_state->>'added_from', coalesce((p_state->>'added_at')::timestamptz, now()), false)
        on conflict (user_id, card_id) do nothing;
      if not found then raise exception 'conflict'; end if;
    end if;
  exception when raise_exception then
    -- Every change above is undone with the block: the review row, the claims and the state.
    if sqlerrm in ('suspended', 'conflict', 'keycard_reviews', 'keycard_new') then
      return jsonb_build_object('status', sqlerrm);
    end if;
    raise;
  end;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.key_card_review(text, text, int, int, text, text, timestamptz, timestamptz, boolean, int, jsonb, real, real, text, int, int, text) from public, anon, authenticated;
grant execute on function public.key_card_review(text, text, int, int, text, text, timestamptz, timestamptz, boolean, int, jsonb, real, real, text, int, int, text) to service_role;
