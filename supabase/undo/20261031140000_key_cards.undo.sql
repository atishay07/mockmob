-- Undo of supabase/migrations/20261031140000_key_cards.sql (Key cards and chapter state, 31 Oct 2026).
-- Drops the suspension view, the review function and the four Key cards tables and every row in them (schedules, reviews, reports, section choices). Nothing else
-- references them. Run only with the owner's grant; export the rows first if they should be kept.
drop view if exists public.key_card_suspended;
drop function if exists public.key_card_review(text, text, int, int, text, text, timestamptz, timestamptz, boolean, int, jsonb, real, real, text, int, int, text);
drop table if exists public.key_card_reviews;
drop table if exists public.key_card_states;
drop table if exists public.key_card_reports;
drop table if exists public.student_subject_options;
