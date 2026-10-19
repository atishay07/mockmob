-- Undo for supabase/migrations/20261020110000_study_goal_daily_minutes.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Drops the daily-minutes column and its check. Dropping it discards the daily goals students saved on the account; the code
-- keeps working (it feature-detects the column: the plan falls back to the usual length and the app keeps its own copy on the
-- phone). Nothing else on study_goals changes.
alter table public.study_goals drop constraint if exists study_goals_daily_minutes_range;
alter table public.study_goals drop column if exists daily_minutes;
