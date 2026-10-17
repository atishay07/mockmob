-- MockMob: Revise cards get a `mode` (LEARN-REVIEW-1017 5.8 and packet P-LR0). Revise becomes one queue over four sources; the
-- second source, "Review again" (a repaired mistake answered before the key shows), becomes a state of the same row instead of
-- a phone-only list (flutter_app features/review/again/review_again_local.dart), so the website and the app read one
-- schedule and the key (user_id, question_id) itself forbids a duplicate: a question is one card, whichever mode.
--   mode  text  'question'  the question comes back as a wrong answer (the existing behaviour, and the default)
--                'again'     the question was repaired; it comes back with the key hidden
-- Additive and idempotent: one column with a default, one check. No existing row changes (every card reads 'question').
-- Code ships first and feature-detects the column (src/lib/server/review.js reads without it when it is missing and treats every
-- card as 'question'), so applying this is safe at any time after the code. Service-role only: the table already has RLS and no
-- policies. NOT APPLIED to production by this change; production needs its own save, dry run and the owner's grant.
-- Undo: supabase/undo/20261017160000_revise_cards_mode.undo.sql
--
-- Dry run and staging apply: see the evidence block at the end of this file.

alter table public.revise_cards add column if not exists mode text not null default 'question';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'revise_cards_mode_check' and conrelid = 'public.revise_cards'::regclass) then
    alter table public.revise_cards add constraint revise_cards_mode_check check (mode in ('question', 'again'));
  end if;
end
$$;

-- Evidence, 17 Oct 2026, STAGING only (onwkqxmjqjrhfbjjdydu "mockmob-question-factory-staging", Postgres 17), revise_cards held 105 rows, all kept:
--   Dry run (one transaction, ended by a RAISE so everything rolled back): the migration run twice gave exactly 1 `mode` column and
--   1 check, no error on the second run; rows 105 before and 105 after, all 105 read 'question'; an insert with mode 'bogus' was
--   rejected by revise_cards_mode_check; the undo file then removed the column and the check (0 and 0), rows still 105.
--   Applied through the migration tool as "revise_cards_mode" (recorded by the tool with its own UTC version); afterwards the
--   column exists, 105 rows all 'question', check = (mode = ANY (ARRAY['question','again'])), RLS on, no policies (service role only).
--   Staging is LEFT MIGRATED. Production is NOT migrated; the code feature-detects the column, so it works before and after.
