-- Undo for supabase/migrations/20261017160000_revise_cards_mode.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Drops the `mode` column and its check. Dropping it loses which cards were "Review again" cards: every card is a plain
-- question card again (it keeps its box and its due day, so nothing already scheduled moves). The code keeps working: it
-- feature-detects the column and reads every card as 'question'. Nothing else on revise_cards changes.
alter table public.revise_cards drop constraint if exists revise_cards_mode_check;
alter table public.revise_cards drop column if exists mode;
