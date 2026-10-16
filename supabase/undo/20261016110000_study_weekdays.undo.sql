-- Undo for supabase/migrations/20261016110000_study_weekdays.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Dropping the column loses each student's chosen study weekdays and nothing else: days_per_week, the
-- pause and the goal history are untouched. The API still answers (weekdays: null) only after the code
-- that reads the column is rolled back too, so undo the code first, then run this.
alter table public.study_goals drop constraint if exists study_goals_weekday_mask_range;
alter table public.study_goals drop column if exists weekday_mask;
