-- Undo for supabase/migrations/20261015210100_revise_cards.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself.
-- DESTRUCTIVE for the cards: it drops each student's Revise schedule (which question is in which box, and when it is due).
-- The questions themselves are untouched, and cards are seeded again from user_question_progress the next time a student
-- opens Revise (their newest 200 wrong answers), but the box a card had reached is lost, so every card starts again in
-- box 1. While the table is missing, GET /api/me/revise answers state 'unavailable' and every surface hides itself.
drop table if exists public.revise_cards;
